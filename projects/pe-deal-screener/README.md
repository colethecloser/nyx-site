# PE Deal Screener

A full-stack tool for screening acquisition targets the way a private-equity
deal team might do a first-pass sourcing screen: filter a list of candidate
companies on EBITDA margin, revenue growth, free cash flow conversion,
leverage capacity, and valuation multiple, then rank what's left with a
composite score.

> **Disclaimer:** every company, name, and financial figure in this project
> is fictional / illustrative. Nothing here represents a real, identifiable
> private company or its actual confidential financials. The scoring
> formula and "implied max EV" / "leverage capacity" figures are simplified,
> illustrative approximations for a portfolio demo — not investment advice
> and not a substitute for a real sources-and-uses or credit analysis.

## Tech stack

- **Frontend:** React + Vite, plain CSS
- **Backend:** Python, FastAPI, psycopg (sync driver, psycopg3)
- **Database:** PostgreSQL 16 (`pe_deal_screener` database)
- **Tests:** pytest, hand-computed unit tests for the metrics module

## Data model

Table `targets` (see `backend/db/schema.sql`), one row per candidate company,
all money in USD millions:

| column | meaning |
|---|---|
| `revenue_musd` | trailing revenue |
| `revenue_growth_pct` | YoY revenue growth % |
| `ebitda_musd` | trailing EBITDA |
| `ebitda_margin_pct` | EBITDA / revenue, stored explicitly |
| `net_debt_musd` | existing net debt at the target, pre-transaction |
| `capex_pct_revenue` | maintenance/growth capex as % of revenue |
| `fcf_musd` | free cash flow, stored explicitly (see derivation below) |
| `ask_ev_musd` | seller's asking enterprise value |

`fcf_musd` in the seed data is derived as:

```
capex        = revenue * capex_pct_revenue
cash_tax     = 21% * (ebitda - capex), floored at 0   # simplified flat-rate cash tax estimate
fcf          = ebitda - capex - cash_tax
```

27 fictional companies are seeded across 5 sectors (Software, Industrials,
Healthcare Services, Consumer/Retail, Business Services), deliberately
spanning a wide range of quality — some clearly strong targets (high growth,
high margin, cheap ask) and some clearly weak ones (thin margins, heavy
leverage, rich ask) — so that filtering and ranking produce a visibly
meaningful spread rather than everything clustering in the middle.

## Metric definitions (`backend/app/metrics.py`)

- **`ev_ebitda_multiple`** = `ask_ev_musd / ebitda_musd` — asking price as a
  multiple of EBITDA. Lower = cheaper.
- **`fcf_conversion`** = `fcf_musd / ebitda_musd` — fraction of EBITDA that
  converts to free cash flow.
- **`leverage_capacity_musd`** = `target_leverage_multiple * ebitda_musd -
  net_debt_musd` — additional debt capacity remaining after refinancing the
  target's existing net debt, assuming a lender would underwrite up to
  `target_leverage_multiple` (default 5.5x) of EBITDA in total debt. Can be
  negative if the company is already levered beyond that multiple.
- **`implied_max_ev_musd`** = `(target_leverage_multiple * ebitda_musd) +
  (assumed_equity_multiple * ebitda_musd)` — an illustrative "how much could
  a sponsor afford to pay" ceiling. It assumes the buyer funds the deal with
  a fixed leverage multiple of EBITDA in new debt (which refinances/replaces
  whatever net debt exists today — this is why `net_debt` does *not* reduce
  this figure; it's a sources-of-capital ceiling, not a specific net offer)
  plus a fixed equity check sized off EBITDA (`assumed_equity_multiple`,
  default 3.0x). This is a deliberately simplified, single-turn
  approximation for quick relative screening across a list of targets — not
  a real sources & uses build.
- **`screen_score`** — a composite 0-100 score, computed **relative to the
  full dataset** (min-max normalized across all seeded targets, not just the
  currently-filtered subset, so a target's score doesn't shift just because
  a filter hid some of its peers). Weighted blend:

  | signal | weight | direction |
  |---|---|---|
  | EBITDA margin | 30% | higher is better |
  | Revenue growth | 25% | higher is better |
  | FCF conversion | 25% | higher is better |
  | Valuation discount (`1 - normalized EV/EBITDA`) | 20% | cheaper multiple is better |

  Each signal is min-max normalized to `[0, 1]` across the dataset, combined
  with the weights above, then scaled to `0-100`. Weights are hand-picked to
  emphasize profitability and growth quality over sheer cheapness — this is
  a documented, adjustable choice, not a universal formula. If a signal has
  zero spread across the dataset (e.g. every target has the same margin),
  it's treated as exactly average (0.5) so it neither helps nor hurts.

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# apply schema + seed data (only needed once, or to reset)
export PGPASSWORD=postgres
psql -h localhost -U postgres -d pe_deal_screener -f db/schema.sql
psql -h localhost -U postgres -d pe_deal_screener -f db/seed.sql

# run tests
pytest tests/ -v

# run the API (defaults to DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pe_deal_screener)
uvicorn app.main:app --reload --port 8000
```

API endpoints:

- `GET /api/targets` — query params: `sector`, `min_ebitda_margin`,
  `min_revenue_growth`, `min_fcf_conversion`, `max_ev_ebitda_multiple`,
  `sort_by` (`score`|`multiple`|`growth`|`margin`|`revenue`|
  `fcf_conversion`|`leverage_capacity`), `order` (`asc`|`desc`), plus
  optional `target_leverage_multiple` / `assumed_equity_multiple` overrides.
- `GET /api/targets/{id}` — single target with full computed metrics.
- `GET /api/sectors` — distinct sector list for the filter dropdown.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # points VITE_API_URL at http://localhost:8000
npm run dev            # http://localhost:5173
```

Build for production with `npm run build`.

## Verification performed while building this

- `pytest` — 17 tests green, including hand-computed expected values for
  `ev_ebitda_multiple`, `fcf_conversion`, `leverage_capacity_musd`,
  `implied_max_ev_musd`, and an explicit invariant test that a
  strictly-better target (higher margin, higher growth, higher FCF
  conversion, lower entry multiple) always scores higher than a
  strictly-worse one.
- Backend started locally and exercised with `curl` against several
  filter/sort combinations (sector filter, margin/growth/multiple
  thresholds, each `sort_by` option) to confirm filtering, sorting, and
  scoring behave sensibly against the seeded data — e.g. the seeded "weak"
  targets (thin margin, heavy leverage, rich ask) consistently rank at the
  bottom and the seeded "strong" targets at the top.
- `npm run build` — production build succeeds.

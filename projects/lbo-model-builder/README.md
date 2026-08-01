# LBO Model Builder

A small full-stack app for building and saving simple leveraged buyout (LBO)
models: sources & uses, a year-by-year debt schedule with a cash-flow sweep,
and exit returns (MOIC / IRR).

**This is a standalone learning / portfolio project. It is illustrative only
and is not investment advice.**

## Tech stack

- **Frontend:** Next.js (App Router, JavaScript, no TypeScript)
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL (saved scenarios stored as JSONB)

## Running it locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Apply the schema to a local Postgres 16 instance (adjust connection info as needed)
psql postgresql://postgres:postgres@localhost:5432/lbo_model_builder -f db/schema.sql

# DATABASE_URL defaults to postgresql://postgres:postgres@localhost:5432/lbo_model_builder
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lbo_model_builder"
uvicorn app.main:app --reload --port 8000
```

Run the tests (includes a live-Postgres round-trip test, so Postgres must be
reachable at `DATABASE_URL`):

```bash
pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://localhost:3000 and talks to the API at
`process.env.NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`, see
`.env.local.example`).

## API

- `POST /api/lbo/run` — run the model, return the schedule/summary (no persistence).
- `POST /api/lbo/scenarios` — run the model and save `{name, inputs, outputs}` to Postgres.
- `GET /api/lbo/scenarios` — list saved scenarios (id, name, created_at, irr, moic).
- `GET /api/lbo/scenarios/{id}` — full saved scenario (inputs + outputs).
- `DELETE /api/lbo/scenarios/{id}`

## How the math works

1. **Sources & Uses.** Purchase enterprise value = entry EBITDA x entry
   multiple. Uses = purchase EV + transaction fees (% of EV). Sources = sum
   of debt tranches (sized either as a flat dollar amount or as a multiple
   of entry EBITDA) + sponsor equity, which is a plug: `equity = uses - debt`.

2. **Operating projection.** Revenue/EBITDA are grown each year of the hold
   period at a flat growth rate (or a per-year override list).

3. **Debt schedule with a cash-flow sweep.** Each year, for every tranche:
   - Interest expense = beginning balance x tranche rate.
   - Mandatory amortization = tranche amort % x *original* principal
     (capped at the remaining balance).
   - Unlevered FCF = EBITDA - capex - cash taxes - mandatory debt service
     (interest + mandatory amortization).
   - The configurable % of that FCF is swept to pay down the **most
     senior outstanding tranche first** (lowest `seniority` number), then
     the next, and so on -- a standard waterfall.
   - Any FCF not swept (or a shortfall, if FCF is negative) flows into an
     accumulated cash balance.

4. **Exit.** Exit enterprise value = final-year EBITDA x exit multiple.
   Exit equity value = exit EV - net debt (ending total debt minus
   accumulated cash).

5. **Returns.** MOIC = exit equity / entry (sponsor) equity. Since this is a
   single cash outflow at entry and a single inflow at exit, IRR is solved
   directly / via bisection from `entry_equity = exit_equity / (1+r)^years`.

## Notes / deviations

- Cash taxes are computed on a simplified taxable base
  (EBITDA - capex - interest), floored at zero -- there's no NOL
  carryforward modeling.
- If unlevered FCF is negative, the model lets the accumulated cash balance
  go negative rather than modeling a revolver draw -- this is called out in
  a code comment in `app/lbo.py` as a known simplification.

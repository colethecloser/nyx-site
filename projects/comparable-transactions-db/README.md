# Comparable Transactions Database

A searchable database of historical leveraged buyouts, built to benchmark a
new deal against precedent transactions — purchase multiples, sponsors,
financing structures, and exits.

## ⚠️ Important: illustrative demo data only

**Every transaction figure in this dataset (enterprise value, revenue,
EBITDA, purchase multiples, leverage, equity contribution, exit multiple,
MOIC, IRR) is approximate and illustrative.** Some rows use real,
well-known, publicly-reported buyout names (e.g. RJR Nabisco, Hilton,
HCA, Dell) for portfolio-demo realism, but the specific financial figures
attached to them are rounded/approximated for demonstration purposes and are
**not verified deal data** — do not use them for real diligence, investment
decisions, or as a citable source. Several rows (clearly marked in their
`source_notes`) use entirely fictional company and sponsor names, invented
for this demo rather than risk stating incorrect figures against a real deal.
Every row's `source_notes` field states this caveat explicitly.

## Tech stack

- **Frontend:** Next.js (App Router, JavaScript)
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL

## Project layout

```
comparable-transactions-db/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app + routes
│   │   ├── queries.py    # SQL/filtering logic (separated from routes)
│   │   └── db.py         # DB connection helper
│   ├── db/
│   │   ├── schema.sql    # transactions table DDL
│   │   └── seed.py       # seeds 40 illustrative precedent transactions
│   ├── tests/
│   │   └── test_queries.py  # pytest, runs against the live Postgres db
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.js                    # search/filter + results table + stats panel
    │   └── transactions/[id]/page.js  # transaction detail page
    └── lib/api.js                     # API client helpers
```

## Data model

The `transactions` table (see `backend/db/schema.sql`) captures, per deal:
target name, sector, announced/closed dates, sponsor, deal type
(`going_private`, `carve_out`, `secondary_buyout`, `growth_buyout`),
enterprise value, LTM revenue/EBITDA, EV/EBITDA and EV/Revenue multiples,
equity contribution %, debt/EBITDA at close, financing structure notes (debt
stack description), and exit details (date, type, multiple, MOIC, IRR).

40 illustrative rows are seeded via `backend/db/seed.py`, spanning
`going_private` (bulk of well-known large-cap buyouts, 1989-2022),
`secondary_buyout`, `carve_out`, and `growth_buyout` deal types.

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL running locally with a `comparable_transactions` database
  (defaults assume `postgresql://postgres:postgres@localhost:5432/comparable_transactions`)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# apply schema (drops/recreates the transactions table)
psql -h localhost -U postgres -d comparable_transactions -f db/schema.sql

# seed illustrative data
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comparable_transactions \
  python3 db/seed.py

# run tests (against the live db)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comparable_transactions \
  python3 -m pytest tests/ -v

# start the API
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comparable_transactions \
  uvicorn app.main:app --reload --port 8000
```

API docs are then available at `http://localhost:8000/docs`.

Key endpoints:
- `GET /api/transactions` — filter by `sector`, `sponsor` (substring),
  `deal_type`, `year_from`/`year_to`, `min_ev_ebitda`/`max_ev_ebitda`;
  supports `sort_by`, `order`, `page`, `page_size`.
- `GET /api/transactions/{id}` — full detail for one transaction.
- `GET /api/transactions/stats` — median/average EV/EBITDA and EV/Revenue,
  grouped by sector and by year, for the current filter set.
- `GET /api/sponsors`, `GET /api/sectors` — distinct values for filter dropdowns.

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Visit `http://localhost:3000`. The frontend reads the backend URL from
`NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000` if unset).

To build for production:

```bash
npm run build
npm run start
```

The transaction detail page (`/transactions/[id]`) fetches its data
client-side (`useEffect` + `fetch`), so `npm run build` never needs a live
backend available at build time.

## Verification performed while building this project

- `pytest` (11 tests) green against the live `comparable_transactions` Postgres
  database — filtering by sector/sponsor/deal type/year/EV-EBITDA range,
  pagination math (total count vs. page contents, no duplicates/overlap,
  correct remainder on the last page), and stats aggregation (median/avg on
  a known 3-row and 4-row subset) all verified.
- Backend started with `uvicorn` and exercised with `curl` across several
  filter combinations (sector, sponsor substring, year range, EV/EBITDA
  range, sort/order) plus `/api/transactions/stats`, `/api/sponsors`,
  `/api/sectors`, and a 404 case — all returned sane, well-formed JSON.
- `npm run build` green in `frontend/`.

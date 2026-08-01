# PE Portfolio Projects

Three self-contained, full-stack private equity tools, each in its own
subdirectory with its own dependencies, tests, and README. None of these
share code or a database with the NYX-1 marketing site or the FGCU Finance
Cohort platform living at the repo root — they're independent portfolio
projects that happen to live in this monorepo.

| Project | What it does | Stack |
|---|---|---|
| [`lbo-model-builder/`](lbo-model-builder/) | Full LBO model: sources & uses, multi-tranche debt schedule with a seniority-ordered cash sweep, exit returns (IRR/MOIC), scenario save/load | Next.js, FastAPI, PostgreSQL |
| [`pe-deal-screener/`](pe-deal-screener/) | Screens acquisition targets on EBITDA margin, revenue growth, FCF conversion, leverage capacity, and valuation multiple into a weighted composite score | React (Vite), FastAPI, PostgreSQL |
| [`comparable-transactions-db/`](comparable-transactions-db/) | Searchable/filterable database of historical buyouts — purchase multiples, sponsors, financing structures, exits — with sector/year benchmarking stats | Next.js, FastAPI, PostgreSQL |

Each project's data (deal targets, precedent transactions) is fictional or
illustrative and clearly labeled as such in that project's README — none of
it is real confidential deal data, and none of it should be used for actual
investment decisions.

## Running one

Every project expects its own Postgres database and runs its backend and
frontend as separate processes. See the project's own README for exact
setup steps; in short:

```bash
cd projects/<project>/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
psql -d <project_db> -f db/schema.sql
uvicorn app.main:app --reload --port 8000

# in another terminal
cd projects/<project>/frontend
npm install
npm run dev
```

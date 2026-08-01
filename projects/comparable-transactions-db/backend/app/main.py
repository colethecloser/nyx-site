"""
Comparable Transactions Database API (FastAPI).

NOTE: All transaction figures served by this API are illustrative/approximate,
assembled for a portfolio demo. See the repository README for details.
"""
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app import queries
from app.queries import TransactionFilters

app = FastAPI(
    title="Comparable Transactions Database API",
    description=(
        "Searchable database of illustrative historical LBO transactions for "
        "benchmarking precedent purchase multiples, financing structures and exits. "
        "All figures are approximate and for portfolio-demo purposes only."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _serialize(value):
    """Make psycopg2 row values JSON-friendly (Decimal, date, datetime)."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def serialize_row(row: dict) -> dict:
    return {k: _serialize(v) for k, v in row.items()}


def serialize_rows(rows) -> list:
    return [serialize_row(dict(r)) for r in rows]


@app.get("/")
def root():
    return {
        "name": "Comparable Transactions Database API",
        "docs": "/docs",
        "note": "All figures illustrative/approximate; portfolio demo only.",
    }


@app.get("/api/transactions")
def get_transactions(
    sector: Optional[str] = None,
    sponsor: Optional[str] = None,
    deal_type: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_ev_ebitda: Optional[float] = None,
    max_ev_ebitda: Optional[float] = None,
    sort_by: str = "announced_date",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    filters = TransactionFilters(
        sector=sector,
        sponsor=sponsor,
        deal_type=deal_type,
        year_from=year_from,
        year_to=year_to,
        min_ev_ebitda=min_ev_ebitda,
        max_ev_ebitda=max_ev_ebitda,
    )
    rows, total = queries.list_transactions(
        filters, sort_by=sort_by, order=order, page=page, page_size=page_size
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": serialize_rows(rows),
    }


@app.get("/api/transactions/stats")
def get_transactions_stats(
    sector: Optional[str] = None,
    sponsor: Optional[str] = None,
    deal_type: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_ev_ebitda: Optional[float] = None,
    max_ev_ebitda: Optional[float] = None,
):
    filters = TransactionFilters(
        sector=sector,
        sponsor=sponsor,
        deal_type=deal_type,
        year_from=year_from,
        year_to=year_to,
        min_ev_ebitda=min_ev_ebitda,
        max_ev_ebitda=max_ev_ebitda,
    )
    stats = queries.get_stats(filters)
    return {
        "overall": serialize_row(dict(stats["overall"])) if stats["overall"] else None,
        "by_sector": serialize_rows(stats["by_sector"]),
        "by_year": serialize_rows(stats["by_year"]),
    }


@app.get("/api/transactions/{transaction_id}")
def get_transaction(transaction_id: int):
    row = queries.get_transaction_by_id(transaction_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return serialize_row(dict(row))


@app.get("/api/sponsors")
def get_sponsors():
    return {"sponsors": queries.distinct_sponsors()}


@app.get("/api/sectors")
def get_sectors():
    return {"sectors": queries.distinct_sectors()}

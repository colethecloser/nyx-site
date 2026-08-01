"""
SQL / filtering logic for the comparable transactions API, kept separate from
the FastAPI route handlers so it can be unit tested directly against the live
Postgres database.
"""
from dataclasses import dataclass
from typing import Optional, List, Tuple, Any

from app.db import get_connection, dict_cursor

ALLOWED_SORT_COLUMNS = {
    "target_name",
    "sector",
    "announced_date",
    "acquirer_sponsor",
    "deal_type",
    "enterprise_value_musd",
    "ev_ebitda_multiple",
    "ev_revenue_multiple",
    "moic",
    "irr_pct",
}


@dataclass
class TransactionFilters:
    sector: Optional[str] = None
    sponsor: Optional[str] = None
    deal_type: Optional[str] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    min_ev_ebitda: Optional[float] = None
    max_ev_ebitda: Optional[float] = None


def build_where_clause(filters: TransactionFilters) -> Tuple[str, List[Any]]:
    """Build a SQL WHERE clause (without the WHERE keyword) and its params."""
    clauses = []
    params: List[Any] = []

    if filters.sector:
        clauses.append("sector = %s")
        params.append(filters.sector)

    if filters.sponsor:
        clauses.append("acquirer_sponsor ILIKE %s")
        params.append(f"%{filters.sponsor}%")

    if filters.deal_type:
        clauses.append("deal_type = %s")
        params.append(filters.deal_type)

    if filters.year_from is not None:
        clauses.append("EXTRACT(YEAR FROM announced_date) >= %s")
        params.append(filters.year_from)

    if filters.year_to is not None:
        clauses.append("EXTRACT(YEAR FROM announced_date) <= %s")
        params.append(filters.year_to)

    if filters.min_ev_ebitda is not None:
        clauses.append("ev_ebitda_multiple >= %s")
        params.append(filters.min_ev_ebitda)

    if filters.max_ev_ebitda is not None:
        clauses.append("ev_ebitda_multiple <= %s")
        params.append(filters.max_ev_ebitda)

    if not clauses:
        return "TRUE", params

    return " AND ".join(clauses), params


def list_transactions(
    filters: TransactionFilters,
    sort_by: str = "announced_date",
    order: str = "desc",
    page: int = 1,
    page_size: int = 20,
):
    """Return (rows, total_count) for the given filters, sorted and paginated."""
    if sort_by not in ALLOWED_SORT_COLUMNS:
        sort_by = "announced_date"
    order = "DESC" if str(order).lower() != "asc" else "ASC"

    page = max(page, 1)
    page_size = max(min(page_size, 200), 1)
    offset = (page - 1) * page_size

    where_sql, params = build_where_clause(filters)

    conn = get_connection()
    try:
        cur = dict_cursor(conn)

        count_sql = f"SELECT COUNT(*) AS total FROM transactions WHERE {where_sql}"
        cur.execute(count_sql, params)
        total = cur.fetchone()["total"]

        # sort_by is validated against an allowlist above, safe to interpolate
        data_sql = (
            f"SELECT * FROM transactions WHERE {where_sql} "
            f"ORDER BY {sort_by} {order} NULLS LAST, id ASC "
            f"LIMIT %s OFFSET %s"
        )
        cur.execute(data_sql, params + [page_size, offset])
        rows = cur.fetchall()

        return rows, total
    finally:
        conn.close()


def get_transaction_by_id(transaction_id: int):
    conn = get_connection()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM transactions WHERE id = %s", (transaction_id,))
        return cur.fetchone()
    finally:
        conn.close()


def get_stats(filters: TransactionFilters):
    """Aggregate median/average EV/EBITDA and EV/Revenue by sector and by year."""
    where_sql, params = build_where_clause(filters)

    conn = get_connection()
    try:
        cur = dict_cursor(conn)

        by_sector_sql = f"""
            SELECT
                sector,
                COUNT(*) AS deal_count,
                ROUND(AVG(ev_ebitda_multiple)::numeric, 2) AS avg_ev_ebitda,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_ebitda_multiple)::numeric, 2) AS median_ev_ebitda,
                ROUND(AVG(ev_revenue_multiple)::numeric, 2) AS avg_ev_revenue,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_revenue_multiple)::numeric, 2) AS median_ev_revenue
            FROM transactions
            WHERE {where_sql}
            GROUP BY sector
            ORDER BY sector
        """
        cur.execute(by_sector_sql, params)
        by_sector = cur.fetchall()

        by_year_sql = f"""
            SELECT
                EXTRACT(YEAR FROM announced_date)::int AS year,
                COUNT(*) AS deal_count,
                ROUND(AVG(ev_ebitda_multiple)::numeric, 2) AS avg_ev_ebitda,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_ebitda_multiple)::numeric, 2) AS median_ev_ebitda,
                ROUND(AVG(ev_revenue_multiple)::numeric, 2) AS avg_ev_revenue,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_revenue_multiple)::numeric, 2) AS median_ev_revenue
            FROM transactions
            WHERE {where_sql}
            GROUP BY EXTRACT(YEAR FROM announced_date)
            ORDER BY year
        """
        cur.execute(by_year_sql, params)
        by_year = cur.fetchall()

        overall_sql = f"""
            SELECT
                COUNT(*) AS deal_count,
                ROUND(AVG(ev_ebitda_multiple)::numeric, 2) AS avg_ev_ebitda,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_ebitda_multiple)::numeric, 2) AS median_ev_ebitda,
                ROUND(AVG(ev_revenue_multiple)::numeric, 2) AS avg_ev_revenue,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ev_revenue_multiple)::numeric, 2) AS median_ev_revenue
            FROM transactions
            WHERE {where_sql}
        """
        cur.execute(overall_sql, params)
        overall = cur.fetchone()

        return {
            "overall": overall,
            "by_sector": by_sector,
            "by_year": by_year,
        }
    finally:
        conn.close()


def distinct_sponsors() -> List[str]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT acquirer_sponsor FROM transactions ORDER BY acquirer_sponsor")
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def distinct_sectors() -> List[str]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT sector FROM transactions ORDER BY sector")
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()

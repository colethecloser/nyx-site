"""
Integration tests for app/queries.py. These run against the LIVE
`comparable_transactions` Postgres database (read DATABASE_URL, default
localhost) — they are not mocked, per project spec. Run `db/seed.py` first.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import psycopg2
import psycopg2.extras
import pytest

from app.queries import TransactionFilters, list_transactions, get_stats

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/comparable_transactions"
)


def raw_query(sql, params=None):
    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params or [])
        return cur.fetchall()
    finally:
        conn.close()


@pytest.fixture(scope="module", autouse=True)
def ensure_seeded():
    rows = raw_query("SELECT COUNT(*) AS c FROM transactions")
    assert rows[0]["c"] >= 25, (
        "Expected the transactions table to be seeded with >=25 rows before running tests; "
        "run db/seed.py against the live database first."
    )


def test_filter_by_sector_returns_only_matching_rows():
    filters = TransactionFilters(sector="Technology / SaaS")
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions WHERE sector = %s", ["Technology / SaaS"]
    )[0]["c"]

    assert total == expected
    assert total == 3  # known from seed data: Nimbus Cloud Analytics, Anaplan, Zendesk
    assert len(rows) == total
    for row in rows:
        assert row["sector"] == "Technology / SaaS"


def test_filter_by_sponsor_substring_search():
    filters = TransactionFilters(sponsor="KKR")
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions WHERE acquirer_sponsor ILIKE %s", ["%KKR%"]
    )[0]["c"]

    assert total == expected
    assert total > 0
    for row in rows:
        assert "KKR" in row["acquirer_sponsor"]


def test_filter_by_deal_type():
    filters = TransactionFilters(deal_type="carve_out")
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions WHERE deal_type = %s", ["carve_out"]
    )[0]["c"]

    assert total == expected
    assert total == 4  # known from seed data
    for row in rows:
        assert row["deal_type"] == "carve_out"


def test_filter_by_year_range():
    filters = TransactionFilters(year_from=2022, year_to=2022)
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions "
        "WHERE EXTRACT(YEAR FROM announced_date) >= 2022 "
        "AND EXTRACT(YEAR FROM announced_date) <= 2022"
    )[0]["c"]

    assert total == expected
    assert total > 0
    for row in rows:
        assert row["announced_date"].year == 2022


def test_filter_by_ev_ebitda_range():
    filters = TransactionFilters(min_ev_ebitda=8, max_ev_ebitda=12)
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions "
        "WHERE ev_ebitda_multiple >= 8 AND ev_ebitda_multiple <= 12"
    )[0]["c"]

    assert total == expected
    assert total > 0
    for row in rows:
        assert 8 <= float(row["ev_ebitda_multiple"]) <= 12


def test_filter_combination_sector_and_year():
    filters = TransactionFilters(sector="Retail", year_from=2015, year_to=2018)
    rows, total = list_transactions(filters, page_size=50)

    expected = raw_query(
        "SELECT COUNT(*) AS c FROM transactions WHERE sector = 'Retail' "
        "AND EXTRACT(YEAR FROM announced_date) >= 2015 "
        "AND EXTRACT(YEAR FROM announced_date) <= 2018"
    )[0]["c"]

    assert total == expected
    for row in rows:
        assert row["sector"] == "Retail"
        assert 2015 <= row["announced_date"].year <= 2018


def test_pagination_math_matches_total_count():
    filters = TransactionFilters()
    page_size = 7

    _, total = list_transactions(filters, page_size=page_size, page=1)
    assert total > 0

    seen_ids = set()
    num_pages = (total + page_size - 1) // page_size
    for page in range(1, num_pages + 1):
        rows, page_total = list_transactions(filters, page_size=page_size, page=page)
        assert page_total == total  # total count is stable across pages
        for row in rows:
            assert row["id"] not in seen_ids  # no duplicates across pages
            seen_ids.add(row["id"])

        if page < num_pages:
            assert len(rows) == page_size
        else:
            # last page has the remainder (or a full page if evenly divisible)
            remainder = total - (num_pages - 1) * page_size
            assert len(rows) == remainder

    assert len(seen_ids) == total


def test_pagination_empty_beyond_last_page():
    filters = TransactionFilters()
    _, total = list_transactions(filters, page_size=10, page=1)
    far_page = (total // 10) + 100
    rows, page_total = list_transactions(filters, page_size=10, page=far_page)
    assert rows == []
    assert page_total == total


def test_stats_median_on_known_small_subset():
    # Known subset from seed data: sector "Technology / SaaS" has exactly 3 rows:
    #   Nimbus Cloud Analytics: ev_ebitda=35.00,  ev_revenue=4.42
    #   Anaplan Inc.:           ev_ebitda=NULL,   ev_revenue=17.26
    #   Zendesk Inc.:           ev_ebitda=340.00, ev_revenue=7.61
    filters = TransactionFilters(sector="Technology / SaaS")
    stats = get_stats(filters)

    overall = stats["overall"]
    assert overall["deal_count"] == 3

    # median_ev_ebitda ignores the NULL -> median of [35.00, 340.00] = 187.50
    assert float(overall["median_ev_ebitda"]) == pytest.approx(187.5, abs=0.01)
    assert float(overall["avg_ev_ebitda"]) == pytest.approx(187.5, abs=0.01)

    # median_ev_revenue of [4.42, 7.61, 17.26] sorted -> middle value 7.61
    assert float(overall["median_ev_revenue"]) == pytest.approx(7.61, abs=0.01)

    by_sector = stats["by_sector"]
    assert len(by_sector) == 1
    assert by_sector[0]["sector"] == "Technology / SaaS"
    assert by_sector[0]["deal_count"] == 3


def test_stats_by_year_groups_correctly():
    filters = TransactionFilters(deal_type="carve_out")
    stats = get_stats(filters)

    total_from_by_year = sum(row["deal_count"] for row in stats["by_year"])
    assert total_from_by_year == stats["overall"]["deal_count"]
    assert total_from_by_year == 4


def test_stats_respects_filters_empty_result():
    # A deliberately impossible filter combination should yield zero rows,
    # and stats aggregation should not error, just report a zero count.
    filters = TransactionFilters(sector="Retail", min_ev_ebitda=9999)
    stats = get_stats(filters)
    assert stats["overall"]["deal_count"] == 0
    assert stats["by_sector"] == []
    assert stats["by_year"] == []

"""FastAPI app for the PE Deal Screener backend."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.db import get_connection
from app.metrics import (
    ScreenAssumptions,
    Target,
    compute_screen_scores,
    ev_ebitda_multiple,
    fcf_conversion,
    implied_max_ev_musd,
    leverage_capacity_musd,
    passes_filters,
)

app = FastAPI(title="PE Deal Screener API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SortField = Literal["score", "multiple", "growth", "margin", "revenue", "fcf_conversion", "leverage_capacity"]
Order = Literal["asc", "desc"]


def _row_to_target(row: dict) -> Target:
    return Target(
        id=row["id"],
        name=row["name"],
        sector=row["sector"],
        revenue_musd=float(row["revenue_musd"]),
        revenue_growth_pct=float(row["revenue_growth_pct"]),
        ebitda_musd=float(row["ebitda_musd"]),
        ebitda_margin_pct=float(row["ebitda_margin_pct"]),
        net_debt_musd=float(row["net_debt_musd"]),
        capex_pct_revenue=float(row["capex_pct_revenue"]),
        fcf_musd=float(row["fcf_musd"]),
        ask_ev_musd=float(row["ask_ev_musd"]),
    )


def _fetch_all_targets() -> list[Target]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM targets ORDER BY id")
            rows = cur.fetchall()
    return [_row_to_target(r) for r in rows]


def _serialize(target: Target, assumptions: ScreenAssumptions, score: float) -> dict:
    return {
        "id": target.id,
        "name": target.name,
        "sector": target.sector,
        "revenue_musd": target.revenue_musd,
        "revenue_growth_pct": target.revenue_growth_pct,
        "ebitda_musd": target.ebitda_musd,
        "ebitda_margin_pct": target.ebitda_margin_pct,
        "net_debt_musd": target.net_debt_musd,
        "capex_pct_revenue": target.capex_pct_revenue,
        "fcf_musd": target.fcf_musd,
        "ask_ev_musd": target.ask_ev_musd,
        "metrics": {
            "ev_ebitda_multiple": round(ev_ebitda_multiple(target), 2),
            "fcf_conversion": round(fcf_conversion(target), 4),
            "leverage_capacity_musd": round(leverage_capacity_musd(target, assumptions), 2),
            "implied_max_ev_musd": round(implied_max_ev_musd(target, assumptions), 2),
            "screen_score": score,
        },
        "assumptions_used": {
            "target_leverage_multiple": assumptions.target_leverage_multiple,
            "assumed_equity_multiple": assumptions.assumed_equity_multiple,
        },
    }


_SORT_KEY_MAP = {
    "score": lambda d: d["metrics"]["screen_score"],
    "multiple": lambda d: d["metrics"]["ev_ebitda_multiple"],
    "growth": lambda d: d["revenue_growth_pct"],
    "margin": lambda d: d["ebitda_margin_pct"],
    "revenue": lambda d: d["revenue_musd"],
    "fcf_conversion": lambda d: d["metrics"]["fcf_conversion"],
    "leverage_capacity": lambda d: d["metrics"]["leverage_capacity_musd"],
}


@app.get("/api/sectors")
def get_sectors() -> list[str]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT sector FROM targets ORDER BY sector")
            rows = cur.fetchall()
    return [r["sector"] for r in rows]


@app.get("/api/targets")
def get_targets(
    sector: Optional[str] = None,
    min_ebitda_margin: Optional[float] = Query(None),
    min_revenue_growth: Optional[float] = Query(None),
    min_fcf_conversion: Optional[float] = Query(None),
    max_ev_ebitda_multiple: Optional[float] = Query(None),
    target_leverage_multiple: float = Query(5.5, gt=0),
    assumed_equity_multiple: float = Query(3.0, ge=0),
    sort_by: SortField = Query("score"),
    order: Order = Query("desc"),
):
    all_targets = _fetch_all_targets()
    if not all_targets:
        return []

    assumptions = ScreenAssumptions(
        target_leverage_multiple=target_leverage_multiple,
        assumed_equity_multiple=assumed_equity_multiple,
        min_ebitda_margin=min_ebitda_margin,
        min_revenue_growth=min_revenue_growth,
        min_fcf_conversion=min_fcf_conversion,
        max_entry_multiple=max_ev_ebitda_multiple,
    )

    # Scores are computed relative to the FULL dataset (not the filtered
    # subset) so a target's score reflects its standing across the whole
    # universe of candidates and doesn't shift just because filters changed
    # which rows are currently visible.
    scores = compute_screen_scores(all_targets, assumptions)

    results = []
    for t in all_targets:
        if sector and t.sector != sector:
            continue
        if not passes_filters(t, assumptions):
            continue
        results.append(_serialize(t, assumptions, scores[t.id]))

    key_fn = _SORT_KEY_MAP[sort_by]
    results.sort(key=key_fn, reverse=(order == "desc"))

    return results


@app.get("/api/targets/{target_id}")
def get_target(
    target_id: int,
    target_leverage_multiple: float = Query(5.5, gt=0),
    assumed_equity_multiple: float = Query(3.0, ge=0),
):
    all_targets = _fetch_all_targets()
    match = next((t for t in all_targets if t.id == target_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail=f"Target {target_id} not found")

    assumptions = ScreenAssumptions(
        target_leverage_multiple=target_leverage_multiple,
        assumed_equity_multiple=assumed_equity_multiple,
    )
    scores = compute_screen_scores(all_targets, assumptions)
    return _serialize(match, assumptions, scores[match.id])


@app.get("/api/health")
def health():
    return {"status": "ok"}

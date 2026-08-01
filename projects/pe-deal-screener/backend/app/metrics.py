"""
Pure functions for computing PE screening metrics.

All monetary figures are in USD millions ("musd"). All percentage/ratio inputs
that end in `_pct` are expressed as e.g. 22.5 for 22.5%.

These functions are intentionally side-effect free (no DB, no I/O) so they can
be unit tested with hand-computed expected values. See tests/test_metrics.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import pstdev
from typing import Iterable, Sequence


@dataclass
class Target:
    """Minimal shape needed to compute metrics for one candidate company."""

    id: int
    name: str
    sector: str
    revenue_musd: float
    revenue_growth_pct: float
    ebitda_musd: float
    ebitda_margin_pct: float
    net_debt_musd: float
    capex_pct_revenue: float
    fcf_musd: float
    ask_ev_musd: float


@dataclass
class ScreenAssumptions:
    """Deal-team assumptions used to screen the dataset.

    These do not change the underlying metric *values* stored on a target
    (margin, growth, etc. are facts about the company) but they do change:
      - leverage_capacity_musd / implied_max_ev_musd, which depend on the
        assumed target leverage multiple and assumed equity check, and
      - which rows survive a filter (min_ebitda_margin, min_revenue_growth,
        min_fcf_conversion, max_entry_multiple).
    """

    target_leverage_multiple: float = 5.5  # x EBITDA, e.g. 5.5x
    assumed_equity_multiple: float = 3.0  # x EBITDA, assumed equity check contribution
    min_ebitda_margin: float | None = None
    min_revenue_growth: float | None = None
    min_fcf_conversion: float | None = None
    max_entry_multiple: float | None = None


# ---------------------------------------------------------------------------
# Per-target metrics
# ---------------------------------------------------------------------------


def ev_ebitda_multiple(target: Target) -> float:
    """Asking price expressed as a multiple of EBITDA. Lower = cheaper."""
    if target.ebitda_musd == 0:
        return float("inf")
    return target.ask_ev_musd / target.ebitda_musd


def fcf_conversion(target: Target) -> float:
    """Fraction of EBITDA that converts to free cash flow (0-1+ range, can exceed 1)."""
    if target.ebitda_musd == 0:
        return 0.0
    return target.fcf_musd / target.ebitda_musd


def leverage_capacity_musd(target: Target, assumptions: ScreenAssumptions) -> float:
    """Additional debt capacity remaining after refinancing existing net debt.

    total_debt_capacity = target_leverage_multiple * EBITDA
    leverage_capacity    = total_debt_capacity - existing net debt

    A negative value means the company is already levered beyond the assumed
    target leverage multiple (no incremental debt capacity remains).
    """
    total_debt_capacity = assumptions.target_leverage_multiple * target.ebitda_musd
    return total_debt_capacity - target.net_debt_musd


def implied_max_ev_musd(target: Target, assumptions: ScreenAssumptions) -> float:
    """Illustrative "how much could a sponsor afford to pay" figure.

    Formula (documented, not gospel):
        implied_max_ev = total_debt_capacity + assumed_equity_contribution
                        = (target_leverage_multiple * EBITDA) + (assumed_equity_multiple * EBITDA)

    i.e. we assume the buyer funds the deal with a fixed leverage multiple of
    EBITDA in new debt (replacing/refinancing whatever net debt exists today,
    which is why net_debt does NOT reduce this figure -- it's a sources-of-
    capital ceiling, not a specific offer net of the seller's existing debt)
    plus a fixed equity check sized off EBITDA. This is a simplified,
    single-turn approximation meant for quick relative screening across a
    list of targets -- not a substitute for a real sources & uses build.
    """
    total_debt_capacity = assumptions.target_leverage_multiple * target.ebitda_musd
    assumed_equity = assumptions.assumed_equity_multiple * target.ebitda_musd
    return total_debt_capacity + assumed_equity


# ---------------------------------------------------------------------------
# Composite screen score
# ---------------------------------------------------------------------------

# Documented weights for the composite 0-100 screen_score. Must sum to 1.0.
SCORE_WEIGHTS = {
    "ebitda_margin": 0.30,
    "revenue_growth": 0.25,
    "fcf_conversion": 0.25,
    "valuation_discount": 0.20,  # lower ask multiple = better = higher discount score
}

assert abs(sum(SCORE_WEIGHTS.values()) - 1.0) < 1e-9


def _min_max_normalize(value: float, lo: float, hi: float) -> float:
    """Scale value to [0, 1] given the dataset's [lo, hi] range for that field.

    If the dataset has zero spread (lo == hi), every target is treated as
    exactly average (0.5) on that dimension so it neither helps nor hurts.
    """
    if hi == lo:
        return 0.5
    return (value - lo) / (hi - lo)


def compute_screen_scores(
    targets: Sequence[Target], assumptions: ScreenAssumptions
) -> dict[int, float]:
    """Compute a 0-100 composite screen_score for every target in `targets`.

    Scoring is relative to the supplied dataset (min-max normalization across
    whatever set of targets is passed in), blending four normalized signals:

      - EBITDA margin (higher is better)
      - Revenue growth (higher is better)
      - FCF conversion = FCF / EBITDA (higher is better)
      - Valuation discount = 1 - normalized(EV/EBITDA multiple)
        (i.e. a *cheaper* ask multiple scores higher on this dimension)

    Each normalized signal is in [0, 1], combined via SCORE_WEIGHTS, then
    scaled to 0-100.

    Returns a dict of {target.id: score}. Requires at least one target;
    returns an empty dict for an empty sequence.
    """
    if not targets:
        return {}

    margins = [t.ebitda_margin_pct for t in targets]
    growths = [t.revenue_growth_pct for t in targets]
    fcf_convs = [fcf_conversion(t) for t in targets]
    multiples = [ev_ebitda_multiple(t) for t in targets]

    margin_lo, margin_hi = min(margins), max(margins)
    growth_lo, growth_hi = min(growths), max(growths)
    fcf_lo, fcf_hi = min(fcf_convs), max(fcf_convs)
    mult_lo, mult_hi = min(multiples), max(multiples)

    scores: dict[int, float] = {}
    for t, fcf_c, mult in zip(targets, fcf_convs, multiples):
        norm_margin = _min_max_normalize(t.ebitda_margin_pct, margin_lo, margin_hi)
        norm_growth = _min_max_normalize(t.revenue_growth_pct, growth_lo, growth_hi)
        norm_fcf = _min_max_normalize(fcf_c, fcf_lo, fcf_hi)
        norm_mult = _min_max_normalize(mult, mult_lo, mult_hi)
        valuation_discount = 1.0 - norm_mult  # cheaper multiple -> higher score

        composite = (
            SCORE_WEIGHTS["ebitda_margin"] * norm_margin
            + SCORE_WEIGHTS["revenue_growth"] * norm_growth
            + SCORE_WEIGHTS["fcf_conversion"] * norm_fcf
            + SCORE_WEIGHTS["valuation_discount"] * valuation_discount
        )
        scores[t.id] = round(composite * 100.0, 2)

    return scores


def passes_filters(target: Target, assumptions: ScreenAssumptions) -> bool:
    """Whether `target` satisfies all set (non-None) filter thresholds."""
    if (
        assumptions.min_ebitda_margin is not None
        and target.ebitda_margin_pct < assumptions.min_ebitda_margin
    ):
        return False
    if (
        assumptions.min_revenue_growth is not None
        and target.revenue_growth_pct < assumptions.min_revenue_growth
    ):
        return False
    if (
        assumptions.min_fcf_conversion is not None
        and fcf_conversion(target) < assumptions.min_fcf_conversion
    ):
        return False
    if (
        assumptions.max_entry_multiple is not None
        and ev_ebitda_multiple(target) > assumptions.max_entry_multiple
    ):
        return False
    return True

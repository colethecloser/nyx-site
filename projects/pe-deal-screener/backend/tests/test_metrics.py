import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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


def make_target(**overrides) -> Target:
    defaults = dict(
        id=1,
        name="Test Co",
        sector="Software",
        revenue_musd=100.0,
        revenue_growth_pct=10.0,
        ebitda_musd=20.0,
        ebitda_margin_pct=20.0,
        net_debt_musd=30.0,
        capex_pct_revenue=3.0,
        fcf_musd=10.0,
        ask_ev_musd=100.0,
    )
    defaults.update(overrides)
    return Target(**defaults)


# ---------------------------------------------------------------------------
# Hand-computed values on synthetic inputs
# ---------------------------------------------------------------------------


def test_ev_ebitda_multiple_hand_computed():
    t = make_target(ebitda_musd=20.0, ask_ev_musd=100.0)
    assert ev_ebitda_multiple(t) == 5.0  # 100 / 20


def test_ev_ebitda_multiple_second_case():
    t = make_target(ebitda_musd=10.0, ask_ev_musd=80.0)
    assert ev_ebitda_multiple(t) == 8.0  # 80 / 10


def test_fcf_conversion_hand_computed():
    t = make_target(ebitda_musd=20.0, fcf_musd=10.0)
    assert fcf_conversion(t) == 0.5  # 10 / 20


def test_fcf_conversion_second_case():
    t = make_target(ebitda_musd=10.0, fcf_musd=2.0)
    assert fcf_conversion(t) == 0.2  # 2 / 10


def test_leverage_capacity_hand_computed():
    # total_debt_capacity = 5.5 * 20 = 110; leverage_capacity = 110 - 30 = 80
    t = make_target(ebitda_musd=20.0, net_debt_musd=30.0)
    a = ScreenAssumptions(target_leverage_multiple=5.5)
    assert leverage_capacity_musd(t, a) == 80.0


def test_leverage_capacity_second_case():
    # total_debt_capacity = 5.5 * 10 = 55; leverage_capacity = 55 - 5 = 50
    t = make_target(ebitda_musd=10.0, net_debt_musd=5.0)
    a = ScreenAssumptions(target_leverage_multiple=5.5)
    assert leverage_capacity_musd(t, a) == 50.0


def test_leverage_capacity_can_be_negative_when_overlevered():
    # total_debt_capacity = 5.5 * 10 = 55; already at 90 net debt -> negative capacity
    t = make_target(ebitda_musd=10.0, net_debt_musd=90.0)
    a = ScreenAssumptions(target_leverage_multiple=5.5)
    assert leverage_capacity_musd(t, a) == -35.0


def test_implied_max_ev_hand_computed():
    # total_debt_capacity = 5.5 * 20 = 110; assumed_equity = 3.0 * 20 = 60; total = 170
    t = make_target(ebitda_musd=20.0)
    a = ScreenAssumptions(target_leverage_multiple=5.5, assumed_equity_multiple=3.0)
    assert implied_max_ev_musd(t, a) == 170.0


def test_implied_max_ev_second_case():
    # total_debt_capacity = 5.5 * 10 = 55; assumed_equity = 3.0 * 10 = 30; total = 85
    t = make_target(ebitda_musd=10.0)
    a = ScreenAssumptions(target_leverage_multiple=5.5, assumed_equity_multiple=3.0)
    assert implied_max_ev_musd(t, a) == 85.0


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


def test_passes_filters_all_thresholds_met():
    t = make_target(
        ebitda_margin_pct=25.0,
        revenue_growth_pct=15.0,
        ebitda_musd=20.0,
        fcf_musd=12.0,  # conversion = 0.6
        ask_ev_musd=100.0,  # multiple = 5.0
    )
    a = ScreenAssumptions(
        min_ebitda_margin=20.0,
        min_revenue_growth=10.0,
        min_fcf_conversion=0.5,
        max_entry_multiple=6.0,
    )
    assert passes_filters(t, a) is True


def test_fails_filters_when_multiple_too_high():
    t = make_target(ask_ev_musd=200.0, ebitda_musd=20.0)  # multiple = 10.0
    a = ScreenAssumptions(max_entry_multiple=6.0)
    assert passes_filters(t, a) is False


def test_fails_filters_when_margin_too_low():
    t = make_target(ebitda_margin_pct=10.0)
    a = ScreenAssumptions(min_ebitda_margin=20.0)
    assert passes_filters(t, a) is False


# ---------------------------------------------------------------------------
# Composite screen score
# ---------------------------------------------------------------------------


def test_strictly_better_target_scores_higher():
    """A target that is strictly better on every input dimension (higher
    margin, higher growth, higher FCF conversion, lower entry multiple) must
    always score higher than a strictly worse one, regardless of the other
    (non-scoring) fields like net_debt or capex."""
    better = make_target(
        id=1,
        ebitda_margin_pct=30.0,
        revenue_growth_pct=25.0,
        ebitda_musd=20.0,
        fcf_musd=16.0,  # conversion = 0.8
        ask_ev_musd=80.0,  # multiple = 4.0 (cheap)
    )
    worse = make_target(
        id=2,
        ebitda_margin_pct=10.0,
        revenue_growth_pct=2.0,
        ebitda_musd=20.0,
        fcf_musd=4.0,  # conversion = 0.2
        ask_ev_musd=240.0,  # multiple = 12.0 (expensive)
    )
    scores = compute_screen_scores([better, worse], ScreenAssumptions())
    assert scores[1] > scores[2]
    # With only two targets and a strictly-dominant one, the better target
    # should min-max normalize to the top of every dimension -> 100.
    assert scores[1] == 100.0
    assert scores[2] == 0.0


def test_score_invariant_holds_across_multiple_pairs():
    """Same invariant, checked pairwise inside a larger, more realistic
    dataset (mirrors the shape of seeded data) to guard against regressions
    that only show up with >2 rows."""
    baseline = make_target(
        id=10,
        ebitda_margin_pct=18.0,
        revenue_growth_pct=8.0,
        ebitda_musd=15.0,
        fcf_musd=6.0,  # conversion = 0.4
        ask_ev_musd=135.0,  # multiple = 9.0
    )
    dominant = make_target(
        id=11,
        ebitda_margin_pct=28.0,
        revenue_growth_pct=20.0,
        ebitda_musd=15.0,
        fcf_musd=12.0,  # conversion = 0.8
        ask_ev_musd=90.0,  # multiple = 6.0
    )
    filler_a = make_target(id=12, ebitda_margin_pct=22.0, revenue_growth_pct=12.0)
    filler_b = make_target(id=13, ebitda_margin_pct=15.0, revenue_growth_pct=5.0)

    scores = compute_screen_scores(
        [baseline, dominant, filler_a, filler_b], ScreenAssumptions()
    )
    assert scores[11] > scores[10]


def test_scores_are_bounded_0_to_100():
    targets = [
        make_target(id=i, ebitda_margin_pct=5.0 * i, revenue_growth_pct=2.0 * i)
        for i in range(1, 6)
    ]
    scores = compute_screen_scores(targets, ScreenAssumptions())
    for s in scores.values():
        assert 0.0 <= s <= 100.0


def test_empty_dataset_returns_empty_scores():
    assert compute_screen_scores([], ScreenAssumptions()) == {}


def test_single_target_dataset_scores_as_average():
    # With zero spread across every dimension (only one row), each normalized
    # signal is 0.5, so the composite should be exactly 50.0.
    t = make_target()
    scores = compute_screen_scores([t], ScreenAssumptions())
    assert scores[t.id] == 50.0

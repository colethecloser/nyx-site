"""
Unit tests for the LBO calculation engine, plus a live-Postgres integration
test for the persistence layer.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from app.lbo import DebtTranche, LBOInputs, run_lbo


# --------------------------------------------------------------------------
# Hand-verifiable single-tranche, no-growth, 100%-sweep, 2-year case.
#
# Inputs:
#   entry_ebitda = 100, entry_multiple = 8x -> purchase EV = 800
#   transaction_fees_pct = 0 (kept out to simplify the hand calc)
#   single tranche: amount = 400, rate = 10%, amort_pct = 0%, seniority 1
#   sponsor_equity (plug) = total_uses(800) - debt(400) = 400
#   ebitda_growth_rate = 0 -> ebitda stays 100 in year 1 and year 2
#   capex_pct_revenue = 0 (no revenue modeled, so capex = 0% * ebitda = 0)
#   tax_rate = 0 (kept at 0 to simplify the hand calc)
#   cash_sweep_pct = 1.0 (100% sweep)
#   exit_multiple = 8x, hold_period_years = 2
#
# Hand calc, Year 1:
#   beginning debt = 400
#   interest = 400 * 10% = 40
#   mandatory amort = 0
#   unlevered FCF = ebitda(100) - capex(0) - taxes(0) - debt_service(40+0) = 60
#   sweep = 60 (100% of FCF, tranche has enough balance)
#   ending debt = 400 - 0 - 60 = 340
#
# Hand calc, Year 2:
#   beginning debt = 340
#   interest = 340 * 10% = 34
#   mandatory amort = 0
#   unlevered FCF = 100 - 0 - 0 - 34 = 66
#   sweep = 66
#   ending debt = 340 - 66 = 274
#
# Exit (end of year 2):
#   exit EV = exit_ebitda(100) * exit_multiple(8) = 800
#   net debt = 274 (no accumulated cash, sweep was 100%)
#   exit equity = 800 - 274 = 526
#
# Returns:
#   MOIC = 526 / 400 = 1.315
#   IRR = (526/400)^(1/2) - 1 = 1.315^0.5 - 1 = 0.146734... ~= 14.67%
# --------------------------------------------------------------------------


def test_single_tranche_hand_verified():
    inputs = LBOInputs(
        entry_ebitda=100,
        entry_multiple=8,
        exit_multiple=8,
        hold_period_years=2,
        transaction_fees_pct=0.0,
        ebitda_growth_rate=0.0,
        capex_pct_revenue=0.0,
        tax_rate=0.0,
        cash_sweep_pct=1.0,
        tranches=[
            DebtTranche(name="Term Loan", amount=400, rate=0.10, amort_pct=0.0, seniority=1),
        ],
    )

    result = run_lbo(inputs)

    assert result.sources_uses.purchase_enterprise_value == pytest.approx(800.0)
    assert result.sources_uses.total_uses == pytest.approx(800.0)
    assert result.sources_uses.total_debt == pytest.approx(400.0)
    assert result.sources_uses.sponsor_equity == pytest.approx(400.0)

    y1, y2 = result.yearly
    assert y1.interest_expense == pytest.approx(40.0)
    assert y1.unlevered_fcf == pytest.approx(60.0)
    assert y1.total_ending_debt == pytest.approx(340.0)

    assert y2.interest_expense == pytest.approx(34.0)
    assert y2.unlevered_fcf == pytest.approx(66.0)
    assert y2.total_ending_debt == pytest.approx(274.0)

    summary = result.summary
    assert summary.exit_enterprise_value == pytest.approx(800.0)
    assert summary.exit_net_debt == pytest.approx(274.0)
    assert summary.exit_equity_value == pytest.approx(526.0)
    assert summary.entry_equity == pytest.approx(400.0)
    assert summary.moic == pytest.approx(526.0 / 400.0, rel=1e-9)
    assert summary.irr == pytest.approx((526.0 / 400.0) ** 0.5 - 1, rel=1e-9)
    assert summary.irr == pytest.approx(0.14673449, rel=1e-4)


# --------------------------------------------------------------------------
# Multi-tranche, multi-year case checking invariants rather than exact figures.
# --------------------------------------------------------------------------


def _multi_tranche_inputs(**overrides):
    base = dict(
        entry_ebitda=50,
        entry_multiple=9,
        exit_multiple=9,
        hold_period_years=5,
        transaction_fees_pct=0.02,
        revenue=200,
        ebitda_margin=0.25,
        ebitda_growth_rate=0.06,
        capex_pct_revenue=0.03,
        tax_rate=0.25,
        cash_sweep_pct=0.75,
        tranches=[
            DebtTranche(name="Revolver", amount=10, rate=0.06, amort_pct=0.0, seniority=1),
            DebtTranche(name="Term Loan A", leverage_multiple=2.0, rate=0.07, amort_pct=0.05, seniority=2),
            DebtTranche(name="Term Loan B", leverage_multiple=1.5, rate=0.09, amort_pct=0.01, seniority=3),
        ],
    )
    base.update(overrides)
    return LBOInputs(**base)


def test_multi_tranche_invariants():
    inputs = _multi_tranche_inputs()
    result = run_lbo(inputs)

    total_original_debt = result.sources_uses.total_debt
    assert total_original_debt > 0
    assert result.sources_uses.sponsor_equity > 0

    prev_total_ending = None
    for row in result.yearly:
        # Ending debt (per tranche and total) is never negative.
        for name, bal in row.tranche_ending.items():
            assert bal >= -1e-6, f"{name} ending balance went negative: {bal}"
        assert row.total_ending_debt >= -1e-6

        # Sum of tranche paydowns (mandatory + sweep) matches the total
        # mandatory amortization + total sweep applied for the year.
        total_tranche_mandatory = sum(row.tranche_mandatory_amort.values())
        total_tranche_sweep = sum(row.tranche_sweep.values())
        assert total_tranche_mandatory == pytest.approx(row.mandatory_amortization, rel=1e-6)
        assert total_tranche_sweep == pytest.approx(row.sweep_applied, rel=1e-6)

        # Beginning - mandatory - sweep == ending, per tranche.
        for name in row.tranche_beginning:
            expected_ending = (
                row.tranche_beginning[name]
                - row.tranche_mandatory_amort[name]
                - row.tranche_sweep[name]
            )
            assert row.tranche_ending[name] == pytest.approx(expected_ending, rel=1e-6)

        # Debt monotonically declines or stays flat year over year (given
        # positive amortization/sweep and no revolver draws in this scenario).
        if prev_total_ending is not None:
            assert row.total_beginning_debt == pytest.approx(prev_total_ending, rel=1e-6)
        prev_total_ending = row.total_ending_debt

    # MOIC = exit equity / entry equity (definition check).
    summary = result.summary
    assert summary.moic == pytest.approx(summary.exit_equity_value / summary.entry_equity, rel=1e-9)

    # Revolver (seniority 1) should be paid down at least as fast as the more
    # junior Term Loan B (seniority 3) as a fraction of original balance,
    # since sweep cash flows to the most senior tranche first.
    original = result.sources_uses.tranche_amounts
    final_row = result.yearly[-1]
    revolver_paid_frac = 1 - final_row.tranche_ending["Revolver"] / original["Revolver"]
    tlb_paid_frac = 1 - final_row.tranche_ending["Term Loan B"] / original["Term Loan B"]
    assert revolver_paid_frac >= tlb_paid_frac - 1e-9


def test_zero_growth_flat_ebitda():
    inputs = _multi_tranche_inputs(ebitda_growth_rate=0.0, revenue=None, ebitda_margin=None, hold_period_years=3)
    result = run_lbo(inputs)
    for row in result.yearly:
        assert row.ebitda == pytest.approx(inputs.entry_ebitda, rel=1e-9)


def test_per_year_growth_override():
    inputs = _multi_tranche_inputs(
        ebitda_growth_by_year=[0.10, 0.20, 0.0, 0.0, 0.0],
        revenue=None,
        ebitda_margin=None,
    )
    result = run_lbo(inputs)
    e0 = inputs.entry_ebitda
    e1 = e0 * 1.10
    e2 = e1 * 1.20
    assert result.yearly[0].ebitda == pytest.approx(e1)
    assert result.yearly[1].ebitda == pytest.approx(e2)


# --------------------------------------------------------------------------
# Live Postgres integration test for the persistence layer.
# --------------------------------------------------------------------------


def test_persistence_round_trip():
    """Insert a scenario into the live lbo_model_builder database and read it back."""
    from app import db

    inputs = _multi_tranche_inputs(hold_period_years=3)
    result = run_lbo(inputs)

    from dataclasses import asdict

    inputs_dict = {
        "entry_ebitda": inputs.entry_ebitda,
        "entry_multiple": inputs.entry_multiple,
        "exit_multiple": inputs.exit_multiple,
        "hold_period_years": inputs.hold_period_years,
    }
    outputs_dict = asdict(result)

    saved = db.insert_scenario(name="pytest-integration-scenario", inputs=inputs_dict, outputs=outputs_dict)
    assert saved["id"] is not None
    assert saved["name"] == "pytest-integration-scenario"

    fetched = db.get_scenario(str(saved["id"]))
    assert fetched is not None
    assert fetched["name"] == "pytest-integration-scenario"
    assert fetched["outputs"]["summary"]["moic"] == pytest.approx(outputs_dict["summary"]["moic"], rel=1e-6)

    listed = db.list_scenarios()
    assert any(str(row["id"]) == str(saved["id"]) for row in listed)

    deleted = db.delete_scenario(str(saved["id"]))
    assert deleted is True
    assert db.get_scenario(str(saved["id"])) is None

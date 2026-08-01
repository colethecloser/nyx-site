"""
Core LBO (Leveraged Buyout) calculation engine.

Pure functions, no I/O. All monetary figures are in the same units the
caller supplies (e.g. millions of dollars) -- the engine is unit agnostic.

High level flow:
  1. Sources & Uses at entry.
  2. Operating projection (revenue / EBITDA) across the hold period.
  3. Year-by-year debt schedule: interest, mandatory amortization, then a
     cash-flow sweep applied to the most senior outstanding tranche first.
  4. Exit: enterprise value -> equity value net of remaining debt (and any
     accumulated cash if the sweep is < 100%).
  5. Returns: MOIC and IRR on the single entry-equity-outflow /
     exit-equity-inflow cash flow.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


# --------------------------------------------------------------------------
# Input data structures
# --------------------------------------------------------------------------


@dataclass
class DebtTranche:
    name: str
    # Exactly one of amount or leverage_multiple should be provided by the
    # caller; `resolved_amount` is computed once entry EBITDA is known.
    amount: Optional[float] = None
    leverage_multiple: Optional[float] = None
    rate: float = 0.0  # annual cash interest rate, e.g. 0.08 for 8%
    amort_pct: float = 0.0  # mandatory annual amortization, % of ORIGINAL principal
    seniority: int = 1  # lower number = more senior = paid down first in a sweep

    def resolved_amount(self, entry_ebitda: float) -> float:
        if self.amount is not None:
            return float(self.amount)
        if self.leverage_multiple is not None:
            return float(self.leverage_multiple) * entry_ebitda
        return 0.0


@dataclass
class LBOInputs:
    entry_ebitda: float
    entry_multiple: float
    exit_multiple: float
    hold_period_years: int
    transaction_fees_pct: float = 0.02  # % of enterprise value

    # Operating projection
    revenue: Optional[float] = None  # if provided, ebitda_margin derives ebitda
    ebitda_margin: Optional[float] = None
    ebitda_growth_rate: float = 0.05  # flat annual growth, used if ebitda_growth_by_year absent
    ebitda_growth_by_year: Optional[List[float]] = None  # per-year override, length == hold_period_years

    # Cash flow / sweep assumptions
    capex_pct_revenue: float = 0.02
    tax_rate: float = 0.25
    cash_sweep_pct: float = 1.0  # fraction of available FCF swept to debt paydown

    tranches: List[DebtTranche] = field(default_factory=list)


# --------------------------------------------------------------------------
# Output data structures
# --------------------------------------------------------------------------


@dataclass
class SourcesUses:
    purchase_enterprise_value: float
    transaction_fees: float
    total_uses: float
    tranche_amounts: dict  # name -> amount
    total_debt: float
    sponsor_equity: float
    total_sources: float


@dataclass
class YearRow:
    year: int
    revenue: Optional[float]
    ebitda: float
    capex: float
    cash_taxes: float
    interest_expense: float
    mandatory_amortization: float
    unlevered_fcf: float
    cash_available_for_sweep: float
    sweep_applied: float
    cash_accumulated: float
    tranche_beginning: dict
    tranche_interest: dict
    tranche_mandatory_amort: dict
    tranche_sweep: dict
    tranche_ending: dict
    total_beginning_debt: float
    total_ending_debt: float


@dataclass
class Summary:
    entry_equity: float
    exit_enterprise_value: float
    exit_net_debt: float
    exit_equity_value: float
    moic: float
    irr: Optional[float]
    hold_period_years: int


@dataclass
class LBOResult:
    sources_uses: SourcesUses
    yearly: List[YearRow]
    summary: Summary


# --------------------------------------------------------------------------
# IRR (single outflow at t=0, single inflow at t=N) via bisection.
# equity0 = exit_equity / (1 + r) ** years  =>  r = (exit_equity/equity0) ** (1/years) - 1
# Solved analytically when possible, bisection as a robust fallback.
# --------------------------------------------------------------------------


def solve_irr(entry_equity: float, exit_equity: float, years: int) -> Optional[float]:
    if entry_equity <= 0 or years <= 0:
        return None
    if exit_equity <= 0:
        # Total loss or worse -- IRR undefined/-100% or below; return -1.0 as a floor.
        return -1.0

    # Closed-form since this is a single cash-flow pair.
    ratio = exit_equity / entry_equity
    try:
        irr = ratio ** (1.0 / years) - 1.0
        return irr
    except (OverflowError, ValueError):
        pass

    # Fallback: bisection on f(r) = entry_equity - exit_equity / (1+r)^years
    def f(r: float) -> float:
        return entry_equity - exit_equity / ((1 + r) ** years)

    lo, hi = -0.9999, 10.0
    flo, fhi = f(lo), f(hi)
    if flo * fhi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        fm = f(mid)
        if abs(fm) < 1e-9:
            return mid
        if flo * fm < 0:
            hi = mid
            fhi = fm
        else:
            lo = mid
            flo = fm
    return (lo + hi) / 2


# --------------------------------------------------------------------------
# Sources & Uses
# --------------------------------------------------------------------------


def compute_sources_uses(inputs: LBOInputs) -> SourcesUses:
    purchase_ev = inputs.entry_ebitda * inputs.entry_multiple
    fees = purchase_ev * inputs.transaction_fees_pct
    total_uses = purchase_ev + fees

    tranche_amounts = {
        t.name: t.resolved_amount(inputs.entry_ebitda) for t in inputs.tranches
    }
    total_debt = sum(tranche_amounts.values())
    sponsor_equity = total_uses - total_debt  # plug
    total_sources = total_debt + sponsor_equity

    return SourcesUses(
        purchase_enterprise_value=purchase_ev,
        transaction_fees=fees,
        total_uses=total_uses,
        tranche_amounts=tranche_amounts,
        total_debt=total_debt,
        sponsor_equity=sponsor_equity,
        total_sources=total_sources,
    )


# --------------------------------------------------------------------------
# Operating projection
# --------------------------------------------------------------------------


def project_ebitda(inputs: LBOInputs) -> List[float]:
    """Returns a list of length hold_period_years of EBITDA for years 1..N."""
    ebitda = inputs.entry_ebitda
    out = []
    for year in range(1, inputs.hold_period_years + 1):
        if inputs.ebitda_growth_by_year and len(inputs.ebitda_growth_by_year) >= year:
            g = inputs.ebitda_growth_by_year[year - 1]
        else:
            g = inputs.ebitda_growth_rate
        ebitda = ebitda * (1 + g)
        out.append(ebitda)
    return out


def project_revenue(inputs: LBOInputs, ebitda_by_year: List[float]) -> List[Optional[float]]:
    if inputs.revenue is None or inputs.ebitda_margin is None:
        return [None] * len(ebitda_by_year)
    revenue = inputs.revenue
    out = []
    for year in range(1, len(ebitda_by_year) + 1):
        if inputs.ebitda_growth_by_year and len(inputs.ebitda_growth_by_year) >= year:
            g = inputs.ebitda_growth_by_year[year - 1]
        else:
            g = inputs.ebitda_growth_rate
        revenue = revenue * (1 + g)
        out.append(revenue)
    return out


# --------------------------------------------------------------------------
# Debt schedule with cash-flow sweep
# --------------------------------------------------------------------------


def run_debt_schedule(inputs: LBOInputs, sources_uses: SourcesUses,
                       ebitda_by_year: List[float],
                       revenue_by_year: List[Optional[float]]) -> List[YearRow]:
    tranches = sorted(inputs.tranches, key=lambda t: t.seniority)
    original_principal = {t.name: t.resolved_amount(inputs.entry_ebitda) for t in tranches}
    balances = dict(original_principal)

    rows: List[YearRow] = []
    accumulated_cash = 0.0

    for idx, ebitda in enumerate(ebitda_by_year):
        year = idx + 1
        revenue = revenue_by_year[idx]

        # Capex is a % of revenue if revenue is modeled, otherwise % of EBITDA.
        if revenue is not None:
            capex = inputs.capex_pct_revenue * revenue
        else:
            capex = inputs.capex_pct_revenue * ebitda

        tranche_beginning = dict(balances)
        total_beginning_debt = sum(tranche_beginning.values())

        # Interest expense computed on beginning-of-year balances.
        tranche_interest = {
            t.name: tranche_beginning[t.name] * t.rate for t in tranches
        }
        total_interest = sum(tranche_interest.values())

        # Cash taxes: simple EBT-based approximation (EBITDA - capex - interest) * tax_rate,
        # floored at zero (no negative tax / no NOL carryforward modeling).
        taxable_income = max(0.0, ebitda - capex - total_interest)
        cash_taxes = taxable_income * inputs.tax_rate

        # Mandatory amortization: % of ORIGINAL principal, capped at remaining balance.
        tranche_mandatory_amort = {}
        for t in tranches:
            scheduled = t.amort_pct * original_principal[t.name]
            actual = min(scheduled, tranche_beginning[t.name])
            tranche_mandatory_amort[t.name] = actual
        total_mandatory_amort = sum(tranche_mandatory_amort.values())

        # Unlevered-style FCF available for debt service, per spec:
        # EBITDA - capex - cash taxes - mandatory debt service (interest + mandatory amort)
        mandatory_debt_service = total_interest + total_mandatory_amort
        unlevered_fcf = ebitda - capex - cash_taxes - mandatory_debt_service

        cash_available_for_sweep = max(0.0, unlevered_fcf) * inputs.cash_sweep_pct
        # Any FCF not swept (either because sweep_pct < 1, or FCF is negative and
        # therefore nothing is available) is tracked in an accumulated cash balance.
        non_swept_fcf = unlevered_fcf - cash_available_for_sweep

        # Apply post-mandatory-amort balances before sweep.
        post_mandatory_balances = {
            t.name: tranche_beginning[t.name] - tranche_mandatory_amort[t.name]
            for t in tranches
        }

        # Cash sweep: pay down most senior outstanding tranche first, waterfall style.
        remaining_sweep = cash_available_for_sweep
        tranche_sweep = {t.name: 0.0 for t in tranches}
        for t in tranches:
            if remaining_sweep <= 0:
                break
            available_balance = post_mandatory_balances[t.name]
            pay = min(remaining_sweep, available_balance)
            tranche_sweep[t.name] = pay
            remaining_sweep -= pay

        # Any sweep cash left over after all debt is retired accumulates as cash.
        leftover_sweep_cash = remaining_sweep

        tranche_ending = {
            t.name: post_mandatory_balances[t.name] - tranche_sweep[t.name]
            for t in tranches
        }
        total_ending_debt = sum(tranche_ending.values())

        # Accumulate (or draw down, if FCF was negative) the cash balance.
        # A negative running balance signals a cash shortfall that in reality
        # would require a revolver draw -- modeling that draw is out of scope
        # here, so we simply surface the shortfall as negative accumulated cash.
        accumulated_cash += non_swept_fcf + leftover_sweep_cash

        balances = tranche_ending

        rows.append(YearRow(
            year=year,
            revenue=revenue,
            ebitda=ebitda,
            capex=capex,
            cash_taxes=cash_taxes,
            interest_expense=total_interest,
            mandatory_amortization=total_mandatory_amort,
            unlevered_fcf=unlevered_fcf,
            cash_available_for_sweep=cash_available_for_sweep,
            sweep_applied=cash_available_for_sweep - leftover_sweep_cash,
            cash_accumulated=accumulated_cash,
            tranche_beginning=tranche_beginning,
            tranche_interest=tranche_interest,
            tranche_mandatory_amort=tranche_mandatory_amort,
            tranche_sweep=tranche_sweep,
            tranche_ending=tranche_ending,
            total_beginning_debt=total_beginning_debt,
            total_ending_debt=total_ending_debt,
        ))

    return rows


# --------------------------------------------------------------------------
# Exit & returns
# --------------------------------------------------------------------------


def compute_summary(inputs: LBOInputs, sources_uses: SourcesUses, yearly: List[YearRow]) -> Summary:
    last_row = yearly[-1]
    exit_ebitda = last_row.ebitda
    exit_ev = exit_ebitda * inputs.exit_multiple
    net_debt = last_row.total_ending_debt - last_row.cash_accumulated
    exit_equity_value = exit_ev - net_debt

    entry_equity = sources_uses.sponsor_equity
    moic = exit_equity_value / entry_equity if entry_equity else 0.0
    irr = solve_irr(entry_equity, exit_equity_value, inputs.hold_period_years)

    return Summary(
        entry_equity=entry_equity,
        exit_enterprise_value=exit_ev,
        exit_net_debt=net_debt,
        exit_equity_value=exit_equity_value,
        moic=moic,
        irr=irr,
        hold_period_years=inputs.hold_period_years,
    )


# --------------------------------------------------------------------------
# Top-level orchestration
# --------------------------------------------------------------------------


def run_lbo(inputs: LBOInputs) -> LBOResult:
    sources_uses = compute_sources_uses(inputs)
    ebitda_by_year = project_ebitda(inputs)
    revenue_by_year = project_revenue(inputs, ebitda_by_year)
    yearly = run_debt_schedule(inputs, sources_uses, ebitda_by_year, revenue_by_year)
    summary = compute_summary(inputs, sources_uses, yearly)
    return LBOResult(sources_uses=sources_uses, yearly=yearly, summary=summary)

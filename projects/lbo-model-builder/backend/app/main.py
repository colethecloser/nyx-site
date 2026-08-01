"""FastAPI application exposing the LBO calculation engine and scenario persistence."""

from dataclasses import asdict
from typing import List, Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import db
from app.lbo import DebtTranche, LBOInputs, run_lbo

app = FastAPI(title="LBO Model Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Pydantic request/response models
# --------------------------------------------------------------------------


class DebtTrancheIn(BaseModel):
    name: str
    amount: Optional[float] = None
    leverage_multiple: Optional[float] = None
    rate: float = 0.0
    amort_pct: float = 0.0
    seniority: int = 1


class LBOInputsIn(BaseModel):
    entry_ebitda: float = Field(..., gt=0)
    entry_multiple: float = Field(..., gt=0)
    exit_multiple: float = Field(..., gt=0)
    hold_period_years: int = Field(..., gt=0, le=20)
    transaction_fees_pct: float = 0.02

    revenue: Optional[float] = None
    ebitda_margin: Optional[float] = None
    ebitda_growth_rate: float = 0.05
    ebitda_growth_by_year: Optional[List[float]] = None

    capex_pct_revenue: float = 0.02
    tax_rate: float = 0.25
    cash_sweep_pct: float = 1.0

    tranches: List[DebtTrancheIn] = Field(default_factory=list)

    def to_engine_inputs(self) -> LBOInputs:
        return LBOInputs(
            entry_ebitda=self.entry_ebitda,
            entry_multiple=self.entry_multiple,
            exit_multiple=self.exit_multiple,
            hold_period_years=self.hold_period_years,
            transaction_fees_pct=self.transaction_fees_pct,
            revenue=self.revenue,
            ebitda_margin=self.ebitda_margin,
            ebitda_growth_rate=self.ebitda_growth_rate,
            ebitda_growth_by_year=self.ebitda_growth_by_year,
            capex_pct_revenue=self.capex_pct_revenue,
            tax_rate=self.tax_rate,
            cash_sweep_pct=self.cash_sweep_pct,
            tranches=[
                DebtTranche(
                    name=t.name,
                    amount=t.amount,
                    leverage_multiple=t.leverage_multiple,
                    rate=t.rate,
                    amort_pct=t.amort_pct,
                    seniority=t.seniority,
                )
                for t in self.tranches
            ],
        )


class ScenarioCreate(BaseModel):
    name: str
    inputs: LBOInputsIn


def _run_and_serialize(inputs_in: LBOInputsIn) -> dict:
    engine_inputs = inputs_in.to_engine_inputs()
    result = run_lbo(engine_inputs)
    return asdict(result)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/lbo/run")
def run(inputs: LBOInputsIn):
    try:
        return _run_and_serialize(inputs)
    except ZeroDivisionError:
        raise HTTPException(status_code=400, detail="Invalid inputs produced a division by zero.")


@app.post("/api/lbo/scenarios")
def create_scenario(payload: ScenarioCreate):
    outputs = _run_and_serialize(payload.inputs)
    row = db.insert_scenario(
        name=payload.name,
        inputs=payload.inputs.model_dump(),
        outputs=outputs,
    )
    return row


@app.get("/api/lbo/scenarios")
def list_scenarios():
    rows = db.list_scenarios()
    out = []
    for r in rows:
        out.append({
            "id": str(r["id"]),
            "name": r["name"],
            "created_at": r["created_at"],
            "irr": float(r["irr"]) if r["irr"] is not None else None,
            "moic": float(r["moic"]) if r["moic"] is not None else None,
        })
    return out


@app.get("/api/lbo/scenarios/{scenario_id}")
def get_scenario(scenario_id: UUID):
    row = db.get_scenario(str(scenario_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return row


@app.delete("/api/lbo/scenarios/{scenario_id}")
def delete_scenario(scenario_id: UUID):
    deleted = db.delete_scenario(str(scenario_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"deleted": True}

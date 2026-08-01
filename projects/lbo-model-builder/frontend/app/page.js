"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_TRANCHES = [
  { name: "Revolver", amount: "10", leverageMultiple: "", rate: "6", amortPct: "0", seniority: 1 },
  { name: "Term Loan A", amount: "", leverageMultiple: "2.0", rate: "7", amortPct: "5", seniority: 2 },
  { name: "Term Loan B", amount: "", leverageMultiple: "1.5", rate: "9", amortPct: "1", seniority: 3 },
];

const DEFAULT_FORM = {
  entryEbitda: "50",
  entryMultiple: "9",
  exitMultiple: "9.5",
  holdPeriodYears: "5",
  ebitdaGrowthRate: "6",
  capexPctRevenue: "2",
  taxRate: "25",
  transactionFeesPct: "2",
  cashSweepPct: "90",
};

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtPct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return `${(Number(n) * 100).toFixed(digits)}%`;
}

function buildPayload(form, tranches) {
  return {
    entry_ebitda: parseFloat(form.entryEbitda),
    entry_multiple: parseFloat(form.entryMultiple),
    exit_multiple: parseFloat(form.exitMultiple),
    hold_period_years: parseInt(form.holdPeriodYears, 10),
    transaction_fees_pct: parseFloat(form.transactionFeesPct) / 100,
    ebitda_growth_rate: parseFloat(form.ebitdaGrowthRate) / 100,
    capex_pct_revenue: parseFloat(form.capexPctRevenue) / 100,
    tax_rate: parseFloat(form.taxRate) / 100,
    cash_sweep_pct: parseFloat(form.cashSweepPct) / 100,
    tranches: tranches.map((t) => ({
      name: t.name,
      amount: t.amount !== "" ? parseFloat(t.amount) : null,
      leverage_multiple: t.leverageMultiple !== "" ? parseFloat(t.leverageMultiple) : null,
      rate: parseFloat(t.rate || "0") / 100,
      amort_pct: parseFloat(t.amortPct || "0") / 100,
      seniority: t.seniority,
    })),
  };
}

export default function Home() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tranches, setTranches] = useState(DEFAULT_TRANCHES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState([]);

  const loadScenarios = () => {
    fetch(`${API_URL}/api/lbo/scenarios`)
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => {});
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const runModel = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/lbo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form, tranches)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const saveScenario = async () => {
    if (!scenarioName.trim()) {
      setError("Enter a scenario name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/lbo/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: scenarioName, inputs: buildPayload(form, tranches) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      setResult(saved.outputs);
      setScenarioName("");
      loadScenarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadScenario = async (id) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/lbo/scenarios/${id}`);
      if (!res.ok) throw new Error("Could not load scenario");
      const data = await res.json();
      setResult(data.outputs);

      const inp = data.inputs;
      setForm({
        entryEbitda: String(inp.entry_ebitda ?? ""),
        entryMultiple: String(inp.entry_multiple ?? ""),
        exitMultiple: String(inp.exit_multiple ?? ""),
        holdPeriodYears: String(inp.hold_period_years ?? ""),
        ebitdaGrowthRate: String((inp.ebitda_growth_rate ?? 0) * 100),
        capexPctRevenue: String((inp.capex_pct_revenue ?? 0) * 100),
        taxRate: String((inp.tax_rate ?? 0) * 100),
        transactionFeesPct: String((inp.transaction_fees_pct ?? 0) * 100),
        cashSweepPct: String((inp.cash_sweep_pct ?? 0) * 100),
      });
      if (Array.isArray(inp.tranches) && inp.tranches.length) {
        setTranches(
          inp.tranches.map((t) => ({
            name: t.name,
            amount: t.amount !== null && t.amount !== undefined ? String(t.amount) : "",
            leverageMultiple:
              t.leverage_multiple !== null && t.leverage_multiple !== undefined
                ? String(t.leverage_multiple)
                : "",
            rate: String((t.rate ?? 0) * 100),
            amortPct: String((t.amort_pct ?? 0) * 100),
            seniority: t.seniority,
          }))
        );
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const updateTranche = (idx, field, value) => {
    setTranches((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const irr = result?.summary?.irr;
  const moic = result?.summary?.moic;

  return (
    <div className="page">
      <h1>LBO Model Builder</h1>
      <p className="subtitle">A simple leveraged buyout modeling tool.</p>
      <div className="disclaimer">
        Illustrative learning / portfolio project only. Not investment advice.
      </div>

      <form className="card" onSubmit={runModel}>
        <h2>Deal Assumptions</h2>
        <div className="grid">
          <div className="field">
            <label>Entry EBITDA ($mm)</label>
            <input
              type="number"
              step="any"
              value={form.entryEbitda}
              onChange={(e) => setForm({ ...form, entryEbitda: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Entry Multiple (x)</label>
            <input
              type="number"
              step="any"
              value={form.entryMultiple}
              onChange={(e) => setForm({ ...form, entryMultiple: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Exit Multiple (x)</label>
            <input
              type="number"
              step="any"
              value={form.exitMultiple}
              onChange={(e) => setForm({ ...form, exitMultiple: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Hold Period (years)</label>
            <input
              type="number"
              value={form.holdPeriodYears}
              onChange={(e) => setForm({ ...form, holdPeriodYears: e.target.value })}
            />
          </div>
          <div className="field">
            <label>EBITDA Growth Rate (%/yr)</label>
            <input
              type="number"
              step="any"
              value={form.ebitdaGrowthRate}
              onChange={(e) => setForm({ ...form, ebitdaGrowthRate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Capex (% of Revenue/EBITDA)</label>
            <input
              type="number"
              step="any"
              value={form.capexPctRevenue}
              onChange={(e) => setForm({ ...form, capexPctRevenue: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cash Tax Rate (%)</label>
            <input
              type="number"
              step="any"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Transaction Fees (% of EV)</label>
            <input
              type="number"
              step="any"
              value={form.transactionFeesPct}
              onChange={(e) => setForm({ ...form, transactionFeesPct: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cash Sweep (%)</label>
            <input
              type="number"
              step="any"
              value={form.cashSweepPct}
              onChange={(e) => setForm({ ...form, cashSweepPct: e.target.value })}
            />
          </div>
        </div>

        <h2 style={{ marginTop: 24 }}>Debt Tranches</h2>
        <div className="table-wrap">
          <table className="tranches-table">
            <thead>
              <tr>
                <th>Tranche</th>
                <th>Amount ($mm)</th>
                <th>or Leverage (x EBITDA)</th>
                <th>Rate (%)</th>
                <th>Mandatory Amort (%/yr)</th>
                <th>Seniority</th>
              </tr>
            </thead>
            <tbody>
              {tranches.map((t, idx) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={t.amount}
                      placeholder="-"
                      onChange={(e) => updateTranche(idx, "amount", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={t.leverageMultiple}
                      placeholder="-"
                      onChange={(e) => updateTranche(idx, "leverageMultiple", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={t.rate}
                      onChange={(e) => updateTranche(idx, "rate", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={t.amortPct}
                      onChange={(e) => updateTranche(idx, "amortPct", e.target.value)}
                    />
                  </td>
                  <td>{t.seniority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? "Running..." : "Run Model"}
          </button>
          <div className="save-row">
            <input
              type="text"
              placeholder="Scenario name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
            />
            <button type="button" className="secondary" onClick={saveScenario} disabled={saving}>
              {saving ? "Saving..." : "Save scenario"}
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {result && (
        <>
          <div className="card">
            <h2>Summary</h2>
            <div className="summary-grid">
              <div className="summary-stat">
                <div className="label">Entry Equity</div>
                <div className="value">${fmt(result.summary.entry_equity)}mm</div>
              </div>
              <div className="summary-stat">
                <div className="label">Exit Equity Value</div>
                <div className="value">${fmt(result.summary.exit_equity_value)}mm</div>
              </div>
              <div className="summary-stat">
                <div className="label">MOIC</div>
                <div className={`value ${moic >= 1 ? "good" : "bad"}`}>{fmt(moic, 2)}x</div>
              </div>
              <div className="summary-stat">
                <div className="label">IRR</div>
                <div className={`value ${irr >= 0 ? "good" : "bad"}`}>{fmtPct(irr)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Sources &amp; Uses</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Uses</th>
                    <th>$mm</th>
                    <th>Sources</th>
                    <th>$mm</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Purchase Enterprise Value</td>
                    <td>{fmt(result.sources_uses.purchase_enterprise_value)}</td>
                    <td>Total Debt</td>
                    <td>{fmt(result.sources_uses.total_debt)}</td>
                  </tr>
                  <tr>
                    <td>Transaction Fees</td>
                    <td>{fmt(result.sources_uses.transaction_fees)}</td>
                    <td>Sponsor Equity</td>
                    <td>{fmt(result.sources_uses.sponsor_equity)}</td>
                  </tr>
                  <tr>
                    <td><strong>Total Uses</strong></td>
                    <td><strong>{fmt(result.sources_uses.total_uses)}</strong></td>
                    <td><strong>Total Sources</strong></td>
                    <td><strong>{fmt(result.sources_uses.total_sources)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Year-by-Year Debt Schedule</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>EBITDA</th>
                    <th>Interest</th>
                    <th>Mandatory Amort</th>
                    <th>Sweep</th>
                    <th>Unlevered FCF</th>
                    <th>Beg. Debt</th>
                    <th>End Debt</th>
                    <th>Cash Bal.</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearly.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{fmt(row.ebitda)}</td>
                      <td>{fmt(row.interest_expense)}</td>
                      <td>{fmt(row.mandatory_amortization)}</td>
                      <td>{fmt(row.sweep_applied)}</td>
                      <td>{fmt(row.unlevered_fcf)}</td>
                      <td>{fmt(row.total_beginning_debt)}</td>
                      <td>{fmt(row.total_ending_debt)}</td>
                      <td>{fmt(row.cash_accumulated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginTop: 20, fontSize: "0.95rem" }}>Ending Debt by Tranche</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    {tranches.map((t) => (
                      <th key={t.name}>{t.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.yearly.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      {Object.keys(row.tranche_ending).map((name) => (
                        <td key={name}>{fmt(row.tranche_ending[name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h2>Saved Scenarios</h2>
        {scenarios.length === 0 && <p style={{ color: "var(--muted)" }}>No scenarios saved yet.</p>}
        <ul className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <button className="scenario-row-btn" onClick={() => loadScenario(s.id)}>
                {s.name}
              </button>
              <span className="scenario-meta">
                MOIC {fmt(s.moic, 2)}x &middot; IRR {fmtPct(s.irr)} &middot;{" "}
                {new Date(s.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

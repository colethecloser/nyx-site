import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SORT_OPTIONS = [
  { value: 'score', label: 'Screen Score' },
  { value: 'multiple', label: 'EV / EBITDA Multiple' },
  { value: 'growth', label: 'Revenue Growth' },
  { value: 'margin', label: 'EBITDA Margin' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'fcf_conversion', label: 'FCF Conversion' },
  { value: 'leverage_capacity', label: 'Leverage Capacity' },
]

const DEFAULT_FILTERS = {
  sector: '',
  min_ebitda_margin: '',
  min_revenue_growth: '',
  min_fcf_conversion: '',
  max_ev_ebitda_multiple: '',
  sort_by: 'score',
  order: 'desc',
}

function scoreClass(score) {
  if (score >= 65) return 'row-high'
  if (score >= 40) return 'row-mid'
  return 'row-low'
}

function fmt(n, digits = 1) {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(digits)
}

function App() {
  const [sectors, setSectors] = useState([])
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/sectors`)
      .then((r) => r.json())
      .then(setSectors)
      .catch((e) => setError(`Could not load sectors: ${e.message}`))
  }, [])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.sector) params.set('sector', filters.sector)
    if (filters.min_ebitda_margin !== '') params.set('min_ebitda_margin', filters.min_ebitda_margin)
    if (filters.min_revenue_growth !== '') params.set('min_revenue_growth', filters.min_revenue_growth)
    if (filters.min_fcf_conversion !== '') params.set('min_fcf_conversion', filters.min_fcf_conversion)
    if (filters.max_ev_ebitda_multiple !== '') params.set('max_ev_ebitda_multiple', filters.max_ev_ebitda_multiple)
    params.set('sort_by', filters.sort_by)
    params.set('order', filters.order)
    return params.toString()
  }, [filters])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/api/targets?${queryString}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setTargets)
      .catch((e) => setError(`Could not load targets: ${e.message}`))
      .finally(() => setLoading(false))
  }, [queryString])

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PE Deal Screener</h1>
        <p className="subtitle">
          Screen acquisition targets on margin, growth, FCF conversion, leverage capacity, and valuation.
          <br />
          <strong>All company data is fictional / illustrative.</strong>
        </p>
      </header>

      <section className="filter-panel">
        <div className="filter-group">
          <label htmlFor="sector">Sector</label>
          <select
            id="sector"
            value={filters.sector}
            onChange={(e) => updateFilter('sector', e.target.value)}
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="min_ebitda_margin">Min EBITDA margin (%)</label>
          <input
            id="min_ebitda_margin"
            type="number"
            placeholder="e.g. 15"
            value={filters.min_ebitda_margin}
            onChange={(e) => updateFilter('min_ebitda_margin', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="min_revenue_growth">Min revenue growth (%)</label>
          <input
            id="min_revenue_growth"
            type="number"
            placeholder="e.g. 10"
            value={filters.min_revenue_growth}
            onChange={(e) => updateFilter('min_revenue_growth', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="min_fcf_conversion">Min FCF conversion (0-1)</label>
          <input
            id="min_fcf_conversion"
            type="number"
            step="0.05"
            placeholder="e.g. 0.5"
            value={filters.min_fcf_conversion}
            onChange={(e) => updateFilter('min_fcf_conversion', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="max_ev_ebitda_multiple">Max EV / EBITDA</label>
          <input
            id="max_ev_ebitda_multiple"
            type="number"
            step="0.5"
            placeholder="e.g. 10"
            value={filters.max_ev_ebitda_multiple}
            onChange={(e) => updateFilter('max_ev_ebitda_multiple', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="sort_by">Sort by</label>
          <select id="sort_by" value={filters.sort_by} onChange={(e) => updateFilter('sort_by', e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="order">Order</label>
          <select id="order" value={filters.order} onChange={(e) => updateFilter('order', e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <div className="filter-group filter-reset">
          <button type="button" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="results">
        <div className="results-meta">
          {loading ? 'Loading…' : `${targets.length} target${targets.length === 1 ? '' : 's'} matched`}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sector</th>
                <th className="num">Revenue ($M)</th>
                <th className="num">EBITDA Margin</th>
                <th className="num">Rev. Growth</th>
                <th className="num">FCF Conversion</th>
                <th className="num">EV / EBITDA</th>
                <th className="num">Leverage Capacity ($M)</th>
                <th className="num">Screen Score</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className={scoreClass(t.metrics.screen_score)}>
                  <td>{t.name}</td>
                  <td>{t.sector}</td>
                  <td className="num">{fmt(t.revenue_musd)}</td>
                  <td className="num">{fmt(t.ebitda_margin_pct)}%</td>
                  <td className="num">{fmt(t.revenue_growth_pct)}%</td>
                  <td className="num">{fmt(t.metrics.fcf_conversion * 100)}%</td>
                  <td className="num">{fmt(t.metrics.ev_ebitda_multiple)}x</td>
                  <td className="num">{fmt(t.metrics.leverage_capacity_musd)}</td>
                  <td className="num score-cell">{fmt(t.metrics.screen_score)}</td>
                </tr>
              ))}
              {!loading && targets.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">
                    No targets match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span className="legend-swatch row-high" /> High score (≥65)
          <span className="legend-swatch row-mid" /> Mid score (40-64)
          <span className="legend-swatch row-low" /> Low score (&lt;40)
        </div>
      </section>
    </div>
  )
}

export default App

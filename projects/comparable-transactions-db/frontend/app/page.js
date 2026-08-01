"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  fetchTransactions,
  fetchTransactionStats,
  fetchSectors,
  fetchSponsors,
  DEAL_TYPES,
  formatMoney,
  formatMultiple,
  formatYear,
  dealTypeLabel,
  exitTypeLabel,
} from "@/lib/api";

const PAGE_SIZE = 15;

const emptyFilters = {
  sector: "",
  sponsor: "",
  deal_type: "",
  year_from: "",
  year_to: "",
  min_ev_ebitda: "",
  max_ev_ebitda: "",
};

export default function Home() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("announced_date");
  const [order, setOrder] = useState("desc");

  const [sectors, setSectors] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSectors()
      .then((d) => setSectors(d.sectors || []))
      .catch(() => {});
    fetchSponsors().catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...appliedFilters,
        sort_by: sortBy,
        order,
        page,
        page_size: PAGE_SIZE,
      };
      const [txData, statsData] = await Promise.all([
        fetchTransactions(params),
        fetchTransactionStats(appliedFilters),
      ]);
      setResults(txData.results || []);
      setTotal(txData.total || 0);
      setStats(statsData);
    } catch (e) {
      setError(
        `Could not reach the API at ${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        }. Is the backend running? (${e.message})`
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, sortBy, order]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterChange(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  function toggleSort(column) {
    if (sortBy === column) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setOrder("desc");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-shell">
      <div className="disclaimer-banner">
        <strong>Illustrative demo data.</strong> All transaction figures
        (enterprise values, multiples, leverage, MOIC/IRR) are approximate and
        assembled for a portfolio demo — not verified deal data, and not
        suitable for real investment diligence. See the project README for
        details.
      </div>

      <form className="card" onSubmit={applyFilters} style={{ marginBottom: 20 }}>
        <div className="section-title">Search precedent transactions</div>
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="sector">Sector</label>
            <select
              id="sector"
              value={filters.sector}
              onChange={(e) => handleFilterChange("sector", e.target.value)}
            >
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sponsor">Sponsor (search)</label>
            <input
              id="sponsor"
              type="text"
              placeholder="e.g. KKR"
              value={filters.sponsor}
              onChange={(e) => handleFilterChange("sponsor", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="deal_type">Deal type</label>
            <select
              id="deal_type"
              value={filters.deal_type}
              onChange={(e) => handleFilterChange("deal_type", e.target.value)}
            >
              {DEAL_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Year announced</label>
            <div className="range-pair">
              <input
                type="number"
                placeholder="From"
                value={filters.year_from}
                onChange={(e) => handleFilterChange("year_from", e.target.value)}
              />
              <input
                type="number"
                placeholder="To"
                value={filters.year_to}
                onChange={(e) => handleFilterChange("year_to", e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>EV / EBITDA range</label>
            <div className="range-pair">
              <input
                type="number"
                step="0.1"
                placeholder="Min"
                value={filters.min_ev_ebitda}
                onChange={(e) =>
                  handleFilterChange("min_ev_ebitda", e.target.value)
                }
              />
              <input
                type="number"
                step="0.1"
                placeholder="Max"
                value={filters.max_ev_ebitda}
                onChange={(e) =>
                  handleFilterChange("max_ev_ebitda", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="layout-two-col">
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort("target_name")} style={{ cursor: "pointer" }}>
                    Target
                  </th>
                  <th>Sponsor</th>
                  <th onClick={() => toggleSort("sector")} style={{ cursor: "pointer" }}>
                    Sector
                  </th>
                  <th onClick={() => toggleSort("announced_date")} style={{ cursor: "pointer" }}>
                    Year
                  </th>
                  <th onClick={() => toggleSort("enterprise_value_musd")} style={{ cursor: "pointer" }}>
                    EV
                  </th>
                  <th onClick={() => toggleSort("ev_ebitda_multiple")} style={{ cursor: "pointer" }}>
                    EV/EBITDA
                  </th>
                  <th onClick={() => toggleSort("ev_revenue_multiple")} style={{ cursor: "pointer" }}>
                    EV/Revenue
                  </th>
                  <th>Deal type</th>
                  <th>Exit</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="loading">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && results.length === 0 && !error && (
                  <tr>
                    <td colSpan={9} className="loading">
                      No transactions match these filters.
                    </td>
                  </tr>
                )}
                {!loading &&
                  results.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/transactions/${row.id}`}>
                          {row.target_name}
                        </Link>
                      </td>
                      <td>{row.acquirer_sponsor}</td>
                      <td>{row.sector}</td>
                      <td>{formatYear(row.announced_date)}</td>
                      <td>{formatMoney(row.enterprise_value_musd)}</td>
                      <td>{formatMultiple(row.ev_ebitda_multiple)}</td>
                      <td>{formatMultiple(row.ev_revenue_multiple)}</td>
                      <td>{dealTypeLabel(row.deal_type)}</td>
                      <td>
                        <span className={`badge exit-${row.exit_type || "still_held"}`}>
                          {exitTypeLabel(row.exit_type)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} · {total} transaction
              {total === 1 ? "" : "s"}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>

        <aside className="card">
          <div className="section-title">Benchmark stats (current filter)</div>
          {!stats && <div className="muted">Loading stats…</div>}
          {stats && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div className="stat-row">
                  <span className="stat-label">Deals in set</span>
                  <span className="stat-value">
                    {stats.overall?.deal_count ?? 0}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Median EV/EBITDA</span>
                  <span className="stat-value">
                    {formatMultiple(stats.overall?.median_ev_ebitda)}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg EV/EBITDA</span>
                  <span className="stat-value">
                    {formatMultiple(stats.overall?.avg_ev_ebitda)}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Median EV/Revenue</span>
                  <span className="stat-value">
                    {formatMultiple(stats.overall?.median_ev_revenue)}
                  </span>
                </div>
              </div>

              <div className="section-title" style={{ fontSize: "0.85rem" }}>
                Median EV/EBITDA by sector
              </div>
              {(stats.by_sector || []).length === 0 && (
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  No data for current filters.
                </div>
              )}
              {(stats.by_sector || []).map((s) => (
                <div className="stat-row" key={s.sector}>
                  <span className="stat-label">
                    {s.sector} ({s.deal_count})
                  </span>
                  <span className="stat-value">
                    {formatMultiple(s.median_ev_ebitda)}
                  </span>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

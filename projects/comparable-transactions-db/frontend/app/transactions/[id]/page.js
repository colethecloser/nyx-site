"use client";

// Client-rendered detail page: the backend is fetched at request time in the
// browser (useEffect), not at build time, so `next build` never needs a live
// backend available, and no server-side prerendering fetch can fail at build time.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchTransaction,
  formatMoney,
  formatMultiple,
  formatDate,
  dealTypeLabel,
  exitTypeLabel,
} from "@/lib/api";

export default function TransactionDetailPage() {
  const params = useParams();
  const { id } = params;

  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchTransaction(id)
      .then(setTxn)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="page-shell">
      <Link href="/" className="back-link">
        &larr; Back to search
      </Link>

      {loading && <div className="loading">Loading transaction…</div>}

      {error && (
        <div className="error-box">
          Could not load transaction #{id}: {error}
        </div>
      )}

      {!loading && !error && !txn && (
        <div className="error-box">Transaction #{id} was not found.</div>
      )}

      {txn && (
        <div className="card">
          <div className="section-title" style={{ fontSize: "1.4rem" }}>
            {txn.target_name}
          </div>
          <div className="muted" style={{ marginBottom: 4 }}>
            {txn.sector} · Acquired by {txn.acquirer_sponsor}
          </div>
          <div className="muted" style={{ marginBottom: 16 }}>
            Announced {formatDate(txn.announced_date)}
            {txn.closed_date ? ` · Closed ${formatDate(txn.closed_date)}` : ""}
            {" · "}
            {dealTypeLabel(txn.deal_type)}
          </div>

          <div className="disclaimer-banner">
            Illustrative demo data — figures are approximate, not verified
            deal data. {txn.source_notes}
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <div className="label">Enterprise value</div>
              <div className="value">
                {formatMoney(txn.enterprise_value_musd)}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">LTM revenue</div>
              <div className="value">{formatMoney(txn.ltm_revenue_musd)}</div>
            </div>
            <div className="detail-item">
              <div className="label">LTM EBITDA</div>
              <div className="value">{formatMoney(txn.ltm_ebitda_musd)}</div>
            </div>
            <div className="detail-item">
              <div className="label">EV / EBITDA</div>
              <div className="value">
                {formatMultiple(txn.ev_ebitda_multiple)}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">EV / Revenue</div>
              <div className="value">
                {formatMultiple(txn.ev_revenue_multiple)}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">Equity contribution</div>
              <div className="value">
                {txn.equity_contribution_pct != null
                  ? `${txn.equity_contribution_pct}%`
                  : "—"}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">Debt / EBITDA at close</div>
              <div className="value">
                {formatMultiple(txn.debt_ebitda_multiple)}
              </div>
            </div>
          </div>

          <div className="section-title" style={{ fontSize: "0.95rem" }}>
            Financing structure
          </div>
          <div className="notes-block">
            {txn.financing_structure_notes || "No details available."}
          </div>

          <div
            className="section-title"
            style={{ fontSize: "0.95rem", marginTop: 20 }}
          >
            Exit
          </div>
          <div className="detail-grid" style={{ marginTop: 0 }}>
            <div className="detail-item">
              <div className="label">Exit status</div>
              <div className="value">{exitTypeLabel(txn.exit_type)}</div>
            </div>
            <div className="detail-item">
              <div className="label">Exit date</div>
              <div className="value">{formatDate(txn.exit_date)}</div>
            </div>
            <div className="detail-item">
              <div className="label">Exit multiple (EV/EBITDA)</div>
              <div className="value">{formatMultiple(txn.exit_multiple)}</div>
            </div>
            <div className="detail-item">
              <div className="label">MOIC</div>
              <div className="value">
                {txn.moic != null ? `${txn.moic}x` : "—"}
              </div>
            </div>
            <div className="detail-item">
              <div className="label">IRR</div>
              <div className="value">
                {txn.irr_pct != null ? `${txn.irr_pct}%` : "—"}
              </div>
            </div>
          </div>

          <div
            className="section-title"
            style={{ fontSize: "0.95rem", marginTop: 20 }}
          >
            Source notes
          </div>
          <div className="notes-block">{txn.source_notes}</div>
        </div>
      )}
    </div>
  );
}

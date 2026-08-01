export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      usp.set(key, value);
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchTransactions(params) {
  const res = await fetch(`${API_URL}/api/transactions${buildQuery(params)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch transactions (${res.status})`);
  return res.json();
}

export async function fetchTransactionStats(params) {
  const res = await fetch(
    `${API_URL}/api/transactions/stats${buildQuery(params)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch stats (${res.status})`);
  return res.json();
}

export async function fetchTransaction(id) {
  const res = await fetch(`${API_URL}/api/transactions/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch transaction (${res.status})`);
  return res.json();
}

export async function fetchSectors() {
  const res = await fetch(`${API_URL}/api/sectors`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sectors (${res.status})`);
  return res.json();
}

export async function fetchSponsors() {
  const res = await fetch(`${API_URL}/api/sponsors`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sponsors (${res.status})`);
  return res.json();
}

export const DEAL_TYPES = [
  { value: "", label: "All deal types" },
  { value: "going_private", label: "Going private" },
  { value: "carve_out", label: "Carve-out" },
  { value: "secondary_buyout", label: "Secondary buyout" },
  { value: "growth_buyout", label: "Growth buyout" },
];

export function formatMoney(musd) {
  if (musd === null || musd === undefined) return "—";
  const n = Number(musd);
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}B`;
  }
  return `$${n.toFixed(0)}M`;
}

export function formatMultiple(x) {
  if (x === null || x === undefined) return "—";
  return `${Number(x).toFixed(1)}x`;
}

export function formatYear(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).getFullYear();
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return dateStr;
}

export function dealTypeLabel(value) {
  const found = DEAL_TYPES.find((d) => d.value === value);
  return found ? found.label : value;
}

export function exitTypeLabel(value) {
  const map = {
    ipo: "IPO",
    strategic_sale: "Strategic sale",
    secondary_sale: "Secondary sale",
    still_held: "Still held",
  };
  return map[value] || value || "Unknown";
}

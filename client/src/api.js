const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchDivisionDashboard() {
  const res = await fetch(`${API_BASE}/orgs/division`);
  if (!res.ok) throw new Error(`Failed to load division (${res.status})`);
  return res.json();
}

export async function fetchOrgDashboard(orgId) {
  const res = await fetch(`${API_BASE}/orgs/${orgId}/dashboard`);
  if (!res.ok) throw new Error(`Failed to load organisation (${res.status})`);
  return res.json();
}

export async function runQuery(question) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Query failed');
  return data;
}

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#3dba8a', '#5b8def', '#d4a017', '#d4654a', '#8b7fd6', '#4ecdc4', '#c0c7c3'];

export function EquipmentCategoryChart({ data }) {
  const rows = (data || []).map((d) => ({
    category: d.category,
    serviceable: d.serviceable,
    maintenance: d.in_maintenance,
    deployed: d.deployed,
  }));

  if (!rows.length) return <p className="empty">No equipment rolled up at this level.</p>;

  return (
    <div className="chart-box">
      <h3>Equipment by category</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a4038" />
          <XAxis dataKey="category" tick={{ fill: '#8fa39a', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#8fa39a', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#13201c', border: '1px solid #2a4038' }} />
          <Legend />
          <Bar dataKey="serviceable" stackId="a" fill="#3dba8a" name="Serviceable" />
          <Bar dataKey="maintenance" stackId="a" fill="#d4654a" name="Maintenance" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReadinessTrendChart({ data }) {
  const rows = (data || []).map((d) => ({
    day: new Date(d.sampled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    readiness: Math.round(d.readiness_pct),
    fuel: d.fuel_days,
    ammo: d.ammo_days,
  }));

  if (!rows.length) return <p className="empty">No readiness history.</p>;

  return (
    <div className="chart-box">
      <h3>Readiness trend (14 days)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a4038" />
          <XAxis dataKey="day" tick={{ fill: '#8fa39a', fontSize: 11 }} />
          <YAxis domain={[50, 100]} tick={{ fill: '#8fa39a', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#13201c', border: '1px solid #2a4038' }} />
          <Legend />
          <Line type="monotone" dataKey="readiness" stroke="#3dba8a" strokeWidth={2} dot={false} name="Readiness %" />
          <Line type="monotone" dataKey="fuel" stroke="#5b8def" strokeWidth={2} dot={false} name="Fuel days" />
          <Line type="monotone" dataKey="ammo" stroke="#d4a017" strokeWidth={2} dot={false} name="Ammo days" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChildReadinessChart({ children }) {
  const rows = (children || []).map((c) => ({
    name: c.short_name,
    readiness: Math.round(c.readiness_pct),
  }));

  if (!rows.length) return <p className="empty">No subordinate formations.</p>;

  return (
    <div className="chart-box">
      <h3>Subordinate readiness</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a4038" />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8fa39a', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#8fa39a', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#13201c', border: '1px solid #2a4038' }} />
          <Bar dataKey="readiness" fill="#5b8def" name="Readiness %" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ServiceabilityPie({ kpis }) {
  const data = [
    { name: 'Serviceable share', value: kpis.equipment_serviceable_pct },
    { name: 'Unserviceable share', value: Math.max(0, 100 - kpis.equipment_serviceable_pct) },
  ];

  return (
    <div className="chart-box">
      <h3>Fleet serviceability</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#13201c', border: '1px solid #2a4038' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <p className="muted center">{kpis.equipment_deployed} platforms marked deployed</p>
    </div>
  );
}

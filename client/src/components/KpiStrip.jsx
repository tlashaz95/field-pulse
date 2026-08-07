import { Link } from 'react-router-dom';
import { formatPct, readinessClass } from '../lib/format.js';

export default function KpiStrip({ kpis }) {
  const items = [
    { label: 'Readiness', value: formatPct(kpis.readiness_pct), tone: readinessClass(kpis.readiness_pct) },
    { label: 'Personnel fill', value: formatPct(kpis.personnel_fill_pct), tone: readinessClass(kpis.personnel_fill_pct) },
    {
      label: 'Personnel',
      value: `${kpis.personnel_present.toLocaleString()} / ${kpis.personnel_authorised.toLocaleString()}`,
    },
    { label: 'Eqpt serviceable', value: formatPct(kpis.equipment_serviceable_pct), tone: readinessClass(kpis.equipment_serviceable_pct) },
    { label: 'Deployed major eqpt', value: kpis.equipment_deployed.toLocaleString() },
    { label: 'In maintenance', value: kpis.equipment_in_maintenance.toLocaleString() },
  ];

  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div key={item.label} className={`kpi ${item.tone || ''}`}>
          <span className="kpi-label">{item.label}</span>
          <strong className="kpi-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="ORBAT path">
      {items.map((item, idx) => (
        <span key={item.id} className="crumb">
          {idx > 0 && <span className="sep">/</span>}
          {idx === items.length - 1 ? (
            <span>{item.short_name}</span>
          ) : (
            <Link to={idx === 0 ? '/' : `/org/${item.id}`}>{item.short_name}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

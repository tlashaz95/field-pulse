import { Link } from 'react-router-dom';
import { armLabel, formatPct, readinessClass } from '../lib/format.js';

export default function OrgCardGrid({ title, subtitle, orgs }) {
  if (!orgs?.length) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted tight">{subtitle}</p>}
        </div>
        <span className="muted">{orgs.length}</span>
      </div>
      <div className="org-grid">
        {orgs.map((org) => (
          <Link key={org.id} to={`/org/${org.id}`} className={`org-card ${org.wartime_only ? 'wartime' : ''}`}>
            <div className="org-card-top">
              <strong>{org.short_name}</strong>
              <span className={`ready-pill ${readinessClass(org.readiness_pct)}`}>
                {formatPct(org.readiness_pct)}
              </span>
            </div>
            <p className="org-name">{org.name}</p>
            <div className="org-meta">
              <span>{armLabel(org.arm)}</span>
              <span>{org.location || '—'}</span>
            </div>
            {org.wartime_only && <span className="tag">Wartime / attached</span>}
            <div className="org-personnel">
              {org.personnel_present?.toLocaleString()} / {org.personnel_authorised?.toLocaleString()} pers
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

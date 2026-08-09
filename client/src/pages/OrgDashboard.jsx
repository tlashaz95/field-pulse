import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchDivisionDashboard, fetchOrgDashboard } from '../api.js';
import { armLabel, groupChildren, levelLabel } from '../lib/format.js';
import KpiStrip, { Breadcrumb } from '../components/KpiStrip.jsx';
import OrgCardGrid from '../components/OrgCardGrid.jsx';
import {
  ChildReadinessChart,
  EquipmentCategoryChart,
  ReadinessTrendChart,
  ServiceabilityPie,
} from '../components/Charts.jsx';
import QueryPanel from '../components/QueryPanel.jsx';
import EquipmentTable, { EventsList } from '../components/EquipmentTable.jsx';
import DeploymentMap from '../components/DeploymentMap.jsx';
import Logo from '../components/Logo.jsx';
import { useLocationEvents } from '../hooks/useLocationEvents.js';

export default function OrgDashboard() {
  const { orgId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { connected, lastPulseAt, liveEvents } = useLocationEvents(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = orgId
          ? await fetchOrgDashboard(orgId)
          : await fetchDivisionDashboard();
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const grouped = useMemo(() => groupChildren(data?.children || []), [data]);
  const isDivision = data?.org?.org_level === 'division';
  const showUnitColumn = data?.org?.org_level !== 'battalion';
  const showBreadcrumb = Boolean(orgId) && (data?.breadcrumb?.length || 0) > 1;

  const scopedLiveEvents = useMemo(() => {
    if (!data?.map_markers?.length || !liveEvents?.length) return liveEvents || [];
    const ids = new Set(data.map_markers.map((m) => m.id));
    return liveEvents.filter((e) => ids.has(e.org_id));
  }, [data?.map_markers, liveEvents]);

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted">Loading ORBAT…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-shell">
        <div className="banner error">{error || 'No data'}</div>
        <p className="muted">
          Ensure Postgres is running, then <code>npm run setup --prefix server</code>
        </p>
        <Link to="/">Back to division</Link>
      </div>
    );
  }

  const { org, breadcrumb, kpis, children } = data;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <Logo size={56} />
          <div className="brand-text">
            <p className="brand">FieldPulse</p>
            <p className="tagline">6 Armoured Division · live operational status</p>
            {showBreadcrumb && <Breadcrumb items={breadcrumb} />}
          </div>
        </div>
        {!isDivision && (
          <Link className="ghost-btn topbar-back" to="/">
            Division HQ
          </Link>
        )}
      </header>

      <QueryPanel enabled={isDivision} />

      <DeploymentMap
        focusOrgId={org.id}
        markers={data.map_markers || []}
        liveEvents={scopedLiveEvents}
        lastPulseAt={lastPulseAt}
        connected={connected}
      />

      <section className="ops-split">
        <div className="ops-left">
          <div className="status-cluster inline-status">
            <span className="pill">{levelLabel(org.org_level)}</span>
            <span className="pill">{armLabel(org.arm)}</span>
            <span className="pill">{org.code}</span>
            {org.wartime_only && <span className="pill warn">Wartime</span>}
          </div>

          <KpiStrip kpis={kpis} />

          {isDivision ? (
            <>
              <OrgCardGrid
                title="Armoured & combat brigades"
                subtitle="Under command — click through for unit dashboards"
                orgs={grouped.brigades}
              />
              <OrgCardGrid title="Division troops" subtitle="Engineers, signals, recce" orgs={grouped.troops} />
              <OrgCardGrid
                title="Division logistics"
                subtitle="ASC, Ordnance, EME, Medical"
                orgs={grouped.logistics}
              />
              <OrgCardGrid title="Artillery & other groupings" orgs={grouped.other} />
            </>
          ) : (
            <OrgCardGrid
              title="Under command"
              subtitle={
                org.org_level === 'battalion'
                  ? 'No further subordinate units in this dataset'
                  : 'Battalions / regiments / batteries'
              }
              orgs={children}
            />
          )}
        </div>

        <aside className="ops-right">
          <div className="charts-stack">
            <EquipmentCategoryChart data={data.equipment_by_category} />
            <ReadinessTrendChart data={data.readiness_trend} />
            <ChildReadinessChart children={children} />
            <ServiceabilityPie kpis={kpis} />
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Equipment holdings</h2>
        </div>
        <EquipmentTable rows={data.equipment} showUnit={showUnitColumn} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent operational events</h2>
          <span className="muted">{data.events.length} total</span>
        </div>
        <EventsList events={data.events} />
      </section>

      <footer className="footer">
        Synthetic ORBAT and holdings for training / portfolio use. Structure inspired by publicly described 6
        Armoured Division organisation; battalion identities and numbers are generated for the application.
      </footer>
    </div>
  );
}

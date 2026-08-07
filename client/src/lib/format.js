export function readinessClass(pct) {
  if (pct >= 90) return 'high';
  if (pct >= 80) return 'mid';
  return 'low';
}

export function armLabel(arm) {
  const map = {
    armour: 'Armour',
    mechanised: 'Mechanised',
    air_defence: 'Air Defence',
    engineers: 'Engineers',
    signals: 'Signals',
    artillery: 'Artillery',
    aviation: 'Aviation',
    recce: 'Recce',
    asc: 'ASC',
    ordnance: 'Ordnance',
    eme: 'EME',
    medical: 'Medical',
    logistics: 'Logistics',
    support: 'Support',
    hq: 'HQ',
  };
  return map[arm] || arm;
}

export function levelLabel(level) {
  const map = {
    division: 'Division',
    group: 'Group',
    brigade: 'Brigade',
    battalion: 'Battalion / Regiment',
    hq: 'HQ',
  };
  return map[level] || level;
}

export function formatPct(n) {
  return `${Math.round(Number(n) || 0)}%`;
}

export function groupChildren(children) {
  const brigades = [];
  const troops = [];
  const logistics = [];
  const other = [];

  for (const child of children) {
    if (child.code === '6ARMD-TPS') {
      troops.push(child);
    } else if (child.code === '6ARMD-LOG') {
      logistics.push(child);
    } else if (child.org_level === 'brigade') {
      brigades.push(child);
    } else {
      other.push(child);
    }
  }

  return { brigades, troops, logistics, other };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Formation-level defaults when arm-specific colour does not apply. */
const LEVEL_COLOR = {
  division: '#f0c14a',
  group: '#5ec8ff',
  brigade: '#3dba8a',
  hq: '#9ad0b8',
  battalion: '#8fa39a',
};

/** Distinct colours for Div Troops arms the user asked to separate. */
const ARM_COLOR = {
  engineers: '#e87b3a', // amber-orange
  signals: '#7c6cff', // violet
  recce: '#2ec4b6', // teal
};

function colorFor(marker) {
  if (marker?.arm && ARM_COLOR[marker.arm]) return ARM_COLOR[marker.arm];
  return LEVEL_COLOR[marker?.org_level] || LEVEL_COLOR.battalion;
}

function markerHtml(marker, { focus, selected }) {
  const color = colorFor(marker);
  const level = marker.org_level;
  const base =
    focus || selected
      ? 16
      : level === 'division' || level === 'brigade' || level === 'group'
        ? 12
        : 8;
  const cls = ['map-dot', focus && 'focus', selected && 'selected'].filter(Boolean).join(' ');
  return `<span class="${cls}" style="--dot:${color};--size:${base}px"></span>`;
}

function buildIcon(marker, opts) {
  const size = opts.focus || opts.selected ? 22 : 14;
  return L.divIcon({
    className: 'fp-marker',
    html: markerHtml(marker, opts),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Deployment awareness map for the current ORBAT slice.
 * Markers update when SSE location.batch events arrive (slice 2).
 */
export default function DeploymentMap({
  focusOrgId,
  markers: initialMarkers = [],
  liveEvents = [],
  lastPulseAt = null,
  connected = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const fittedKeyRef = useRef(null);
  const [markers, setMarkers] = useState(initialMarkers);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setMarkers(initialMarkers);
    setSelectedId(null);
  }, [initialMarkers]);

  useEffect(() => {
    if (!liveEvents?.length) return;
    setMarkers((prev) => {
      const byId = new Map(prev.map((m) => [m.id, { ...m }]));
      for (const ev of liveEvents) {
        const id = ev.org_id;
        if (!byId.has(id)) continue;
        byId.set(id, {
          ...byId.get(id),
          lat: ev.lat,
          lng: ev.lng,
          position_reported_at: ev.reported_at,
          arm: ev.arm || byId.get(id).arm,
        });
      }
      return [...byId.values()];
    });
  }, [liveEvents]);

  const summary = useMemo(() => {
    const moved = liveEvents.filter((e) => e.changed).length;
    return { count: markers.length, moved };
  }, [markers, liveEvents]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedKeyRef.current = null;
      markerByIdRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current = new Map();
    const latLngs = [];

    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue;
      const ll = [Number(m.lat), Number(m.lng)];
      latLngs.push(ll);
      const focus = m.id === focusOrgId;
      const selected = m.id === selectedId;
      const leafletMarker = L.marker(ll, {
        icon: buildIcon(m, { focus, selected }),
        zIndexOffset: selected ? 1000 : focus ? 500 : 0,
      });
      leafletMarker.bindPopup(
        `<strong>${m.short_name}</strong><br/>${m.code} · ${m.org_level}${
          m.arm ? ` · ${m.arm}` : ''
        }<br/>${m.location || '—'}<br/><span style="opacity:.7">${Number(m.lat).toFixed(
          4
        )}, ${Number(m.lng).toFixed(4)}</span>`
      );
      leafletMarker.on('click', () => setSelectedId(m.id));
      leafletMarker.addTo(layer);
      markerByIdRef.current.set(m.id, leafletMarker);
    }

    const fitKey = `${focusOrgId}:${initialMarkers.map((m) => m.id).join(',')}`;
    if (latLngs.length && fittedKeyRef.current !== fitKey) {
      fittedKeyRef.current = fitKey;
      if (latLngs.length === 1) {
        map.setView(latLngs[0], 11);
      } else {
        map.fitBounds(L.latLngBounds(latLngs).pad(0.2));
      }
    }
  }, [markers, focusOrgId, initialMarkers, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    const leafletMarker = markerByIdRef.current.get(selectedId);
    if (!map || !leafletMarker) return;
    const ll = leafletMarker.getLatLng();
    map.panTo(ll, { animate: true });
    leafletMarker.openPopup();
  }, [selectedId, markers]);

  function selectFromFeed(ev) {
    setSelectedId(ev.org_id);
  }

  return (
    <section className="panel map-panel">
      <div className="panel-head">
        <div>
          <h2>Deployment map</h2>
          <p className="muted tight">
            Live positions for this formation and subordinates · {summary.count} markers
          </p>
        </div>
        <div className="map-status">
          <span className={`pill ${connected ? 'ok' : 'warn'}`}>
            {connected ? 'SSE live' : 'Connecting…'}
          </span>
          {lastPulseAt && (
            <span className="muted map-pulse">
              Pulse {new Date(lastPulseAt).toLocaleTimeString()}
              {summary.moved > 0 ? ` · ${summary.moved} moved` : ' · heartbeat'}
            </span>
          )}
        </div>
      </div>
      <div className="map-frame" ref={containerRef} />
      <div className="map-legend">
        <span>
          <i style={{ background: LEVEL_COLOR.division }} /> Division
        </span>
        <span>
          <i style={{ background: LEVEL_COLOR.brigade }} /> Brigade / group
        </span>
        <span>
          <i style={{ background: ARM_COLOR.engineers }} /> Engineers
        </span>
        <span>
          <i style={{ background: ARM_COLOR.signals }} /> Signals
        </span>
        <span>
          <i style={{ background: ARM_COLOR.recce }} /> Recce
        </span>
        <span>
          <i style={{ background: LEVEL_COLOR.battalion }} /> Other units
        </span>
      </div>
      {liveEvents.length > 0 && (
        <ul className="map-feed" aria-label="Recent location events">
          {liveEvents.some((e) => e.changed) ? (
            liveEvents
              .filter((e) => e.changed)
              .slice(-5)
              .reverse()
              .map((e) => (
                <li key={`${e.org_id}-${e.reported_at}`}>
                  <button
                    type="button"
                    className={`map-feed-item${selectedId === e.org_id ? ' active' : ''}`}
                    onClick={() => selectFromFeed(e)}
                  >
                    <strong>{e.short_name}</strong>
                    <span className="muted">
                      {' '}
                      relocated · {Number(e.lat).toFixed(4)}, {Number(e.lng).toFixed(4)}
                    </span>
                  </button>
                </li>
              ))
          ) : (
            <li className="muted">Location heartbeat received — no position changes this pulse</li>
          )}
        </ul>
      )}
    </section>
  );
}

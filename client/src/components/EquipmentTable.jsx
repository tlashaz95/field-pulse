import { useEffect, useMemo, useState } from 'react';

export default function EquipmentTable({ rows, showUnit }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((row) => {
      const hay = [
        row.category,
        row.nomenclature,
        row.role,
        row.org_short_name,
        row.org_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="equipment-block">
      <div className="equipment-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search equipment by unit, category, name, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search equipment holdings"
        />
        <span className="muted">
          {filtered.length}
          {(rows || []).length !== filtered.length ? ` / ${(rows || []).length}` : ''} lines
        </span>
      </div>

      {!filtered.length ? (
        <p className="empty">{search ? 'No equipment matches your search.' : 'No equipment lines at this level.'}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {showUnit && <th>Unit</th>}
                <th>Category</th>
                <th>Nomenclature</th>
                <th>Role</th>
                <th>Auth</th>
                <th>Held</th>
                <th>Svc</th>
                <th>Deployed</th>
                <th>Maint</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id || `${row.org_code}-${row.nomenclature}`}>
                  {showUnit && <td>{row.org_short_name || row.org_code}</td>}
                  <td>{row.category}</td>
                  <td>{row.nomenclature}</td>
                  <td className="muted">{row.role || '—'}</td>
                  <td>{row.authorised}</td>
                  <td>{row.held}</td>
                  <td>{row.serviceable}</td>
                  <td>{row.deployed}</td>
                  <td>{row.in_maintenance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 5;

export function EventsList({ events }) {
  const [page, setPage] = useState(0);
  const list = events || [];

  useEffect(() => {
    setPage(0);
  }, [events]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = list.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!list.length) return <p className="empty">No recent events.</p>;

  return (
    <div className="events-block">
      <ul className="events">
        {slice.map((event) => (
          <li key={event.id} className={`event ${event.severity}`}>
            <div className="event-top">
              <strong>{event.title}</strong>
              <span className="muted">
                {event.org_short_name} · {new Date(event.occurred_at).toLocaleString()}
              </span>
            </div>
            {event.detail && <p>{event.detail}</p>}
          </li>
        ))}
      </ul>
      <div className="pagination">
        <button
          type="button"
          className="ghost-btn"
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </button>
        <span className="muted">
          Page {safePage + 1} of {totalPages}
        </span>
        <button
          type="button"
          className="ghost-btn"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

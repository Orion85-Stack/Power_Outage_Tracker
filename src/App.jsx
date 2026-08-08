import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Plus, Trash2, Pencil, Download, Upload, X, Check, RotateCcw, ZapOff, AlertTriangle } from 'lucide-react';

const CAUSES = ['Weather', 'Equipment failure', 'Utility maintenance', 'Tree/vegetation', 'Animal contact', 'Unknown', 'Other'];
const STORAGE_KEY = 'outage-log-entries';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function fmtDuration(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function durationMinutes(entry, nowMs) {
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
  return Math.max(0, (end - start) / 60000);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: null },
];

const emptyForm = () => ({
  id: null,
  startTime: toInputValue(new Date().toISOString()),
  endTime: '',
  ongoing: false,
  cause: CAUSES[0],
  location: '',
  notes: '',
});

export default function App() {
  const [entries, setEntries] = useState(loadEntries);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState('log');
  const [now, setNow] = useState(Date.now());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [range, setRange] = useState(30);
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef(null);

  // Persist to localStorage whenever entries change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, [entries]);

  // Live timer tick while an outage is ongoing
  useEffect(() => {
    const hasOngoing = entries.some((e) => !e.endTime);
    if (!hasOngoing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [entries]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const ongoing = entries.find((e) => !e.endTime);

  function openNewForm() {
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(entry) {
    setForm({
      id: entry.id,
      startTime: toInputValue(entry.startTime),
      endTime: entry.endTime ? toInputValue(entry.endTime) : '',
      ongoing: !entry.endTime,
      cause: entry.cause,
      location: entry.location || '',
      notes: entry.notes || '',
    });
    setShowForm(true);
  }

  function submitForm() {
    if (!form.startTime) {
      showToast('Start time is required');
      return;
    }
    if (!form.ongoing && !form.endTime) {
      showToast('Add an end time, or mark as ongoing');
      return;
    }
    const startISO = new Date(form.startTime).toISOString();
    const endISO = form.ongoing ? null : new Date(form.endTime).toISOString();
    if (endISO && new Date(endISO) < new Date(startISO)) {
      showToast('End time is before start time');
      return;
    }
    if (form.ongoing && !form.id && ongoing) {
      showToast('An outage is already logged as ongoing');
      return;
    }

    if (form.id) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === form.id
            ? { ...e, startTime: startISO, endTime: endISO, cause: form.cause, location: form.location, notes: form.notes }
            : e
        )
      );
      showToast('Outage updated');
    } else {
      setEntries((prev) => [
        ...prev,
        { id: uid(), startTime: startISO, endTime: endISO, cause: form.cause, location: form.location, notes: form.notes },
      ]);
      showToast(form.ongoing ? 'Outage logged — marked ongoing' : 'Outage logged');
    }
    setShowForm(false);
  }

  function markRestored(id) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, endTime: new Date().toISOString() } : e)));
    showToast('Marked restored');
  }

  function deleteEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    showToast('Entry deleted');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outage-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported JSON file');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error('bad format');
        setEntries((prev) => {
          const map = new Map(prev.map((en) => [en.id, en]));
          imported.forEach((en) => {
            if (en && en.id) map.set(en.id, en);
          });
          return Array.from(map.values());
        });
        showToast(`Imported ${imported.length} ${imported.length === 1 ? 'entry' : 'entries'}`);
      } catch (err) {
        showToast('Could not read that file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function resetAll() {
    setEntries([]);
    setConfirmReset(false);
    showToast('All data cleared');
  }

  const sorted = useMemo(() => [...entries].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)), [entries]);

  const filtered = useMemo(() => {
    if (range === 'ALL') return sorted;
    const cutoff = now - range * 24 * 60 * 60 * 1000;
    return sorted.filter((e) => new Date(e.startTime).getTime() >= cutoff);
  }, [sorted, range, now]);

  const kpis = useMemo(() => {
    if (filtered.length === 0) {
      return { count: 0, totalMin: 0, avgMin: 0, longest: null, momentary: 0, sustained: 0, uptimePct: 100 };
    }
    let totalMin = 0,
      momentary = 0,
      sustained = 0,
      longest = null;
    filtered.forEach((e) => {
      const d = durationMinutes(e, now);
      totalMin += d;
      if (d <= 5) momentary++;
      else sustained++;
      if (!longest || d > durationMinutes(longest, now)) longest = e;
    });
    const periodMin =
      range === 'ALL'
        ? Math.max(1, (now - new Date(sorted[sorted.length - 1].startTime).getTime()) / 60000)
        : range * 24 * 60;
    const uptimePct = Math.max(0, Math.min(100, 100 - (totalMin / periodMin) * 100));
    return { count: filtered.length, totalMin, avgMin: totalMin / filtered.length, longest, momentary, sustained, uptimePct };
  }, [filtered, now, range, sorted]);

  const causeBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      map[e.cause] = (map[e.cause] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const monthlyTrend = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const d = new Date(e.startTime);
      const key = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([month, count]) => ({ month, count }))
      .slice(-12);
  }, [filtered]);

  const hourDist = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    filtered.forEach((e) => {
      const h = new Date(e.startTime).getHours();
      buckets[h].count++;
    });
    return buckets;
  }, [filtered]);

  const dowDist = useMemo(() => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const buckets = labels.map((day) => ({ day, count: 0 }));
    filtered.forEach((e) => {
      const d = new Date(e.startTime).getDay();
      buckets[d].count++;
    });
    return buckets;
  }, [filtered]);

  const maxCauseCount = causeBreakdown[0]?.[1] || 1;

  return (
    <div className="app">
      <div className="shell">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <Zap size={18} color="#12151B" strokeWidth={2.5} />
            </div>
            <div>
              <div className="brand-title">OUTAGE LOG</div>
              <div className="brand-sub">household power reliability</div>
            </div>
          </div>
          <BreakerToggle
            options={[
              { label: 'Log', value: 'log' },
              { label: 'Report', value: 'report' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </header>

        <main className="main scroll">
          {tab === 'log' ? (
            <LogTab
              ongoing={ongoing}
              now={now}
              entries={sorted}
              onNew={openNewForm}
              onEdit={openEditForm}
              onDelete={deleteEntry}
              onRestore={markRestored}
            />
          ) : (
            <ReportTab
              range={range}
              setRange={setRange}
              kpis={kpis}
              causeBreakdown={causeBreakdown}
              maxCauseCount={maxCauseCount}
              monthlyTrend={monthlyTrend}
              hourDist={hourDist}
              dowDist={dowDist}
              hasData={entries.length > 0}
            />
          )}

          {tab === 'log' && (
            <section className="data-section">
              <div className="section-title">DATA</div>
              <div className="data-row">
                <button className="ghost-btn" onClick={exportData}>
                  <Download size={14} /> Export JSON
                </button>
                <button className="ghost-btn" onClick={() => fileInputRef.current.click()}>
                  <Upload size={14} /> Import JSON
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importData} />
              </div>
              <div className="data-row">
                {!confirmReset ? (
                  <button className="danger-ghost-btn" onClick={() => setConfirmReset(true)}>
                    <RotateCcw size={14} /> Clear all data
                  </button>
                ) : (
                  <div className="confirm-row">
                    <span className="confirm-text">Delete all {entries.length} entries? This can't be undone.</span>
                    <button className="danger-btn" onClick={resetAll}>
                      Yes, delete
                    </button>
                    <button className="ghost-btn-small" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {saveError && (
                <div className="error-note">
                  <AlertTriangle size={13} /> Last change couldn't be saved — your browser storage may be full or blocked.
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {showForm && <EntryForm form={form} setForm={setForm} onCancel={() => setShowForm(false)} onSubmit={submitForm} isEdit={!!form.id} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function BreakerToggle({ options, value, onChange }) {
  return (
    <div className="breaker">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`breaker-btn${opt.value === value ? ' active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LogTab({ ongoing, now, entries, onNew, onEdit, onDelete, onRestore }) {
  return (
    <div>
      {ongoing && (
        <div className="ongoing-card pulse">
          <div className="ongoing-top">
            <ZapOff size={20} color="#E8A33D" />
            <span className="ongoing-label">POWER IS OUT</span>
          </div>
          <div className="ongoing-timer">{fmtDuration(durationMinutes(ongoing, now))}</div>
          <div className="ongoing-meta">
            Since {fmtDateTime(ongoing.startTime)} · {ongoing.cause}
            {ongoing.location ? ` · ${ongoing.location}` : ''}
          </div>
          <button className="restore-btn" onClick={() => onRestore(ongoing.id)}>
            <Check size={15} /> Mark power restored
          </button>
        </div>
      )}

      <button className="new-btn" onClick={onNew}>
        <Plus size={16} /> Log an outage
      </button>

      <div className="section-title">HISTORY ({entries.length})</div>
      {entries.length === 0 ? (
        <div className="empty-state">No outages logged yet. Nothing to report — that's a good thing.</div>
      ) : (
        <div className="list">
          {entries.map((e) => (
            <div key={e.id} className="entry-row">
              <div className="entry-main">
                <div className="entry-date">{fmtDateTime(e.startTime)}</div>
                <div className={`entry-dur${!e.endTime ? ' ongoing' : ''}`}>
                  {e.endTime ? fmtDuration(durationMinutes(e, now)) : 'ongoing'}
                </div>
              </div>
              <div className="entry-tags">
                <span className="cause-tag">{e.cause}</span>
                {e.location && <span className="cause-tag">{e.location}</span>}
                {e.notes && <span className="entry-notes">{e.notes}</span>}
              </div>
              <div className="entry-actions">
                <button className="icon-btn" onClick={() => onEdit(e)} aria-label="Edit">
                  <Pencil size={14} />
                </button>
                <button className="icon-btn" onClick={() => onDelete(e.id)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryForm({ form, setForm, onCancel, onSubmit, isEdit }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit outage' : 'Log an outage'}</span>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <label className="field-label">Start time</label>
        <input
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          className="field-input"
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.ongoing}
            onChange={(e) => setForm((f) => ({ ...f, ongoing: e.target.checked, endTime: e.target.checked ? '' : f.endTime }))}
          />
          Still ongoing
        </label>

        {!form.ongoing && (
          <>
            <label className="field-label">End time</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              className="field-input"
            />
          </>
        )}

        <label className="field-label">Cause</label>
        <select value={form.cause} onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))} className="field-input">
          {CAUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="field-label">Location (optional)</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="field-input"
          placeholder="e.g. Springfield, IL, USA"
        />

        <label className="field-label">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="field-input"
          placeholder="Anything worth remembering — breaker tripped, storm, utility ticket #..."
        />

        <div className="modal-actions">
          <button className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" onClick={onSubmit}>
            {isEdit ? 'Save changes' : 'Log outage'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportTab({ range, setRange, kpis, causeBreakdown, maxCauseCount, monthlyTrend, hourDist, dowDist, hasData }) {
  if (!hasData) {
    return <div className="empty-state">Log at least one outage to see your reliability report.</div>;
  }
  return (
    <div>
      <div className="range-row">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.label === 'ALL' ? 'ALL' : r.days)}
            className={`range-btn${(range === 'ALL' && r.label === 'ALL') || range === r.days ? ' active' : ''}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total outages" value={kpis.count} />
        <KpiCard label="Total downtime" value={fmtDuration(kpis.totalMin)} accent="#E8A33D" />
        <KpiCard label="Avg duration" value={fmtDuration(kpis.avgMin)} />
        <KpiCard label="Longest outage" value={kpis.longest ? fmtDuration(durationMinutes(kpis.longest, Date.now())) : '—'} accent="#E2593F" />
        <KpiCard label="Uptime" value={`${kpis.uptimePct.toFixed(2)}%`} accent="#4FD1C5" />
        <KpiCard label="Momentary / Sustained" value={`${kpis.momentary} / ${kpis.sustained}`} small />
      </div>

      <div className="chart-card">
        <div className="chart-title">OUTAGES BY MONTH</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262D38" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#8991A0', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#2E3540' }} tickLine={false} />
            <YAxis tick={{ fill: '#8991A0', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#20262F', border: '1px solid #2E3540', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }}
              labelStyle={{ color: '#EDEFF2' }}
              cursor={{ fill: 'rgba(232,163,61,0.08)' }}
            />
            <Bar dataKey="count" fill="#E8A33D" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="chart-title">TIME OF DAY</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={hourDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fill: '#8991A0', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#2E3540' }} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#8991A0', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#20262F', border: '1px solid #2E3540', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }}
              labelFormatter={(h) => `${h}:00`}
              cursor={{ fill: 'rgba(79,209,197,0.08)' }}
            />
            <Bar dataKey="count" fill="#4FD1C5" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="chart-title">DAY OF WEEK</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dowDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: '#8991A0', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#2E3540' }} tickLine={false} />
            <YAxis tick={{ fill: '#8991A0', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#20262F', border: '1px solid #2E3540', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }}
              cursor={{ fill: 'rgba(232,163,61,0.08)' }}
            />
            <Bar dataKey="count" fill="#E8A33D" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div className="chart-title">CAUSE BREAKDOWN</div>
        <div className="cause-list">
          {causeBreakdown.map(([cause, count]) => (
            <div key={cause}>
              <div className="cause-bar-label">
                <span>{cause}</span>
                <span className="count">{count}</span>
              </div>
              <div className="cause-bar-track">
                <div className="cause-bar-fill" style={{ width: `${(count / maxCauseCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, small }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${small ? ' small' : ''}`} style={{ color: accent || '#EDEFF2' }}>
        {value}
      </div>
    </div>
  );
}

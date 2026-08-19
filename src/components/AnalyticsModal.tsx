import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { formatDuration } from "../core";
import { resultsToCsvBlob, toCsvRows } from "../services/csv";
import { subscribeAllResults, subscribeVenueResults, type Unsubscribe } from "../services/practiceSync";
import type { CloudPracticeResult, UserProfile } from "../types";

const dateLabel = (timestamp: number) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp);

export function AnalyticsModal({ onClose, profile }: { onClose(): void; profile: UserProfile }) {
  const isAdmin = profile.role === "admin";
  const [allVenues, setAllVenues] = useState(false);
  const [rows, setRows] = useState<CloudPracticeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [scriptFilter, setScriptFilter] = useState("");

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    let cancelled = false;
    setLoading(true);
    const onData = (results: CloudPracticeResult[]) => { if (!cancelled) { setRows(results); setLoading(false); } };
    const subscribe = allVenues && isAdmin ? subscribeAllResults(onData) : subscribeVenueResults(profile.venueId, onData);
    subscribe.then((unsub) => { if (cancelled) unsub(); else unsubscribe = unsub; });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [allVenues, isAdmin, profile.venueId]);

  const employees = useMemo(() => Array.from(new Set(rows.map((row) => row.employeeName))).sort(), [rows]);
  const scripts = useMemo(() => Array.from(new Set(rows.map((row) => row.scriptTitle))).sort(), [rows]);
  const filtered = useMemo(() => rows
    .filter((row) => !employeeFilter || row.employeeName === employeeFilter)
    .filter((row) => !scriptFilter || row.scriptTitle === scriptFilter)
    .sort((a, b) => b.completedAt - a.completedAt), [rows, employeeFilter, scriptFilter]);

  const exportCsv = () => {
    const url = URL.createObjectURL(resultsToCsvBlob(toCsvRows(filtered))), link = document.createElement("a");
    link.href = url; link.download = `training-results-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <Modal title="Training Compliance" onClose={onClose} wide>
    <div className="library-toolbar">
      <label className="sort-field"><span>Employee</span><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="">All employees</option>{employees.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="sort-field"><span>Script</span><select value={scriptFilter} onChange={(event) => setScriptFilter(event.target.value)}><option value="">All scripts</option>{scripts.map((title) => <option key={title} value={title}>{title}</option>)}</select></label>
      {isAdmin && <label className="sort-field"><span>Scope</span><select value={allVenues ? "all" : "venue"} onChange={(event) => setAllVenues(event.target.value === "all")}><option value="venue">My venue</option><option value="all">All venues</option></select></label>}
      <button className="button secondary" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button>
    </div>
    {loading ? <div className="empty-state"><span>▤</span><h3>Loading…</h3></div> : filtered.length ? <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead><tr><th>Employee</th><th>Script</th><th>Completed</th><th>Duration</th><th>Avg WPM</th><th>Pauses</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.resultId}><td>{row.employeeName}</td><td>{row.scriptTitle}</td><td>{dateLabel(row.completedAt)}</td><td>{formatDuration(row.elapsedMs)}</td><td>{row.averageWpm}</td><td>{row.pauses}</td></tr>)}</tbody>
      </table>
    </div> : <div className="empty-state"><span>▤</span><h3>No practice results yet</h3><p>Results appear here once your team signs in and completes a reading.</p></div>}
  </Modal>;
}

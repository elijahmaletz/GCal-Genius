import { useState } from "react";

const WORKER_URL = "https://gcal-genius.elijah-maletz.workers.dev/";

const TIMEZONES = [
  ["America/Los_Angeles", "PT – Pacific"],
  ["America/Denver", "MT – Mountain"],
  ["America/Chicago", "CT – Central"],
  ["America/New_York", "ET – Eastern"],
  ["America/Anchorage", "AK – Alaska"],
  ["Pacific/Honolulu", "HT – Hawaii"],
  ["Europe/London", "GMT – London"],
  ["Europe/Paris", "CET – Paris/Berlin"],
  ["Europe/Moscow", "MSK – Moscow"],
  ["Asia/Dubai", "GST – Dubai"],
  ["Asia/Kolkata", "IST – India"],
  ["Asia/Singapore", "SGT – Singapore"],
  ["Asia/Tokyo", "JST – Tokyo"],
  ["Australia/Sydney", "AEST – Sydney"],
  ["Pacific/Auckland", "NZST – Auckland"],
];

function TimeRangeSelector({ value, onChange }) {
  const opts = [];
  for (let h = 6; h <= 22; h++) {
    for (let m of [0, 30]) {
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push(t);
    }
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 13, background: "white" }}>
      {opts.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

function groupSlots(slots, tz) {
  if (!slots?.length) return [];
  const sorted = [...slots].sort((a, b) => new Date(a.start) - new Date(b.start));
  const grouped = [];
  let current = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    if (new Date(sorted[i].start).getTime() <= new Date(current.end).getTime()) {
      current.end = sorted[i].end;
    } else {
      grouped.push(current);
      current = { ...sorted[i] };
    }
  }
  grouped.push(current);

  const byDate = {};
  for (const slot of grouped) {
    const dateKey = new Date(slot.start).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: tz
    });
    if (!byDate[dateKey]) byDate[dateKey] = [];
    const startStr = new Date(slot.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
    const endStr = new Date(slot.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
    byDate[dateKey].push(`${startStr} – ${endStr}`);
  }
  return Object.entries(byDate);
}

export default function App() {
  const [attendees, setAttendees] = useState([{ first: "", last: "", email: "" }]);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0],
  });
  const [workHours, setWorkHours] = useState({ start: "09:00", end: "17:00" });
  const [duration, setDuration] = useState(30);
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addAttendee = () => setAttendees([...attendees, { first: "", last: "", email: "" }]);
  const removeAttendee = i => setAttendees(attendees.filter((_, idx) => idx !== i));
  const updateAttendee = (i, field, v) => {
    const a = attendees.map((att, idx) => {
      if (idx !== i) return att;
      const updated = { ...att, [field]: v };
      if (field === "first" || field === "last") {
        const f = field === "first" ? v : att.first;
        const l = field === "last" ? v : att.last;
        updated.email = f && l ? `${f}.${l}@qualifiedhealthai.com` : "";
      }
      return updated;
    });
    setAttendees(a);
  };

  const validEmails = attendees.map(a => a.email).filter(e => e.includes("@"));

  const handleFind = async () => {
    if (!validEmails.length) {
      setError("Please enter at least one attendee's first and last name.");
      return;
    }
    setError(null);
    setResults(null);
    setLoading(true);

    try {
      const resp = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendees: validEmails,
          dateStart: dateRange.start,
          dateEnd: dateRange.end,
          startHour: parseInt(workHours.start),
          endHour: parseInt(workHours.end),
          duration,
          timezone,
        }),
      });
      const data = await resp.json();
      if (data.error) setError(`Calendar API error: ${data.error}`);
      else setResults(data.slots);
    } catch (err) {
      setError(`Request failed: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 680, margin: "40px auto", padding: 24 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Team Availability Finder</h1>
        </div>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>Find a time when everyone is free — powered by Google Calendar</p>
      </div>

      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>👥 Attendees</label>
        {attendees.map((att, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <input type="text" placeholder="First" value={att.first}
                onChange={e => updateAttendee(i, "first", e.target.value)}
                style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none" }} />
              <input type="text" placeholder="Last" value={att.last}
                onChange={e => updateAttendee(i, "last", e.target.value)}
                style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none" }} />
              {attendees.length > 1 && (
                <button onClick={() => removeAttendee(i)}
                  style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
              )}
            </div>
            {att.email && <div style={{ fontSize: 12, color: "#6b7280", paddingLeft: 4 }}>📧 {att.email}</div>}
          </div>
        ))}
        <button onClick={addAttendee}
          style={{ background: "none", border: "1px dashed #d1d5db", borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: "#6b7280", fontSize: 13 }}>
          + Add attendee
        </button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>📆 Date Range</label>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 14 }} />
          <span style={{ color: "#9ca3af" }}>→</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 14 }} />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>⚙️ Constraints</label>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Hours:</span>
            <TimeRangeSelector value={workHours.start} onChange={v => setWorkHours({ ...workHours, start: v })} />
            <span style={{ color: "#9ca3af" }}>–</span>
            <TimeRangeSelector value={workHours.end} onChange={v => setWorkHours({ ...workHours, end: v })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Timezone:</span>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 13, background: "white" }}>
              {TIMEZONES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Duration:</span>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 13, background: "white" }}>
              {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>
      </section>

      <button onClick={handleFind} disabled={loading}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
          background: loading ? "#9ca3af" : "#2563eb", color: "white",
          fontWeight: 600, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", marginBottom: 24
        }}>
        {loading ? "🔍 Checking calendars..." : "Find Available Times"}
      </button>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 16, color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {results && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 16, color: "#166534" }}>✅ Available Slots</h2>
          {groupSlots(results, timezone).length > 0 ? (
            <ul style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {groupSlots(results, timezone).map(([date, times], i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{date}:</span>{" "}
                  <span style={{ color: "#374151" }}>{times.join(", ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#6b7280", fontSize: 14 }}>No common availability found. Try expanding the date range.</p>
          )}
        </div>
      )}
    </div>
  );
}

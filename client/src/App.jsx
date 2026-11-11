import { useCallback, useEffect, useRef, useState } from "react";
import {
  AQI_LEGEND, DEFAULT_CITIES, MAX_CITIES, METRICS, aqiBand, cityKey, dayLabel, defaultRange,
  explain, iso, loadLS, saveLS, weatherIcon,
} from "./lib.js";

/* ---------- small pieces ---------- */
function Trend({ days, metric, selected, onPick }) {
  const vals = days.map((d) => d[metric.k]);
  const top = Math.max(...vals.filter((v) => v != null), 1);
  return (
    <div className="trend" role="img" aria-label={`${metric.label} trend`}>
      {days.map((d) => {
        const v = d[metric.k];
        const color = metric.k === "aqi" ? aqiBand(v).color : metric.color;
        return (
          <button key={d.date} className={"bar" + (d.date === selected ? " sel" : "")} onClick={() => onPick(d.date)} title={`${d.date}: ${v ?? "–"}${metric.unit}`}>
            <span className="fill" style={{ height: `${v == null ? 4 : Math.max(8, (v / top) * 100)}%`, background: color }} />
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({ metric, day, days, onPick }) {
  const v = day[metric.k];
  const [face, line] = explain(metric.k, v);
  const color = metric.k === "aqi" ? aqiBand(v).color : metric.color;
  return (
    <article className="metric" style={{ "--accent": color }}>
      <header><span className="m-emoji">{metric.emoji}</span><h4>{metric.label}</h4></header>
      <div className="m-value">{v ?? "–"}<small>{v == null ? "" : metric.unit}</small></div>
      <p className="m-line"><span>{face}</span> {line}</p>
      <Trend days={days} metric={metric} selected={day.date} onPick={onPick} />
    </article>
  );
}

function CityCard({ city, state, active, onSelect, shownAqi }) {
  const latest = state?.days ? [...state.days].reverse().find((d) => d.aqi != null) || state.days.at(-1) : null;
  const b = aqiBand(latest?.aqi);
  return (
    <button className={"city-card" + (active ? " active" : "")} onClick={onSelect} aria-pressed={active}>
      <span className="cc-name">{city.name}</span>
      <span className="cc-icon">{latest ? weatherIcon(latest.code) : "⏳"}</span>
      <span className="cc-temp">{latest?.tempHigh != null ? `${Math.round(latest.tempHigh)}°` : "…"}</span>
      {shownAqi && <span className="cc-aqi" style={{ background: b.color }}>{b.face} {latest?.aqi ?? "–"}</span>}
    </button>
  );
}

/* ---------- pages ---------- */
function Controls({ range, setRange, shown, setShown, fetchAll, rangeOk }) {
  return (
    <section className="controls card">
      <div className="field-group">
        <label>From<input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>To<input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <button className="btn" onClick={() => setRange(defaultRange())}>Last 5 days</button>
        <button className="btn primary" disabled={!rangeOk} onClick={fetchAll}>🔍 Show weather</button>
      </div>
      {!rangeOk && <p className="err">Pick a “From” day that comes before the “To” day 🙂</p>}
      <div className="toggles" role="group" aria-label="Choose what to show">
        <span className="label">Show:</span>
        {METRICS.map((m) => (
          <button key={m.k} className={"chip" + (shown[m.k] ? " on" : "")} aria-pressed={shown[m.k]} onClick={() => setShown({ ...shown, [m.k]: !shown[m.k] })}>
            {m.emoji} {m.label} <span aria-hidden>{shown[m.k] ? "👁️" : "🙈"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WeatherPage({ cities, goCities, ctl, data }) {
  const { shown } = ctl;
  const [sel, setSel] = useState(0);
  const [selDate, setSelDate] = useState(null);
  const today = iso(new Date());

  useEffect(() => { if (sel >= cities.length) setSel(0); }, [cities, sel]);

  const city = cities[sel];
  const state = city && data[cityKey(city)];
  const days = state?.days || [];
  const day = days.find((d) => d.date === selDate) || days.at(-1);
  const active = METRICS.filter((m) => shown[m.k]);

  if (!cities.length)
    return <div className="empty"><div>🌍</div><h2>No cities yet!</h2><p>Add up to {MAX_CITIES} cities to see their weather.</p><button className="btn primary" onClick={goCities}>➕ Add cities</button></div>;

  return (
    <>
      <Controls {...ctl} />

      <section className="city-row" aria-label="Cities">
        {cities.map((c, i) => (
          <CityCard key={cityKey(c)} city={c} state={data[cityKey(c)]} active={i === sel} onSelect={() => setSel(i)} shownAqi={shown.aqi} />
        ))}
      </section>

      {shown.aqi && <div className="legend">{AQI_LEGEND.map((b) => <span key={b.range} style={{ background: b.color }}>{b.face} {b.range}</span>)}</div>}

      {!state && <div className="card msg">⏳ Asking the clouds…</div>}
      {state?.error && <div className="card msg err">Oops! {state.error}</div>}
      {day && (
        <>
          <section className="hero card" style={{ "--hero": aqiBand(day.aqi).color }}>
            <div className="hero-main">
              <div className="hero-icon">{weatherIcon(day.code)}</div>
              <div>
                <div className="hero-temp">{day.tempHigh != null ? Math.round(day.tempHigh) : "–"}°<small>/ {day.tempLow != null ? Math.round(day.tempLow) : "–"}°C</small></div>
                <h2>{city.name}</h2>
                <p>{[city.region, city.country].filter(Boolean).join(", ")} · {dayLabel(day.date, today)}</p>
              </div>
            </div>
            {shown.aqi && (
              <div className="hero-aqi"><span>{aqiBand(day.aqi).face}</span><b>AQI {day.aqi ?? "–"}</b><small>{aqiBand(day.aqi).text}</small></div>
            )}
          </section>

          <div className="days" role="tablist" aria-label="Pick a day">
            {days.map((d) => (
              <button key={d.date} role="tab" aria-selected={d.date === day.date} className={"day" + (d.date === day.date ? " sel" : "")} onClick={() => setSelDate(d.date)}>
                <span>{dayLabel(d.date, today)}</span>
                <span className="d-icon">{weatherIcon(d.code)}</span>
                <span className="d-t">{d.tempHigh != null ? Math.round(d.tempHigh) : "–"}° <em>{d.tempLow != null ? Math.round(d.tempLow) : "–"}°</em></span>
              </button>
            ))}
          </div>

          {active.length ? (
            <section className="metrics">{active.map((m) => <MetricCard key={m.k} metric={m} day={day} days={days} onPick={setSelDate} />)}</section>
          ) : <div className="card msg">Tap a button above to switch something on 👆</div>}
        </>
      )}
    </>
  );
}

/* ---------- report ---------- */
const nums = (a) => a.filter((x) => x != null);
const mean = (a) => { const v = nums(a); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fmt = (v, k) => (v == null ? "–" : k === "aqi" || k === "humidity" ? Math.round(v) : Math.round(v * 10) / 10);

function summarize(days) {
  const col = (k) => days.map((d) => d[k]);
  return {
    aqi: nums(col("aqi")).length ? Math.max(...nums(col("aqi"))) : null,
    precipitation: nums(col("precipitation")).reduce((s, x) => s + x, 0),
    humidity: mean(col("humidity")),
    wind: mean(col("wind")),
    dewPoint: mean(col("dewPoint")),
    uv: nums(col("uv")).length ? Math.max(...nums(col("uv"))) : null,
  };
}
const SUMMARY_NOTE = { aqi: "peak", precipitation: "total", humidity: "avg", wind: "avg", dewPoint: "avg", uv: "max" };

function ReportPage({ cities, ctl, data, goCities }) {
  const { shown, range } = ctl;
  const [detail, setDetail] = useState("aqi");
  const active = METRICS.filter((m) => shown[m.k]);
  const rows = cities.map((c) => {
    const st = data[cityKey(c)];
    return { city: c, st, sum: st?.days ? summarize(st.days) : null };
  });
  const ready = rows.filter((r) => r.sum);
  const dates = ready[0]?.st.days.map((d) => d.date) || [];
  const dm = METRICS.find((m) => m.k === detail && shown[m.k]) || active[0];
  const winner = (k, low = true) => {
    const c = ready.filter((r) => r.sum[k] != null);
    if (!c.length) return null;
    return c.reduce((a, b) => ((low ? b.sum[k] < a.sum[k] : b.sum[k] > a.sum[k]) ? b : a));
  };
  const cleanest = winner("aqi"), rainiest = winner("precipitation", false), windiest = winner("wind", false), sunniest = winner("uv", false);

  const cellColor = (k, v) => (k === "aqi" ? aqiBand(v).color : null);

  function downloadCsv() {
    const head = ["City", "Date", ...active.map((m) => m.label)];
    const lines = [head];
    ready.forEach((r) => r.st.days.forEach((d) => lines.push([`${r.city.name}, ${r.city.country}`, d.date, ...active.map((m) => d[m.k] ?? "")])));
    const csv = lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `weather-report_${range.from}_to_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!cities.length)
    return <div className="empty"><div>📊</div><h2>No cities to report on</h2><button className="btn primary" onClick={goCities}>➕ Add cities</button></div>;

  return (
    <>
      <div className="no-print"><Controls {...ctl} /></div>
      <div className="print-title">
        <h1>🌈 Sunny Skies – Weather Report</h1>
        <p>{range.from} → {range.to} · {cities.map((c) => c.name).join(", ")} · printed {new Date().toLocaleDateString()}</p>
      </div>
      {ready.length > 0 && (
        <section className="awards">
          {shown.aqi && cleanest && <div className="award"><span>🏆</span><small>Cleanest air</small><b>{cleanest.city.name}</b><em>AQI {fmt(cleanest.sum.aqi, "aqi")}</em></div>}
          {shown.precipitation && rainiest && <div className="award"><span>☔</span><small>Rainiest</small><b>{rainiest.city.name}</b><em>{fmt(rainiest.sum.precipitation)} mm</em></div>}
          {shown.wind && windiest && <div className="award"><span>🪁</span><small>Windiest</small><b>{windiest.city.name}</b><em>{fmt(windiest.sum.wind)} km/h</em></div>}
          {shown.uv && sunniest && <div className="award"><span>😎</span><small>Strongest sun</small><b>{sunniest.city.name}</b><em>UV {fmt(sunniest.sum.uv)}</em></div>}
        </section>
      )}

      <section className="card">
        <div className="report-head">
          <h2>📊 All cities · {range.from} → {range.to}</h2>
          <span className="no-print report-actions">
            <button className="btn" disabled={!ready.length} onClick={downloadCsv}>⬇️ Download CSV</button>
            <button className="btn primary" disabled={!ready.length} onClick={() => window.print()}>🖨️ Print</button>
          </span>
        </div>
        {!active.length ? <p className="msg">Switch something on above 👆</p> : (
          <div className="table-wrap">
            <table className="report">
              <thead>
                <tr><th>City</th>{active.map((m) => <th key={m.k}>{m.emoji} {m.label}<small>{SUMMARY_NOTE[m.k]}</small></th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ city, st, sum }) => (
                  <tr key={cityKey(city)}>
                    <th scope="row">{city.name}<small>{city.country}</small></th>
                    {!sum ? <td colSpan={active.length} className="hint">{st?.error ? `Oops! ${st.error}` : "⏳ Loading…"}</td>
                      : active.map((m) => {
                        const bg = cellColor(m.k, sum[m.k]);
                        return <td key={m.k}>{bg ? <span className="pill" style={{ background: bg }}>{aqiBand(sum.aqi).face} {fmt(sum[m.k], m.k)}</span> : <>{fmt(sum[m.k], m.k)}<small>{m.unit}</small></>}</td>;
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dm && ready.length > 0 && (
        <section className="card">
          <div className="report-head">
            <h2>🗓️ Day by day · {dm.emoji} {dm.label}</h2>
            <div className="toggles no-print">
              {active.map((m) => <button key={m.k} className={"chip" + (m.k === dm.k ? " on" : "")} aria-pressed={m.k === dm.k} onClick={() => setDetail(m.k)}>{m.emoji} {m.label}</button>)}
            </div>
          </div>
          <div className="table-wrap">
            <table className="report grid">
              <thead><tr><th>City</th>{dates.map((d) => <th key={d}>{new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</th>)}</tr></thead>
              <tbody>
                {ready.map(({ city, st }) => (
                  <tr key={cityKey(city)}>
                    <th scope="row">{city.name}</th>
                    {st.days.map((d) => {
                      const v = d[dm.k], bg = cellColor(dm.k, v);
                      return <td key={d.date}>{bg ? <span className="pill" style={{ background: bg }}>{v ?? "–"}</span> : <>{v ?? "–"}<small>{dm.unit}</small></>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function CitiesPage({ cities, setCities }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const full = cities.length >= MAX_CITIES;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const move = (from, to) => {
    if (to < 0 || to >= cities.length || from === to) return;
    const next = [...cities];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setCities(next);
  };

  async function search(e) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true); setErr("");
    try {
      const r = await (await fetch("/api/search?q=" + encodeURIComponent(q.trim()))).json();
      if (r.error) throw new Error(r.error);
      setResults(r);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="card">
        <h2>➕ Add a city</h2>
        <form className="search" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a city, e.g. Tokyo" aria-label="City name" />
          <button className="btn primary" disabled={busy}>{busy ? "Searching…" : "🔎 Search"}</button>
        </form>
        <p className="hint">Pick up to {MAX_CITIES} cities. They’re saved on this device.</p>
        {err && <p className="err">Oops! {err}</p>}
        {results && !results.length && <p className="hint">No city found – try another spelling.</p>}
        <div className="results">
          {results?.map((c) => {
            const has = cities.some((x) => cityKey(x) === cityKey(c));
            return (
              <div className="result" key={c.id}>
                <span>📍 <b>{c.name}</b><small>{[c.region, c.country].filter(Boolean).join(", ")}</small></span>
                <button className="btn primary" disabled={has || full} onClick={() => setCities([...cities, { name: c.name, region: c.region, country: c.country, lat: c.lat, lon: c.lon }])}>
                  {has ? "Added ✓" : full ? "Full" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="card">
        <h2>⭐ My cities ({cities.length}/{MAX_CITIES})</h2>
        {cities.length > 1 && <p className="hint">Drag a city by its handle ☰, or use the arrows, to change the order.</p>}
        {!cities.length && <span className="hint">Nothing here yet – search above!</span>}
        <ol className="mine">
          {cities.map((c, i) => (
            <li
              key={cityKey(c)}
              className={"mine-item" + (drag === i ? " dragging" : "") + (over === i && drag !== null && drag !== i ? " over" : "")}
              draggable
              onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
            >
              <span className="handle" aria-hidden title="Drag to reorder">☰</span>
              <span className="rank">{i + 1}</span>
              <span className="mine-name">📍 {c.name}<small>{[c.region, c.country].filter(Boolean).join(", ")}</small></span>
              <button className="icon-btn" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>▲</button>
              <button className="icon-btn" aria-label={`Move ${c.name} down`} disabled={i === cities.length - 1} onClick={() => move(i, i + 1)}>▼</button>
              <button className="icon-btn danger" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => setCities(cities.filter((x) => x !== c))}>✖</button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/* ---------- login ---------- */
const userKey = (name, what) => `u:${name.trim().toLowerCase()}:${what}`;

function LoginPage({ onLogin }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 30);
  const known = loadLS("users", []);
  const go = async (n) => { setBusy(true); await onLogin(n); setBusy(false); };
  function submit(e) {
    e.preventDefault();
    if (!clean || busy) return;
    const key = clean.toLowerCase();
    const users = known.filter((n) => n.toLowerCase() !== key);
    const existing = known.find((n) => n.toLowerCase() === key);
    saveLS("users", [existing || clean, ...users].slice(0, 8));
    go(existing || clean);
  }
  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo">🌈</div>
        <h1>Sunny Skies</h1>
        <p className="hint">What’s your name? We’ll remember your cities for next time.</p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name" aria-label="Your name" maxLength={30} />
        <button className="btn primary big" disabled={!clean || busy}>{busy ? "Loading…" : "Let’s go! 🚀"}</button>
        {known.length > 0 && (
          <div className="known">
            <span className="hint">Welcome back:</span>
            {known.map((n) => <button type="button" key={n} className="chip" disabled={busy} onClick={() => go(n)}>👋 {n}</button>)}
          </div>
        )}
      </form>
    </main>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [page, setPage] = useState("weather");
  const [user, setUser] = useState(() => loadLS("user", null));
  const [cities, setCities] = useState(() => (user ? loadLS(userKey(user, "cities"), loadLS("cities", DEFAULT_CITIES)) : DEFAULT_CITIES));
  const [range, setRange] = useState(defaultRange);
  const allOn = Object.fromEntries(METRICS.map((m) => [m.k, true]));
  const [shown, setShown] = useState(() => (user ? loadLS(userKey(user, "shown"), allOn) : allOn));
  const [data, setData] = useState({});
  const rangeOk = Boolean(range.from && range.to && range.from <= range.to);

  const [sync, setSync] = useState("idle"); // idle | saving | saved | offline
  const skipSave = useRef(true);

  // Always keep a local copy; also push to the database (debounced) so it follows the user across devices.
  useEffect(() => {
    if (!user) return;
    saveLS(userKey(user, "cities"), cities);
    saveLS(userKey(user, "shown"), shown);
    if (skipSave.current) { skipSave.current = false; return; }
    setSync("saving");
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: user, cities, shown }) });
        setSync(r.ok ? "saved" : "offline");
      } catch { setSync("offline"); }
    }, 600);
    return () => clearTimeout(t);
  }, [cities, shown, user]);

  async function login(name) {
    let p = null;
    try {
      const r = await fetch(`/api/profile?name=${encodeURIComponent(name)}`);
      if (r.ok) p = (await r.json()).profile;
    } catch { /* offline: fall back to this device's copy */ }
    skipSave.current = Boolean(p); // don't re-save what we just loaded; do save a brand-new profile
    setCities(p?.cities ?? loadLS(userKey(name, "cities"), loadLS("cities", DEFAULT_CITIES)));
    setShown(p?.shown ?? loadLS(userKey(name, "shown"), allOn));
    setSync(p ? "saved" : "idle");
    setUser(name); saveLS("user", name); setPage("weather");
  }
  function logout() { setUser(null); saveLS("user", null); }

  const fetchAll = useCallback(async () => {
    if (!rangeOk) return;
    setData({});
    await Promise.all(cities.map(async (c) => {
      let res;
      try { res = await (await fetch(`/api/weather?lat=${c.lat}&lon=${c.lon}&from=${range.from}&to=${range.to}`)).json(); }
      catch (e) { res = { error: String(e) }; }
      setData((d) => ({ ...d, [cityKey(c)]: res }));
    }));
  }, [cities, range, rangeOk]);
  useEffect(() => { fetchAll(); }, [cities]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctl = { range, setRange, shown, setShown, fetchAll, rangeOk };
  const goCities = () => setPage("cities");
  const tabs = [["weather", "🌤️ Weather"], ["report", "📊 Report"], ["cities", "🏙️ My Cities"]];

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <>
      <header className="top no-print">
        <h1><span className="logo">🌈</span> Sunny Skies</h1>
        <nav>
          {tabs.map(([k, label]) => (
            <button key={k} className={page === k ? "active" : ""} onClick={() => setPage(k)}>
              {label}{k === "cities" && <b>{cities.length}</b>}
            </button>
          ))}
        </nav>
        <div className="user-box">
          <span className="avatar" aria-hidden>{user[0].toUpperCase()}</span>
          <span>Hi, <b>{user}</b>!</span>
          <span className="sync" title="Your cities are saved to your account">{sync === "saving" ? "⏳ Saving…" : sync === "saved" ? "☁️ Saved" : sync === "offline" ? "⚠️ Saved on this device only" : ""}</span>
          <button className="btn small" onClick={logout}>Switch user</button>
        </div>
      </header>
      <main>
        {page === "weather" && <WeatherPage cities={cities} goCities={goCities} ctl={ctl} data={data} />}
        {page === "report" && <ReportPage cities={cities} goCities={goCities} ctl={ctl} data={data} />}
        {page === "cities" && <CitiesPage cities={cities} setCities={setCities} />}
      </main>
    </>
  );
}

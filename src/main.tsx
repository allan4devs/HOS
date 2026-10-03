import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Route,
  FileText,
  Clock3,
  Fuel,
  Moon,
  ChevronDown,
  Search,
  Check,
  LoaderCircle,
  Download,
  Truck,
  X,
  RotateCcw,
  Info,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { RouteMap } from "./RouteMap";
import { LogSheet } from "./LogSheet";
import {
  hours,
  timeLabel,
  dateLabel,
  type Plan,
  type Location,
  type Driver,
} from "./types";

const example: Location[] = [
  { label: "Chicago, Illinois", lat: 41.8781, lng: -87.6298 },
  { label: "Indianapolis, Indiana", lat: 39.7684, lng: -86.1581 },
  { label: "Dallas, Texas", lat: 32.7767, lng: -96.797 },
];
const freshDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T08:00`;
};
const emptyDriver: Driver = {
  name: "",
  carrier: "",
  truck: "",
  trailer: "",
  shipping: "",
  terminal: "",
};
async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

function LocationInput({
  label,
  index,
  value,
  onSelect,
  disabled,
}: {
  label: string;
  index: number;
  value: Location | null;
  onSelect: (l: Location | null) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  React.useEffect(() => {
    if (value) setQuery(value.label);
    setResults([]);
    setError("");
  }, [value]);
  async function search() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ results: Location[] }>(
        `/api/geocode?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(data.results);
      if (!data.results.length)
        setError("No results. Try a US city and state or a full address.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="location-field">
      <label htmlFor={`location-${index}`}>{label}</label>
      <div className={`location-control ${value ? "selected" : ""}`}>
        <span className="location-number">{index + 1}</span>
        <input
          id={`location-${index}`}
          value={query}
          placeholder="City, state or street address"
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onSelect(null);
            setResults([]);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (query.trim().length >= 3) void search();
            }
          }}
        />
        <button
          type="button"
          aria-label={`Search ${label.toLowerCase()}`}
          title="Search and select a location"
          onClick={search}
          disabled={busy || disabled || query.trim().length < 3}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : value ? (
            <Check size={17} />
          ) : (
            <Search size={17} />
          )}
        </button>
      </div>
      {!!results.length && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(r);
                  setResults([]);
                }}
              >
                <MapPin size={15} />
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function App() {
  const [locations, setLocations] = useState<(Location | null)[]>(example);
  const [cycle, setCycle] = useState("0");
  const [departure, setDeparture] = useState(freshDate);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"route" | "logs">("route");
  const [day, setDay] = useState(0);
  const [driver, setDriver] = useState<Driver>(emptyDriver);
  const [showRules, setShowRules] = useState(false);
  const [exporting, setExporting] = useState(false);
  React.useEffect(() => {
    if (!showRules) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowRules(false);
      if (event.key === "Tab") {
        const buttons =
          document.querySelectorAll<HTMLButtonElement>(".modal button");
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [showRules]);
  const changed = () => {
    setPlan(null);
    setError("");
    setDay(0);
  };
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (locations.some((l) => !l)) {
      setError("Search and select each location before planning.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const p = await api<Plan>("/api/plan", {
        locations,
        cycle_used: Number(cycle),
        departure,
      });
      setPlan(p);
      setDay(0);
      setTab("route");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!plan) return;
    setExporting(true);
    try {
      const { exportLogs } = await import("./export");
      exportLogs(plan, driver);
    } catch {
      setError("Could not export the logs. Please try again.");
    } finally {
      setExporting(false);
    }
  }
  const stops = plan?.events.filter((e) => e.kind !== "drive") || [];
  return (
    <>
      <header className="header">
        <a href="/" className="brand" aria-label="HOS home">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          hos<span className="brand-dot">.</span>
        </a>
        <nav>
          <button
            className={tab === "route" ? "nav-active" : ""}
            onClick={() => setTab("route")}
          >
            <Route size={16} />
            Trip planner
          </button>
          <button
            className={tab === "logs" ? "nav-active" : ""}
            onClick={() => setTab("logs")}
          >
            <FileText size={16} />
            Daily logs
          </button>
        </nav>
        <a
          className="source-link"
          href="https://github.com/allan4devs/HOS"
          target="_blank"
          rel="noreferrer"
        >
          View source
          <ArrowUpRight size={16} />
        </a>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-dot" /> THE ROAD, WITH A PLAN
            </div>
            <h1>
              A better road ahead<span>.</span>
            </h1>
            <p>Plan your trip. Know your stops. Keep your hours in sight.</p>
          </div>
          <button className="rules-pill" onClick={() => setShowRules(true)}>
            <span className="tiny-dot" />
            70-hour / 8-day cycle
            <Info size={15} />
          </button>
        </div>
        <div className="workspace">
          <aside className="planner-card">
            <div className="card-heading">
              <span className="icon-square">
                <Truck size={20} />
              </span>
              <div>
                <h2>Your next trip</h2>
                <p>Every good route starts here.</p>
              </div>
            </div>
            <form onSubmit={generate}>
              <div className="location-stack">
                {[
                  "Current location",
                  "Pickup location",
                  "Drop-off location",
                ].map((label, i) => (
                  <LocationInput
                    key={i}
                    label={label}
                    index={i}
                    value={locations[i]}
                    disabled={busy}
                    onSelect={(l) => {
                      setLocations((old) =>
                        old.map((v, j) => (j === i ? l : v)),
                      );
                      changed();
                    }}
                  />
                ))}
              </div>
              <div className="form-divider" />
              <label className="form-label" htmlFor="cycle">
                Current cycle used <span>70 hrs max</span>
              </label>
              <div className="cycle-input">
                <Clock3 size={17} />
                <input
                  id="cycle"
                  type="number"
                  min="0"
                  max="70"
                  step="0.01"
                  required
                  value={cycle}
                  disabled={busy}
                  onChange={(e) => {
                    setCycle(e.target.value);
                    changed();
                  }}
                />
                <span>hours</span>
              </div>
              <div className="cycle-track">
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, (Number(cycle) / 70) * 100))}%`,
                  }}
                />
              </div>
              <p className="available">
                {Math.max(0, 70 - Number(cycle)).toFixed(1)} hours left in your
                current cycle
              </p>
              <label className="form-label" htmlFor="departure">
                Departure <span>Home-terminal time</span>
              </label>
              <input
                className="date-input"
                id="departure"
                type="datetime-local"
                min="2000-01-01T00:00"
                max="2100-12-31T23:59"
                required
                value={departure}
                disabled={busy}
                onChange={(e) => {
                  setDeparture(e.target.value);
                  changed();
                }}
              />
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="primary plan-button"
                disabled={busy}
                type="submit"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    Planning your route…
                  </>
                ) : (
                  <>
                    Generate trip plan
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <button
                type="button"
                className="example-button"
                disabled={busy}
                onClick={() => {
                  setLocations(example.map((x) => ({ ...x })));
                  setCycle("0");
                  changed();
                }}
              >
                <RotateCcw size={13} />
                Use example trip
              </button>
            </form>
            <div className="assumption-note">
              <span className="icon-square small">
                <Info size={15} />
              </span>
              <p>
                Starts with fresh daily clocks and a full tank.{" "}
                <button onClick={() => setShowRules(true)}>
                  See planning assumptions
                </button>
              </p>
            </div>
          </aside>
          <section className="results">
            <div className="result-tabs">
              <div>
                <button
                  className={tab === "route" ? "active" : ""}
                  onClick={() => setTab("route")}
                >
                  <Route size={17} />
                  Route overview
                </button>
                <button
                  className={tab === "logs" ? "active" : ""}
                  onClick={() => setTab("logs")}
                >
                  <FileText size={17} />
                  Daily log sheets
                  {plan && <span className="count">{plan.logs.length}</span>}
                </button>
              </div>
              <button
                className="export-button"
                disabled={!plan || exporting}
                onClick={download}
              >
                <Download size={15} />
                {exporting ? "Exporting…" : "Export logs"}
              </button>
            </div>
            {tab === "route" ? (
              <>
                <div className="map-card">
                  <RouteMap
                    plan={plan}
                    locations={(plan?.route.locations || locations).filter(
                      (l): l is Location => !!l,
                    )}
                  />
                  <div className="map-label">
                    <span className="tiny-dot" />
                    {plan ? "YOUR PLANNED ROUTE" : "YOUR ROUTE STARTS HERE"}
                  </div>
                  {!plan && (
                    <div className="map-empty">
                      <Route size={22} />
                      <strong>A clear view of the journey.</strong>
                      <span>
                        Generate a trip to see your route and planned stops.
                      </span>
                    </div>
                  )}
                  <div className="map-legend">
                    <span>
                      <i className="legend-route" />
                      Route
                    </span>
                    <span>
                      <i className="legend-rest" />
                      Rest & breaks
                    </span>
                    <span>
                      <i className="legend-fuel" />
                      Fuel
                    </span>
                  </div>
                </div>
                <div className="stats">
                  {[
                    {
                      label: "Total distance",
                      value: plan
                        ? `${plan.summary.miles.toLocaleString()} mi`
                        : "—",
                      sub: "Current → pickup → drop-off",
                      icon: <Route size={18} />,
                    },
                    {
                      label: "Driving time",
                      value: plan ? hours(plan.summary.driving_hours) : "—",
                      sub: "Estimated time behind the wheel",
                      icon: <Clock3 size={18} />,
                    },
                    {
                      label: "Trip duration",
                      value: plan ? hours(plan.summary.elapsed_hours) : "—",
                      sub: plan
                        ? `${plan.summary.days} daily log sheet${plan.summary.days === 1 ? "" : "s"}`
                        : "Including stops and rests",
                      icon: <Moon size={18} />,
                    },
                    {
                      label: "Fuel stops",
                      value: plan ? String(plan.summary.fuel_stops) : "—",
                      sub: "At least every 1,000 miles",
                      icon: <Fuel size={18} />,
                    },
                  ].map((s) => (
                    <div className="stat" key={s.label}>
                      <div>
                        {s.label}
                        {s.icon}
                      </div>
                      <strong>{s.value}</strong>
                      <small>{s.sub}</small>
                    </div>
                  ))}
                </div>
                <div className="itinerary-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ONE STOP AT A TIME</span>
                      <h2>Your road ahead</h2>
                    </div>
                    {plan && (
                      <span className="arrival">
                        Completion <strong>{timeLabel(plan.arrival)}</strong>
                      </span>
                    )}
                  </div>
                  {!plan ? (
                    <div className="empty-itinerary">
                      <span className="icon-square">
                        <MapPin size={21} />
                      </span>
                      <div>
                        <strong>A little planning. A smoother trip.</strong>
                        <p>
                          Your pickup, fuel stops, breaks and delivery will
                          appear here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="timeline">
                        <div className="timeline-item">
                          <span className="stop-icon start">
                            <Truck size={17} />
                          </span>
                          <div>
                            <small>{timeLabel(plan.departure)}</small>
                            <h3>Start your trip</h3>
                            <p>{plan.route.locations[0].label}</p>
                          </div>
                          <span className="duration">Mile 0</span>
                        </div>
                        {stops.map((s, i) => (
                          <div className="timeline-item" key={i}>
                            <span className={`stop-icon ${s.kind}`}>
                              {s.kind === "fuel" ? (
                                <Fuel size={17} />
                              ) : ["pickup", "dropoff"].includes(s.kind) ? (
                                <MapPin size={17} />
                              ) : (
                                <Moon size={17} />
                              )}
                            </span>
                            <div>
                              <small>{timeLabel(s.start)}</small>
                              <h3>{s.label}</h3>
                              <p>{s.place}</p>
                              {["rest", "break", "restart", "fuel"].includes(
                                s.kind,
                              ) && (
                                <span className="stop-note">
                                  Estimated position · verify a safe stopping
                                  facility
                                </span>
                              )}
                            </div>
                            <span className="duration">
                              {hours(s.seconds / 3600)}
                              <small>
                                Mile{" "}
                                {Math.round(s.mile_marker).toLocaleString()}
                              </small>
                            </span>
                          </div>
                        ))}
                      </div>
                      <details className="directions">
                        <summary>
                          Turn-by-turn route instructions
                          <ChevronDown size={16} />
                        </summary>
                        {plan.route.legs.map((leg, i) => (
                          <div key={i}>
                            <h3>
                              {i === 0
                                ? "Current location → pickup"
                                : "Pickup → drop-off"}{" "}
                              <span>{leg.miles.toFixed(0)} mi</span>
                            </h3>
                            <ol>
                              {leg.instructions.map((s, j) => (
                                <li key={j}>
                                  <span>{s.instruction}</span>
                                  <small>{s.miles} mi</small>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </details>
                      <p className="route-caveat">
                        Road directions use a car profile. Check truck
                        restrictions, road conditions and stopping facilities
                        before driving.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="logs-panel">
                {!plan ? (
                  <div className="logs-empty">
                    <FileText size={35} />
                    <h2>Your day, on the record.</h2>
                    <p>
                      Generate a trip plan to draw a complete 24-hour log for
                      each day.
                    </p>
                    <button className="primary" onClick={() => setTab("route")}>
                      Plan your trip
                      <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          EVERY HOUR ACCOUNTED FOR
                        </span>
                        <h2>Daily log sheets</h2>
                      </div>
                      <span className="preview-badge">Projected logs</span>
                    </div>
                    <details className="driver-details">
                      <summary>
                        Add driver & carrier details <ChevronDown size={16} />
                      </summary>
                      <div className="driver-grid">
                        {(Object.keys(emptyDriver) as (keyof Driver)[]).map(
                          (k) => (
                            <label key={k}>
                              {
                                {
                                  name: "Driver name",
                                  carrier: "Carrier name",
                                  truck: "Truck number",
                                  trailer: "Trailer number",
                                  shipping: "Shipping document",
                                  terminal: "Home terminal",
                                }[k]
                              }
                              <input
                                maxLength={80}
                                value={driver[k]}
                                onChange={(e) =>
                                  setDriver({ ...driver, [k]: e.target.value })
                                }
                              />
                            </label>
                          ),
                        )}
                      </div>
                    </details>
                    <div className="day-selector" aria-label="Log day">
                      {plan.logs.map((l, i) => (
                        <button
                          key={l.date}
                          className={day === i ? "selected" : ""}
                          onClick={() => setDay(i)}
                        >
                          <small>DAY {i + 1}</small>
                          {dateLabel(l.date).replace(/, \d{4}/, "")}
                        </button>
                      ))}
                    </div>
                    <LogSheet log={plan.logs[day]} driver={driver} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        <footer>
          <span>Made for the miles ahead.</span>
          <span>
            OpenStreetMap + OSRM <span className="footer-dot">·</span> Django +
            React <span className="footer-dot">·</span>
            <a
              href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
              target="_blank"
              rel="noreferrer"
            >
              FMCSA rule reference <ArrowUpRight size={12} />
            </a>
          </span>
        </footer>
      </main>
      {showRules && (
        <div className="modal-backdrop" onClick={() => setShowRules(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              aria-label="Close assumptions"
              autoFocus
              onClick={() => setShowRules(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">THE DETAILS BEHIND THE PLAN</span>
            <h2 id="rules-title">Planning assumptions</h2>
            <p>
              Property-carrying driver · 70 hours / 8 days · no adverse
              conditions.
            </p>
            <ul>
              {(
                plan?.assumptions || [
                  "Fresh daily clocks after 10 consecutive hours off duty before departure.",
                  "Up to 11 hours driving in a 14-hour duty window. A 30-minute non-driving interruption is required after 8 cumulative driving hours.",
                  "Current cycle usage includes driving and other on-duty hours. Unknown prior history is never used to grant recap credits; a 34-hour off-duty restart restores the 70-hour cycle.",
                  "Full tank at departure; a 30-minute on-duty fuel stop every 1,000 miles. Pickup and drop-off take 1 hour each.",
                  "OSRM road times, with a maximum planning average of 55 mph. No live traffic. Car routing does not verify truck restrictions.",
                  "Rest and fuel markers indicate estimated road positions, not confirmed truck stops.",
                  "Dates and logs use your entered home-terminal wall clock, without time-zone conversion.",
                  "Logs are planning previews. Outside-trip off-duty time is assumed; these are not certified ELD records.",
                ]
              ).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <button className="primary" onClick={() => setShowRules(false)}>
              Got it
              <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

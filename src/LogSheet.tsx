import {
  dateLabel,
  hours,
  statuses,
  statusLabels,
  type Log,
  type Driver,
} from "./types";

export function LogSheet({ log, driver }: { log: Log; driver: Driver }) {
  const x = (h: number) => 132 + h * 25;
  const y = (s: string) =>
    57 + statuses.indexOf(s as (typeof statuses)[number]) * 38;
  const path = log.segments
    .map(
      (s, i) =>
        `${i ? "L" : "M"}${x(s.start)},${y(s.status)} L${x(s.end)},${y(s.status)}`,
    )
    .join(" ");
  return (
    <article className="log-sheet">
      <div className="sheet-heading">
        <div>
          <span className="eyebrow">PROJECTED RECORD OF DUTY STATUS</span>
          <h3>Driver’s daily log</h3>
        </div>
        <div className="sheet-date">
          {dateLabel(log.date)}
          <small>24 hours · home-terminal time</small>
        </div>
      </div>
      <div className="sheet-fields">
        <span>
          Driver<strong>{driver.name || "Not provided"}</strong>
        </span>
        <span>
          Carrier<strong>{driver.carrier || "Not provided"}</strong>
        </span>
        <span>
          Truck / trailer
          <strong>
            {driver.truck || "—"} / {driver.trailer || "—"}
          </strong>
        </span>
        <span>
          Distance<strong>{log.miles.toLocaleString()} mi</strong>
        </span>
      </div>
      <div className="graph-scroll">
        <svg
          viewBox="0 0 822 208"
          role="img"
          aria-label={`Duty status graph for ${log.date}`}
          className="log-graph"
        >
          <rect x="132" y="38" width="600" height="152" fill="#fafbf8" />
          {Array.from({ length: 97 }, (_, i) => (
            <line
              key={i}
              x1={132 + i * 6.25}
              x2={132 + i * 6.25}
              y1="38"
              y2="190"
              stroke={i % 4 === 0 ? "#c7d2c9" : "#e7ece5"}
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          ))}
          {Array.from({ length: 25 }, (_, i) => (
            <text
              key={i}
              x={x(i)}
              y="26"
              textAnchor="middle"
              fontSize="10"
              fill="#647269"
            >
              {i === 0 || i === 24 ? "M" : i === 12 ? "N" : i % 12}
            </text>
          ))}
          {statuses.map((s, i) => (
            <g key={s}>
              <text x="8" y={y(s) + 4} fontSize="12" fill="#3c4b41">
                {i + 1}. {statusLabels[i]}
              </text>
              <line
                x1="132"
                x2="732"
                y1={38 + i * 38}
                y2={38 + i * 38}
                stroke="#bdc9be"
              />
              <text x="750" y={y(s) + 4} fontSize="12" fill="#3c4b41">
                {hours(log.totals[s])}
              </text>
            </g>
          ))}
          <line x1="132" x2="732" y1="190" y2="190" stroke="#bdc9be" />
          <path
            d={path}
            fill="none"
            stroke="#237153"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="sheet-fields lower">
        <span>
          Home terminal<strong>{driver.terminal || "Not provided"}</strong>
        </span>
        <span>
          Shipping document<strong>{driver.shipping || "Not provided"}</strong>
        </span>
        <span>
          Total<strong>24h 00m</strong>
        </span>
      </div>
      <div className="remarks">
        <span className="eyebrow">REMARKS · STATUS CHANGES</span>
        {log.remarks.map((r, i) => (
          <div key={i}>
            <time>{r.time}</time>
            <span>
              {r.label}
              {r.continued ? " (continued)" : ""}
              <small>{r.place}</small>
            </span>
          </div>
        ))}
      </div>
      <p className="sheet-note">
        Planning preview. Off-duty time outside the trip is assumed. Driver
        certification and actual duty records are required for an official log.
      </p>
    </article>
  );
}

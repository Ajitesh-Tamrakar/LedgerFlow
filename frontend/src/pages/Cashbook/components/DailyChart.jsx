import { useMemo, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatDay, formatInr, weekdayName } from "../../../lib/format";
import "./DailyChart.css";

/*
 * "Daily collections" -- the dark wide card and the home of the range
 * toggle. The line is built client-side from the derived window (the
 * design's own math, ported): every day in the range is a point, days
 * with a row sit on the line (a deliberate-₹0 day dips to the
 * baseline), days without a row break the line and leave an amber gap
 * tick -- a missing day is a gap, never a ₹0.
 */
const ACCENT = "#D8F14B";

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "14", label: "14 days" },
  { key: "30", label: "30 days" },
  { key: "custom", label: "Custom" },
];

// Catmull-Rom smoothing, the design's curve.
function smooth(points) {
  if (points.length === 1) {
    return (
      "M" +
      (points[0].x - 0.8).toFixed(2) +
      "," +
      points[0].y.toFixed(2) +
      " L" +
      (points[0].x + 0.8).toFixed(2) +
      "," +
      points[0].y.toFixed(2)
    );
  }

  let path = "M" + points[0].x.toFixed(2) + "," + points[0].y.toFixed(2);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return path;
}

function DailyChart({
  perDay,
  range,
  customFrom,
  customTo,
  today,
  invalid,
  recordedCount,
  missingCount,
  total,
  onRangeChange,
  onCustomFrom,
  onCustomTo,
  onDateChange,
}) {
  const [hover, setHover] = useState(-1);

  // The whole chart geometry, derived once per window.
  const chart = useMemo(() => {
    const pts = perDay.map((d) => ({
      iso: d.date,
      t: d.status === "missing" ? null : d.total,
      zero: d.status === "zero",
    }));

    const n = Math.max(1, pts.length);
    const maxT = Math.max(...pts.map((p) => p.t ?? 0), 1);
    const xAt = (i) => (n === 1 ? 50 : 3 + (i / (n - 1)) * 94);
    const yAt = (t) => 92 - (t / maxT) * 78;

    // Runs of recorded days become line segments; a missing day breaks
    // the run, so a long unrecorded stretch reads as an honest gap.
    const segments = [];
    let run = [];
    pts.forEach((p, i) => {
      if (p.t !== null) {
        run.push({ x: xAt(i), y: yAt(p.t) });
      } else if (run.length) {
        segments.push(run);
        run = [];
      }
    });
    if (run.length) segments.push(run);

    const segs = segments.map((seg) => {
      const line = smooth(seg);
      const area =
        line +
        ` L${seg[seg.length - 1].x.toFixed(2)},92 L${seg[0].x.toFixed(2)},92 Z`;
      return { line, area };
    });

    const gaps = pts
      .map((p, i) => (p.t !== null ? null : xAt(i).toFixed(2)))
      .filter((x) => x !== null);

    // Latest recorded day, if any, gets the white marker.
    let latest = null;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].t !== null) {
        latest = { x: xAt(i), y: yAt(pts[i].t) };
        break;
      }
    }

    const tickEvery = Math.max(1, Math.ceil(n / 8));

    return {
      pts,
      n,
      segs,
      gaps,
      latest,
      ticks: pts.map((p, i) => ({
        label: i % tickEvery === 0 || i === n - 1 ? String(Number(p.iso.slice(8))) : "",
        last: i === n - 1,
      })),
      xAt,
      yAt,
    };
  }, [perDay]);

  const hp = hover >= 0 && hover < chart.pts.length ? chart.pts[hover] : null;
  const hx = hp ? chart.xAt(hover) : 0;
  const hoverY = hp && hp.t !== null ? chart.yAt(hp.t) : 0;

  const headlineLabel = invalid
    ? "Pick a valid range"
    : range === "custom"
      ? `${formatDay(perDay[0]?.date ?? today)} – ${formatDay(perDay[perDay.length - 1]?.date ?? today)} collections`
      : `${range}-day collections`;

  const alt = `Daily collection totals, ${chart.pts.length} days. ${recordedCount} days recorded, ${missingCount} not recorded.`;

  return (
    <Card className="daily-chart card--dark card--wide">
      <div className="daily-chart__header">
        <h2 className="daily-chart__title">Daily collections</h2>
        <div className="daily-chart__ranges" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={
                "daily-chart__range" +
                (range === r.key ? " daily-chart__range--on" : "")
              }
              aria-pressed={range === r.key}
              onClick={() => onRangeChange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {range === "custom" && (
        <div className="daily-chart__custom">
          <label className="daily-chart__date-field">
            <span>From</span>
            <input
              type="date"
              value={customFrom}
              max={today}
              onChange={(e) => onCustomFrom(e.target.value)}
              aria-label="Range from"
            />
          </label>
          <label className="daily-chart__date-field">
            <span>To</span>
            <input
              type="date"
              value={customTo}
              max={today}
              onChange={(e) => onCustomTo(e.target.value)}
              aria-label="Range to"
            />
          </label>
          {invalid && (
            <span className="daily-chart__custom-error" role="alert">
              From is after To.
            </span>
          )}
        </div>
      )}

      <div className="daily-chart__headline-row">
        <div className="daily-chart__headline">{invalid ? "—" : <CountUp value={total} duration={700} format={formatInr} />}</div>
        <div className="daily-chart__headline-sub">
          <span>{headlineLabel}</span>
          {!invalid && (
            <>
              <span className="daily-chart__divider" aria-hidden="true" />
              <span className="daily-chart__coverage">
                {recordedCount} recorded · {missingCount} missing
              </span>
            </>
          )}
        </div>
      </div>

      <div
        // A new key per window re-fires the draw-in animation on range change.
        key={`${range}:${customFrom}:${customTo}`}
        className="daily-chart__canvas"
        role="img"
        aria-label={alt}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="daily-chart__svg">
          <defs>
            <linearGradient id="daily-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.42" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1="0" y1="92" x2="100" y2="92" stroke="rgba(255,255,255,0.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {chart.segs.map((s, i) => (
            <path key={`a${i}`} d={s.area} fill="url(#daily-chart-fill)" className="daily-chart__area" />
          ))}
          {chart.segs.map((s, i) => (
            <path key={`l${i}`} d={s.line} fill="none" stroke={ACCENT} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="daily-chart__line" />
          ))}
          {chart.gaps.map((x, i) => (
            <line key={`g${i}`} x1={x} y1="86" x2={x} y2="92" stroke="#E3B23C" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {chart.latest && !invalid && (
          <span
            className="daily-chart__latest"
            style={{ left: `${chart.latest.x}%`, top: `${chart.latest.y}%` }}
            aria-hidden="true"
          />
        )}

        {hp && (
          <span
            className="daily-chart__hover-line"
            style={{ left: `${hx}%` }}
            aria-hidden="true"
          />
        )}
        {hp && hp.t !== null && (
          <span
            className="daily-chart__hover-dot"
            style={{ left: `${hx}%`, top: `${hoverY}%` }}
            aria-hidden="true"
          />
        )}
        {hp && (
          <span
            className={"daily-chart__tip" + (hx > 70 ? " daily-chart__tip--flip-r" : hx < 14 ? " daily-chart__tip--flip-l" : "")}
            style={{ left: `${Math.min(88, Math.max(12, hx))}%` }}
          >
            <span className="daily-chart__tip-date">
              {formatDay(hp.iso)} · {weekdayName(hp.iso)}
            </span>
            <span
              className={
                "daily-chart__tip-value" +
                (hp.t !== null && hp.t > 0 ? "" : " daily-chart__tip-value--soft")
              }
            >
              {hp.t !== null && hp.t > 0 ? formatInr(hp.t) : hp.t !== null ? "₹0" : "—"}
            </span>
            <span
              className={
                "daily-chart__tip-status" +
                (hp.t !== null && hp.t > 0 ? "" : " daily-chart__tip-status--soft")
              }
            >
              {hp.t === null
                ? "Not recorded"
                : hp.t === 0
                  ? "Recorded as ₹0"
                  : "Recorded"}
            </span>
          </span>
        )}

        <div className="daily-chart__hits">
          {chart.pts.map((p, i) => (
            <button
              type="button"
              key={p.iso}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(-1)}
              onBlur={() => setHover(-1)}
              onClick={() => onDateChange(p.iso)}
              aria-label={`${formatDay(p.iso)} · ${
                p.t !== null ? `${formatInr(p.t)} collected` : "not recorded"
              }. Open in the entry form`}
            />
          ))}
        </div>
      </div>

      <div className="daily-chart__ticks">
        {chart.ticks.map((t, i) => (
          <span key={i} className={"daily-chart__tick" + (t.last ? " daily-chart__tick--last" : "")}>
            {t.label}
          </span>
        ))}
      </div>

      <div className="daily-chart__legend">
        <span className="daily-chart__legend-item">
          <span className="daily-chart__key daily-chart__key--line" style={{ background: ACCENT }} aria-hidden="true" />
          Recorded collection
        </span>
        <span className="daily-chart__legend-item">
          <span className="daily-chart__key daily-chart__key--gap" aria-hidden="true" />
          Not recorded — a gap, not ₹0
        </span>
        <span className="daily-chart__legend-item">
          <span className="daily-chart__key daily-chart__key--dot" style={{ borderColor: ACCENT }} aria-hidden="true" />
          Latest recorded day
        </span>
      </div>
    </Card>
  );
}

export default DailyChart;

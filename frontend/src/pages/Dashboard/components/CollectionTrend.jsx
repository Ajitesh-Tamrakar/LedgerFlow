import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr, formatPercent } from "../../../lib/format";
import "./CollectionTrend.css";

/*
 * "Collection trend" -- the dark wide card, and the home of the
 * Week / Month / Quarter buttons.
 *
 * The buttons do not own the period: they report up via
 * onPeriodChange, the page flips its one `period` state, and the
 * page re-fetches this card's data plus the summary tray. That is
 * the whole "one button switches everything" story.
 */
const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
];

// The mock used one-letter sample labels; the API returns real ones
// ("6 Oct", "Wk of 6 Oct"). Shorten per period so 31 monthly bars
// and 13 weekly bars still fit their columns.
function barLabel(point, period) {
  if (period === "month") {
    return point.label.split(" ")[0]; // "6 Oct" -> "6"
  }
  if (period === "quarter") {
    return point.label.replace("Wk of ", ""); // "Wk of 6 Oct" -> "6 Oct"
  }
  return point.label;
}

function CollectionTrend({ trend, period, onPeriodChange }) {
  const points = trend.trend;
  const max = Math.max(...points.map((p) => Number(p.amount)), 0) || 1;

  /*
   * The mock re-fires a small rise on the headline whenever the figure
   * changes. A CSS animation only plays when it *changes*, and the
   * headline element must persist (the CountUp inside keeps its value),
   * so it alternates between two identical keyframes, A and B.
   */
  const [pop, setPop] = useState("a");
  const lastTotal = useRef(trend.current.total);

  useEffect(() => {
    if (lastTotal.current !== trend.current.total) {
      lastTotal.current = trend.current.total;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [trend.current.total]);

  const delta = formatPercent(trend.change_percent);

  const chartAlt =
    `Bar chart of collections by ${trend.granularity}, ` +
    `${points[0].label} to ${points[points.length - 1].label}. ` +
    `Latest ${trend.current.label}: ${formatInr(trend.current.total)}.`;

  return (
    <Card className="collection-trend card--wide">
      <div className="collection-trend__header">
        <h2 className="collection-trend__title">Collection trend</h2>
        <div className="collection-trend__periods" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="collection-trend__period"
              aria-pressed={period === p.key}
              onClick={() => onPeriodChange(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="collection-trend__head-row">
        <div>
          <div
            className={`collection-trend__headline collection-trend__headline--${pop}`}
          >
            <CountUp
              value={Number(trend.current.total)}
              duration={900}
              format={formatInr}
            />
          </div>
          <div className="collection-trend__headline-sub">
            {trend.current.label} · vs {trend.previous.label}{" "}
            {formatInr(trend.previous.total)}
          </div>
        </div>
        {/* Remounting on change (a new key) re-fires the pill's pop. */}
        <span key={delta} className="collection-trend__delta">
          {delta}
        </span>
      </div>

      <div className="collection-trend__chart" role="img" aria-label={chartAlt}>
        {points.map((point, i) => {
          // Latest bucket is the running one (accent); the one before it
          // is the last completed (grey); the rest sit in between.
          const classes =
            "collection-trend__bar" +
            (i === points.length - 1 ? " collection-trend__bar--current" : "") +
            (i === points.length - 2 ? " collection-trend__bar--last" : "");

          return (
            <div className="collection-trend__bar-col" key={point.bucket}>
              <div
                className={classes}
                style={{
                  height: `${Math.round((Number(point.amount) / max) * 100)}%`,
                  animationDelay: `${120 + i * 34}ms`,
                }}
              />
              <span className="collection-trend__bar-label" aria-hidden="true">
                {barLabel(point, period)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default CollectionTrend;

import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr, formatPercent } from "../../../lib/format";
import "./InProgress.css";

/*
 * "In progress" -- the lime accent card.
 *
 * How much of the selected period has actually happened, and how it is
 * pacing against the same slice of the previous period. Period-based, so
 * the page re-fetches it with the rest of the tray on toggle.
 *
 * `label` / `prevLabel` are the trend's period names ("October",
 * "September") — the card just plugs them into the design's wording.
 */
function InProgress({ inProgress, label, prevLabel, period = "month" }) {
  const { total, elapsed_days, period_days, pace_delta_percent, prev_same_days_total } =
    inProgress;

  const pct = Math.round((elapsed_days / period_days) * 100);

  const days =
    period === "month" && label
      ? `${elapsed_days} of ${period_days} days of ${label} recorded`
      : `${elapsed_days} of ${period_days} days recorded`;

  // The pace block only makes sense when there is something to pace
  // against; the API sends pace_delta_percent = null otherwise.
  const hasPace =
    pace_delta_percent !== null && pace_delta_percent !== undefined;

  // The design's month wording names the slice: "vs 1–11 August".
  // Week/quarter labels already name the whole window, so use them as-is.
  const baseline =
    period === "month" ? `1–${elapsed_days} ${prevLabel}` : prevLabel;

  return (
    <Card className="in-progress">
      <h2 className="in-progress__title">In progress</h2>

      <div className="in-progress__figure">
        <div className="in-progress__total">
          <CountUp value={Number(total)} duration={900} format={formatInr} />
        </div>
        {label && <div className="in-progress__so-far">{label} so far</div>}
      </div>

      <div className="in-progress__progress">
        <div className="in-progress__track">
          <div className="in-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="in-progress__days">{days}</div>
      </div>

      {hasPace && (
        <div className="in-progress__pace">
          <div className="in-progress__pace-head">
            <span className="in-progress__pace-label">Early pace</span>
            <span className="in-progress__pace-delta">
              {formatPercent(pace_delta_percent)}
            </span>
          </div>
          <p className="in-progress__pace-note">
            vs {baseline} ({formatInr(prev_same_days_total)}). A rougher read
            than the trend figure — early days swing hard.
          </p>
        </div>
      )}
    </Card>
  );
}

export default InProgress;

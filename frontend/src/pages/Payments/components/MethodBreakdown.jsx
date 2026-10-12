import Card from "../../../components/Card/Card";
import "./MethodBreakdown.css";

/*
 * "How it went out" -- the wide breakdown card: the traced-percentage
 * headline, the nested donut (one concentric ring per method, arcs scaled
 * against the biggest share) and the per-method rows.
 *
 * Everything on it is the range-scoped aggregate the page derives from
 * the merged rows. Hovering a row or a ring highlights its method and
 * dims the others; clicking either narrows the list to that method.
 *
 * Pure presentation: the page hands it finished rows, rings and the
 * current hover.
 */
function MethodBreakdown({
  mix,
  rows,
  rings,
  aria,
  hoverMethod,
  onHover,
  onPick,
}) {
  return (
    <Card className="payments-breakdown card--full">
      <div className="payments-breakdown__body">
        <div className="payments-breakdown__left">
          <div>
            <h2 className="payments-breakdown__eyebrow">How it went out</h2>
            <span className="payments-breakdown__headline-line">
              <span className="payments-breakdown__headline">
                {mix.headline}
              </span>
              <span className="payments-breakdown__headline-note">
                {mix.headlineNote}
              </span>
            </span>
          </div>

          <div className="payments-breakdown__donut">
            <svg viewBox="0 0 200 200" role="img" aria-label={aria}>
              <g transform="rotate(-90 100 100)">
                {rings.map((ring) => (
                  <circle
                    key={`track-${ring.value}`}
                    cx="100"
                    cy="100"
                    r={ring.r}
                    fill="none"
                    stroke="#F4F4EE"
                    strokeWidth={ring.w}
                  />
                ))}
                {rings.map((ring) => (
                  <circle
                    key={ring.value}
                    cx="100"
                    cy="100"
                    r={ring.r}
                    pathLength="100"
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={ring.w}
                    strokeLinecap="round"
                    strokeDasharray={ring.dash}
                    strokeDashoffset="0"
                    className={
                      "payments-breakdown__arc" +
                      (ring.dim ? " payments-breakdown__arc--dim" : "")
                    }
                    style={{ animationDelay: `${ring.delay}ms` }}
                    onClick={() => onPick(ring.value)}
                    onMouseEnter={() => onHover(ring.value)}
                    onMouseLeave={() => onHover(null)}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>

        <div className="payments-breakdown__right">
          <div className="payments-breakdown__cols">
            <span className="payments-breakdown__col-name">
              Payment method
            </span>
            <span className="payments-breakdown__col-share">Share</span>
            <span className="payments-breakdown__col-amount">Amount</span>
          </div>

          {rows.map((row) => (
            <button
              key={row.value}
              type="button"
              aria-label={row.aria}
              className={
                "payments-breakdown__row" +
                (hoverMethod === row.value
                  ? " payments-breakdown__row--hover"
                  : "") +
                (row.dim ? " payments-breakdown__row--dim" : "")
              }
              onClick={() => onPick(row.value)}
              onMouseEnter={() => onHover(row.value)}
              onMouseLeave={() => onHover(null)}
            >
              <span className="payments-breakdown__line">
                <span
                  className="payments-breakdown__dot"
                  style={{ background: row.fill }}
                  aria-hidden="true"
                />
                <span className="payments-breakdown__name">
                  {row.label}
                </span>
                <span className="payments-breakdown__count">
                  {row.countLabel}
                </span>
              </span>
              <span className="payments-breakdown__share">{row.share}</span>
              <span className="payments-breakdown__amount">{row.amount}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="payments-breakdown__strip">
        <span className="payments-breakdown__strip-note">
          Most used: <span className="payments-breakdown__top-label">{mix.topLabel}</span>
        </span>
        <span className="payments-breakdown__strip-note">
          <span className="payments-breakdown__top-share">
            {mix.topShare}
          </span>{" "}
          of what left the till this period
        </span>
      </div>
    </Card>
  );
}

export default MethodBreakdown;

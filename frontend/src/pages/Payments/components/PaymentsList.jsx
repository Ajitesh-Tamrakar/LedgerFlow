import Card from "../../../components/Card/Card";
import "./PaymentsList.css";

/*
 * "Payments" -- the wide list card: the result count, the current page's
 * rows, the empty state and the pagination footer.
 *
 * Pure presentation: the page hands it finished rows and reports opens,
 * page clicks and the empty state's reset. The row rise re-fires off the
 * `gen` counter's parity (two identical keyframes, A and B -- the design's
 * rowA/rowB), staggered 45 ms per row; the count pop off `tick`'s, the
 * design's two counters.
 */

// The design's page buttons: every page within one of the current, plus
// the first and last, gaps collapsed into a single "…" (the bills and
// dealers pages' rule -- the mock's flat list of every page number
// doesn't scale to a real payment count).
function pageItems(current, count) {
  const items = [];

  for (let p = 1; p <= count; p++) {
    const near = Math.abs(p - current) <= 1 || p === 1 || p === count;

    if (!near) {
      if (items.length && items[items.length - 1].ellipsis) {
        continue;
      }
      items.push({ label: "…", ellipsis: true });
      continue;
    }

    items.push({ label: String(p) });
  }

  return items;
}

function PaymentsList({
  rows,
  tick,
  gen,
  flash,
  resultCount,
  page,
  pageCount,
  range,
  empty,
  onOpen,
  onPageChange,
  onReset,
}) {
  const rowAnim = gen % 2 ? "b" : "a";
  const countAnim = tick % 2 ? "b" : "a";

  return (
    <Card className="payments-list card--full">
      <div className="payments-list__header">
        <h2 className="payments-list__title">Payments</h2>
        <span
          className={`payments-list__count payments-list__count--${countAnim}`}
        >
          {resultCount}
        </span>
      </div>

      {flash && (
        <div className="payments-list__flash" role="status">
          <span aria-hidden="true" />
          {flash}
        </div>
      )}

      <div className="payments-list__table" role="table" aria-label="Payments">
        <div className="payments-list__cols" role="row">
          <span className="payments-list__col-dealer">Dealer</span>
          <span className="payments-list__col-method">Method</span>
          <span className="payments-list__col-date">Paid on</span>
          <span className="payments-list__col-amount">Amount</span>
        </div>

        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            role="row"
            className={
              `payments-list__row payments-list__row--${rowAnim}` +
              (row.justSaved ? " payments-list__row--saved" : "")
            }
            style={{ animationDelay: `${row.delay}ms` }}
            aria-label={row.aria}
            onClick={() => onOpen(row.id)}
          >
            <span className="payments-list__id">
              <span
                className={
                  "payments-list__chip" +
                  (row.justSaved ? " payments-list__chip--saved" : "")
                }
                aria-hidden="true"
              >
                {row.initials}
              </span>
              <span className="payments-list__text">
                <span className="payments-list__name-line">
                  <span className="payments-list__name">{row.dealer}</span>
                  {row.retired && (
                    <span className="payments-list__retired">Retired</span>
                  )}
                </span>
                <span className="payments-list__meta">{row.meta}</span>
              </span>
            </span>

            <span className="payments-list__method">
              <span
                className="payments-list__badge"
                style={{
                  background: row.badge.bg,
                  color: row.badge.fg,
                  borderColor: row.badge.border,
                }}
              >
                {row.method}
              </span>
            </span>

            <span className="payments-list__date">{row.date}</span>
            <span className="payments-list__amount">{row.amount}</span>
          </button>
        ))}

        {empty && (
          <div className="payments-list__empty">
            <p className="payments-list__empty-note">{empty.note}</p>
            <button
              type="button"
              className="payments-list__empty-cta"
              onClick={onReset}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="payments-list__footer">
        <span className="payments-list__range">{range}</span>

        <div className="payments-list__pager">
          <button
            type="button"
            className="payments-list__nav"
            disabled={page === 1}
            aria-label="Previous page"
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </button>

          {pageItems(page, pageCount).map((item, index) =>
            item.ellipsis ? (
              <span
                key={`gap-${index}`}
                className="payments-list__gap"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item.label}
                type="button"
                className={
                  "payments-list__num" +
                  (Number(item.label) === page
                    ? " payments-list__num--on"
                    : "")
                }
                aria-current={Number(item.label) === page ? "page" : undefined}
                aria-label={`Page ${item.label} of ${pageCount}`}
                onClick={() => onPageChange(Number(item.label))}
              >
                {item.label}
              </button>
            )
          )}

          <button
            type="button"
            className="payments-list__nav"
            disabled={page === pageCount}
            aria-label="Next page"
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </Card>
  );
}

export default PaymentsList;

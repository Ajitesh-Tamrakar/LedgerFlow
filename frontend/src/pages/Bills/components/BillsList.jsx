import Card from "../../../components/Card/Card";
import "./BillsList.css";

/*
 * "Bills" -- the wide list card: the result count, the current page's
 * rows, the empty state and the pagination footer.
 *
 * Pure presentation: the page hands it finished rows and reports opens,
 * page clicks and the empty state's reset. The row rise re-fires off the
 * `gen` counter's parity (two identical keyframes, A and B -- the design's
 * rowA/rowB), staggered 45 ms per row; the count pop off `tick`'s, the
 * design's two counters.
 */

// The design's page buttons: every page within one of the current, plus
// the first and last, gaps collapsed into a single "…" (the dealers
// page's rule -- the mock's flat list of every page number doesn't scale
// to a real bill count).
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

function BillsList({
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
    <Card className="bills-list card--wide card--full">
      <div className="bills-list__header">
        <h2 className="bills-list__title">Bills</h2>
        <span
          className={`bills-list__count bills-list__count--${countAnim}`}
        >
          {resultCount}
        </span>
      </div>

      {flash && (
        <div className="bills-list__flash" role="status">
          <span aria-hidden="true" />
          {flash}
        </div>
      )}

      <div className="bills-list__table" role="table" aria-label="Bills">
        <div className="bills-list__cols" role="row">
          <span className="bills-list__col-dealer">Dealer</span>
          <span className="bills-list__col-date">Bill date</span>
          <span className="bills-list__col-amount">Amount</span>
        </div>

        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            role="row"
            className={`bills-list__row bills-list__row--${rowAnim}`}
            style={{ animationDelay: `${index * 45}ms` }}
            aria-label={row.aria}
            onClick={() => onOpen(row.id)}
          >
            <span className="bills-list__id">
              <span
                className="bills-list__chip"
                aria-hidden="true"
              >
                PDF
              </span>
              <span className="bills-list__text">
                <span className="bills-list__name-line">
                  <span className="bills-list__name">{row.dealer}</span>
                  {row.retired && (
                    <span className="bills-list__retired">Retired</span>
                  )}
                </span>
                <span className="bills-list__meta">{row.meta}</span>
              </span>
            </span>

            <span className="bills-list__date">{row.date}</span>
            <span className="bills-list__amount">{row.amount}</span>
          </button>
        ))}

        {empty && (
          <div className="bills-list__empty">
            <p className="bills-list__empty-note">{empty.note}</p>
            <button
              type="button"
              className="bills-list__empty-cta"
              onClick={onReset}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="bills-list__footer">
        <span className="bills-list__range">{range}</span>

        <div className="bills-list__pager">
          <button
            type="button"
            className="bills-list__nav"
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
                className="bills-list__gap"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item.label}
                type="button"
                className={
                  "bills-list__num" +
                  (Number(item.label) === page
                    ? " bills-list__num--on"
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
            className="bills-list__nav"
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

export default BillsList;

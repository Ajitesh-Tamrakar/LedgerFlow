import Card from "../../../components/Card/Card";
import { formatInr } from "../../../lib/format";
import "./DealersList.css";

/*
 * "Dealers" -- the wide list card: the column header, the current page's
 * rows, the empty state and the pagination footer.
 *
 * Pure presentation: the page hands it the current page's rows plus the
 * paging figures and reports opens, retires and page clicks back. The row
 * rise re-fires off the `gen` counter's parity (two identical keyframes,
 * A and B -- the design's rowA/rowB), staggered 38 ms per row.
 */

// The design's initials: first letters of the first two words that begin
// with a letter or digit, uppercased.
function initials(name) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word[0]));
  return ((words[0] || "?")[0] + (words[1] ? words[1][0] : "")).toUpperCase();
}

// Three-state read of a signed outstanding figure (the design's tone()).
function toneOf(balance) {
  if (balance < 0) return "credit";
  if (balance === 0) return "settled";
  return "owed";
}

// The design's page buttons: every page within one of the current, plus
// the first and last, gaps collapsed into a single "…".
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

// The design's three exact empty-state wordings.
function emptyCopy(query, status) {
  if (query) {
    return {
      note:
        `Nothing matches “${query}”` +
        (status === "all" ? "." : ` in ${status} dealers.`),
      cta: "Clear search",
    };
  }

  if (status === "inactive") {
    return {
      note: "No retired dealers — every dealer on the books is active.",
      cta: "Show all dealers",
    };
  }

  return {
    note: "No dealers yet. Add the first one with the form beside this list.",
    cta: "Show all dealers",
  };
}

function DealersList({
  rows,
  selectedId,
  gen,
  flash,
  query,
  status,
  page,
  pageCount,
  range,
  onOpen,
  onToggleActive,
  onPageChange,
  onReset,
}) {
  const empty = rows.length === 0 ? emptyCopy(query, status) : null;
  const rowAnim = gen % 2 ? "b" : "a";

  return (
    <Card className="dealers-list card--wide">
      <div className="dealers-list__header">
        <h2 className="dealers-list__title">Dealers</h2>
        <span className="dealers-list__hint">Highest owed first.</span>
      </div>

      {flash && (
        <div className="dealers-list__flash" role="status">
          <span aria-hidden="true" />
          {flash}
        </div>
      )}

      <div className="dealers-list__table" role="table" aria-label="Dealers">
        <div className="dealers-list__cols" role="row">
          <span className="dealers-list__col-name">Dealer</span>
          <span className="dealers-list__col-gst">GSTIN</span>
          <span className="dealers-list__col-bal">Outstanding</span>
          <span className="dealers-list__col-action">Action</span>
        </div>

        {rows.map((dealer, index) => {
          const balance = Number(dealer.outstanding_balance);
          const tone = toneOf(balance);
          const state = dealer.id === selectedId
            ? "selected"
            : dealer.is_active
              ? "active"
              : "retired";

          return (
            <div
              key={dealer.id}
              role="row"
              className={`dealers-list__row dealers-list__row--${state} dealers-list__row--${rowAnim}`}
              style={{ animationDelay: `${index * 38}ms` }}
            >
              <button
                type="button"
                className="dealers-list__open"
                onClick={() => onOpen(dealer.id)}
                aria-label={`Open ${dealer.name} — ${formatInr(
                  balance
                )} ${tone === "credit" ? "in credit" : tone === "settled" ? "settled" : "owed"}`}
              >
                <span aria-hidden="true" className="dealers-list__chip">
                  {initials(dealer.name)}
                </span>
                <span className="dealers-list__text">
                  <span className="dealers-list__name">{dealer.name}</span>
                  <span className="dealers-list__state">
                    <span aria-hidden="true" className="dealers-list__dot" />
                    {dealer.is_active ? "Active" : "Inactive"}
                  </span>
                </span>
              </button>

              <span className="dealers-list__gst">
                {dealer.gstin || "—"}
              </span>

              <span className="dealers-list__balwrap">
                <span
                  className={`dealers-list__bal dealers-list__bal--${
                    dealer.is_active ? tone : balance < 0 ? "credit" : "dim"
                  }`}
                >
                  {formatInr(balance)}
                </span>
                <span
                  className={`dealers-list__tag dealers-list__tag--${tone}`}
                >
                  {tone === "credit"
                    ? "In credit"
                    : tone === "settled"
                      ? "Settled"
                      : "Owed"}
                </span>
              </span>

              <span className="dealers-list__action">
                <button
                  type="button"
                  className="dealers-list__toggle"
                  onClick={() => onToggleActive(dealer.id)}
                >
                  {dealer.is_active ? "Retire" : "Restore"}
                </button>
              </span>
            </div>
          );
        })}

        {empty && (
          <div className="dealers-list__empty">
            <p className="dealers-list__empty-note">{empty.note}</p>
            <button
              type="button"
              className="dealers-list__empty-cta"
              onClick={onReset}
            >
              {empty.cta}
            </button>
          </div>
        )}
      </div>

      <div className="dealers-list__footer">
        <span className="dealers-list__range">{range}</span>
        <div className="dealers-list__pager">
          <button
            type="button"
            className="dealers-list__nav"
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
                className="dealers-list__gap"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item.label}
                type="button"
                className={
                  "dealers-list__num" +
                  (Number(item.label) === page
                    ? " dealers-list__num--on"
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
            className="dealers-list__nav"
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

export default DealersList;

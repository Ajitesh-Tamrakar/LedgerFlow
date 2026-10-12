import Card from "../../../components/Card/Card";
import DealerSelect from "./DealerSelect";
import "./PaymentsFilter.css";

/*
 * "Filter" -- the wide card under the breakdown: the dealer picker
 * (retired included, with an "All dealers" sentinel), the method chips
 * ("All methods" plus the endpoint's five), the four date ranges and the
 * three sorts.
 *
 * Pure presentation: the page owns every value and hands back clicks.
 */
const RANGES = [
  { id: "month", label: "This month" },
  { id: "30", label: "Last 30 days" },
  { id: "quarter", label: "Last quarter" },
  { id: "all", label: "All time" },
];

const SORTS = [
  { id: "date", label: "Paid on" },
  { id: "amount", label: "Amount" },
  { id: "created", label: "Recorded" },
];

function PaymentsFilter({
  dealers,
  methods,
  dealerFilter,
  onDealerFilterChange,
  method,
  onMethodChange,
  range,
  onRangeChange,
  sort,
  dir,
  onSortChange,
  pickerOpen,
  onPickerOpen,
  onPickerClose,
}) {
  return (
    <Card className="payments-filter card--full">
      <div className="payments-filter__header">
        <h2 className="payments-filter__title">Filter</h2>
        <span className="payments-filter__hint">
          Method labels come from{" "}
          <span className="payments-filter__mono">
            /api/payments/methods/
          </span>{" "}
          — one source, shared with the panel.
        </span>
      </div>

      <div className="payments-filter__controls">
        <div className="payments-filter__picker">
          <DealerSelect
            label="Dealer — retired ones included"
            dealers={dealers}
            options={dealers}
            value={dealerFilter}
            onChange={onDealerFilterChange}
            allowAll
            placeholder="All dealers"
            showRetiredTag
            note="A payment made to a since-retired supplier has to stay findable for audit."
            noteWithQuery="Searching happens here in the browser — the dealer list arrives once, so typing never costs a request."
            open={pickerOpen}
            onOpen={onPickerOpen}
            onClose={onPickerClose}
          />
        </div>

        <div className="payments-filter__group">
          <span className="payments-filter__label">Method</span>
          <div
            className="payments-filter__chips"
            role="group"
            aria-label="Method"
          >
            <button
              type="button"
              className={
                "payments-filter__chip" +
                (method === null ? " payments-filter__chip--on" : "")
              }
              aria-pressed={method === null}
              onClick={() => onMethodChange(null)}
            >
              All methods
            </button>

            {methods.map((item) => (
              <button
                key={item.value}
                type="button"
                className={
                  "payments-filter__chip" +
                  (method === item.value ? " payments-filter__chip--on" : "")
                }
                style={{
                  background: method === item.value ? undefined : item.bg,
                  color: method === item.value ? undefined : item.fg,
                  borderColor: method === item.value ? undefined : item.border,
                }}
                aria-pressed={method === item.value}
                onClick={() => onMethodChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="payments-filter__group">
          <span className="payments-filter__label">Date range</span>
          <div
            className="payments-filter__ranges"
            role="group"
            aria-label="Date range"
          >
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  "payments-filter__range" +
                  (range === item.id ? " payments-filter__range--on" : "")
                }
                aria-pressed={range === item.id}
                onClick={() => onRangeChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="payments-filter__group payments-filter__group--sort">
          <span className="payments-filter__label">Sort</span>
          <div className="payments-filter__sorts">
            {SORTS.map((item) => {
              const on = sort === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "payments-filter__sort" +
                    (on ? " payments-filter__sort--on" : "")
                  }
                  aria-pressed={on}
                  onClick={() => onSortChange(item.id)}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={
                      "payments-filter__arrow" +
                      (on ? " payments-filter__arrow--on" : "") +
                      (on && dir === "asc"
                        ? " payments-filter__arrow--asc"
                        : "")
                    }
                  >
                    ▼
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="payments-filter__footnote">
        Sorting offers date, amount and recorded only — dealer name and
        method aren't ordering fields on this API.
      </p>
    </Card>
  );
}

export default PaymentsFilter;

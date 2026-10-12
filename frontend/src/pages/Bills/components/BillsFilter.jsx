import Card from "../../../components/Card/Card";
import DealerSelect from "./DealerSelect";
import "./BillsFilter.css";

/*
 * "Filter" -- the wide card under the breakdown: the dealer picker
 * (retired ones included, with an "All dealers" sentinel), the four date
 * ranges and the three sorts. The design is explicit that bills have no
 * name search -- the API doesn't offer one on this resource.
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
  { id: "date", label: "Bill date" },
  { id: "amount", label: "Amount" },
  { id: "created", label: "Recorded" },
];

function BillsFilter({
  dealers,
  dealerFilter,
  onDealerFilterChange,
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
    <Card className="bills-filter card--wide card--full">
      <div className="bills-filter__header">
        <h2 className="bills-filter__title">Filter</h2>
        <span className="bills-filter__hint">
          No name search on bills — the API doesn't offer one on this
          resource.
        </span>
      </div>

      <div className="bills-filter__controls">
        <div className="bills-filter__picker">
          <DealerSelect
            label="Dealer — retired ones included"
            dealers={dealers}
            options={dealers}
            value={dealerFilter}
            onChange={onDealerFilterChange}
            allowAll
            placeholder="All dealers"
            showRetiredTag
            note="Retired dealers stay listed: bills already filed against them have to remain findable."
            noteWithQuery="Searching happens here in the browser — the dealer list arrives once, so typing never costs a request."
            open={pickerOpen}
            onOpen={onPickerOpen}
            onClose={onPickerClose}
          />
        </div>

        <div className="bills-filter__group">
          <span className="bills-filter__label">Date range</span>
          <div
            className="bills-filter__ranges"
            role="group"
            aria-label="Date range"
          >
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  "bills-filter__range" +
                  (range === item.id ? " bills-filter__range--on" : "")
                }
                aria-pressed={range === item.id}
                onClick={() => onRangeChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bills-filter__group bills-filter__group--sort">
          <span className="bills-filter__label">Sort</span>
          <div className="bills-filter__sorts">
            {SORTS.map((item) => {
              const on = sort === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "bills-filter__sort" +
                    (on ? " bills-filter__sort--on" : "")
                  }
                  aria-pressed={on}
                  onClick={() => onSortChange(item.id)}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={
                      "bills-filter__arrow" +
                      (on ? " bills-filter__arrow--on" : "") +
                      (on && dir === "asc"
                        ? " bills-filter__arrow--asc"
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
    </Card>
  );
}

export default BillsFilter;

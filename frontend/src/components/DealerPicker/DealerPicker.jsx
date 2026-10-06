import { useEffect, useRef, useState } from "react";
import "./DealerPicker.css";

function scoreDealer(name, query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return { score: 0, at: -1 };
  }

  const n = name.toLowerCase();
  const at = n.indexOf(q);

  // Starts with the search text
  if (at === 0) {
    return { score: 4, at };
  }

  // Search text starts after a separator
  if (at > 0) {
    const previous = n[at - 1];

    if (/[^a-z0-9]/.test(previous)) {
      return { score: 3, at };
    }

    return { score: 2, at };
  }

  // Initials match
  const initials = n
    .split(/\s+/)
    .map((word) => word[0])
    .join("");

  if (initials.indexOf(q) === 0) {
    return { score: 1, at: -1 };
  }

  return { score: -1, at: -1 };
}

function rankDealers(dealers, query) {
  const scored = dealers.map((dealer) => {
    const result = scoreDealer(dealer.name, query);

    return {
      ...dealer,
      score: result.score,
      at: result.at,
    };
  });

  if (!query.trim()) {
    return {
      hits: scored,
      rest: [],
    };
  }

  const hits = scored
    .filter((dealer) => dealer.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.at - b.at ||
        a.name.localeCompare(b.name)
    );

  const rest = scored.filter((dealer) => dealer.score < 0);

  return {
    hits,
    rest,
  };
}

function DealerName({ dealer, query }) {
  const q = query.trim();

  if (!q || dealer.at < 0) {
    return <span>{dealer.name}</span>;
  }

  const before = dealer.name.slice(0, dealer.at);
  const match = dealer.name.slice(
    dealer.at,
    dealer.at + q.length
  );
  const after = dealer.name.slice(dealer.at + q.length);

  return (
    <span>
      {before}
      <mark>{match}</mark>
      {after}
    </span>
  );
}

function StatusPill({ dealer }) {
  const retired = !dealer.is_active;

  return (
    <span
      className={
        retired
          ? "dealer-picker__status dealer-picker__status--retired"
          : "dealer-picker__status"
      }
    >
      {retired ? "RETIRED" : "ACTIVE"}
    </span>
  );
}

export default function DealerPicker({
  dealers = [],
  value = null,
  onChange,

  // Used by different pages.
  // true  -> Active + Retired
  // false -> Active only
  includeRetired = true,

  label = "Dealer — retired ones included",
  placeholder = "Choose a dealer",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const availableDealers = includeRetired
    ? dealers
    : dealers.filter((dealer) => dealer.is_active);

  const selectedDealer =
    dealers.find((dealer) => dealer.id === value) || null;

  const { hits, rest } = rankDealers(
    availableDealers,
    query
  );

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  function togglePicker() {
    setOpen((current) => !current);
    setQuery("");
  }

  function selectDealer(dealer) {
    onChange?.(dealer.id);
    setOpen(false);
    setQuery("");
  }

  function clearSearch() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div
      className="dealer-picker"
      ref={rootRef}
    >
      <label className="dealer-picker__label">
        {label}
      </label>

      <button
        type="button"
        className={`dealer-picker__trigger ${
          open ? "dealer-picker__trigger--open" : ""
        }`}
        onClick={togglePicker}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dealer-picker__selected">
          <span
            className={
              selectedDealer
                ? "dealer-picker__value dealer-picker__value--selected"
                : "dealer-picker__value"
            }
          >
            {selectedDealer
              ? selectedDealer.name
              : placeholder}
          </span>

          {selectedDealer && !selectedDealer.is_active && (
            <span className="dealer-picker__status dealer-picker__status--retired">
              RETIRED
            </span>
          )}
        </span>

        <span
          className={`dealer-picker__caret ${
            open ? "dealer-picker__caret--open" : ""
          }`}
        >
          ▲
        </span>
      </button>

      {open && (
        <div className="dealer-picker__menu">
          <div className="dealer-picker__search">
            <span
              className="dealer-picker__search-icon"
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search dealers"
              aria-label="Search dealers"
            />

            {query && (
              <button
                type="button"
                className="dealer-picker__clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div
            className="dealer-picker__options"
            role="listbox"
          >
            {query.trim() ? (
              <>
                <div className="dealer-picker__group">
                  <div className="dealer-picker__group-title">
                    {hits.length > 0
                      ? `${hits.length} MATCH “${query.trim()}” — BEST FIRST`
                      : `NOTHING MATCHES “${query.trim()}”`}
                  </div>

                  {hits.map((dealer) => (
                    <DealerOption
                      key={dealer.id}
                      dealer={dealer}
                      query={query}
                      selected={dealer.id === value}
                      onClick={() =>
                        selectDealer(dealer)
                      }
                    />
                  ))}
                </div>

                {rest.length > 0 && (
                  <div className="dealer-picker__group">
                    <div className="dealer-picker__group-title">
                      OTHER DEALERS
                    </div>

                    {rest.map((dealer) => (
                      <DealerOption
                        key={dealer.id}
                        dealer={dealer}
                        query={query}
                        selected={dealer.id === value}
                        onClick={() =>
                          selectDealer(dealer)
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {includeRetired ? (
                  <>
                    <DealerGroup
                      title="ACTIVE"
                      dealers={availableDealers.filter(
                        (dealer) => dealer.is_active
                      )}
                      value={value}
                      query={query}
                      onSelect={selectDealer}
                    />

                    <DealerGroup
                      title="RETIRED — STILL PAYABLE"
                      dealers={availableDealers.filter(
                        (dealer) => !dealer.is_active
                      )}
                      value={value}
                      query={query}
                      onSelect={selectDealer}
                    />
                  </>
                ) : (
                  <DealerGroup
                    title="ACTIVE"
                    dealers={availableDealers}
                    value={value}
                    query={query}
                    onSelect={selectDealer}
                  />
                )}
              </>
            )}

            {query.trim() &&
              hits.length === 0 &&
              rest.length === 0 && (
                <div className="dealer-picker__empty">
                  No dealers found.
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

function DealerGroup({
  title,
  dealers,
  value,
  query,
  onSelect,
}) {
  if (dealers.length === 0) {
    return null;
  }

  return (
    <div className="dealer-picker__group">
      <div className="dealer-picker__group-title">
        {title}
      </div>

      {dealers.map((dealer) => (
        <DealerOption
          key={dealer.id}
          dealer={{
            ...dealer,
            score: 0,
            at: -1,
          }}
          query={query}
          selected={dealer.id === value}
          onClick={() => onSelect(dealer)}
        />
      ))}
    </div>
  );
}

function DealerOption({
  dealer,
  query,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`dealer-picker__option ${
        selected
          ? "dealer-picker__option--selected"
          : ""
      } ${
        dealer.score < 0
          ? "dealer-picker__option--dim"
          : ""
      }`}
      onClick={onClick}
      role="option"
      aria-selected={selected}
    >
      <span className="dealer-picker__name">
        <DealerName
          dealer={dealer}
          query={query}
        />
      </span>

      <StatusPill dealer={dealer} />
    </button>
  );
}
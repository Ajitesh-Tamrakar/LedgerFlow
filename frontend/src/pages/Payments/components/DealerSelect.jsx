import { useEffect, useRef, useState } from "react";
import "./DealerSelect.css";

/*
 * The payments page's dealer picker, for the filter card: every dealer
 * (retired included) plus an "All dealers" sentinel, in a flat ranked
 * list. The design draws it the same way as the bills picker: a label,
 * a trigger (the current value, an optional Retired tag, a caret) and a
 * floating menu -- search box, a match-count line, ranked options with
 * Active/Retired tags, and a footnote.
 *
 * The shared DealerPicker groups its menu into ACTIVE / RETIRED sections
 * and has no "All dealers" option, so this one is page-local (the panel
 * uses the shared one, whose groups match its own design). The ranking
 * below is the same relevance rule the design's score() uses.
 *
 * `open` / `onOpen` / `onClose` are page-owned: one shared "which picker
 * is open" value in the page keeps at most one menu up at a time. Outside
 * clicks and Escape only ever CLOSE -- a closed picker's own listener must
 * not be able to open it on behalf of its sibling's session.
 */

// The design's relevance rule: a name that starts with the search beats
// one where it starts after a separator, which beats a mid-name hit,
// which beats an initials match; a miss scores -1 and stays listed, dimmed.
function scoreName(name, query) {
  const t = String(query).trim().toLowerCase();

  if (!t) {
    return { score: 0, at: -1 };
  }

  const n = name.toLowerCase();
  const at = n.indexOf(t);

  if (at === 0) {
    return { score: 4, at };
  }

  if (at > 0) {
    return { score: /[^a-z0-9]/.test(n[at - 1]) ? 3 : 2, at };
  }

  const initials = n
    .split(/\s+/)
    .map((word) => word[0])
    .join("");

  if (initials.indexOf(t) === 0) {
    return { score: 1, at: -1 };
  }

  return { score: -1, at: -1 };
}

// Misses stay visible (dimmed) below the matches, best match first.
function rankOptions(options, query) {
  const scored = options.map((option) => {
    const result = scoreName(option.name, query);

    return { ...option, score: result.score, at: result.at };
  });

  if (!String(query).trim()) {
    return { hits: scored, rest: [] };
  }

  const hits = scored
    .filter((option) => option.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.at - b.at ||
        a.name.localeCompare(b.name)
    );

  return { hits, rest: scored.filter((option) => option.score < 0) };
}

function OptionName({ name, at, query }) {
  const len = String(query).trim().length;

  if (at < 0 || len === 0) {
    return <span className="payments-dealer-select__option-name">{name}</span>;
  }

  return (
    <span className="payments-dealer-select__option-name">
      {name.slice(0, at)}
      <span className="payments-dealer-select__mark">
        {name.slice(at, at + len)}
      </span>
      {name.slice(at + len)}
    </span>
  );
}

function DealerSelect({
  label,
  dealers,
  options,
  value,
  onChange,
  allowAll = false,
  placeholder = "Choose a dealer",
  emptyMuted = false,
  showRetiredTag = false,
  open = false,
  onOpen,
  onClose,
  note,
  noteWithQuery,
}) {
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  // The design clears the search whenever the menu is (re)opened by the
  // trigger; a close via outside click leaves it, so only reset on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // The design closes the menu on any mousedown outside the picker, and
  // on Escape. Both are close-only: the trigger button is the only thing
  // that opens a menu (see the component note).
  useEffect(() => {
    function handleMouseDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // The label reads the full dealer list, not the menu's subset: a value
  // that is not listed still renders by name.
  const selected = dealers.find((dealer) => dealer.id === value) || null;
  const { hits, rest } = rankOptions(options, query);
  const hasQuery = !!String(query).trim();

  function selectOption(option) {
    onChange?.(option.id);
    onClose?.();
  }

  function renderOption(option) {
    const isSelected = option.id === value;
    const retired = !option.is_active;
    const tag = retired ? "Retired" : "Active";

    return (
      <button
        key={option.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        className={
          "payments-dealer-select__option" +
          (isSelected ? " payments-dealer-select__option--selected" : "") +
          (option.score < 0 ? " payments-dealer-select__option--dim" : "")
        }
        onClick={() => selectOption(option)}
      >
        <OptionName name={option.name} at={option.at} query={query} />
        <span
          className={
            "payments-dealer-select__tag" +
            (retired ? " payments-dealer-select__tag--retired" : "")
          }
        >
          {tag}
        </span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="payments-dealer-select">
      <span className="payments-dealer-select__label">{label}</span>

      <button
        type="button"
        className={
          "payments-dealer-select__trigger" +
          (open ? " payments-dealer-select__trigger--open" : "")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpen?.()}
      >
        <span className="payments-dealer-select__selected">
          <span
            className={
              "payments-dealer-select__value" +
              (!selected && emptyMuted
                ? " payments-dealer-select__value--empty"
                : "")
            }
          >
            {selected ? selected.name : placeholder}
          </span>

          {showRetiredTag && selected && !selected.is_active && (
            <span className="payments-dealer-select__retired">
              Retired
            </span>
          )}
        </span>

        <span
          aria-hidden="true"
          className={
            "payments-dealer-select__caret" +
            (open ? " payments-dealer-select__caret--open" : "")
          }
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className="payments-dealer-select__menu"
          role="listbox"
          aria-label={label}
        >
          <div className="payments-dealer-select__search" data-field>
            <span aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search dealers"
              aria-label="Search dealers"
            />
            {hasQuery && (
              <button
                type="button"
                className="payments-dealer-select__clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>

          {hasQuery && (
            <div className="payments-dealer-select__search-note">
              {hits.length
                ? `${hits.length} of ${options.length} match “${query.trim()}” — best first`
                : `Nothing matches “${query.trim()}”`}
            </div>
          )}

          {allowAll && (
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              className={
                "payments-dealer-select__option" +
                (value === null
                  ? " payments-dealer-select__option--selected"
                  : "")
              }
              onClick={() => selectOption({ id: null })}
            >
              <span className="payments-dealer-select__option-name">
                All dealers
              </span>
              <span className="payments-dealer-select__tag">Any</span>
            </button>
          )}

          {hits.map(renderOption)}
          {rest.map(renderOption)}

          <div className="payments-dealer-select__footnote">
            {hasQuery && noteWithQuery ? noteWithQuery : note}
          </div>
        </div>
      )}
    </div>
  );
}

export default DealerSelect;

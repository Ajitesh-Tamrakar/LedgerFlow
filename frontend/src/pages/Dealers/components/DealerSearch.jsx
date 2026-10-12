import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import "./DealerSearch.css";

/*
 * "Find a dealer" -- the wide card at the top of the grid: the search box,
 * the All / Active / Inactive tabs and the three sort pills.
 *
 * Pure presentation: the page owns query, status and sort and hands back
 * the tab counts and the result line; the card only draws and reports the
 * clicks. The small pop on the result count is the same A/B keyframe trick
 * QuickStatus uses (two identical keyframes, the class flips when the
 * value it is keyed on changes -- the design's anim() helper).
 */
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const SORTS = [
  { key: "balance", label: "Most owed" },
  { key: "name", label: "A–Z" },
  { key: "recent", label: "Newest" },
];

function DealerSearch({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  tabCounts,
  resultCount,
}) {
  // The design re-pops the result line whenever the filtered count or the
  // tab changes, so key off both.
  const [pop, setPop] = useState("a");
  const lastKey = useRef(`${resultCount}:${status}`);

  useEffect(() => {
    const key = `${resultCount}:${status}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [resultCount, status]);

  return (
    <Card className="dealer-search card--wide">
      <div className="dealer-search__header">
        <h2 className="dealer-search__title">Find a dealer</h2>
        <span
          className={`dealer-search__count dealer-search__count--${pop}`}
        >
          {resultCount}
        </span>
      </div>

      <div
        className={
          "dealer-search__box" +
          (query ? " dealer-search__box--active" : "")
        }
      >
        <span aria-hidden="true" className="dealer-search__icon">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search dealers by name or GSTIN"
          placeholder="Search name or GSTIN — “Krishna”, “27AA”"
        />
        {query && (
          <button
            type="button"
            className="dealer-search__clear"
            onClick={() => onQueryChange("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="dealer-search__controls">
        <div
          role="group"
          aria-label="Active state"
          className="dealer-search__tabs"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                "dealer-search__tab" +
                (status === tab.key ? " dealer-search__tab--on" : "")
              }
              aria-pressed={status === tab.key}
              onClick={() => onStatusChange(tab.key)}
            >
              {tab.label}
              <span className="dealer-search__tab-count">
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="dealer-search__sorts">
          <span className="dealer-search__sort-label">Sort</span>
          {SORTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                "dealer-search__sort" +
                (sort === item.key ? " dealer-search__sort--on" : "")
              }
              aria-pressed={sort === item.key}
              onClick={() => onSortChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default DealerSearch;

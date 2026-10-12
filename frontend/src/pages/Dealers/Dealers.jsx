import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import { createDealer, getDealersAll, updateDealer } from "../../api/dealers";
import { formatInr } from "../../lib/format";
import DealerSearch from "./components/DealerSearch";
import TotalOutstanding from "./components/TotalOutstanding";
import DealersList from "./components/DealersList";
import DealerDetail from "./components/DealerDetail";
import AddDealer from "./components/AddDealer";
import "./Dealers.css";

/*
 * The dealers page.
 *
 * Same architecture as the dashboard and the cashbook: the page owns every
 * piece of state and makes every API call; the cards are presentational
 * and report actions back through the handlers below.
 *
 * One fetch on mount: every dealer, every API page merged into one list.
 * Search, tab counts, sorts and screen paging all happen in the browser
 * over that list (the design does the same), and writes update the list in
 * place from the API's receipts -- so nothing on the page ever refetches.
 */

// The screen's page size (the design's default). Unrelated to the API's
// 50-row pages, which getDealersAll merges behind the scenes.
const PAGE_SIZE = 8;

function Dealers() {
  /* null = loading, [] = none (including a failed fetch -- the cards then
     show the empty state, the cashbook convention). */
  const [dealers, setDealers] = useState(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("balance");
  const [page, setPage] = useState(1);

  /* null = the Add panel is showing; otherwise the detail panel. */
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* The design's short-lived confirmation line in the list card. */
  const [flash, setFlash] = useState("");

  /* Every action that changes what the list shows bumps this; the row
     rise re-fires off its parity (the design's gen counter). */
  const [gen, setGen] = useState(0);

  /* The one fetch: the whole list, all API pages merged. */
  useEffect(() => {
    let active = true;

    getDealersAll()
      .then((rows) => {
        if (active) {
          setDealers(rows);
        }
      })
      .catch((error) => {
        console.error("Dealers failed:", error);
        if (active) {
          setDealers([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /* The design lets the flash expire on its own. */
  useEffect(() => {
    if (!flash) {
      return;
    }
    const timer = setTimeout(() => setFlash(""), 4200);
    return () => clearTimeout(timer);
  }, [flash]);

  /*
   * The one derivation (Option A): the dealer rows + query, status, sort
   * and page -> everything the cards show. Computed here once; the cards
   * receive finished values.
   */
  const derived = useMemo(() => {
    if (dealers === null) {
      return null;
    }

    const q = query.trim().toLowerCase();
    const searched = dealers.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.gstin || "").toLowerCase().includes(q)
    );

    // The tab counts follow the current SEARCH (the design's rule).
    const activeFound = searched.filter((d) => d.is_active).length;
    const tabCounts = {
      all: searched.length,
      active: activeFound,
      inactive: searched.length - activeFound,
    };

    const filtered = searched.filter((d) =>
      status === "all" ? true : status === "active" ? d.is_active : !d.is_active
    );

    const sorted = filtered.slice().sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "recent") {
        // ISO datetimes compare lexicographically; ties fall back to id.
        return a.created_at < b.created_at
          ? 1
          : a.created_at > b.created_at
            ? -1
            : b.id - a.id;
      }
      // Stable sort, so equal balances keep the API's name order.
      return Number(b.outstanding_balance) - Number(a.outstanding_balance);
    });

    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const cur = Math.min(page, pageCount);
    const start = (cur - 1) * PAGE_SIZE;
    const rows = sorted.slice(start, start + PAGE_SIZE);

    const range =
      sorted.length === 0
        ? "Nothing to page through"
        : `Showing ${start + 1}–${Math.min(
            start + PAGE_SIZE,
            sorted.length
          )} of ${sorted.length}`;

    const resultCount =
      sorted.length === dealers.length
        ? `${dealers.length} dealers`
        : `${sorted.length} of ${dealers.length} dealers`;

    // The money card follows ALL dealers -- the search never narrows it.
    const credits = dealers.filter((d) => Number(d.outstanding_balance) < 0);
    const stats = {
      net: dealers.reduce((sum, d) => sum + Number(d.outstanding_balance), 0),
      dealerCount: dealers.length,
      activeCount: dealers.filter((d) => d.is_active).length,
      owed: dealers.reduce(
        (sum, d) => sum + Math.max(0, Number(d.outstanding_balance)),
        0
      ),
      credit: credits.reduce((sum, d) => sum + Number(d.outstanding_balance), 0),
      creditCount: credits.length,
      creditNote:
        credits.length === 1
          ? `${credits[0].name} is overpaid, and nets off the total above.`
          : `${credits.length} overpaid dealers net off the total above.`,
    };

    return {
      tabCounts,
      rows,
      pageCount,
      cur,
      range,
      resultCount,
      stats,
      selected: dealers.find((d) => d.id === selectedId) || null,
    };
  }, [dealers, query, status, sort, page, selectedId]);

  /* The cards' actions arrive here; the cards never touch the API. Every
     one of the first three also resets to page one and re-staggers the
     rows, exactly like the design's bump(). */
  function handleQueryChange(value) {
    setQuery(value);
    setPage(1);
    setGen((g) => g + 1);
  }

  function handleStatusChange(key) {
    setStatus(key);
    setPage(1);
    setGen((g) => g + 1);
  }

  function handleSortChange(key) {
    setSort(key);
    setPage(1);
    setGen((g) => g + 1);
  }

  function handlePageChange(target) {
    setPage(target);
    setGen((g) => g + 1);
  }

  function handleReset() {
    setQuery("");
    setStatus("all");
    setPage(1);
    setGen((g) => g + 1);
  }

  function handleOpen(id) {
    setSelectedId(id);
  }

  function handleClose() {
    setSelectedId(null);
  }

  /* A row's Retire/Restore saves immediately. The PATCH payload always
     carries the other fields unchanged; only is_active flips. When the
     receipt lands the row is swapped in place -- its recomputed
     outstanding moves the list, the money card and (if open) the detail
     panel from that one update. */
  function handleToggleActive(id) {
    if (dealers === null) {
      return;
    }
    const dealer = dealers.find((d) => d.id === id);
    if (!dealer) {
      return;
    }

    const wasActive = dealer.is_active;

    updateDealer(id, {
      name: dealer.name,
      gstin: dealer.gstin,
      openingBalance: Number(dealer.opening_balance),
      isActive: !wasActive,
    })
      .then((receipt) => {
        setDealers((current) =>
          current
            ? current.map((d) => (d.id === id ? receipt : d))
            : current
        );
        setFlash(
          `${dealer.name} ${
            wasActive
              ? "retired — kept on the books, hidden from pickers."
              : "restored to active."
          }`
        );
      })
      .catch((error) => {
        console.error("Could not update dealer:", error);
      });
  }

  /* The Add panel's save. Resolves true when the dealer landed (so the
     card can clear its drafts) and false otherwise. */
  function handleCreateSave(values) {
    if (saving) {
      return Promise.resolve(false);
    }

    setSaving(true);

    return createDealer(values)
      .then((receipt) => {
        setDealers((current) => [...(current || []), receipt]);

        // The design shows the newcomer: back to the whole list, page one.
        setQuery("");
        setStatus("all");
        setPage(1);
        setGen((g) => g + 1);

        const opening = Number(receipt.opening_balance);
        setFlash(
          `${receipt.name} added${
            opening ? ` with ${formatInr(opening)} opening.` : "."
          }`
        );
        return true;
      })
      .catch((error) => {
        console.error("Could not add dealer:", error);
        return false;
      })
      .finally(() => {
        setSaving(false);
      });
  }

  /* The detail panel's save. The 200 receipt carries the RECOMPUTED
     outstanding (a changed opening balance moves it), so swapping the row
     in place is the whole update. */
  function handleEditSave(values) {
    if (editSaving || selectedId === null) {
      return Promise.resolve(false);
    }

    setEditSaving(true);

    return updateDealer(selectedId, values)
      .then((receipt) => {
        setDealers((current) =>
          current
            ? current.map((d) => (d.id === receipt.id ? receipt : d))
            : current
        );
        setGen((g) => g + 1);
        setFlash(`${values.name} saved.`);
        return true;
      })
      .catch((error) => {
        console.error("Could not save dealer:", error);
        return false;
      })
      .finally(() => {
        setEditSaving(false);
      });
  }

  return (
    <PageShell>
      <Navbar />

      <h1 className="dealers__heading">LedgerFlow — dealers</h1>

      {/* All five cards appear when the list lands (the dashboard
          convention); the detail panel replaces the Add panel in the
          same slot. */}
      {derived && (
        <main className="dealers__grid" aria-label="Dealers">
          <DealerSearch
            query={query}
            onQueryChange={handleQueryChange}
            status={status}
            onStatusChange={handleStatusChange}
            sort={sort}
            onSortChange={handleSortChange}
            tabCounts={derived.tabCounts}
            resultCount={derived.resultCount}
          />

          <TotalOutstanding
            net={derived.stats.net}
            dealerCount={derived.stats.dealerCount}
            activeCount={derived.stats.activeCount}
            owed={derived.stats.owed}
            credit={derived.stats.credit}
            creditCount={derived.stats.creditCount}
            creditNote={derived.stats.creditNote}
          />

          <DealersList
            rows={derived.rows}
            selectedId={selectedId}
            gen={gen}
            flash={flash}
            query={query}
            status={status}
            page={derived.cur}
            pageCount={derived.pageCount}
            range={derived.range}
            onOpen={handleOpen}
            onToggleActive={handleToggleActive}
            onPageChange={handlePageChange}
            onReset={handleReset}
          />

          {derived.selected ? (
            <DealerDetail
              dealer={derived.selected}
              dealers={dealers}
              saving={editSaving}
              onSave={handleEditSave}
              onClose={handleClose}
            />
          ) : (
            <AddDealer
              dealers={dealers}
              saving={saving}
              onSave={handleCreateSave}
            />
          )}
        </main>
      )}

      <div className="dealers__footnote">
        <span>
          Outstanding is opening balance + all bills − all payments, computed
          by the API.
        </span>
        <span>Page size 8 per page.</span>
      </div>
    </PageShell>
  );
}

export default Dealers;

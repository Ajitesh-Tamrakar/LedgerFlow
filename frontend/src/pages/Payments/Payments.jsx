import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import {
  createPayment,
  getPaymentMethods,
  getPaymentsAll,
  updatePayment,
} from "../../api/payments";
import { getDealersAll } from "../../api/dealers";
import { formatDate, formatInr, getToday } from "../../lib/format";
import MonthPayments from "./components/MonthPayments";
import RecordPayment from "./components/RecordPayment";
import MethodBreakdown from "./components/MethodBreakdown";
import PaymentsFilter from "./components/PaymentsFilter";
import PaymentsList from "./components/PaymentsList";
import NotesStrip from "./components/NotesStrip";
import PaymentPanel from "./components/PaymentPanel";
import "./Payments.css";

/*
 * The payments page.
 *
 * Same architecture as the dealers and bills pages: the page owns every
 * piece of state and makes every API call; the cards are presentational
 * and report actions back through the handlers below. One screen --
 * the list -- plus a side panel: adding and correcting both open it
 * (the design is explicit: a payment is four short fields).
 *
 * Three fetches on mount: every payment, every dealer (the pickers and
 * the row name lookups, including the retired tags) and the method
 * choices (one call feeds both the filter's chips and the panel's pills;
 * the labels come from the endpoint, the colors are local). The list
 * does its dealer/method/range filter, sorts and paging in the browser
 * over the merged rows (the design does the same), and writes update
 * the list in place from the API's receipts -- so nothing refetches.
 *
 * The tile, the donut and the headline are aggregates derived in the
 * browser from those rows; payments has no own summary endpoint.
 */

// The design's default page knob. Unrelated to the API's 50-row pages,
// which getPaymentsAll merges behind the scenes.
const PAGE_SIZE = 6;
const DAY = 86400000;
const FLASH_MS = 4200; // the dealers page's convention

// The per-method palette: presentation only. The labels come from
// /api/payments/methods/, so the colors are the only local part (a
// method value the endpoint ever adds new reads as cash).
const METHOD_COLORS = {
  cash: { bg: "#F1F1EA", fg: "#454A3E", border: "#E0E0D7", ring: "#8C927C" },
  upi: { bg: "#DCD9F5", fg: "#3A3573", border: "#C6C1EA", ring: "#6E63D6" },
  card: { bg: "#E4E7C9", fg: "#4A5320", border: "#D2D7AC", ring: "#9FB424" },
  cheque: { bg: "#F2DCC7", fg: "#7A5223", border: "#E2C6A7", ring: "#E08A22" },
  bank_transfer: {
    bg: "#CFE3DC",
    fg: "#2B5246",
    border: "#B2D1C6",
    ring: "#1F9E7E",
  },
};
const FALLBACK_COLORS = METHOD_COLORS.cash;

// The design's nested-donut geometry: one concentric ring per method.
const DONUT_GEOMETRY = [
  { r: 86, w: 13 },
  { r: 69, w: 13 },
  { r: 52, w: 13 },
  { r: 35, w: 13 },
  { r: 19, w: 12 },
];

// "#2088 · recorded 13 Sep 2026" -- the design's row meta line.
function paymentMeta(payment) {
  return `#${payment.id} · recorded ${formatDate(
    String(payment.created_at).slice(0, 10)
  )}`;
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function inRunningMonth(iso, todayDate) {
  const date = new Date(iso + "T00:00:00");
  return (
    date.getMonth() === todayDate.getMonth() &&
    date.getFullYear() === todayDate.getFullYear()
  );
}

// The design's empty-list wording, with its retired-dealer variant.
function emptyNote(selected) {
  if (selected && !selected.is_active) {
    return `${selected.name} is retired and has no payments in this window. Widen the range — retired dealers stay in this filter precisely so their settled payments remain findable.`;
  }

  return "No payments match this dealer, method and date range.";
}

function Payments() {
  // The three load fetches; null until they land ([] = failed, the
  // cashbook convention -- the cards then show their empty states).
  const [payments, setPayments] = useState(null);
  const [dealers, setDealers] = useState(null);
  const [methods, setMethods] = useState(null);

  // List filters (browser-side, over the merged rows).
  const [dealerFilter, setDealerFilter] = useState(null);
  const [method, setMethod] = useState(null);
  const [range, setRange] = useState("month");
  const [sort, setSort] = useState("date");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);

  // The design's single picker value: at most one menu up at a time.
  const [picker, setPicker] = useState(null);

  // Donut row/ring cross-highlight.
  const [hoverMethod, setHoverMethod] = useState(null);

  // The design's two animation counters: `gen` re-fires the row stagger
  // on every list change; `tick` re-pops the result count when the count
  // can actually change (range, filter, a write).
  const [gen, setGen] = useState(0);
  const [tick, setTick] = useState(0);

  const [flash, setFlash] = useState("");
  const [savedId, setSavedId] = useState(null);

  // The side panel: null | "add" | "edit".
  const [panel, setPanel] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // --- the three load fetches, in parallel ------------------------------
  useEffect(() => {
    let active = true;

    getPaymentsAll()
      .then((rows) => {
        if (active) setPayments(rows);
      })
      .catch((error) => {
        console.error("Payments fetch failed:", error);
        if (active) setPayments([]);
      });

    getDealersAll()
      .then((rows) => {
        if (active) setDealers(rows);
      })
      .catch((error) => {
        console.error("Dealers fetch failed:", error);
        if (active) setDealers([]);
      });

    getPaymentMethods()
      .then((rows) => {
        if (active) setMethods(rows);
      })
      .catch((error) => {
        console.error("Payment methods fetch failed:", error);
        if (active) setMethods([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // The list flash, the dealers page's 4.2 s convention.
  useEffect(() => {
    if (!flash) {
      return;
    }
    const timer = setTimeout(() => setFlash(""), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  const today = getToday();

  // --- the one derivation ------------------------------------------------
  const derived = useMemo(() => {
    if (payments === null || dealers === null || methods === null) {
      return null;
    }

    const todayDate = new Date(today + "T00:00:00");
    const dealerById = new Map(dealers.map((dealer) => [dealer.id, dealer]));
    const paletteFor = (value) => METHOD_COLORS[value] || FALLBACK_COLORS;
    const labelFor = (value) => {
      const found = methods.find((item) => item.value === value);
      return found ? found.label : value;
    };

    // One palette-merged list feeds the filter chips and the panel pills.
    const methodPalette = methods.map((item) => ({
      ...item,
      ...paletteFor(item.value),
    }));

    // The month tile: the running calendar month, all payments.
    const monthRows = payments.filter((p) =>
      inRunningMonth(p.date, todayDate)
    );
    const monthTotal = monthRows.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // The filtered + sorted list, then the current page of it.
    let list = payments.slice();

    if (dealerFilter) {
      list = list.filter((p) => p.dealer === dealerFilter);
    }

    if (method) {
      list = list.filter((p) => p.method === method);
    }

    if (range !== "all") {
      list = list.filter((p) => {
        const date = new Date(p.date + "T00:00:00");

        if (range === "month") {
          return inRunningMonth(p.date, todayDate);
        }

        if (range === "30") {
          return todayDate - date <= 30 * DAY;
        }

        // "Last quarter" is a 92-day window in the filter -- not the
        // calendar quarter.
        return todayDate - date <= 92 * DAY;
      });
    }

    // ISO strings compare chronologically; a stable sort keeps the API's
    // tie order (-date, -id).
    const sign = dir === "desc" ? -1 : 1;

    list = list.sort((a, b) => {
      if (sort === "amount") {
        return (Number(a.amount) - Number(b.amount)) * sign;
      }

      if (sort === "created") {
        return a.created_at < b.created_at
          ? -sign
          : a.created_at > b.created_at
            ? sign
            : 0;
      }

      return a.date < b.date ? -sign : a.date > b.date ? sign : 0;
    });

    // The method mix, the design's scope rule: "All time" reads every
    // payment; any other range reads the filtered window.
    const scope = range === "all" ? payments : list;

    const byMethod = {};

    scope.forEach((p) => {
      const bucket = byMethod[p.method] || { total: 0, count: 0 };
      bucket.total += Number(p.amount);
      bucket.count += 1;
      byMethod[p.method] = bucket;
    });

    const mixTotal = Object.values(byMethod).reduce(
      (sum, bucket) => sum + bucket.total,
      0
    );

    const mixOrder = methods
      .filter((item) => byMethod[item.value])
      .sort(
        (a, b) => byMethod[b.value].total - byMethod[a.value].total
      );

    // Nested radial: one ring per method, each arc scaled against the
    // biggest share (min 2.5 so a sliver stays visible).
    const maxShare = mixOrder.length
      ? byMethod[mixOrder[0].value].total / (mixTotal || 1)
      : 0;

    const rings = mixOrder.slice(0, 5).map((item, i) => {
      const bucket = byMethod[item.value];
      const share = mixTotal ? bucket.total / mixTotal : 0;
      const len = maxShare ? Math.max((share / maxShare) * 78, 2.5) : 0;

      return {
        value: item.value,
        r: DONUT_GEOMETRY[i].r,
        w: DONUT_GEOMETRY[i].w,
        color: paletteFor(item.value).ring,
        dash: `${len} 100`,
        dim: !!hoverMethod && hoverMethod !== item.value,
        delay: i * 100,
      };
    });

    const breakdownRows = mixOrder.map((item) => {
      const bucket = byMethod[item.value];
      const share = mixTotal
        ? Math.round((bucket.total / mixTotal) * 100)
        : 0;

      return {
        value: item.value,
        label: item.label,
        countLabel:
          bucket.count === 1 ? "1 payment" : `${bucket.count} payments`,
        amount: formatInr(bucket.total),
        share: `${share}%`,
        fill: paletteFor(item.value).ring,
        dim: !!hoverMethod && hoverMethod !== item.value,
        aria: `${item.label}, ${formatInr(bucket.total)} across ${bucket.count} payments — filter the list to this method`,
      };
    });

    // Headline: how much of the money left a trail -- cash and cheque
    // are the untraceable half.
    const traced = ["upi", "bank_transfer", "card"].reduce(
      (sum, value) => sum + (byMethod[value] ? byMethod[value].total : 0),
      0
    );

    const top = mixOrder[0]
      ? {
          label: mixOrder[0].label,
          share: mixTotal
            ? `${Math.round((byMethod[mixOrder[0].value].total / mixTotal) * 100)}%`
            : "0%",
        }
      : { label: "—", share: "0%" };

    const mix = {
      headline: `${mixTotal ? Math.round((traced / mixTotal) * 100) : 0}%`,
      headlineNote: mixTotal
        ? `of value left a bank trail · ${formatInr(mixTotal)} total`
        : "nothing recorded this period",
      topLabel: top.label,
      topShare: top.share,
    };

    const donutAria =
      "Payment-method mix: " +
      (mixOrder.length
        ? mixOrder
            .map((item) => `${item.label} ${formatInr(byMethod[item.value].total)}`)
            .join(", ")
        : "nothing in this period");

    // The current page of the list, as finished row objects.
    const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const cur = Math.min(page, pageCount);
    const start = (cur - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    const listRows = slice.map((p, i) => {
      const dealer = dealerById.get(p.dealer);
      const name = dealer ? dealer.name : "No such dealer";
      const label = labelFor(p.method);
      const justSaved = savedId === p.id;

      return {
        id: p.id,
        dealer: name,
        retired: dealer ? !dealer.is_active : false,
        initials: dealer ? initials(name) : "—",
        justSaved,
        method: label,
        badge: paletteFor(p.method),
        date: formatDate(p.date),
        amount: formatInr(Number(p.amount)),
        meta: paymentMeta(p),
        aria: `Correct payment ${p.id} to ${name}, ${label}`,
        delay: i * 45,
      };
    });

    const selected = dealerFilter
      ? dealerById.get(dealerFilter) || null
      : null;

    return {
      methodPalette,
      monthTotal,
      monthCount: monthRows.length,
      periodLabel: `1–${formatDate(today)}, month to date`,
      breakdownRows,
      rings,
      mix,
      donutAria,
      listRows,
      cur,
      pageCount,
      rangeText: list.length
        ? `Showing ${start + 1}–${start + slice.length} of ${list.length}`
        : "Nothing to show",
      resultCount:
        list.length === 1 ? "1 payment" : `${list.length} payments`,
      empty:
        list.length === 0 ? { note: emptyNote(selected) } : null,
      recordedDates: [...new Set(payments.map((p) => p.date))],
      editRow:
        editId !== null
          ? payments.find((p) => p.id === editId) || null
          : null,
    };
  }, [
    payments,
    dealers,
    methods,
    dealerFilter,
    method,
    range,
    sort,
    dir,
    page,
    savedId,
    hoverMethod,
    today,
    editId,
  ]);

  // --- list handlers -----------------------------------------------------
  function handleRangeChange(rangeId) {
    setRange(rangeId);
    setPage(1);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  function handleSortChange(sortId) {
    if (sortId === sort) {
      setDir((value) => (value === "desc" ? "asc" : "desc"));
    } else {
      setSort(sortId);
      setDir("desc");
    }
    setPage(1);
    setGen((value) => value + 1);
  }

  // Chips, donut rows and rings all narrow the list to one method.
  function handleMethodChange(methodValue) {
    setMethod(methodValue);
    setPage(1);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  function handleFilterDealer(dealerId) {
    setDealerFilter(dealerId);
    setPage(1);
    setPicker(null);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  function handlePageChange(next) {
    setPage(next);
    setGen((value) => value + 1);
  }

  function handleReset() {
    setDealerFilter(null);
    setMethod(null);
    setRange("all");
    setPage(1);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  // The one list picker, page-owned; trigger toggles, outside clicks and
  // Escape only ever close.
  const filterPicker = {
    open: picker === "filter",
    onOpen: () =>
      setPicker((value) => (value === "filter" ? null : "filter")),
    onClose: () => setPicker((value) => (value === "filter" ? null : value)),
  };

  // --- side panel ----------------------------------------------------------
  function openAdd() {
    setPanel("add");
    setEditId(null);
    setPicker(null);
    setFlash("");
  }

  function openEdit(id) {
    if (!payments || !payments.some((p) => p.id === id)) {
      return;
    }

    setPanel("edit");
    setEditId(id);
    setPicker(null);
    setFlash("");
  }

  function closePanel() {
    setPanel(null);
    setEditId(null);
    setSaving(false);
    setPicker(null);
  }

  // The panel's save: create or correct, then swap the receipt into the
  // list in place -- no refetch. The rejection is re-thrown so the panel
  // can surface the server's own message.
  function handlePanelSave(values) {
    if (saving || !methods) {
      return Promise.resolve(false);
    }

    const isEdit = panel === "edit";

    setSaving(true);

    const request = isEdit
      ? updatePayment(editId, values)
      : createPayment(values);

    return request
      .then((receipt) => {
        setPayments((current) => {
          if (!current) {
            return current;
          }

          return isEdit
            ? current.map((p) => (p.id === receipt.id ? receipt : p))
            : [receipt, ...current];
        });
        setSavedId(receipt.id);

        // A new payment lands at the top: back to page one.
        if (!isEdit) {
          setPage(1);
        }

        setGen((value) => value + 1);
        setTick((value) => value + 1);

        const label =
          (methods.find((item) => item.value === receipt.method) || {}).label ||
          receipt.method;

        setFlash(
          isEdit
            ? `Payment #${receipt.id} corrected. Previous values stay in the history underneath — no confirmation step, no delete.`
            : `Payment #${receipt.id} recorded — ${formatInr(Number(receipt.amount))} by ${label.toLowerCase()}.`
        );

        setPanel(null);
        setEditId(null);
        return true;
      })
      .catch((error) => {
        console.error("Payment save failed:", error);
        throw error;
      })
      .finally(() => {
        setSaving(false);
      });
  }

  // --- render ------------------------------------------------------------
  return (
    <PageShell>
      <Navbar />

      <h1 className="payments__heading">LedgerFlow — payments</h1>

      <div className="payments__toolbar">
        <span className="payments__toolbar-name">All payments</span>
        <button
          type="button"
          className="payments__toolbar-add"
          onClick={openAdd}
        >
          Add payment
        </button>
        <span className="payments__toolbar-note">
          One screen. Adding and correcting both open the side panel — a
          payment is four short fields.
        </span>
      </div>

      {derived && (
        <main className="payments__grid" aria-label="Payments">
          <MonthPayments
            total={derived.monthTotal}
            count={derived.monthCount}
            periodLabel={derived.periodLabel}
          />

          <RecordPayment onAdd={openAdd} />

          <MethodBreakdown
            mix={derived.mix}
            rows={derived.breakdownRows}
            rings={derived.rings}
            aria={derived.donutAria}
            hoverMethod={hoverMethod}
            onHover={setHoverMethod}
            onPick={handleMethodChange}
          />

          <PaymentsFilter
            dealers={dealers}
            methods={derived.methodPalette}
            dealerFilter={dealerFilter}
            onDealerFilterChange={handleFilterDealer}
            method={method}
            onMethodChange={handleMethodChange}
            range={range}
            onRangeChange={handleRangeChange}
            sort={sort}
            dir={dir}
            onSortChange={handleSortChange}
            pickerOpen={filterPicker.open}
            onPickerOpen={filterPicker.onOpen}
            onPickerClose={filterPicker.onClose}
          />

          <PaymentsList
            rows={derived.listRows}
            tick={tick}
            gen={gen}
            flash={flash}
            resultCount={derived.resultCount}
            page={derived.cur}
            pageCount={derived.pageCount}
            range={derived.rangeText}
            empty={derived.empty}
            onOpen={openEdit}
            onPageChange={handlePageChange}
            onReset={handleReset}
          />

          <NotesStrip />
        </main>
      )}

      {panel === "add" && derived && (
        <PaymentPanel
          key="add"
          mode="add"
          payment={null}
          dealers={dealers}
          methods={derived.methodPalette}
          savedDates={derived.recordedDates}
          saving={saving}
          onClose={closePanel}
          onSave={handlePanelSave}
        />
      )}

      {panel === "edit" && derived && derived.editRow && (
        <PaymentPanel
          key={`edit-${editId}`}
          mode="edit"
          payment={derived.editRow}
          dealers={dealers}
          methods={derived.methodPalette}
          savedDates={derived.recordedDates}
          saving={saving}
          onClose={closePanel}
          onSave={handlePanelSave}
        />
      )}

      <div className="payments__footnote">
        <span>
          Amounts arrive as strings and are parsed before any arithmetic.
          This tile is the running month; Net Cash Flow on the dashboard is
          the last complete month — same field, different aggregate.
        </span>
        <span>
          Page size {PAGE_SIZE} per page. Method enum is enforced at the
          database level, labels still read from the endpoint.
        </span>
      </div>
    </PageShell>
  );
}

export default Payments;

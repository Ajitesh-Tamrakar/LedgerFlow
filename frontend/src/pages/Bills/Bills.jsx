import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import {
  createBill,
  getBillFile,
  getBillPurchases,
  getBillsAll,
  replaceBillFile,
  updateBill,
} from "../../api/bills";
import { getDealersAll } from "../../api/dealers";
import { firstMessage } from "../../lib/errors";
import { formatDate, formatInr, formatMb, getToday } from "../../lib/format";
import PurchasesThisMonth from "./components/PurchasesThisMonth";
import UploadCta from "./components/UploadCta";
import DealerBreakdown from "./components/DealerBreakdown";
import BillsFilter from "./components/BillsFilter";
import BillsList from "./components/BillsList";
import UploadPages from "./components/UploadPages";
import BillDetails from "./components/BillDetails";
import UploadActions from "./components/UploadActions";
import BillViewer from "./components/BillViewer";
import BillCorrect from "./components/BillCorrect";
import DetailNotes from "./components/DetailNotes";
import "./Bills.css";

/*
 * The bills page.
 *
 * Same architecture as the dealers page: the page owns every piece of
 * state and makes every API call; the cards are presentational and
 * report actions back through the handlers below. Three screens --
 * list, upload, detail -- navigate only through their own CTAs.
 *
 * Three fetches on mount: every bill, every dealer (the pickers and the
 * row name lookups), and the month's purchases summary. The list does
 * its dealer filter, date range, sorts and paging in the browser over
 * the merged rows (the design does the same); the headline and the
 * breakdown never come from the list -- they come from the purchases
 * endpoint, which the page refetches after every successful write.
 *
 * The upload draft (the files, the details, the error/done status)
 * persists across screen switches, the way the design keeps it in one
 * component; the detail's correction draft is card local instead (the
 * DailyEntry pattern).
 */

const PAGE_SIZE = 5; // the design's default page knob
const MB = 1048576;
const MAX_UPLOAD_BYTES = 10 * MB; // today's server fallback, not a setting
const DAY = 86400000;
const FLASH_MS = 4200; // the dealers page's convention

// A failed initial fetch still renders the cards, in their empty state
// (the cashbook convention). The shape the headline + breakdown expect.
const EMPTY_PURCHASES = { total: "0.00", count: 0, dealers: [] };

// The design's row meta line: "#1042 · 3 pages · 2.4 MB". Missing is not
// zero -- pages and file_size are nullable for a PDF bill, so a null
// part is dropped rather than printed as 0.
function billMeta(bill) {
  const parts = [`#${bill.id}`];

  if (bill.pages !== null && bill.pages !== undefined) {
    parts.push(`${bill.pages} ${bill.pages === 1 ? "page" : "pages"}`);
  }

  const size = formatMb(bill.file_size);

  if (size) {
    parts.push(size);
  }

  return parts.join(" · ");
}

// The same join for the viewer's header: "3 pages · 2.4 MB · PDF".
function billFileMeta(bill) {
  const parts = [];

  if (bill.pages !== null && bill.pages !== undefined) {
    parts.push(`${bill.pages} ${bill.pages === 1 ? "page" : "pages"}`);
  }

  const size = formatMb(bill.file_size);

  if (size) {
    parts.push(size);
  }

  parts.push("PDF");

  return parts.join(" · ");
}

// The design's empty-list wording, with a zero-bills state of its own.
function emptyNote(billCount, selectedDealer) {
  if (billCount === 0) {
    return "No bills yet. Upload the first one with the button above.";
  }

  if (selectedDealer && !selectedDealer.is_active) {
    return `${selectedDealer.name} is retired and has no bills in this window. Widen the range — retired dealers stay in this filter precisely so their old bills remain findable.`;
  }

  return "No bills match this dealer and date range. Bills can only be found by dealer and date here; there is no name search on this resource.";
}

function Bills() {
  // The three load fetches; null until they land.
  const [bills, setBills] = useState(null);
  const [dealers, setDealers] = useState(null);
  const [purchases, setPurchases] = useState(null);

  const [screen, setScreen] = useState("list");
  const [openId, setOpenId] = useState(null);

  // One shared "which picker is open" value keeps at most one menu up at
  // a time (the design's single picker state) and lets "Fix and resend"
  // open the details' picker from across the grid.
  const [picker, setPicker] = useState(null);

  // List filters (browser-side, over the merged rows).
  const [dealerFilter, setDealerFilter] = useState(null);
  const [range, setRange] = useState("month");
  const [sort, setSort] = useState("date");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);

  // The design's two animation counters: `gen` re-fires the row stagger
  // on every list change; `tick` re-pops the result count when the count
  // can actually change (range, filter, breakdown pick, a write).
  const [gen, setGen] = useState(0);
  const [tick, setTick] = useState(0);

  const [flash, setFlash] = useState("");
  const [saving, setSaving] = useState(false);

  // The upload draft -- persists across screen switches.
  const [upMode, setUpMode] = useState("new");
  const [replaceId, setReplaceId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [rejected, setRejected] = useState("");
  const [upDealer, setUpDealer] = useState(null);
  const [upDate, setUpDate] = useState(getToday());
  const [upAmount, setUpAmount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [upError, setUpError] = useState(null);
  const [upDone, setUpDone] = useState(null);

  // The viewer's object URL; refetched whenever the opened row changes.
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerFailed, setViewerFailed] = useState(false);

  // --- the three load fetches, in parallel ------------------------------
  useEffect(() => {
    let active = true;

    getBillsAll()
      .then((rows) => {
        if (active) setBills(rows);
      })
      .catch((error) => {
        console.error("Bills fetch failed:", error);
        if (active) setBills([]);
      });

    getDealersAll()
      .then((rows) => {
        if (active) setDealers(rows);
      })
      .catch((error) => {
        console.error("Dealers fetch failed:", error);
        if (active) setDealers([]);
      });

    getBillPurchases("month")
      .then((data) => {
        if (active) setPurchases(data);
      })
      .catch((error) => {
        console.error("Purchases fetch failed:", error);
        if (active) setPurchases(EMPTY_PURCHASES);
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

  const ready =
    bills !== null && dealers !== null && purchases !== null;

  const openBillRow = openId !== null
    ? bills.find((bill) => bill.id === openId) || null
    : null;

  // The viewer fetches the PDF with the token; an <iframe src> can't
  // carry one. Re-runs when the opened row object is replaced (a save or
  // a file replace) so the box shows the current file.
  useEffect(() => {
    if (!openBillRow || !openBillRow.file_url) {
      return;
    }

    let active = true;
    let url = null;

    setViewerUrl(null);
    setViewerFailed(false);

    getBillFile(openBillRow.id)
      .then((blob) => {
        if (!active) {
          return;
        }
        url = URL.createObjectURL(blob);
        setViewerUrl(url);
      })
      .catch((error) => {
        console.error("Bill file fetch failed:", error);
        if (active) {
          setViewerFailed(true);
        }
      });

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [openBillRow]);

  // --- derivations -------------------------------------------------------
  const today = getToday();

  const derived = useMemo(() => {
    if (!ready) {
      return null;
    }

    const dealerById = new Map(dealers.map((dealer) => [dealer.id, dealer]));
    const activeDealers = dealers.filter((dealer) => dealer.is_active);

    // Headline + breakdown: the purchases endpoint, never the list.
    const monthTotal = Number(purchases.total);
    const breakdownRows = purchases.dealers.map((row) => {
      const total = Number(row.total);
      const biggest = purchases.dealers.length
        ? Number(purchases.dealers[0].total)
        : 1;

      return {
        id: row.id,
        name: row.name,
        amountText: formatInr(total),
        share: monthTotal ? Math.round((total / monthTotal) * 100) : 0,
        width: Math.max(4, Math.round((total / (biggest || 1)) * 100)),
        aria: `${row.name}, ${formatInr(total)} this month — filter the list to this dealer`,
      };
    });

    // The filtered + sorted list, then the current page of it.
    let list = bills;

    if (dealerFilter) {
      list = list.filter((bill) => bill.dealer === dealerFilter);
    }

    if (range !== "all") {
      const todayDate = new Date(today + "T00:00:00");

      list = list.filter((bill) => {
        const date = new Date(bill.date + "T00:00:00");

        if (range === "month") {
          return (
            date.getMonth() === todayDate.getMonth() &&
            date.getFullYear() === todayDate.getFullYear()
          );
        }

        if (range === "30") {
          return todayDate - date <= 30 * DAY;
        }

        // "Last quarter" is a 92-day window in the filter -- not the
        // calendar quarter the purchases endpoint uses.
        return todayDate - date <= 92 * DAY;
      });
    }

    // ISO strings compare chronologically; a stable sort keeps the API's
    // tie order (-date, -id).
    const sign = dir === "desc" ? -1 : 1;

    list = list.slice().sort((a, b) => {
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

    const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const cur = Math.min(page, pageCount);
    const start = (cur - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    const selected = dealerFilter
      ? dealerById.get(dealerFilter) || null
      : null;

    const rows = slice.map((bill) => {
      const dealer = dealerById.get(bill.dealer);

      return {
        id: bill.id,
        dealer: dealer ? dealer.name : "No such dealer",
        retired: dealer ? !dealer.is_active : false,
        meta: billMeta(bill),
        date: formatDate(bill.date),
        amount: formatInr(Number(bill.amount)),
        aria: `Open bill ${bill.id} from ${dealer ? dealer.name : "unknown dealer"}`,
      };
    });

    // The detail's picker: active dealers, plus the bill's own if retired.
    const detailOptions = dealers.filter(
      (dealer) =>
        dealer.is_active ||
        (openBillRow !== null && dealer.id === openBillRow.dealer)
    );

    return {
      dealerById,
      activeDealers,
      breakdownRows,
      monthTotal,
      listLength: list.length,
      rows,
      cur,
      pageCount,
      selected,
      rangeText: list.length
        ? `Showing ${start + 1}–${start + slice.length} of ${list.length}`
        : "Nothing to show",
      resultCount: list.length === 1 ? "1 bill" : `${list.length} bills`,
      empty:
        slice.length === 0
          ? { note: emptyNote(bills.length, selected) }
          : null,
      detailOptions,
    };
  }, [ready, bills, dealers, purchases, dealerFilter, range, sort, dir, page, today, openBillRow]);

  // Upload derivations (the design's `pending`, minus its mock 0.78
  // photo estimate -- the server caps on the raw sum, so does the client).
  const rawTotal = photos.reduce((total, photo) => total + photo.size, 0);
  const hasFiles = !!pdfFile || photos.length > 0;
  const pendingBytes = pdfFile ? pdfFile.size : rawTotal;
  const oversize = hasFiles && pendingBytes > MAX_UPLOAD_BYTES;
  const canSubmit = hasFiles && !oversize && !uploading;

  const countLabel = pdfFile
    ? `1 PDF · ${formatMb(pdfFile.size)}`
    : photos.length
      ? `${photos.length} ${photos.length === 1 ? "page" : "pages"} · ${formatMb(rawTotal)} of photos`
      : "No pages yet";

  const uploadTitle =
    upMode === "replace"
      ? `Replace the file on bill #${replaceId}`
      : "Add the pages";

  // The design's error text, with the server's own message first.
  const errorText = !upError
    ? ""
    : upError.kind === "network"
      ? "Nothing was lost: the pages, their order, the dealer, date and amount are all still here. Reconnect and upload again."
      : upError.message ||
        (!upDealer
          ? "No such dealer. The check runs server-side and won't say whether that dealer exists under another business — expect this exact generic message."
          : "Amount is required. Your pages are untouched.");

  const doneText = upDone
    ? upDone.replaced
      ? `File replaced on bill #${upDone.id}. The old PDF is gone; the history underneath keeps the record.`
      : `Bill #${upDone.id} saved. The PDF is what LedgerFlow stores — your source files stayed on this computer.`
    : "";

  // The design's period line with the real date plugged in:
  // "1–15 Oct 2026, month to date".
  const periodLabel = `1–${formatDate(today)}, month to date`;

  // --- navigation --------------------------------------------------------
  function goScreen(next) {
    setScreen(next);
    setPicker(null);
  }

  function openBill(id) {
    if (!bills.some((bill) => bill.id === id)) {
      return;
    }

    setOpenId(id);
    goScreen("detail");
  }

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

  function handleFilterDealer(id) {
    setDealerFilter(id);
    setPage(1);
    setPicker(null);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  function handleBreakdownPick(id) {
    setDealerFilter(id);
    setRange("month");
    setPage(1);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  function handlePageChange(next) {
    setPage(next);
    setGen((value) => value + 1);
  }

  function handleReset() {
    setDealerFilter(null);
    setRange("all");
    setPage(1);
    setTick((value) => value + 1);
    setGen((value) => value + 1);
  }

  // The trigger click toggles (the design's onToggle); outside clicks and
  // Escape only ever close -- a closed picker must not open for its
  // sibling's session.
  const filterPicker = {
    open: picker === "filter",
    onOpen: () => setPicker((value) => (value === "filter" ? null : "filter")),
    onClose: () => setPicker((value) => (value === "filter" ? null : value)),
  };

  const metaPicker = {
    open: picker === "meta",
    onOpen: () => setPicker((value) => (value === "meta" ? null : "meta")),
    onClose: () => setPicker((value) => (value === "meta" ? null : value)),
  };

  const detailPicker = {
    open: picker === "detail",
    onOpen: () => setPicker((value) => (value === "detail" ? null : "detail")),
    onClose: () =>
      setPicker((value) => (value === "detail" ? null : value)),
  };

  // --- upload handlers ---------------------------------------------------
  function handleUpload() {
    setUpMode("new");
    setReplaceId(null);
    setUpError(null);
    setUpDone(null);
    goScreen("upload");
  }

  // The design's ingest: one PDF replaces everything; photos append.
  function handleIngest(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) {
      return;
    }

    const pdf = files.find(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    );
    const images = files.filter(
      (file) =>
        /^image\//.test(file.type) ||
        /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
    );
    const skipped = files.filter(
      (file) => file !== pdf && !images.includes(file)
    );

    if (pdf) {
      setPdfFile({ name: pdf.name, size: pdf.size, file: pdf });
      setPhotos([]);
      setUpError(null);
      setUpDone(null);
      setRejected(
        files.length > 1
          ? `Took ${pdf.name} and ignored the rest — a bill is one PDF. Upload photos instead if you have loose pages.`
          : ""
      );
      return;
    }

    if (!images.length) {
      setRejected(
        "That file type can't be used. Bills take image pages (JPG, PNG, WEBP, HEIC) or a single PDF."
      );
      return;
    }

    const stamp = Date.now();
    const added = images.map((file, index) => ({
      key: `p${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
    }));

    setPhotos((current) => current.concat(added));
    setPdfFile(null);
    setUpError(null);
    setUpDone(null);
    setRejected(
      skipped.length
        ? `${skipped.length}${
            skipped.length === 1 ? " file was" : " files were"
          } skipped — images and PDFs only.`
        : ""
    );
  }

  function handleMovePhoto(index, delta) {
    setPhotos((current) => {
      const target = index + delta;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const arranged = current.slice();
      [arranged[index], arranged[target]] = [
        arranged[target],
        arranged[index],
      ];

      return arranged;
    });
    setUpDone(null);
  }

  function handleRemovePhoto(index) {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setUpError(null);
    setUpDone(null);
  }

  function handleClearPhotos() {
    setPhotos([]);
    setUpError(null);
    setUpDone(null);
    setRejected("");
  }

  function handleClearPdf() {
    setPdfFile(null);
    setUpError(null);
    setUpDone(null);
    setRejected("");
  }

  function handleUpDealerChange(id) {
    setUpDealer(id);
    setPicker(null);
    setUpError(null);
  }

  function handleUpDateChange(value) {
    setUpDate(value);
  }

  function handleUpAmountChange(value) {
    setUpAmount(value);
    setUpError(null);
  }

  function runUpload() {
    if (uploading) {
      return;
    }

    const hasFilesNow = !!pdfFile || photos.length > 0;
    const pendingNow = pdfFile
      ? pdfFile.size
      : photos.reduce((total, photo) => total + photo.size, 0);

    if (!hasFilesNow || pendingNow > MAX_UPLOAD_BYTES) {
      return;
    }

    setUploading(true);
    setUpError(null);
    setUpDone(null);

    const payload = {
      file: pdfFile ? pdfFile.file : undefined,
      files: photos.length ? photos.map((photo) => photo.file) : undefined,
      dealer: upDealer,
      date: upDate,
      amount: upAmount,
    };

    const request =
      upMode === "replace"
        ? replaceBillFile(replaceId, payload)
        : createBill(payload);

    request
      .then((receipt) => {
        setBills((current) =>
          upMode === "replace"
            ? current.map((bill) =>
                bill.id === receipt.id ? receipt : bill
              )
            : [receipt, ...current]
        );
        refreshPurchases();
        setUpDone({ id: receipt.id, replaced: upMode === "replace" });
        setPhotos([]);
        setPdfFile(null);
        setUpAmount("");
        setFlash(
          upMode === "replace"
            ? `File replaced on bill #${receipt.id}.`
            : `Bill #${receipt.id} added.`
        );
        setTick((value) => value + 1);
      })
      .catch((error) => {
        console.error("Bill upload failed:", error);
        setUpError({
          kind: error && error.status ? "validation" : "network",
          message: firstMessage(error),
        });
      })
      .finally(() => {
        setUploading(false);
      });
  }

  function handleUploadRetry() {
    if (!upError) {
      return;
    }

    if (upError.kind === "network") {
      setUpError(null);
      runUpload();
    } else {
      setUpError(null);
      setPicker("meta");
    }
  }

  function handleOpenSaved() {
    if (upDone) {
      openBill(upDone.id);
    }
  }

  function handleCancelUpload() {
    goScreen("list");
  }

  // --- detail handlers ---------------------------------------------------
  function handleBackToBills() {
    goScreen("list");
  }

  function handleReplaceFile() {
    const bill = openBillRow;

    if (!bill) {
      return;
    }

    setUpMode("replace");
    setReplaceId(bill.id);
    setPhotos([]);
    setPdfFile(null);
    setUpError(null);
    setUpDone(null);
    setRejected("");

    // The details card still shows in replace mode, so seed it from the
    // bill; unchanged values are a no-op, and a correction made in the
    // card saves too.
    setUpDealer(bill.dealer);
    setUpDate(bill.date);
    setUpAmount(bill.amount);

    goScreen("upload");
  }

  function handleSaveCorrection(values) {
    const bill = openBillRow;

    if (!bill || saving) {
      return Promise.resolve(true);
    }

    setSaving(true);

    return updateBill(bill.id, values)
      .then((receipt) => {
        setBills((current) =>
          current.map((row) => (row.id === receipt.id ? receipt : row))
        );
        refreshPurchases();
        setFlash(`Bill #${receipt.id} saved.`);
        setTick((value) => value + 1);
        return true;
      })
      .catch((error) => {
        console.error("Bill correction failed:", error);
        throw error;
      })
      .finally(() => {
        setSaving(false);
      });
  }

  function handleDownload() {
    const bill = openBillRow;

    if (!bill) {
      return Promise.resolve(false);
    }

    // Its own request, per the design -- not a second use of the viewer's.
    return getBillFile(bill.id, true)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `bill-${bill.date}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        return true;
      })
      .catch((error) => {
        console.error("Bill download failed:", error);
        return false;
      });
  }

  // A write can move the month, so the headline + breakdown re-ask.
  // A failed refresh keeps the last known figures rather than zeroing.
  function refreshPurchases() {
    getBillPurchases("month")
      .then(setPurchases)
      .catch((error) => {
        console.error("Purchases refresh failed:", error);
      });
  }

  // --- render ------------------------------------------------------------
  return (
    <PageShell>
      <Navbar />

      <h1 className="bills__heading">LedgerFlow — bills</h1>

      {ready && derived && (
        <main className="bills__grid" aria-label="Bills">
          {screen === "list" && (
            <>
              <PurchasesThisMonth
                total={derived.monthTotal}
                count={purchases.count}
                periodLabel={periodLabel}
              />
              <UploadCta onUpload={handleUpload} />
              <DealerBreakdown
                rows={derived.breakdownRows}
                onPick={handleBreakdownPick}
              />
              <BillsFilter
                dealers={dealers}
                dealerFilter={dealerFilter}
                onDealerFilterChange={handleFilterDealer}
                range={range}
                onRangeChange={handleRangeChange}
                sort={sort}
                dir={dir}
                onSortChange={handleSortChange}
                pickerOpen={filterPicker.open}
                onPickerOpen={filterPicker.onOpen}
                onPickerClose={filterPicker.onClose}
              />
              <BillsList
                rows={derived.rows}
                tick={tick}
                gen={gen}
                flash={flash}
                resultCount={derived.resultCount}
                page={derived.cur}
                pageCount={derived.pageCount}
                range={derived.rangeText}
                empty={derived.empty}
                onOpen={openBill}
                onPageChange={handlePageChange}
                onReset={handleReset}
              />
            </>
          )}

          {screen === "upload" && (
            <>
              <UploadPages
                title={uploadTitle}
                countLabel={countLabel}
                photos={photos}
                pdfFile={pdfFile}
                rejected={rejected}
                onFiles={handleIngest}
                onClearPdf={handleClearPdf}
                onClearPhotos={handleClearPhotos}
                onMovePhoto={handleMovePhoto}
                onRemovePhoto={handleRemovePhoto}
              />
              <BillDetails
                dealers={dealers}
                activeDealers={derived.activeDealers}
                upDealer={upDealer}
                onDealerChange={handleUpDealerChange}
                upDate={upDate}
                onDateChange={handleUpDateChange}
                upAmount={upAmount}
                onAmountChange={handleUpAmountChange}
                upError={upError}
                pickerOpen={metaPicker.open}
                onPickerOpen={metaPicker.onOpen}
                onPickerClose={metaPicker.onClose}
              />
              <UploadActions
                oversize={oversize}
                oversizeText={
                  hasFiles
                    ? `This bill comes to ${formatMb(pendingBytes)} against a 10 MB limit.`
                    : ""
                }
                upError={upError}
                errorText={errorText}
                upDone={upDone}
                doneText={doneText}
                onOpenSaved={handleOpenSaved}
                uploading={uploading}
                mode={upMode}
                canSubmit={canSubmit}
                onSubmit={runUpload}
                onCancel={handleCancelUpload}
                onRetry={handleUploadRetry}
              />
            </>
          )}

          {screen === "detail" && openBillRow && (
            <>
              <BillViewer
                bill={openBillRow}
                fileMeta={billFileMeta(openBillRow)}
                viewerUrl={viewerUrl}
                viewerFailed={viewerFailed}
                onDownload={handleDownload}
                onReplace={handleReplaceFile}
              />
              <BillCorrect
                bill={openBillRow}
                dealers={dealers}
                pickerOptions={derived.detailOptions}
                pickerOpen={detailPicker.open}
                onPickerOpen={detailPicker.onOpen}
                onPickerClose={detailPicker.onClose}
                saving={saving}
                onBack={handleBackToBills}
                onSave={handleSaveCorrection}
              />
              <DetailNotes />
            </>
          )}
        </main>
      )}

      <div className="bills__footnote">
        <span>
          Money arrives as strings from this API and is parsed before any
          arithmetic. Purchases this month comes from its own endpoint —
          never totalled from the visible rows.
        </span>
        <span>
          Page size {PAGE_SIZE} per page. 10 MB is today's fallback, not a
          pinned setting.
        </span>
      </div>
    </PageShell>
  );
}

export default Bills;

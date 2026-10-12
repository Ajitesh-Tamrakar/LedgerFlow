import { useEffect, useRef, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import { getBills } from "../../api/bills";
import {
  getCashbookByDate,
  getCashbookEntries,
  saveCashbookEntry,
} from "../../api/cashbook";
import { getCollectionTrend, getDashboardSummary } from "../../api/dashboard";
import { addTask, getTasks, updateTask } from "../../api/tasks";
import { getToday } from "../../lib/format";
import Cashbook from "./components/Cashbook";
import CollectionTrend from "./components/CollectionTrend";
import InProgress from "./components/InProgress";
import NetCashFlow from "./components/NetCashFlow";
import OutstandingPerDealer from "./components/OutstandingPerDealer";
import PurchasingActivity from "./components/PurchasingActivity";
import RecentBills from "./components/RecentBills";
import Tasks from "./components/Tasks";
import TotalOutstanding from "./components/TotalOutstanding";
import "./Dashboard.css";

function headingDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Last day of the month an ISO date sits in, as an ISO date.
function monthEnd(iso) {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function Dashboard() {
  /*
   * One `period` state drives every period-based card. The Week / Month /
   * Quarter buttons in the Collection trend card call setPeriod, and the
   * first effect re-fetches everything that depends on it -- so one click
   * switches the trend, in-progress, net cash flow and purchasing cards
   * together, exactly like the design.
   */
  const [period, setPeriod] = useState("month");
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);

  // Period-independent: the task list and the newest bills.
  const [tasks, setTasks] = useState(null);
  const [bills, setBills] = useState(null);

  // The cashbook form: which day, its row (null while loading / 404),
  // the days that have entries (calendar dots), and the save state.
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [cashbookEntry, setCashbookEntry] = useState(null);
  const [cashbookDates, setCashbookDates] = useState([]);
  const [cashbookSaving, setCashbookSaving] = useState(false);

  /* The period-based tray, plus the trend (labels now, chart soon). */
  useEffect(() => {
    let active = true;

    getDashboardSummary(period)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((error) => {
        console.error("Dashboard summary failed:", error);
      });

    getCollectionTrend(period)
      .then((data) => {
        if (active) setTrend(data);
      })
      .catch((error) => {
        console.error("Collection trend failed:", error);
      });

    return () => {
      active = false;
    };
  }, [period]);

  /* Fetched once on mount -- neither list follows the period toggle. */
  useEffect(() => {
    let active = true;

    getTasks()
      .then((data) => {
        if (active) setTasks(data.results);
      })
      .catch((error) => {
        console.error("Tasks failed:", error);
      });

    getBills()
      .then((data) => {
        if (active) setBills(data.results);
      })
      .catch((error) => {
        console.error("Bills failed:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  /*
   * The selected cashbook day. GET 404s on a day with no entry -- the
   * order-slip file turns that into null, and the card renders blanks.
   * Blank first, so a day switch never briefly shows the old day's
   * numbers. (A month has at most 31 entries, one page always holds it,
   * so the dots are a single date-bounded list call.)
   */
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;

    let active = true;
    setCashbookEntry(null);

    getCashbookByDate(selectedDate)
      .then((row) => {
        if (active) setCashbookEntry(row);
      })
      .catch((error) => {
        console.error("Cashbook entry failed:", error);
      });

    getCashbookEntries({
      dateFrom: selectedDate.slice(0, 8) + "01",
      dateTo: monthEnd(selectedDate),
    })
      .then((data) => {
        if (active) setCashbookDates(data.results.map((row) => row.date));
      })
      .catch((error) => {
        console.error("Cashbook dates failed:", error);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  /* The Cashbook card's actions arrive here; the card itself never
     touches the API. */

  function handleCashbookDateChange(iso) {
    if (iso === selectedDate) {
      return;
    }
    setSelectedDate(iso);
    // The design drops the "Saving…" state when a new day is chosen.
    setCashbookSaving(false);
  }

  function handleCashbookSave(values) {
    if (cashbookSaving) {
      return;
    }
    setCashbookSaving(true);
    const date = selectedDate;

    // One PUT either way -- the backend is a create-or-replace upsert.
    saveCashbookEntry(date, values)
      .then((row) => {
        // If the user jumped to another day while this was in flight,
        // don't paint the stale day's row into the form.
        if (date === selectedDateRef.current) {
          setCashbookEntry(row);
          setCashbookDates((current) =>
            current.includes(date) ? current : [...current, date]
          );
        }
      })
      .catch((error) => {
        console.error("Could not save cashbook entry:", error);
      })
      .finally(() => {
        setCashbookSaving(false);
      });
  }

  /* The Tasks card's actions arrive here; the card itself never touches
     the API -- it just reports what the user did. */
  function handleAddTask(title) {
    addTask(title)
      .then((created) => {
        // The API lists newest-first, so a new task goes on top.
        setTasks((current) => [created, ...(current || [])]);
      })
      .catch((error) => {
        console.error("Could not add task:", error);
      });
  }

  function handleToggleTask(task) {
    updateTask(task.id, { is_done: !task.is_done })
      .then(() => {
        setTasks((current) =>
          current.map((t) =>
            t.id === task.id ? { ...t, is_done: !t.is_done } : t
          )
        );
      })
      .catch((error) => {
        console.error("Could not update task:", error);
      });
  }

  return (
    <PageShell>
      <Navbar />

      <h1 className="dashboard__heading">
        LedgerFlow — dashboard, {headingDate()}
      </h1>

      {/* Card order follows the design mock. Each card appears when its
          own data lands, and the dense grid interleaves them into the
          mock's layout. */}
      <main className="dashboard__grid" aria-label="Dashboard summary">
        <Cashbook
          selectedDate={selectedDate}
          entry={cashbookEntry}
          saving={cashbookSaving}
          savedDates={cashbookDates}
          onDateChange={handleCashbookDateChange}
          onSave={handleCashbookSave}
        />
        {trend && (
          <CollectionTrend trend={trend} period={period} onPeriodChange={setPeriod} />
        )}
        {summary && (
          <>
            <InProgress
              inProgress={summary.in_progress}
              label={trend ? trend.current.label : null}
              prevLabel={trend ? trend.previous.label : null}
              period={summary.period}
            />
            <NetCashFlow
              netCashFlow={summary.net_cash_flow}
              label={trend ? trend.current.label : null}
            />
            <TotalOutstanding outstanding={summary.outstanding} />
            <OutstandingPerDealer dealers={summary.outstanding.dealers} />
            <PurchasingActivity
              purchasing={summary.purchasing}
              period={summary.period}
            />
          </>
        )}
        {tasks && (
          <Tasks tasks={tasks} onAdd={handleAddTask} onToggle={handleToggleTask} />
        )}
        {bills && <RecentBills bills={bills.slice(0, 4)} />}
      </main>

      <div className="dashboard__footnote">
        <span>Periods read as calendar weeks, months and quarters.</span>
        <span>Bills and payments are corrected by editing, never deleted.</span>
      </div>
    </PageShell>
  );
}

export default Dashboard;

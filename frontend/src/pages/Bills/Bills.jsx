import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import DateField from "../../components/DateField/DateField";
import { useState } from "react";

function Bills() {
  const [date, setDate] = useState("2026-10-19");
  return (
    <PageShell>
      <Navbar></Navbar>
      <h1>Bills</h1>
      <DateField label="Date" value={date} onChange={setDate} />
      {/* Bills content will go here */}
    </PageShell>
  );
}

export default Bills;

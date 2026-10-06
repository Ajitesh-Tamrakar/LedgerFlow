import { useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import Card from "../../components/Card/Card";
import SectionLabel from "../../components/SectionLabel/SectionLabel";
import PillButton from "../../components/PillButton/PillButton";
import FormField from "../../components/FormField/FormField";
import DateField from "../../components/DateField/DateField";
import DealerPicker from "../../components/DealerPicker/DealerPicker";
import DataTable from "../../components/DataTable/DataTable";

function Cashbook() {

  return (
    <PageShell>
      <Navbar />
      <h1>Cashbook</h1>
    </PageShell>
  );
}

export default Cashbook;

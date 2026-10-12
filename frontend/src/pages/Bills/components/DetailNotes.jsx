import Card from "../../../components/Card/Card";
import "./DetailNotes.css";

/*
 * The three grey notes under the detail screen: what this page is
 * deliberately NOT doing. Static content, no props.
 */
const NOTES = [
  {
    title: "No payment status",
    text: "Bills and payments are structurally independent here — there is no way to compute whether this bill was settled, so nothing on this page hints at one.",
  },
  {
    title: "No original photos",
    text: "Only the compiled PDF is stored. The source images were transient input and exist solely on whatever device took them.",
  },
  {
    title: "No delete, no visible history",
    text: "Corrections are the only path. django-simple-history records every change underneath; surfacing that log isn't asked for yet.",
  },
];

function DetailNotes() {
  return (
    <Card className="detail-notes card--full">
      {NOTES.map((note) => (
        <div key={note.title} className="detail-notes__item">
          <span className="detail-notes__title">{note.title}</span>
          <span className="detail-notes__text">{note.text}</span>
        </div>
      ))}
    </Card>
  );
}

export default DetailNotes;

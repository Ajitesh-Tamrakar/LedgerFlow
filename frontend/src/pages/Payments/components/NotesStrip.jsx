import Card from "../../../components/Card/Card";
import "./NotesStrip.css";

/*
 * The four grey notes under the list: what this page is deliberately
 * NOT doing. Static content, no props.
 */
const NOTES = [
  {
    title: "No delete",
    text: "Corrections go through PATCH, same as Bills. The audit trail underneath is what makes that safe without a confirmation step.",
  },
  {
    title: "No bill link",
    text: 'Bill and Payment are independent in this schema — there is no "which bill did this settle" field, and none is invented here.',
  },
  {
    title: "No file slot",
    text: "Nothing to attach. Payments never carried a document; the upload flow belongs to Bills alone.",
  },
  {
    title: "Two different months",
    text: "This page's tile is the running month. Net Cash Flow on the dashboard is the last complete month — same field, its own aggregate call.",
  },
];

function NotesStrip() {
  return (
    <Card className="payments-notes card--full">
      {NOTES.map((note) => (
        <div key={note.title} className="payments-notes__item">
          <span className="payments-notes__title">{note.title}</span>
          <span className="payments-notes__text">{note.text}</span>
        </div>
      ))}
    </Card>
  );
}

export default NotesStrip;

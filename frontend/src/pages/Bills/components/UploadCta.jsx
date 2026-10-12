import Card from "../../../components/Card/Card";
import "./UploadCta.css";

/*
 * The dark card on the list screen: the only door into the upload
 * screen. Pure presentation -- one callback.
 */
function UploadCta({ onUpload }) {
  return (
    <Card variant="dark" className="upload-cta card--wide">
      <h2 className="upload-cta__title">Upload a bill</h2>

      <p className="upload-cta__text">
        Upload the scanned pages and LedgerFlow puts them together into one
        PDF in the background — or drop in a PDF you already have.
      </p>

      <button
        type="button"
        className="upload-cta__button"
        onClick={onUpload}
      >
        Upload a bill
      </button>
    </Card>
  );
}

export default UploadCta;

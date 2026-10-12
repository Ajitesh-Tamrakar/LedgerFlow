import Card from "../../../components/Card/Card";
import "./UploadActions.css";

/*
 * The dark actions card on the upload screen: the oversize warning, the
 * upload error (with retry), the done status, and the submit/cancel row.
 *
 * Pure presentation: the page hands it finished strings and reports the
 * clicks. The design's "Uploading 37%" counter is a mock timer; a real
 * fetch has no progress, so the CTA breathes with just "Uploading…"
 * (the user's locked decision: no progress number for now).
 */
function UploadActions({
  oversize,
  oversizeText,
  upError,
  errorText,
  upDone,
  doneText,
  onOpenSaved,
  uploading,
  mode,
  canSubmit,
  onSubmit,
  onCancel,
  onRetry,
}) {
  return (
    <Card variant="dark" className="upload-actions card--full">
      {oversize && (
        <div className="upload-actions__alert" role="alert">
          <span className="upload-actions__alert-title">
            Too large to upload — checked here, before the upload starts.
          </span>
          <span className="upload-actions__alert-text">
            {oversizeText} Remove or retake a page and try again. The 10 MB
            ceiling is today's server fallback, not a pinned setting — it
            may move.
          </span>
        </div>
      )}

      {upError && (
        <div className="upload-actions__alert" role="alert">
          <span className="upload-actions__alert-title">
            {upError.kind === "network"
              ? "Upload failed — connection dropped."
              : "The server rejected this bill."}
          </span>
          <span className="upload-actions__alert-text">{errorText}</span>
          <span className="upload-actions__retry-row">
            <button
              type="button"
              className="upload-actions__retry"
              onClick={onRetry}
            >
              {upError.kind === "network" ? "Send again" : "Fix and resend"}
            </button>
            <span className="upload-actions__retry-note">
              Your pages and every field are still held — nothing to redo.
            </span>
          </span>
        </div>
      )}

      {upDone && (
        <div className="upload-actions__done" role="status">
          <span>{doneText}</span>
          <button
            type="button"
            className="upload-actions__open"
            onClick={onOpenSaved}
          >
            Open the bill
          </button>
        </div>
      )}

      <div className="upload-actions__row">
        <button
          type="button"
          className={
            "upload-actions__submit" +
            (!canSubmit ? " upload-actions__submit--off" : "") +
            (uploading ? " upload-actions__submit--busy" : "")
          }
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {uploading
            ? "Uploading…"
            : mode === "replace"
              ? "Replace the file"
              : "Upload bill"}
        </button>

        <button
          type="button"
          className="upload-actions__cancel"
          onClick={onCancel}
        >
          Back to bills
        </button>

        <span className="upload-actions__note">
          The pages are compiled into one PDF on the server while the upload
          is in flight; the PDF is what LedgerFlow stores.
        </span>
      </div>
    </Card>
  );
}

export default UploadActions;

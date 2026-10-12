import { useEffect, useState } from "react";
import Card from "../../../components/Card/Card";
import "./BillViewer.css";

/*
 * "The bill itself" -- the detail screen's white card: the inline PDF
 * viewer, the download and replace actions.
 *
 * The design's striped placeholder box is the mock standing in for a PDF
 * it can't embed; the real card renders the fetched PDF in an iframe (the
 * page fetches the bytes with the token and hands it an object URL -- an
 * <iframe src> can't carry the bearer token itself). While the fetch is
 * in flight, or if it fails, the design's placeholder shows.
 *
 * The download flash is card local (the design's short-lived status line);
 * the request itself is the page's.
 */
const FLASH_MS = 4200; // the dealers page's convention

function BillViewer({
  bill,
  fileMeta,
  viewerUrl,
  viewerFailed,
  onDownload,
  onReplace,
}) {
  const [downloadFlash, setDownloadFlash] = useState("");

  useEffect(() => {
    if (!downloadFlash) {
      return;
    }
    const timer = setTimeout(() => setDownloadFlash(""), FLASH_MS);
    return () => clearTimeout(timer);
  }, [downloadFlash]);

  function handleDownload() {
    onDownload().then((ok) => {
      setDownloadFlash(
        ok
          ? "Requested with ?download=1 — a separate request from the viewer above."
          : "The download didn't start — the connection dropped. Try again."
      );
    });
  }

  return (
    <Card className="bill-viewer card--wide">
      <div className="bill-viewer__header">
        <h2 className="bill-viewer__title">The bill itself</h2>
        <span className="bill-viewer__meta">{fileMeta}</span>
      </div>

      <div
        className="bill-viewer__stage"
        role="img"
        aria-label={
          bill ? `Compiled PDF for bill ${bill.id}, shown inline` : ""
        }
      >
        {viewerUrl ? (
          <iframe
            className="bill-viewer__frame"
            src={viewerUrl}
            title={`Bill ${bill.id} — PDF`}
          />
        ) : (
          <div className="bill-viewer__placeholder">
            <span className="bill-viewer__badge">Inline PDF viewer</span>
            {viewerFailed ? (
              <span className="bill-viewer__mono">
                The PDF didn't load from its endpoint — use the download
                below, or come back a moment.
              </span>
            ) : (
              <span className="bill-viewer__mono">
                GET /api/bills/{bill.id}/file/ — no ?download=1, rendered in
                place so a paper bill stays readable here.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="bill-viewer__actions">
        <button
          type="button"
          className="bill-viewer__button"
          onClick={handleDownload}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="bill-viewer__button"
          onClick={onReplace}
        >
          Replace the file
        </button>
        {downloadFlash && (
          <span className="bill-viewer__flash" role="status">
            {downloadFlash}
          </span>
        )}
      </div>

      <p className="bill-viewer__note">
        Download is its own request —{" "}
        <code className="bill-viewer__code">?download=1</code> on the same
        endpoint — not a second use of the viewer's link. Replacing the file
        reuses the full upload-and-compile flow, because a missed page is the
        same problem as the first time.
      </p>
    </Card>
  );
}

export default BillViewer;

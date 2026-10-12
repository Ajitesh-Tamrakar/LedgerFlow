import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import { formatMb } from "../../../lib/format";
import "./UploadPages.css";

/*
 * "Add the pages" -- the upload screen's white card: the dropzone, the
 * chosen PDF, and the arranged photo pages. In replace mode the title
 * reads "Replace the file on bill #N".
 *
 * The files themselves live in the page (they are the upload draft, and
 * they must survive screen switches -- the design keeps them too); this
 * card only owns the cosmetic bits: the drag highlight and the two
 * hidden file inputs. Thumbnails are real previews of the Files, over
 * the design's striped placeholder, which shows through if an image
 * fails to load.
 */

function UploadPages({
  title,
  countLabel,
  photos,
  pdfFile,
  rejected,
  onFiles,
  onClearPdf,
  onClearPhotos,
  onMovePhoto,
  onRemovePhoto,
}) {
  const [dragging, setDragging] = useState(false);
  const imageRef = useRef(null);
  const pdfRef = useRef(null);

  // The design re-pops the count line whenever the page count moves (its
  // photoTick); the label text moves with it, so key off that.
  const [countAnim, setCountAnim] = useState("a");
  const lastCount = useRef(countLabel);

  useEffect(() => {
    if (lastCount.current !== countLabel) {
      lastCount.current = countLabel;
      setCountAnim((current) => (current === "a" ? "b" : "a"));
    }
  }, [countLabel]);

  // One object URL per photo; the old set is revoked when the photos
  // change or the card unmounts.
  const thumbs = useMemo(
    () => photos.map((photo) => URL.createObjectURL(photo.file)),
    [photos]
  );

  useEffect(() => {
    return () => {
      thumbs.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [thumbs]);

  // The design's ingest: one PDF replaces everything; photos append.
  // `e.target.value = ""` lets the same file be picked again.
  function handleInputChange(event) {
    onFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    onFiles(event.dataTransfer && event.dataTransfer.files);
  }

  const hasPdf = !!pdfFile;
  const hasPhotos = photos.length > 0;

  return (
    <Card className="upload-pages card--wide">
      <div className="upload-pages__header">
        <h2 className="upload-pages__title">{title}</h2>
        <span
          className={`upload-pages__count upload-pages__count--${countAnim}`}
        >
          {countLabel}
        </span>
      </div>

      <div
        className={
          "upload-pages__drop" + (dragging ? " upload-pages__drop--active" : "")
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="upload-pages__icon" aria-hidden="true">
          ↥
        </span>

        <span className="upload-pages__drop-text">
          <span>
            {dragging
              ? "Drop the files here"
              : "Drag files in, or pick them from your computer"}
          </span>
          <span className="upload-pages__drop-sub">
            JPG, PNG, WEBP or HEIC pages — or drop a PDF you already have.
            Several files at once is fine.
          </span>
        </span>

        <span className="upload-pages__browse">
          <button
            type="button"
            className="upload-pages__browse-photos"
            onClick={() => imageRef.current?.click()}
          >
            <span className="upload-pages__dot" aria-hidden="true" />
            Upload photos
          </button>
          <button
            type="button"
            className="upload-pages__browse-pdf"
            onClick={() => pdfRef.current?.click()}
          >
            Upload a PDF
          </button>
        </span>

        <input
          ref={imageRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
          className="upload-pages__input"
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
          className="upload-pages__input"
        />
      </div>

      {rejected && (
        <div className="upload-pages__rejected" role="alert">
          {rejected}
        </div>
      )}

      {hasPdf && (
        <div className="upload-pages__pdf">
          <span className="upload-pages__pdf-glyph" aria-hidden="true">
            PDF
          </span>
          <span className="upload-pages__pdf-text">
            <span className="upload-pages__pdf-name">{pdfFile.name}</span>
            <span className="upload-pages__pdf-meta">
              {formatMb(pdfFile.size)} · uploaded as-is
            </span>
          </span>
          <button
            type="button"
            className="upload-pages__remove"
            onClick={onClearPdf}
          >
            Remove
          </button>
        </div>
      )}

      {hasPhotos && (
        <div className="upload-pages__photos-row">
          <span>Drag the arrows to put the pages in reading order.</span>
          <button
            type="button"
            className="upload-pages__start-over"
            onClick={onClearPhotos}
          >
            Start over
          </button>
        </div>
      )}

      {hasPhotos && (
        <div className="upload-pages__grid">
          {photos.map((photo, index) => (
            <div
              key={photo.key}
              className="upload-pages__photo"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span className="upload-pages__thumb">
                <img
                  src={thumbs[index]}
                  alt=""
                  onError={(event) => {
                    // A file that won't render still shows its stripes.
                    event.currentTarget.style.display = "none";
                  }}
                />
                <span className="upload-pages__page-chip">
                  Page {index + 1}
                </span>
              </span>

              <span className="upload-pages__photo-line">
                <span className="upload-pages__photo-name">
                  {photo.name}
                </span>
                <span className="upload-pages__photo-size">
                  {formatMb(photo.size)}
                </span>
              </span>

              <span className="upload-pages__photo-controls">
                <button
                  type="button"
                  className="upload-pages__move"
                  disabled={index === 0}
                  aria-label={`Move page ${index + 1} earlier`}
                  onClick={() => onMovePhoto(index, -1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="upload-pages__move"
                  disabled={index === photos.length - 1}
                  aria-label={`Move page ${index + 1} later`}
                  onClick={() => onMovePhoto(index, 1)}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="upload-pages__remove"
                  aria-label={`Remove page ${index + 1}`}
                  onClick={() => onRemovePhoto(index)}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!hasPhotos && !hasPdf && (
        <div className="upload-pages__none">
          A bill can run to several pages. Add them in any order — you can
          reorder them here before you upload.
        </div>
      )}

      <p className="upload-pages__note">
        Images are only ever input. LedgerFlow stores one PDF per bill — the
        source files stay on this computer and can't be fetched back later.
        A PDF you upload directly is stored as-is.
      </p>
    </Card>
  );
}

export default UploadPages;

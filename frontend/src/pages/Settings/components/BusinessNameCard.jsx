import "./BusinessNameCard.css";

/*
 * The business name card (accent). One big input, a live note under it
 * (all saved / unsaved / saving... / error), a character counter once the
 * draft gets long, and the save/cancel pair.
 * Presentational -- the page owns the draft and makes the PATCH.
 */
function BusinessNameCard({
  value,
  blank,
  note,
  noteError,
  count,
  countWarn,
  saveCta,
  saveDisabled,
  saving,
  revertDisabled,
  shake,
  onValueChange,
  onSubmit,
  onRevert,
}) {
  const fieldClasses = [
    "settings-biz__field",
    blank ? "is-invalid" : "",
    // The parity flip replays the shake without remounting the input,
    // so the field keeps its focus (the design's A/B trick).
    shake ? (shake % 2 ? "settings-shake-b" : "settings-shake-a") : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      id="business"
      className="settings-card settings-card--business"
      aria-labelledby="settings-biz-title"
    >
      <h2 id="settings-biz-title" className="settings-card__title">
        Business name
      </h2>

      <form className="settings-biz__form" onSubmit={onSubmit} noValidate>
        <span className={fieldClasses}>
          <input
            className="settings-biz__input"
            type="text"
            value={value}
            onChange={onValueChange}
            maxLength={100}
            placeholder="Your business name"
            aria-label="Business name"
            aria-describedby="settings-biz-help"
            aria-invalid={blank || undefined}
          />
        </span>

        <div
          className="settings-biz__help"
          id="settings-biz-help"
          aria-live="polite"
        >
          <span className={`settings-biz__note ${noteError ? "is-error" : ""}`}>
            {note}
          </span>
          {count ? (
            <span
              className={`settings-biz__count ${countWarn ? "is-warn" : ""}`}
            >
              {count}
            </span>
          ) : null}
        </div>

        <div className="settings-biz__actions">
          <button
            type="submit"
            className={`settings-biz__save ${
              saving ? "is-saving" : ""
            } ${saveDisabled ? "is-disabled" : ""}`}
            disabled={saveDisabled}
          >
            {saveCta}
          </button>
          <button
            type="button"
            className={`settings-biz__cancel ${
              revertDisabled ? "is-disabled" : ""
            }`}
            disabled={revertDisabled}
            onClick={onRevert}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default BusinessNameCard;

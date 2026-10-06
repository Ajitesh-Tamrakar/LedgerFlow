import "./DataTable.css";

export default function DataTable({
  title,
  meta,

  columns = [],
  rows = [],

  renderCell,

  currentPage = 1,
  totalPages = 1,
  showingFrom = 0,
  showingTo = 0,
  totalItems = 0,

  onPageChange,

  emptyMessage = "Nothing to show.",
}) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <section className="data-table">
      {/* Header */}
      <div className="data-table__top">
        <span className="data-table__title">
          {title}
        </span>

        {meta && (
          <span className="data-table__meta">
            {meta}
          </span>
        )}
      </div>

      {/* Column headings */}
      <div
        className="data-table__header"
        style={{
          gridTemplateColumns: columns
            .map((column) => column.width || "1fr")
            .join(" "),
        }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={`data-table__heading ${
              column.align === "right"
                ? "data-table__heading--right"
                : ""
            }`}
          >
            {column.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="data-table__body">
        {rows.length > 0 ? (
          rows.map((row, rowIndex) => (
            <div
              key={row.id ?? rowIndex}
              className="data-table__row"
              style={{
                gridTemplateColumns: columns
                  .map((column) => column.width || "1fr")
                  .join(" "),
              }}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={`data-table__cell ${
                    column.align === "right"
                      ? "data-table__cell--right"
                      : ""
                  }`}
                >
                  {renderCell
                    ? renderCell(row, column)
                    : row[column.key]}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="data-table__empty">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="data-table__footer">
        <span className="data-table__range">
          {totalItems > 0
            ? `Showing ${showingFrom}–${showingTo} of ${totalItems}`
            : "Nothing to show"}
        </span>

        {totalPages > 0 && (
          <div className="data-table__pagination">
            <button
              type="button"
              className="data-table__page-button"
              disabled={!canGoPrevious}
              onClick={() =>
                onPageChange?.(currentPage - 1)
              }
              aria-label="Previous page"
            >
              ‹
            </button>

            <button
              type="button"
              className="data-table__page-button data-table__page-button--current"
              aria-current="page"
            >
              {currentPage}
            </button>

            <button
              type="button"
              className="data-table__page-button"
              disabled={!canGoNext}
              onClick={() =>
                onPageChange?.(currentPage + 1)
              }
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
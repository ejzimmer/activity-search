import './PaginationNav.css';
type PaginationNavProps = {
  page: number;
  totalPages: number;
  total: number | undefined;
  isLoading: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationNav({
  page,
  totalPages,
  total,
  isLoading,
  onPageChange,
}: PaginationNavProps) {
  return (
    <nav aria-label="Pagination" className="pagination">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
      >
        Previous
      </button>
      <p aria-live="polite">
        {total === undefined
          ? 'Loading…'
          : `Page ${page} of ${totalPages} · ${total} activities`}
      </p>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
      >
        Next
      </button>
    </nav>
  );
}

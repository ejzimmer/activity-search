export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : fallback;
}

export function parsePagination(params: URLSearchParams): Pagination {
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = Math.min(
    parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

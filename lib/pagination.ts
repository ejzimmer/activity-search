export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export interface Pagination {
  page: number
  pageSize: number
  offset: number
}

function positiveInt(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback
  const n = Number(value)
  return n >= 1 ? n : fallback
}

/** Reads ?page= and ?pageSize= (1-based page), clamping to sane values. */
export function parsePagination(params: URLSearchParams): Pagination {
  const page = positiveInt(params.get('page'), 1)
  const pageSize = Math.min(positiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  return { page, pageSize, offset: (page - 1) * pageSize }
}

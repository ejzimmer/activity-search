import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parsePagination } from '../lib/pagination.ts'

const p = (qs: string) => parsePagination(new URLSearchParams(qs))

describe('parsePagination', () => {
  it('defaults to the first page', () => {
    expect(p('')).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, offset: 0 })
  })

  it('computes the offset', () => {
    expect(p('page=3&pageSize=10')).toEqual({ page: 3, pageSize: 10, offset: 20 })
  })

  it('ignores junk and clamps the page size', () => {
    expect(p('page=-2&pageSize=abc')).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, offset: 0 })
    expect(p('page=0')).toMatchObject({ page: 1 })
    expect(p('pageSize=5000').pageSize).toBe(MAX_PAGE_SIZE)
  })
})

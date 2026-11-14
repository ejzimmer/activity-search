import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
} from '../lib/pagination.ts';

const parseQuery = (query: string) =>
  parsePagination(new URLSearchParams(query));

describe('parsePagination', () => {
  describe('with no parameters', () => {
    it('returns the first page at the default size', () => {
      expect(parseQuery('')).toEqual({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        offset: 0,
      });
    });
  });

  describe('with a page and page size', () => {
    it('computes the offset', () => {
      expect(parseQuery('page=3&pageSize=10')).toEqual({
        page: 3,
        pageSize: 10,
        offset: 20,
      });
    });
  });

  describe('with values that are not positive whole numbers', () => {
    it('falls back to the defaults', () => {
      expect(parseQuery('page=-2&pageSize=abc')).toEqual({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        offset: 0,
      });
      expect(parseQuery('page=0')).toMatchObject({ page: 1 });
    });
  });

  describe('with a page size over the maximum', () => {
    it('caps it', () => {
      expect(parseQuery('pageSize=5000').pageSize).toBe(MAX_PAGE_SIZE);
    });
  });
});

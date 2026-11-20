import { describe, expect, it } from 'vitest';
import {
  createApiSearchParams,
  hasActiveFilters,
  readActivityQuery,
  writeActivityQuery,
  type FilterValues,
} from '../src/activityQuery.ts';

const NO_FILTERS: FilterValues = {
  sportType: '',
  name: '',
  distanceKm: '',
  hours: '',
  minutes: '',
};

const createQuery = (filters: Partial<FilterValues>) => ({
  page: 1,
  filters: { ...NO_FILTERS, ...filters },
});

describe('readActivityQuery', () => {
  describe('with an empty URL', () => {
    it('starts on the first page with no filters', () => {
      expect(readActivityQuery(new URLSearchParams())).toEqual({
        page: 1,
        filters: NO_FILTERS,
      });
    });
  });

  describe('with a URL that writeActivityQuery wrote', () => {
    it('reads back the same query', () => {
      const query = {
        page: 3,
        filters: {
          sportType: 'running',
          name: 'park',
          distanceKm: '20',
          hours: '2',
          minutes: '',
        },
      };
      const url = new URL('https://example.com/');
      writeActivityQuery(url, query);
      expect(readActivityQuery(url.searchParams)).toEqual(query);
    });
  });
});

describe('createApiSearchParams', () => {
  describe('with a distance in kilometres', () => {
    it('sends it in metres', () => {
      expect(
        createApiSearchParams(createQuery({ distanceKm: '20.5' })).get(
          'distance',
        ),
      ).toBe('20500');
    });
  });

  describe('with hours and minutes', () => {
    it('sends the duration in seconds', () => {
      expect(
        createApiSearchParams(createQuery({ hours: '1', minutes: '45' })).get(
          'duration',
        ),
      ).toBe('6300');
    });

    describe('when only minutes are filled in', () => {
      it('sends the minutes in seconds', () => {
        expect(
          createApiSearchParams(createQuery({ minutes: '90' })).get('duration'),
        ).toBe('5400');
      });
    });
  });

  describe('with a name', () => {
    it('sends it trimmed', () => {
      expect(
        createApiSearchParams(createQuery({ name: '  park ' })).get('name'),
      ).toBe('park');
    });
  });
});

describe('hasActiveFilters', () => {
  describe('when a filter is filled in', () => {
    it('is true', () => {
      expect(hasActiveFilters(createQuery({ sportType: 'running' }))).toBe(
        true,
      );
    });
  });

  describe('when the only values typed in filter nothing', () => {
    it('is false', () => {
      expect(
        hasActiveFilters(createQuery({ name: '  ', hours: '0', minutes: '' })),
      ).toBe(false);
    });
  });
});

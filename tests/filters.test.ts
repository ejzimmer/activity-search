import { describe, expect, it } from 'vitest';
import { parseActivityFilters } from '../lib/filters.ts';

const parseQuery = (query: string) =>
  parseActivityFilters(new URLSearchParams(query));

describe('parseActivityFilters', () => {
  describe('with no parameters', () => {
    it('filters nothing', () => {
      expect(parseQuery('')).toEqual({
        sportTypes: null,
        namePattern: null,
        distanceRange: null,
        movingTimeRange: null,
        nearPoint: null,
      });
    });
  });

  describe('with a type', () => {
    describe('that has narrower types under it', () => {
      it('matches the type and every narrower one', () => {
        expect(parseQuery('type=running').sportTypes).toEqual(
          expect.arrayContaining(['running', 'trail_running', 'virtual_run']),
        );
      });
    });

    describe('that has nothing under it', () => {
      it('matches only that type', () => {
        expect(parseQuery('type=trail_running').sportTypes).toEqual([
          'trail_running',
        ]);
      });
    });
  });

  describe('with a name', () => {
    it('matches the name anywhere', () => {
      expect(parseQuery('name=%20park%20').namePattern).toBe('%park%');
    });

    it('matches LIKE wildcards literally', () => {
      expect(parseQuery('name=100%25_done').namePattern).toBe(
        '%100\\%\\_done%',
      );
    });
  });

  describe('with a distance in metres', () => {
    it('matches 10% either side', () => {
      const { min, max } = parseQuery('distance=20000').distanceRange!;
      expect(min).toBeCloseTo(18000);
      expect(max).toBeCloseTo(22000);
    });
  });

  describe('with a duration in seconds', () => {
    it('matches a little under and a bit more over', () => {
      const { min, max } = parseQuery('duration=7200').movingTimeRange!;
      expect(min).toBeCloseTo(6912);
      expect(max).toBeCloseTo(7776);
    });
  });

  describe('with a latitude and longitude', () => {
    it('matches near that point', () => {
      expect(parseQuery('lat=-37.81&lng=144.96').nearPoint).toEqual({
        lat: -37.81,
        lng: 144.96,
      });
    });

    describe('that are out of range', () => {
      it('ignores them', () => {
        expect(parseQuery('lat=91&lng=144.96').nearPoint).toBeNull();
      });
    });

    describe('when only one is given', () => {
      it('ignores it', () => {
        expect(parseQuery('lat=-37.81').nearPoint).toBeNull();
      });
    });
  });

  describe('with blank, zero or non-numeric values', () => {
    it('ignores them', () => {
      expect(
        parseQuery('type=%20&name=&distance=abc&duration=0&lat=&lng=x'),
      ).toEqual({
        sportTypes: null,
        namePattern: null,
        distanceRange: null,
        movingTimeRange: null,
        nearPoint: null,
      });
    });
  });
});

import { describe, expect, it } from 'vitest';
import { listSportTypeOptions } from '../lib/sport-types.ts';

describe('listSportTypeOptions', () => {
  describe('when a narrow type was recorded but its broad type never was', () => {
    it('still offers the broad type, with the narrow one under it', () => {
      expect(listSportTypeOptions(['trail_running'])).toEqual([
        { sportType: 'running', isChild: false },
        { sportType: 'trail_running', isChild: true },
      ]);
    });
  });

  describe('when a broad type and narrow types under it were recorded', () => {
    it('offers the broad type once, followed by the narrow ones in order', () => {
      expect(
        listSportTypeOptions(['treadmill_running', 'running', 'trail_running']),
      ).toEqual([
        { sportType: 'running', isChild: false },
        { sportType: 'trail_running', isChild: true },
        { sportType: 'treadmill_running', isChild: true },
      ]);
    });
  });

  describe('when there are several broad types', () => {
    it('sorts them by type key', () => {
      expect(
        listSportTypeOptions(['road_biking', 'hiking', 'running']).map(
          ({ sportType }) => sportType,
        ),
      ).toEqual(['cycling', 'road_biking', 'hiking', 'running']);
    });
  });
});

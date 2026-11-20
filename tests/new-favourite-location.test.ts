import { describe, expect, it } from 'vitest';
import {
  MAX_FAVOURITE_NAME_LENGTH,
  parseNewFavouriteLocation,
} from '../lib/new-favourite-location.ts';

describe('parseNewFavouriteLocation', () => {
  describe('with a name and a point', () => {
    it('reads them, with the name trimmed', () => {
      expect(
        parseNewFavouriteLocation({ name: ' Home ', lat: -37.81, lng: 144.96 }),
      ).toEqual({ name: 'Home', lat: -37.81, lng: 144.96 });
    });
  });

  describe('with a blank name', () => {
    it('rejects it', () => {
      expect(
        parseNewFavouriteLocation({ name: '  ', lat: -37.81, lng: 144.96 }),
      ).toBeNull();
    });
  });

  describe('with a name that is too long', () => {
    it('rejects it', () => {
      expect(
        parseNewFavouriteLocation({
          name: 'x'.repeat(MAX_FAVOURITE_NAME_LENGTH + 1),
          lat: -37.81,
          lng: 144.96,
        }),
      ).toBeNull();
    });
  });

  describe('with a point off the globe', () => {
    it('rejects it', () => {
      expect(
        parseNewFavouriteLocation({ name: 'Home', lat: -37.81, lng: 200 }),
      ).toBeNull();
    });
  });

  describe('with a body that is not an object', () => {
    it('rejects it', () => {
      expect(parseNewFavouriteLocation('Home')).toBeNull();
    });
  });
});

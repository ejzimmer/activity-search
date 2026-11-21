import { describe, expect, it } from 'vitest';
import { GarminKeyEncryption } from '../lib/garmin-key-encryption.ts';
import {
  isScheduledSyncRequest,
  readTrustedSyncUserId,
} from '../lib/sync-request.ts';

const encryption = new GarminKeyEncryption('test encryption secret');

const createSyncRequest = (path: string, headers: Record<string, string>) =>
  new Request(`https://example.test${path}`, { method: 'POST', headers });

describe('isScheduledSyncRequest', () => {
  describe('when Neon scheduled the request', () => {
    it('says so', () => {
      const request = createSyncRequest('/sync', {
        'x-neon-trigger-invocation-id': 'inv_123',
      });
      expect(isScheduledSyncRequest(request)).toBe(true);
    });
  });

  describe('when anyone else sent it', () => {
    it('says not', () => {
      expect(isScheduledSyncRequest(createSyncRequest('/sync', {}))).toBe(
        false,
      );
    });
  });
});

describe('readTrustedSyncUserId', () => {
  describe('when the sync token was made for the user in the URL', () => {
    it('reads the user', () => {
      const request = createSyncRequest('/sync?user=7', {
        'x-sync-token': encryption.createSyncToken(7),
      });
      expect(readTrustedSyncUserId(request, encryption)).toBe(7);
    });
  });

  describe('when the sync token was made for a different user', () => {
    it('rejects it', () => {
      const request = createSyncRequest('/sync?user=7', {
        'x-sync-token': encryption.createSyncToken(8),
      });
      expect(readTrustedSyncUserId(request, encryption)).toBeNull();
    });
  });

  describe('when the sync token was made with a different secret', () => {
    it('rejects it', () => {
      const otherEncryption = new GarminKeyEncryption('another secret');
      const request = createSyncRequest('/sync?user=7', {
        'x-sync-token': otherEncryption.createSyncToken(7),
      });
      expect(readTrustedSyncUserId(request, encryption)).toBeNull();
    });
  });

  describe('when there is no sync token', () => {
    it('rejects it', () => {
      const request = createSyncRequest('/sync?user=7', {});
      expect(readTrustedSyncUserId(request, encryption)).toBeNull();
    });
  });
});

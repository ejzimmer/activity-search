import { describe, expect, it } from 'vitest';
import { createSyncToken } from '../lib/sync.ts';
import { isTrustedSyncRequest } from '../lib/sync-request.ts';

const apiKey = 'garmin-key';

const createSyncRequest = (headers: Record<string, string>) =>
  new Request('https://example.test/sync', { method: 'POST', headers });

describe('isTrustedSyncRequest', () => {
  describe('when Neon scheduled the request', () => {
    it('trusts it', () => {
      const request = createSyncRequest({
        'x-neon-trigger-invocation-id': 'inv_123',
      });
      expect(isTrustedSyncRequest(request, apiKey)).toBe(true);
    });
  });

  describe('when the request carries a sync token', () => {
    describe('made from the Garmin key', () => {
      it('trusts it', () => {
        const request = createSyncRequest({
          'x-sync-token': createSyncToken(apiKey),
        });
        expect(isTrustedSyncRequest(request, apiKey)).toBe(true);
      });
    });

    describe('made from a different key', () => {
      it('rejects it', () => {
        const request = createSyncRequest({
          'x-sync-token': createSyncToken('someone-else'),
        });
        expect(isTrustedSyncRequest(request, apiKey)).toBe(false);
      });
    });
  });

  describe('when the request has neither', () => {
    it('rejects it', () => {
      expect(isTrustedSyncRequest(createSyncRequest({}), apiKey)).toBe(false);
    });
  });
});

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from '../lib/db.ts';
import {
  GarminApiError,
  type GarminActivity,
  type GarminClient,
} from '../lib/garmin.ts';
import { syncWithGarmin } from '../lib/sync.ts';
import {
  createTestDatabase,
  type TestDatabase,
} from './support/test-database.ts';

let testDatabase: TestDatabase;
let sql: Sql;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  sql = testDatabase.sql;
});

beforeEach(async () => {
  await testDatabase.clearTables();
  await sql`
    INSERT INTO users (email, password_hash)
    VALUES ('first@example.test', 'unused'), ('second@example.test', 'unused')
  `;
});

function createGarminActivity(
  activityId: number,
  activityName: string,
): GarminActivity {
  return {
    activityId,
    activityName,
    startTimeGMT: '2026-11-20 08:00:00',
    activityType: { typeKey: 'running' },
  };
}

function createFakeGarmin(activities: GarminActivity[]): GarminClient {
  return {
    searchActivities: async () => activities,
    downloadActivity: async (activityId: string) => {
      throw new GarminApiError(404, `/download/${activityId}`, '');
    },
  } as unknown as GarminClient;
}

function createRejectingGarmin(): GarminClient {
  return {
    searchActivities: async () => {
      throw new GarminApiError(401, '/token', '');
    },
  } as unknown as GarminClient;
}

async function listActivityOwners() {
  return sql`
    SELECT activities.name, users.email
    FROM activities JOIN users ON users.id = activities.user_id
    ORDER BY activities.id
  `;
}

const silenceLog = () => {};

describe('syncWithGarmin', () => {
  describe('for one person', () => {
    it('files the activities under that person', async () => {
      await syncWithGarmin({
        sql,
        garmin: createFakeGarmin([createGarminActivity(1, 'Morning run')]),
        userId: 2,
        log: silenceLog,
      });
      expect(await listActivityOwners()).toEqual([
        { name: 'Morning run', email: 'second@example.test' },
      ]);
    });

    it("records the result in that person's sync status", async () => {
      await syncWithGarmin({
        sql,
        garmin: createFakeGarmin([createGarminActivity(1, 'Morning run')]),
        userId: 2,
        log: silenceLog,
      });
      const [status] = await sql`
        SELECT last_result FROM user_sync_state WHERE user_id = 2
      `;
      expect(status.last_result).toMatch(/^Saved 1 activities/);
    });
  });

  describe("when another person's key returns an activity someone else owns", () => {
    it('leaves it with its owner', async () => {
      const activity = createGarminActivity(1, 'Morning run');
      await syncWithGarmin({
        sql,
        garmin: createFakeGarmin([activity]),
        userId: 1,
        log: silenceLog,
      });
      await syncWithGarmin({
        sql,
        garmin: createFakeGarmin([{ ...activity, activityName: 'Renamed' }]),
        userId: 2,
        log: silenceLog,
      });
      expect(await listActivityOwners()).toEqual([
        { name: 'Morning run', email: 'first@example.test' },
      ]);
    });
  });

  describe('when Garmin rejects the key', () => {
    it("marks that person's key as rejected", async () => {
      await expect(
        syncWithGarmin({
          sql,
          garmin: createRejectingGarmin(),
          userId: 2,
          log: silenceLog,
        }),
      ).rejects.toThrow(GarminApiError);
      const users = await sql`
        SELECT email, is_garmin_key_rejected AS "isRejected" FROM users ORDER BY id
      `;
      expect(users).toEqual([
        { email: 'first@example.test', isRejected: false },
        { email: 'second@example.test', isRejected: true },
      ]);
    });
  });
});

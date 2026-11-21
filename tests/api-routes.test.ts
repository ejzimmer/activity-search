import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_SIGN_IN_FAILURES } from '../lib/accounts.ts';
import { routeApiRequest } from '../lib/api-routes.ts';
import type { Sql } from '../lib/db.ts';
import {
  createTestDatabase,
  type TestDatabase,
} from './support/test-database.ts';

const SETUP_INVITE_CODE = 'first-account-setup-code';
const ADMIN = { email: 'erin@example.test', password: 'correct horse battery' };
const FRIEND = { email: 'friend@example.test', password: 'friendly password' };

let testDatabase: TestDatabase;
let sql: Sql;

beforeAll(async () => {
  testDatabase = await createTestDatabase();
  sql = testDatabase.sql;
});

beforeEach(async () => {
  await testDatabase.clearTables();
});

interface ApiCall {
  method?: string;
  body?: unknown;
  sessionCookie?: string;
}

function callApi(
  path: string,
  { method = 'GET', body, sessionCookie }: ApiCall = {},
) {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (sessionCookie) headers.set('cookie', sessionCookie);
  return routeApiRequest(
    new Request(`https://api.example.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { sql, setupInviteCode: SETUP_INVITE_CODE },
  );
}

function readSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('The response set no cookie');
  return setCookie.split(';')[0];
}

async function signUpAdmin() {
  const response = await callApi('/sign-up', {
    method: 'POST',
    body: { ...ADMIN, inviteCode: SETUP_INVITE_CODE },
  });
  return readSessionCookie(response);
}

async function createInviteCode(sessionCookie: string): Promise<string> {
  const response = await callApi('/invites', { method: 'POST', sessionCookie });
  return ((await response.json()) as { code: string }).code;
}

async function signUpFriend(adminCookie: string) {
  const response = await callApi('/sign-up', {
    method: 'POST',
    body: { ...FRIEND, inviteCode: await createInviteCode(adminCookie) },
  });
  return readSessionCookie(response);
}

async function insertActivity(
  id: number,
  name: string,
  userEmail: string | null,
) {
  await sql`
    INSERT INTO activities (id, name, start_date, user_id)
    VALUES (${id}, ${name}, '2026-11-20T08:00:00Z', (SELECT id FROM users WHERE email = ${userEmail}))
  `;
}

async function listActivityNames(sessionCookie: string) {
  const response = await callApi('/activities', { sessionCookie });
  const { activities } = (await response.json()) as {
    activities: Array<{ name: string }>;
  };
  return activities.map(({ name }) => name);
}

describe('the API', () => {
  describe('signing up', () => {
    describe('with the setup invite code', () => {
      describe('when nobody has an account yet', () => {
        it('creates an admin account and signs it in', async () => {
          const response = await callApi('/sign-up', {
            method: 'POST',
            body: { ...ADMIN, inviteCode: SETUP_INVITE_CODE },
          });
          expect(response.status).toBe(201);
          const session = await callApi('/session', {
            sessionCookie: readSessionCookie(response),
          });
          expect(await session.json()).toEqual({
            email: ADMIN.email,
            isAdmin: true,
          });
        });

        it('gives the account the activities synced before there were accounts', async () => {
          await insertActivity(1, 'Morning run', null);
          const adminCookie = await signUpAdmin();
          expect(await listActivityNames(adminCookie)).toEqual(['Morning run']);
        });
      });

      describe('when someone already has an account', () => {
        it('rejects it', async () => {
          await signUpAdmin();
          const response = await callApi('/sign-up', {
            method: 'POST',
            body: { ...FRIEND, inviteCode: SETUP_INVITE_CODE },
          });
          expect(response.status).toBe(403);
        });
      });
    });

    describe('with an invite from the admin', () => {
      it('creates an account that is not an admin', async () => {
        const friendCookie = await signUpFriend(await signUpAdmin());
        const session = await callApi('/session', {
          sessionCookie: friendCookie,
        });
        expect(await session.json()).toEqual({
          email: FRIEND.email,
          isAdmin: false,
        });
      });

      describe('that has already been used', () => {
        it('rejects it', async () => {
          const inviteCode = await createInviteCode(await signUpAdmin());
          await callApi('/sign-up', {
            method: 'POST',
            body: { ...FRIEND, inviteCode },
          });
          const response = await callApi('/sign-up', {
            method: 'POST',
            body: {
              email: 'another@example.test',
              password: 'another password',
              inviteCode,
            },
          });
          expect(response.status).toBe(403);
        });
      });

      describe('for an email that already has an account', () => {
        it('rejects it', async () => {
          const adminCookie = await signUpAdmin();
          const response = await callApi('/sign-up', {
            method: 'POST',
            body: {
              email: ' ERIN@example.test',
              password: 'a different password',
              inviteCode: await createInviteCode(adminCookie),
            },
          });
          expect(response.status).toBe(409);
        });
      });
    });

    describe('with a code nobody issued', () => {
      it('rejects it', async () => {
        await signUpAdmin();
        const response = await callApi('/sign-up', {
          method: 'POST',
          body: { ...FRIEND, inviteCode: 'made-up-code' },
        });
        expect(response.status).toBe(403);
      });
    });
  });

  describe('signing in', () => {
    beforeEach(async () => {
      await signUpAdmin();
    });

    describe('with the right password', () => {
      it('starts a session', async () => {
        const response = await callApi('/sign-in', {
          method: 'POST',
          body: ADMIN,
        });
        expect(response.status).toBe(200);
        const session = await callApi('/session', {
          sessionCookie: readSessionCookie(response),
        });
        expect(session.status).toBe(200);
      });
    });

    describe('with the wrong password', () => {
      it('rejects it', async () => {
        const response = await callApi('/sign-in', {
          method: 'POST',
          body: { ...ADMIN, password: 'wrong password' },
        });
        expect(response.status).toBe(401);
      });
    });

    describe(`after ${MAX_SIGN_IN_FAILURES} wrong passwords`, () => {
      it('rejects even the right password for a while', async () => {
        for (let attempt = 0; attempt < MAX_SIGN_IN_FAILURES; attempt++) {
          await callApi('/sign-in', {
            method: 'POST',
            body: { ...ADMIN, password: 'wrong password' },
          });
        }
        const response = await callApi('/sign-in', {
          method: 'POST',
          body: ADMIN,
        });
        expect(response.status).toBe(429);
      });
    });
  });

  describe('signing out', () => {
    it('ends the session', async () => {
      const adminCookie = await signUpAdmin();
      await callApi('/sign-out', {
        method: 'POST',
        sessionCookie: adminCookie,
      });
      const session = await callApi('/session', { sessionCookie: adminCookie });
      expect(session.status).toBe(401);
    });
  });

  describe('listing activities', () => {
    describe('without a session', () => {
      it('asks the caller to sign in', async () => {
        const response = await callApi('/activities');
        expect(response.status).toBe(401);
      });
    });

    describe('when two people have activities', () => {
      it('shows each person only their own', async () => {
        const adminCookie = await signUpAdmin();
        const friendCookie = await signUpFriend(adminCookie);
        await insertActivity(1, "Erin's run", ADMIN.email);
        await insertActivity(2, "Friend's ride", FRIEND.email);

        expect(await listActivityNames(adminCookie)).toEqual(["Erin's run"]);
        expect(await listActivityNames(friendCookie)).toEqual([
          "Friend's ride",
        ]);
      });
    });
  });

  describe('favourite places', () => {
    describe('when someone else saved a place', () => {
      it("doesn't list it", async () => {
        const adminCookie = await signUpAdmin();
        const friendCookie = await signUpFriend(adminCookie);
        await callApi('/favourite-locations', {
          method: 'POST',
          sessionCookie: adminCookie,
          body: { name: 'Home', lat: -37.81, lng: 144.96 },
        });

        const response = await callApi('/favourite-locations', {
          sessionCookie: friendCookie,
        });
        expect(await response.json()).toEqual([]);
      });

      it("doesn't let them remove it", async () => {
        const adminCookie = await signUpAdmin();
        const friendCookie = await signUpFriend(adminCookie);
        const saved = await callApi('/favourite-locations', {
          method: 'POST',
          sessionCookie: adminCookie,
          body: { name: 'Home', lat: -37.81, lng: 144.96 },
        });
        const { id } = (await saved.json()) as { id: number };

        const response = await callApi(`/favourite-locations/${id}`, {
          method: 'DELETE',
          sessionCookie: friendCookie,
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('creating an invite', () => {
    describe('as someone who is not the admin', () => {
      it('is refused', async () => {
        const friendCookie = await signUpFriend(await signUpAdmin());
        const response = await callApi('/invites', {
          method: 'POST',
          sessionCookie: friendCookie,
        });
        expect(response.status).toBe(403);
      });
    });
  });
});

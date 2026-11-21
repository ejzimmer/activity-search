import type { Sql } from './db.ts';
import { createSecretToken, hashSecretToken } from './secret-tokens.ts';
import type { GarminKeyResponse } from './types.ts';

const SESSION_COOKIE_NAME = 'session';
const SESSION_LIFETIME = Temporal.Duration.from({ days: 30 });

export interface SignedInUser {
  id: number;
  email: string;
  isAdmin: boolean;
  garminKey: GarminKeyResponse | null;
}

/** The API sits behind the site's /api/* proxy, so the browser sees the cookie as the site's own. */
function createSessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/api',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function createSignedOutCookie(): string {
  return createSessionCookie('', 0);
}

export function readSessionToken(request: Request): string | null {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME && valueParts.length)
      return valueParts.join('=') || null;
  }
  return null;
}

/** Returns the Set-Cookie header value for the new session. */
export async function startSession(sql: Sql, userId: number): Promise<string> {
  const token = createSecretToken();
  const lifetimeSeconds = SESSION_LIFETIME.total('seconds');
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashSecretToken(token)}, ${userId}, now() + make_interval(secs => ${lifetimeSeconds}))
  `;
  return createSessionCookie(token, lifetimeSeconds);
}

export async function endSession(sql: Sql, request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (token)
    await sql`DELETE FROM sessions WHERE token_hash = ${hashSecretToken(token)}`;
}

export function selectGarminKeyStatus(sql: Sql) {
  return sql`
    CASE WHEN users.garmin_key_saved_at IS NULL THEN NULL
    ELSE json_build_object(
      'savedAt', users.garmin_key_saved_at,
      'isRejected', users.is_garmin_key_rejected
    ) END AS "garminKey"
  `;
}

export async function findSignedInUser(
  sql: Sql,
  request: Request,
): Promise<SignedInUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const [user] = await sql`
    SELECT users.id, users.email, users.is_admin AS "isAdmin", ${selectGarminKeyStatus(sql)}
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashSecretToken(token)} AND sessions.expires_at > now()
  `;
  return (user as SignedInUser | undefined) ?? null;
}

import { createHash, timingSafeEqual } from 'node:crypto';
import {
  parseSignInRequest,
  parseSignUpRequest,
  type SignUpDetails,
} from './account-requests.ts';
import type { Sql } from './db.ts';
import { hashPassword, isPasswordCorrect } from './passwords.ts';
import { respondWithProblem } from './problem-response.ts';
import { hashSecretToken } from './secret-tokens.ts';
import {
  createSignedOutCookie,
  endSession,
  selectGarminKeyStatus,
  startSession,
  type SignedInUser,
} from './sessions.ts';
import type { SignedInUserResponse } from './types.ts';

export const MAX_SIGN_IN_FAILURES = 5;
const SIGN_IN_LOCKOUT_MINUTES = 15;

/** Checked against when the email has no account, so a wrong email takes as long to reject as a wrong password. */
const PASSWORD_HASH_FOR_TIMING_ONLY =
  'scrypt$32768$8$1$01tMvslJYoHpLfofOfCdXQ==$gfGizqkwLPlQEBj6xFRqAfDhw3OH0d+ssQYf84hoHwY=';

const INVALID_INVITE_PROBLEM =
  "That invite isn't valid. It may have been used already or have expired.";

interface AccountProblem {
  status: number;
  problem: string;
}

export function describeSignedInUser({
  email,
  isAdmin,
  garminKey,
}: SignedInUser): SignedInUserResponse {
  return { email, isAdmin, garminKey };
}

async function respondWithNewSession(
  sql: Sql,
  user: SignedInUser,
  status: number,
): Promise<Response> {
  const cookie = await startSession(sql, user.id);
  return Response.json(describeSignedInUser(user), {
    status,
    headers: { 'set-cookie': cookie },
  });
}

function isSetupInviteCode(inviteCode: string, setupInviteCode?: string) {
  if (!setupInviteCode) return false;
  const hashCode = (code: string) => createHash('sha256').update(code).digest();
  return timingSafeEqual(hashCode(inviteCode), hashCode(setupInviteCode));
}

/** The first account becomes the admin and takes over everything synced before there were accounts. */
async function createFirstUser(
  sql: Sql,
  email: string,
  passwordHash: string,
): Promise<SignedInUser | AccountProblem> {
  const [user] = await sql`
    WITH new_user AS (
      INSERT INTO users (email, password_hash, is_admin)
      SELECT ${email}, ${passwordHash}, true
      WHERE NOT EXISTS (SELECT 1 FROM users)
      RETURNING id, email, is_admin
    ), claimed_activities AS (
      UPDATE activities SET user_id = new_user.id
      FROM new_user WHERE activities.user_id IS NULL
    ), claimed_favourites AS (
      UPDATE favourite_locations SET user_id = new_user.id
      FROM new_user WHERE favourite_locations.user_id IS NULL
    )
    SELECT id, email, is_admin AS "isAdmin", NULL AS "garminKey" FROM new_user
  `;
  return (
    (user as SignedInUser | undefined) ?? {
      status: 403,
      problem: INVALID_INVITE_PROBLEM,
    }
  );
}

async function createInvitedUser(
  sql: Sql,
  { email, inviteCode }: SignUpDetails,
  passwordHash: string,
): Promise<SignedInUser | AccountProblem> {
  const codeHash = hashSecretToken(inviteCode);
  const [invite] = await sql`
    SELECT 1 FROM invites
    WHERE code_hash = ${codeHash} AND used_at IS NULL AND expires_at > now()
  `;
  if (!invite) return { status: 403, problem: INVALID_INVITE_PROBLEM };
  const [existingUser] = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (existingUser)
    return {
      status: 409,
      problem: 'There is already an account for that email.',
    };

  const [user] = await sql`
    WITH new_user AS (
      INSERT INTO users (email, password_hash)
      SELECT ${email}, ${passwordHash}
      WHERE EXISTS (
        SELECT 1 FROM invites
        WHERE code_hash = ${codeHash} AND used_at IS NULL AND expires_at > now()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, is_admin
    )
    UPDATE invites SET used_by = new_user.id, used_at = now()
    FROM new_user
    WHERE invites.code_hash = ${codeHash} AND invites.used_at IS NULL
    RETURNING new_user.id, new_user.email, new_user.is_admin AS "isAdmin", NULL AS "garminKey"
  `;
  return (
    (user as SignedInUser | undefined) ?? {
      status: 403,
      problem: INVALID_INVITE_PROBLEM,
    }
  );
}

export async function signUp(
  sql: Sql,
  request: Request,
  setupInviteCode?: string,
): Promise<Response> {
  const details = parseSignUpRequest(await request.json().catch(() => null));
  if ('problem' in details) return respondWithProblem(400, details.problem);

  const passwordHash = await hashPassword(details.password);
  const userOrProblem = isSetupInviteCode(details.inviteCode, setupInviteCode)
    ? await createFirstUser(sql, details.email, passwordHash)
    : await createInvitedUser(sql, details, passwordHash);
  if ('problem' in userOrProblem)
    return respondWithProblem(userOrProblem.status, userOrProblem.problem);
  return respondWithNewSession(sql, userOrProblem, 201);
}

async function countRecentSignInFailures(sql: Sql, email: string) {
  const [{ failures }] = await sql`
    SELECT count(*)::int AS failures FROM sign_in_failures
    WHERE email = ${email}
      AND failed_at > now() - make_interval(mins => ${SIGN_IN_LOCKOUT_MINUTES})
  `;
  return failures as number;
}

async function recordSignInFailure(sql: Sql, email: string) {
  await sql`DELETE FROM sign_in_failures WHERE failed_at < now() - interval '1 day'`;
  await sql`INSERT INTO sign_in_failures (email) VALUES (${email})`;
}

export async function signIn(sql: Sql, request: Request): Promise<Response> {
  const details = parseSignInRequest(await request.json().catch(() => null));
  if ('problem' in details) return respondWithProblem(400, details.problem);

  if (
    (await countRecentSignInFailures(sql, details.email)) >=
    MAX_SIGN_IN_FAILURES
  ) {
    return respondWithProblem(
      429,
      `Too many attempts. Try again in ${SIGN_IN_LOCKOUT_MINUTES} minutes.`,
    );
  }

  const [account] = (await sql`
    SELECT users.id, users.email, users.is_admin AS "isAdmin",
           users.password_hash AS "passwordHash", ${selectGarminKeyStatus(sql)}
    FROM users WHERE email = ${details.email}
  `) as Array<SignedInUser & { passwordHash: string }>;
  const isCorrect = await isPasswordCorrect(
    details.password,
    account?.passwordHash ?? PASSWORD_HASH_FOR_TIMING_ONLY,
  );
  if (!account || !isCorrect) {
    await recordSignInFailure(sql, details.email);
    return respondWithProblem(401, "That email and password don't match.");
  }

  await sql`DELETE FROM sign_in_failures WHERE email = ${details.email}`;
  const { passwordHash: _passwordHash, ...user } = account;
  return respondWithNewSession(sql, user, 200);
}

export async function signOut(sql: Sql, request: Request): Promise<Response> {
  await endSession(sql, request);
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': createSignedOutCookie() },
  });
}

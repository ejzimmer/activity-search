import {
  parsePasswordResetLinkRequest,
  parsePasswordResetRequest,
} from './account-requests.ts';
import { isSetupInviteCode, respondWithNewSession } from './accounts.ts';
import type { Sql } from './db.ts';
import { hashPassword } from './passwords.ts';
import { respondWithProblem } from './problem-response.ts';
import { createSecretToken, hashSecretToken } from './secret-tokens.ts';
import { selectGarminKeyStatus, type SignedInUser } from './sessions.ts';
import type { PasswordResetLinkResponse } from './types.ts';

const RESET_LIFETIME_DAYS = 3;
export const MAX_RESET_FAILURES = 10;
const RESET_LOCKOUT_MINUTES = 15;

const INVALID_RESET_PROBLEM =
  "That reset link isn't valid. It may have been used already or have expired.";

export async function createPasswordResetLink(
  sql: Sql,
  request: Request,
  user: SignedInUser,
): Promise<Response> {
  if (!user.isAdmin)
    return respondWithProblem(403, 'Only the admin can reset passwords.');
  const details = parsePasswordResetLinkRequest(
    await request.json().catch(() => null),
  );
  if ('problem' in details) return respondWithProblem(400, details.problem);

  const code = createSecretToken();
  const [reset] = await sql`
    INSERT INTO password_resets (code_hash, user_id, expires_at)
    SELECT ${hashSecretToken(code)}, id, now() + make_interval(days => ${RESET_LIFETIME_DAYS})
    FROM users WHERE email = ${details.email}
    RETURNING expires_at AS "expiresAt"
  `;
  if (!reset)
    return respondWithProblem(404, 'There is no account for that email.');
  const body: PasswordResetLinkResponse = {
    code,
    expiresAt: reset.expiresAt as string,
  };
  return Response.json(body, { status: 201 });
}

async function claimResetCode(
  sql: Sql,
  resetCode: string,
  setupInviteCode?: string,
): Promise<number | null> {
  if (isSetupInviteCode(resetCode, setupInviteCode)) {
    const [admin] = await sql`SELECT id FROM users WHERE is_admin`;
    return (admin?.id as number | undefined) ?? null;
  }
  const [reset] = await sql`
    UPDATE password_resets SET used_at = now()
    WHERE code_hash = ${hashSecretToken(resetCode)}
      AND used_at IS NULL AND expires_at > now()
    RETURNING user_id AS "userId"
  `;
  return (reset?.userId as number | undefined) ?? null;
}

/** Counted across all accounts, because the setup invite code works for the admin's account without an email. */
async function countRecentResetFailures(sql: Sql): Promise<number> {
  await sql`DELETE FROM password_reset_failures WHERE failed_at < now() - interval '1 day'`;
  const [{ failures }] = await sql`
    SELECT count(*)::int AS failures FROM password_reset_failures
    WHERE failed_at > now() - make_interval(mins => ${RESET_LOCKOUT_MINUTES})
  `;
  return failures as number;
}

/** The admin can use the setup invite code as a reset code, since nobody else can make them a link. */
export async function resetPassword(
  sql: Sql,
  request: Request,
  setupInviteCode?: string,
): Promise<Response> {
  const details = parsePasswordResetRequest(
    await request.json().catch(() => null),
  );
  if ('problem' in details) return respondWithProblem(400, details.problem);

  if ((await countRecentResetFailures(sql)) >= MAX_RESET_FAILURES)
    return respondWithProblem(
      429,
      `Too many attempts. Try again in ${RESET_LOCKOUT_MINUTES} minutes.`,
    );
  const userId = await claimResetCode(sql, details.resetCode, setupInviteCode);
  if (userId === null) {
    await sql`INSERT INTO password_reset_failures DEFAULT VALUES`;
    return respondWithProblem(403, INVALID_RESET_PROBLEM);
  }

  const passwordHash = await hashPassword(details.password);
  const [user] = (await sql`
    UPDATE users SET password_hash = ${passwordHash}
    WHERE id = ${userId}
    RETURNING users.id, users.email, users.is_admin AS "isAdmin", ${selectGarminKeyStatus(sql)}
  `) as SignedInUser[];
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
  await sql`DELETE FROM sign_in_failures WHERE email = ${user.email}`;
  return respondWithNewSession(sql, user, 200);
}

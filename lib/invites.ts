import type { Sql } from './db.ts';
import { respondWithProblem } from './problem-response.ts';
import { createSecretToken, hashSecretToken } from './secret-tokens.ts';
import type { SignedInUser } from './sessions.ts';
import type { InviteResponse } from './types.ts';

const INVITE_LIFETIME_DAYS = 7;

export async function createInvite(
  sql: Sql,
  user: SignedInUser,
): Promise<Response> {
  if (!user.isAdmin)
    return respondWithProblem(403, 'Only the admin can invite people.');
  const code = createSecretToken();
  const [{ expiresAt }] = await sql`
    INSERT INTO invites (code_hash, created_by, expires_at)
    VALUES (${hashSecretToken(code)}, ${user.id}, now() + make_interval(days => ${INVITE_LIFETIME_DAYS}))
    RETURNING expires_at AS "expiresAt"
  `;
  const body: InviteResponse = { code, expiresAt: expiresAt as string };
  return Response.json(body, { status: 201 });
}

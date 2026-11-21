import './PasswordResetPanel.css';
import { useState, type FormEvent } from 'react';
import type {
  PasswordResetLinkResponse,
  ProblemResponse,
} from '../lib/types.ts';
import { formatDate } from './format.ts';

type PasswordResetLink = { link: string; expiresAt: Temporal.Instant };

async function requestPasswordResetLink(
  email: string,
): Promise<PasswordResetLink> {
  const response = await fetch('/api/password-reset-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = (await response.json().catch(() => null)) as
    PasswordResetLinkResponse | ProblemResponse | null;
  if (!response.ok || !body || 'problem' in body)
    throw new Error(
      body && 'problem' in body
        ? body.problem
        : `The API returned ${response.status}`,
    );
  const link = new URL('/', window.location.origin);
  link.searchParams.set('reset', body.code);
  return {
    link: link.toString(),
    expiresAt: Temporal.Instant.from(body.expiresAt),
  };
}

export function PasswordResetPanel() {
  const [resetLink, setResetLink] = useState<PasswordResetLink | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const createResetLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email'));
    try {
      setResetLink(await requestPasswordResetLink(email));
      setProblem(null);
    } catch (error) {
      setResetLink(null);
      setProblem((error as Error).message);
    }
  };

  return (
    <div className="password-reset-panel">
      <form onSubmit={createResetLink}>
        <label>
          Email of someone who forgot their password
          <input name="email" type="email" autoComplete="off" required />
        </label>
        <button type="submit">Make reset link</button>
      </form>
      {resetLink && (
        <label>
          Send this link to them. It works once, until{' '}
          {formatDate(resetLink.expiresAt)}.
          <input
            readOnly
            value={resetLink.link}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
      {problem && (
        <p role="alert" className="problem">
          {problem}
        </p>
      )}
    </div>
  );
}

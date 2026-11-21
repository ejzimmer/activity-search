import './InvitePanel.css';
import { useState } from 'react';
import type { InviteResponse } from '../lib/types.ts';
import { formatDate } from './format.ts';

type Invite = { link: string; expiresAt: Temporal.Instant };

async function requestInvite(): Promise<Invite> {
  const response = await fetch('/api/invites', { method: 'POST' });
  if (!response.ok) throw new Error(`The API returned ${response.status}`);
  const { code, expiresAt } = (await response.json()) as InviteResponse;
  const link = new URL('/', window.location.origin);
  link.searchParams.set('invite', code);
  return { link: link.toString(), expiresAt: Temporal.Instant.from(expiresAt) };
}

export function InvitePanel() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const createInvite = async () => {
    try {
      setInvite(await requestInvite());
      setProblem(null);
    } catch (error) {
      setProblem(`Couldn't create an invite: ${(error as Error).message}`);
    }
  };

  return (
    <div className="invite-panel">
      <button type="button" onClick={createInvite}>
        {invite ? 'Create another invite' : 'Invite someone'}
      </button>
      {invite && (
        <label>
          Send this link to one person. It works once, until{' '}
          {formatDate(invite.expiresAt)}.
          <input
            readOnly
            value={invite.link}
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

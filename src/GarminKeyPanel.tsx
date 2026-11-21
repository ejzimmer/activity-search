import './GarminKeyPanel.css';
import { useState, type FormEvent } from 'react';
import type { GarminKeyResponse, ProblemResponse } from '../lib/types.ts';
import { formatDate } from './format.ts';
import {
  parseGarminKeyStatus,
  type GarminKeyStatus,
} from './parseSignedInUser.ts';

const GARMIN_KEY_PAGE =
  'https://connect.garmin.com/app/settings/personalApiToken';

type GarminKeyPanelProps = {
  garminKey: GarminKeyStatus | null;
  onGarminKeyChange: (garminKey: GarminKeyStatus | null) => void;
};

async function requestSaveGarminKey(
  garminKey: string,
): Promise<GarminKeyStatus> {
  const response = await fetch('/api/garmin-key', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ garminKey }),
  });
  const body = (await response.json().catch(() => null)) as
    GarminKeyResponse | ProblemResponse | null;
  if (!response.ok || !body || 'problem' in body)
    throw new Error(
      body && 'problem' in body
        ? body.problem
        : `The API returned ${response.status}`,
    );
  return parseGarminKeyStatus(body)!;
}

async function requestRemoveGarminKey(): Promise<void> {
  const response = await fetch('/api/garmin-key', { method: 'DELETE' });
  if (!response.ok) throw new Error(`The API returned ${response.status}`);
}

export function GarminKeyPanel({
  garminKey,
  onGarminKeyChange,
}: GarminKeyPanelProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wasJustSaved, setWasJustSaved] = useState(false);

  const saveGarminKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSaving(true);
    try {
      const garminKeyField = new FormData(form).get('garminKey');
      onGarminKeyChange(await requestSaveGarminKey(String(garminKeyField)));
      form.reset();
      setProblem(null);
      setWasJustSaved(true);
    } catch (error) {
      setProblem((error as Error).message);
    }
    setIsSaving(false);
  };

  const removeGarminKey = async () => {
    try {
      await requestRemoveGarminKey();
      onGarminKeyChange(null);
      setProblem(null);
      setWasJustSaved(false);
    } catch (error) {
      setProblem(`Couldn't remove the key: ${(error as Error).message}`);
    }
  };

  return (
    <section className="garmin-key-panel" aria-label="Garmin key">
      {garminKey?.isRejected && (
        <p role="alert" className="problem">
          Garmin rejected your key. It has probably expired, so add a new one.
        </p>
      )}
      {garminKey && !garminKey.isRejected && (
        <p>
          {wasJustSaved
            ? 'Saved. Your activities are syncing now.'
            : `Your Garmin key was saved ${formatDate(garminKey.savedAt)}.`}
        </p>
      )}
      <form onSubmit={saveGarminKey}>
        <label>
          {garminKey ? 'New Garmin key' : 'Garmin key'}
          <input
            name="garminKey"
            type="password"
            autoComplete="off"
            required
            aria-describedby="garmin-key-help"
          />
        </label>
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Checking with Garmin…' : 'Save key'}
        </button>
      </form>
      <p id="garmin-key-help" className="help">
        Create a key in{' '}
        <a href={GARMIN_KEY_PAGE} target="_blank" rel="noreferrer">
          Garmin Connect
        </a>{' '}
        and paste it here. It's stored encrypted and never shown again.
      </p>
      {problem && (
        <p role="alert" className="problem">
          {problem}
        </p>
      )}
      {garminKey && (
        <button type="button" className="remove" onClick={removeGarminKey}>
          Remove key
        </button>
      )}
    </section>
  );
}

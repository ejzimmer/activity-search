import './SyncNote.css';
import type { SyncStatus } from './types.ts';
import { formatDate } from './format.ts';

type SyncNoteProps = {
  sync: SyncStatus | null;
  problem: string | null;
  onSyncNow: () => void;
};

function describeSync(sync: SyncStatus | null): string | null {
  if (sync?.running) return 'Syncing with Garmin…';
  if (!sync?.last_finished_at) return null;
  return (
    `Last synced with Garmin ${formatDate(sync.last_finished_at)}` +
    (sync.last_result ? `: ${sync.last_result}` : '')
  );
}

export function SyncNote({ sync, problem, onSyncNow }: SyncNoteProps) {
  return (
    <div className="sync-note">
      <p>{describeSync(sync)}</p>
      <button type="button" onClick={onSyncNow} disabled={sync?.running}>
        Sync now
      </button>
      {problem && (
        <p role="alert" className="problem">
          {problem}
        </p>
      )}
    </div>
  );
}

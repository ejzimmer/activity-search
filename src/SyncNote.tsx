import type { SyncStatus } from '../lib/types.ts';
import { formatDate } from './format.ts';

type SyncNoteProps = {
  sync: SyncStatus;
};

export function SyncNote({ sync }: SyncNoteProps) {
  if (sync.running) return <p className="sync-note">Syncing with Garmin…</p>;
  if (!sync.last_finished_at) return null;
  return (
    <p className="sync-note">
      Last synced with Garmin {formatDate(sync.last_finished_at)}
      {sync.last_result ? `: ${sync.last_result}` : ''}
    </p>
  );
}

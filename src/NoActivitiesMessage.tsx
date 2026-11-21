type NoActivitiesMessageProps = {
  isFiltered: boolean;
  isSyncRunning: boolean;
  hasGarminKey: boolean;
};

export function NoActivitiesMessage({
  isFiltered,
  isSyncRunning,
  hasGarminKey,
}: NoActivitiesMessageProps) {
  if (isFiltered) return <p>No matching activities.</p>;
  if (!hasGarminKey)
    return <p>No activities yet. Add your Garmin key to load them.</p>;
  return (
    <p>
      No activities yet.{' '}
      {isSyncRunning
        ? 'The first sync from Garmin is running now, and they will appear as it goes.'
        : 'Use Sync now to load them from Garmin.'}
    </p>
  );
}

type NoActivitiesMessageProps = {
  isFiltered: boolean;
  isSyncRunning: boolean;
};

export function NoActivitiesMessage({
  isFiltered,
  isSyncRunning,
}: NoActivitiesMessageProps) {
  if (isFiltered) return <p>No matching activities.</p>;
  return (
    <p>
      No activities yet.{' '}
      {isSyncRunning
        ? 'The first sync from Garmin is running now. Reload in a few minutes.'
        : "They'll appear after the first sync from Garmin, which runs once a day."}
    </p>
  );
}

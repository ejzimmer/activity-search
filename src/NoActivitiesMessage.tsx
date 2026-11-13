type NoActivitiesMessageProps = {
  isSyncRunning: boolean;
};

export function NoActivitiesMessage({
  isSyncRunning,
}: NoActivitiesMessageProps) {
  return (
    <p>
      No activities yet.{' '}
      {isSyncRunning
        ? 'The first sync from Garmin is running now. Reload in a few minutes.'
        : "They'll appear after the first sync from Garmin, which runs every hour."}
    </p>
  );
}

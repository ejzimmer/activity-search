export function formatDistance(metres: number | null): string {
  if (metres === null) return '–';
  return `${(metres / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '–';
  return Temporal.Duration.from({ seconds })
    .round({ largestUnit: 'hours' })
    .toLocaleString(undefined, { style: 'digital', hoursDisplay: 'auto' });
}

export function formatElevation(metres: number | null): string {
  if (metres === null) return '–';
  return `${Math.round(metres)} m`;
}

export function formatDate(instant: Temporal.Instant): string {
  return instant.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Garmin type keys look like "trail_running"; show them as "Trail running". */
export function formatSportType(typeKey: string | null): string {
  if (!typeKey) return '–';
  const words = typeKey.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

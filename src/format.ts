export function formatDistance(metres: number | null): string {
  if (metres === null) return '–';
  return `${(metres / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatElevation(metres: number | null): string {
  if (metres === null) return '–';
  return `${Math.round(metres)} m`;
}

export function formatDate(iso: string): string {
  return Temporal.Instant.from(iso).toLocaleString(undefined, {
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

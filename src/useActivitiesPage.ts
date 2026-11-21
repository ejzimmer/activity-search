import { useEffect, useRef, useState } from 'react';
import type { ActivitiesPageResponse } from '../lib/types.ts';
import { createApiSearchParams, type ActivityQuery } from './activityQuery.ts';
import { parseActivitiesPage } from './parseActivitiesPage.ts';
import type { ActivitiesPage } from './types.ts';

type ActivitiesPageState =
  | { status: 'loading'; data?: ActivitiesPage }
  | { status: 'ready'; data: ActivitiesPage }
  | { status: 'error'; message: string; data?: ActivitiesPage };

const TYPING_PAUSE_MS = 300;
const SYNC_POLL_INTERVAL_MS = 10_000;
const SYNC_START_WAIT = Temporal.Duration.from({ minutes: 1 });

export function useActivitiesPage(query: ActivityQuery) {
  const apiSearch = createApiSearchParams(query).toString();
  const [state, setState] = useState<ActivitiesPageState>({
    status: 'loading',
  });
  const [reloadCount, setReloadCount] = useState(0);
  const loadedApiSearch = useRef<string | null>(null);
  const [syncExpectedUntil, setSyncExpectedUntil] =
    useState<Temporal.Instant | null>(null);
  const reloadActivitiesPage = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    const controller = new AbortController();
    if (loadedApiSearch.current !== apiSearch)
      setState((previous) => ({ status: 'loading', data: previous.data }));
    loadedApiSearch.current = apiSearch;
    const fetchActivitiesPage = () =>
      fetch(`/api/activities?${apiSearch}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(`The API returned ${response.status}`);
          return parseActivitiesPage(
            (await response.json()) as ActivitiesPageResponse,
          );
        })
        .then((data) => setState({ status: 'ready', data }))
        .catch((error: Error) => {
          if (error.name === 'AbortError') return;
          setState((previous) => ({
            status: 'error',
            message: error.message,
            data: previous.data,
          }));
        });
    const timeout = setTimeout(fetchActivitiesPage, TYPING_PAUSE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [apiSearch, reloadCount]);

  // A requested sync takes a moment to start, so polling begins before the
  // API reports it as running.
  const isSyncRunning = state.data?.sync?.running ?? false;
  useEffect(() => {
    const isWaitingForSyncToStart =
      syncExpectedUntil !== null &&
      Temporal.Instant.compare(Temporal.Now.instant(), syncExpectedUntil) < 0;
    if (!isSyncRunning && !isWaitingForSyncToStart) return;
    const timeout = setTimeout(reloadActivitiesPage, SYNC_POLL_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [state, isSyncRunning, syncExpectedUntil]);

  const expectSyncToStart = () => {
    setSyncExpectedUntil(Temporal.Now.instant().add(SYNC_START_WAIT));
    reloadActivitiesPage();
  };

  return { state, expectSyncToStart };
}

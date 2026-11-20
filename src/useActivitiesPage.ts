import { useEffect, useState } from 'react';
import type { ActivitiesPageResponse } from '../lib/types.ts';
import { createApiSearchParams, type ActivityQuery } from './activityQuery.ts';
import { parseActivitiesPage } from './parseActivitiesPage.ts';
import type { ActivitiesPage } from './types.ts';

type ActivitiesPageState =
  | { status: 'loading'; data?: ActivitiesPage }
  | { status: 'ready'; data: ActivitiesPage }
  | { status: 'error'; message: string; data?: ActivitiesPage };

const TYPING_PAUSE_MS = 300;

export function useActivitiesPage(query: ActivityQuery): ActivitiesPageState {
  const apiSearch = createApiSearchParams(query).toString();
  const [state, setState] = useState<ActivitiesPageState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ status: 'loading', data: previous.data }));
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
  }, [apiSearch]);

  return state;
}

import { useEffect, useState } from 'react';
import type { ActivitiesPage } from '../lib/types.ts';

type ActivitiesPageState =
  | { status: 'loading'; data?: ActivitiesPage }
  | { status: 'ready'; data: ActivitiesPage }
  | { status: 'error'; message: string; data?: ActivitiesPage };

export function useActivitiesPage(page: number): ActivitiesPageState {
  const [state, setState] = useState<ActivitiesPageState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ status: 'loading', data: previous.data }));
    fetch(`/api/activities?page=${page}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`The API returned ${response.status}`);
        return (await response.json()) as ActivitiesPage;
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
    return () => controller.abort();
  }, [page]);

  return state;
}

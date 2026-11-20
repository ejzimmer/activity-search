import { useEffect, useState } from 'react';
import {
  readActivityQuery,
  writeActivityQuery,
  type ActivityQuery,
  type FilterValues,
} from './activityQuery.ts';

function readActivityQueryFromUrl() {
  return readActivityQuery(new URLSearchParams(window.location.search));
}

export function useActivityQuery() {
  const [query, setQuery] = useState(readActivityQueryFromUrl);

  useEffect(() => {
    const handlePopState = () => setQuery(readActivityQueryFromUrl());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateQuery = (
    nextQuery: ActivityQuery,
    method: 'pushState' | 'replaceState',
  ) => {
    const url = new URL(window.location.href);
    writeActivityQuery(url, nextQuery);
    window.history[method](null, '', url);
    setQuery(nextQuery);
  };

  const goToPage = (page: number) =>
    updateQuery({ ...query, page }, 'pushState');

  // Filters change on every keystroke, so they replace the history entry
  // rather than adding one per character.
  const changeFilters = (filters: FilterValues) =>
    updateQuery({ page: 1, filters }, 'replaceState');

  return { query, goToPage, changeFilters };
}

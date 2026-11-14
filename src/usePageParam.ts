import { useEffect, useState } from 'react';

function readPageFromUrl(): number {
  const page = Number(new URLSearchParams(window.location.search).get('page'));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function usePageParam(): [number, (page: number) => void] {
  const [page, setPage] = useState(readPageFromUrl);

  useEffect(() => {
    const handlePopState = () => setPage(readPageFromUrl());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goToPage = (nextPage: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(nextPage));
    window.history.pushState(null, '', url);
    setPage(nextPage);
  };

  return [page, goToPage];
}

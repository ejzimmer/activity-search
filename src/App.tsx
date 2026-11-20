import './App.css';
import { useState } from 'react';
import { ActivitiesMap } from './ActivitiesMap.tsx';
import { ActivitiesTable } from './ActivitiesTable.tsx';
import { hasActiveFilters } from './activityQuery.ts';
import { ActivityFilters } from './ActivityFilters.tsx';
import { NoActivitiesMessage } from './NoActivitiesMessage.tsx';
import { PaginationNav } from './PaginationNav.tsx';
import { SyncNote } from './SyncNote.tsx';
import { useActivitiesPage } from './useActivitiesPage.ts';
import { useActivityQuery } from './useActivityQuery.ts';

export function App() {
  const { query, goToPage, changeFilters } = useActivityQuery();
  const state = useActivitiesPage(query);
  const { data } = state;
  const isLoading = state.status === 'loading';
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const toggleSelectedActivity = (activityId: string) =>
    setSelectedActivityId((currentId) =>
      currentId === activityId ? null : activityId,
    );

  return (
    <main>
      <h1>Activities</h1>

      {state.status === 'error' && (
        <p role="alert" className="error">
          Couldn't load activities: {state.message}
        </p>
      )}

      {data && (
        <ActivitiesMap
          activities={data.activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={toggleSelectedActivity}
        />
      )}

      <ActivityFilters
        filters={query.filters}
        sportTypeOptions={data?.sportTypes ?? []}
        onChange={changeFilters}
      />

      {data?.total === 0 ? (
        <NoActivitiesMessage
          isFiltered={hasActiveFilters(query)}
          isSyncRunning={data.sync?.running ?? false}
        />
      ) : (
        <ActivitiesTable
          activities={data?.activities ?? []}
          isLoading={isLoading}
          selectedActivityId={selectedActivityId}
          onSelectActivity={toggleSelectedActivity}
        />
      )}

      <PaginationNav
        page={query.page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total}
        isLoading={isLoading}
        onPageChange={goToPage}
      />

      {data?.sync && <SyncNote sync={data.sync} />}
    </main>
  );
}

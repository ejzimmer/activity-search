import './App.css';
import { useState } from 'react';
import { ActivitiesMap } from './ActivitiesMap.tsx';
import { ActivitiesTable } from './ActivitiesTable.tsx';
import { NoActivitiesMessage } from './NoActivitiesMessage.tsx';
import { PaginationNav } from './PaginationNav.tsx';
import { SyncNote } from './SyncNote.tsx';
import { useActivitiesPage } from './useActivitiesPage.ts';
import { usePageParam } from './usePageParam.ts';

export function App() {
  const [page, goToPage] = usePageParam();
  const state = useActivitiesPage(page);
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

      {data?.total === 0 ? (
        <NoActivitiesMessage isSyncRunning={data.sync?.running ?? false} />
      ) : (
        <ActivitiesTable
          activities={data?.activities ?? []}
          isLoading={isLoading}
          selectedActivityId={selectedActivityId}
          onSelectActivity={toggleSelectedActivity}
        />
      )}

      <PaginationNav
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total}
        isLoading={isLoading}
        onPageChange={goToPage}
      />

      {data?.sync && <SyncNote sync={data.sync} />}
    </main>
  );
}

import './ActivitiesPage.css';
import { useEffect, useRef, useState } from 'react';
import { ActivitiesMap } from './ActivitiesMap.tsx';
import { ActivitiesTable } from './ActivitiesTable.tsx';
import {
  createNearFilterValues,
  hasActiveFilters,
  readNearPoint,
} from './activityQuery.ts';
import { ActivityFilters } from './ActivityFilters.tsx';
import { NoActivitiesMessage } from './NoActivitiesMessage.tsx';
import type { GarminKeyStatus } from './parseSignedInUser.ts';
import { PaginationNav } from './PaginationNav.tsx';
import { SyncNote } from './SyncNote.tsx';
import { useActivitiesPage } from './useActivitiesPage.ts';
import { useActivityQuery } from './useActivityQuery.ts';
import { useFavouriteLocations } from './useFavouriteLocations.ts';

type ActivitiesPageProps = {
  garminKey: GarminKeyStatus | null;
};

async function requestSyncNow() {
  const response = await fetch('/api/sync-now', { method: 'POST' });
  if (!response.ok) throw new Error(`The API returned ${response.status}`);
}

export function ActivitiesPage({ garminKey }: ActivitiesPageProps) {
  const { query, goToPage, changeFilters } = useActivityQuery();
  const { state, expectSyncToStart } = useActivitiesPage(query);
  const [syncProblem, setSyncProblem] = useState<string | null>(null);
  const garminKeySavedAt = garminKey?.savedAt ?? null;
  const previousGarminKeySavedAt = useRef(garminKeySavedAt);

  useEffect(() => {
    if (
      garminKeySavedAt &&
      garminKeySavedAt !== previousGarminKeySavedAt.current
    )
      expectSyncToStart();
    previousGarminKeySavedAt.current = garminKeySavedAt;
  }, [garminKeySavedAt]);

  const syncNow = async () => {
    try {
      await requestSyncNow();
      setSyncProblem(null);
      expectSyncToStart();
    } catch (error) {
      setSyncProblem(`Couldn't start a sync: ${(error as Error).message}`);
    }
  };
  const { data } = state;
  const { favourites, errorMessage, addFavourite, removeFavourite } =
    useFavouriteLocations();
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
          nearPoint={readNearPoint(query.filters)}
          onPickPoint={(point) =>
            changeFilters({
              ...query.filters,
              ...createNearFilterValues(point),
            })
          }
        />
      )}

      <ActivityFilters
        filters={query.filters}
        sportTypeOptions={data?.sportTypes ?? []}
        onChange={changeFilters}
        favourites={favourites}
        onAddFavourite={addFavourite}
        onRemoveFavourite={removeFavourite}
      />

      {errorMessage && (
        <p role="alert" className="error">
          {errorMessage}
        </p>
      )}

      {data?.total === 0 ? (
        <NoActivitiesMessage
          isFiltered={hasActiveFilters(query)}
          isSyncRunning={data.sync?.running ?? false}
          hasGarminKey={garminKey !== null}
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

      {garminKey && (
        <SyncNote
          sync={data?.sync ?? null}
          problem={syncProblem}
          onSyncNow={syncNow}
        />
      )}
    </main>
  );
}

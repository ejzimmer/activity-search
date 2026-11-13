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

  return (
    <main>
      <h1>Activities</h1>

      {state.status === 'error' && (
        <p role="alert" className="error">
          Couldn't load activities: {state.message}
        </p>
      )}

      {data?.total === 0 ? (
        <NoActivitiesMessage isSyncRunning={data.sync?.running ?? false} />
      ) : (
        <ActivitiesTable
          activities={data?.activities ?? []}
          isLoading={isLoading}
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

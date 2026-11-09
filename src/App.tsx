import { useEffect, useState } from 'react'
import type { ActivitiesPage } from '../lib/types.ts'
import { formatDate, formatDistance, formatDuration, formatElevation, formatSportType } from './format.ts'

function pageFromUrl(): number {
  const n = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

type State =
  | { status: 'loading'; data?: ActivitiesPage }
  | { status: 'ready'; data: ActivitiesPage }
  | { status: 'error'; message: string; data?: ActivitiesPage }

export function App() {
  const [page, setPage] = useState(pageFromUrl)
  const [state, setState] = useState<State>({ status: 'loading' })

  // Keep the page in the URL so reload and the back button work.
  useEffect(() => {
    const onPop = () => setPage(pageFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ status: 'loading', data: s.data }))
    fetch(`/api/activities?page=${page}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`The API returned ${res.status}`)
        return (await res.json()) as ActivitiesPage
      })
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setState((s) => ({ status: 'error', message: err.message, data: s.data }))
      })
    return () => controller.abort()
  }, [page])

  const goTo = (next: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', String(next))
    window.history.pushState(null, '', url)
    setPage(next)
  }

  const data = state.data
  const totalPages = data?.totalPages ?? 1
  const loading = state.status === 'loading'

  return (
    <main>
      <h1>Activities</h1>

      {state.status === 'error' && (
        <p role="alert" className="error">
          Couldn't load activities: {state.message}
        </p>
      )}

      {data && data.total === 0 ? (
        <p>No activities yet. Run <code>npm run sync</code> to load them from Garmin Connect.</p>
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table>
            <caption className="visually-hidden">Your activities, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">Distance</th>
                <th scope="col" className="num">Moving time</th>
                <th scope="col" className="num">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {data?.activities.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.start_date)}</td>
                  <th scope="row">{a.name}</th>
                  <td>{formatSportType(a.sport_type)}</td>
                  <td className="num">{formatDistance(a.distance_m)}</td>
                  <td className="num">{formatDuration(a.moving_time_s)}</td>
                  <td className="num">{formatElevation(a.elevation_gain_m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pagination" className="pagination">
        <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1 || loading}>
          Previous
        </button>
        <p aria-live="polite">
          {data ? `Page ${page} of ${totalPages} · ${data.total} activities` : 'Loading…'}
        </p>
        <button type="button" onClick={() => goTo(page + 1)} disabled={page >= totalPages || loading}>
          Next
        </button>
      </nav>
    </main>
  )
}

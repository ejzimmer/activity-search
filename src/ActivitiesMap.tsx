import 'leaflet/dist/leaflet.css';
import './ActivitiesMap.css';
import { useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { FitMapToRoutes } from './FitMapToRoutes.tsx';
import { RouteLine } from './RouteLine.tsx';
import type { Activity, LatLng } from './types.ts';

type ActivitiesMapProps = {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (activityId: string) => void;
};

type ActivityWithRoute = { activity: Activity; route: LatLng[] };

export function ActivitiesMap({
  activities,
  selectedActivityId,
  onSelectActivity,
}: ActivitiesMapProps) {
  const activitiesWithRoutes: ActivityWithRoute[] = useMemo(
    () =>
      activities.flatMap((activity) =>
        activity.route ? [{ activity, route: activity.route }] : [],
      ),
    [activities],
  );
  const selected = activitiesWithRoutes.find(
    ({ activity }) => activity.id === selectedActivityId,
  );
  const routesToFit = useMemo(
    () =>
      selected
        ? [selected.route]
        : activitiesWithRoutes.map(({ route }) => route),
    [activitiesWithRoutes, selected],
  );
  if (activitiesWithRoutes.length === 0) return null;

  // Leaflet draws later lines on top, so the selected route goes last.
  const drawingOrder = selected
    ? [...activitiesWithRoutes.filter((entry) => entry !== selected), selected]
    : activitiesWithRoutes;

  return (
    <section className="activities-map" aria-label="Map of routes">
      <MapContainer
        center={[0, 0]}
        zoom={2}
        // Fractional zoom lets fitting the routes fill the map instead of
        // stopping at the next whole zoom level out.
        zoomSnap={0.25}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {drawingOrder.map(({ activity, route }) => (
          <RouteLine
            // Leaflet only reads a line's class when creating it, so a change
            // of selection needs a new line.
            key={`${activity.id}-${activity === selected?.activity}`}
            activity={activity}
            route={route}
            isSelected={activity === selected?.activity}
            onSelect={onSelectActivity}
          />
        ))}
        <FitMapToRoutes routes={routesToFit} />
      </MapContainer>
    </section>
  );
}

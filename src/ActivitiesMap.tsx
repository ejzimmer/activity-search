import 'leaflet/dist/leaflet.css';
import './ActivitiesMap.css';
import { latLng } from 'leaflet';
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { NEAR_RADIUS_M, type Coordinates } from '../lib/coordinates.ts';
import { FitMapToPointsOnLoad } from './FitMapToPointsOnLoad.tsx';
import { NearbyArea } from './NearbyArea.tsx';
import { PickPointOnClick } from './PickPointOnClick.tsx';
import { RouteLine } from './RouteLine.tsx';
import type { Activity, LatLng } from './types.ts';

type ActivitiesMapProps = {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (activityId: string) => void;
  nearPoint: Coordinates | null;
  onPickPoint: (point: Coordinates) => void;
};

function listNearbyAreaCorners(center: Coordinates): LatLng[] {
  const bounds = latLng(center).toBounds(NEAR_RADIUS_M * 2);
  return [
    [bounds.getSouth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getEast()],
  ];
}

type ActivityWithRoute = { activity: Activity; route: LatLng[] };

export function ActivitiesMap({
  activities,
  selectedActivityId,
  onSelectActivity,
  nearPoint,
  onPickPoint,
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
  const nearLat = nearPoint?.lat;
  const nearLng = nearPoint?.lng;
  const pointsToFit = useMemo(() => {
    const routePoints = activitiesWithRoutes.flatMap(({ route }) => route);
    if (nearLat === undefined || nearLng === undefined) return routePoints;
    return [
      ...routePoints,
      ...listNearbyAreaCorners({ lat: nearLat, lng: nearLng }),
    ];
  }, [activitiesWithRoutes, nearLat, nearLng]);
  const hasSomethingToShow =
    activitiesWithRoutes.length > 0 || nearPoint !== null;
  const [hasShownMap, setHasShownMap] = useState(false);
  // Unmounting the map would lose the person's pan and zoom, so once shown it
  // stays, even when a filter leaves no routes.
  if (!hasShownMap) {
    if (!hasSomethingToShow) return null;
    setHasShownMap(true);
  }

  // Leaflet draws later lines on top, so the selected route goes last.
  const drawingOrder = selected
    ? [...activitiesWithRoutes.filter((entry) => entry !== selected), selected]
    : activitiesWithRoutes;

  return (
    <section className="activities-map" aria-label="Map of routes">
      <MapContainer
        center={[0, 0]}
        zoom={2}
        // Leaflet only zooms in whole levels by default, and each level is
        // twice the scale of the last. Fitting the routes then often leaves
        // them filling barely half the map, so allow quarter levels.
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
        {nearPoint && <NearbyArea center={nearPoint} />}
        <PickPointOnClick onPickPoint={onPickPoint} />
        <FitMapToPointsOnLoad points={pointsToFit} />
      </MapContainer>
    </section>
  );
}

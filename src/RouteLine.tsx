import { Polyline, Tooltip } from 'react-leaflet';
import { formatDate } from './format.ts';
import type { Activity, LatLng } from './types.ts';

type RouteLineProps = {
  activity: Activity;
  route: LatLng[];
  isSelected: boolean;
  onSelect: (activityId: string) => void;
};

export function RouteLine({
  activity,
  route,
  isSelected,
  onSelect,
}: RouteLineProps) {
  return (
    <Polyline
      positions={route}
      className={isSelected ? 'route-line selected' : 'route-line'}
      pathOptions={{ weight: isSelected ? 5 : 3 }}
      eventHandlers={{ click: () => onSelect(activity.id) }}
    >
      <Tooltip sticky>
        {activity.name}, {formatDate(activity.start_date)}
      </Tooltip>
    </Polyline>
  );
}

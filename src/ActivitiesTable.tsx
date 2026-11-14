import './ActivitiesTable.css';
import type { Activity } from './types.ts';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatElevation,
  formatSportType,
} from './format.ts';

type ActivitiesTableProps = {
  activities: Activity[];
  isLoading: boolean;
};

export function ActivitiesTable({
  activities,
  isLoading,
}: ActivitiesTableProps) {
  return (
    <div className="table-wrap" aria-busy={isLoading}>
      <table>
        <caption className="visually-hidden">
          Your activities, newest first
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">
              Distance
            </th>
            <th scope="col" className="num">
              Moving time
            </th>
            <th scope="col" className="num">
              Elevation
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity.id}>
              <td>{formatDate(activity.start_date)}</td>
              <th scope="row">{activity.name}</th>
              <td>{formatSportType(activity.sport_type)}</td>
              <td className="num">{formatDistance(activity.distance_m)}</td>
              <td className="num">{formatDuration(activity.moving_time_s)}</td>
              <td className="num">
                {formatElevation(activity.elevation_gain_m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

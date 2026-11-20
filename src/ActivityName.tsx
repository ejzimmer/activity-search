import './ActivityName.css';
import type { Activity } from './types.ts';

type ActivityNameProps = {
  activity: Activity;
  isSelected: boolean;
  onSelect: (activityId: string) => void;
};

export function ActivityName({
  activity,
  isSelected,
  onSelect,
}: ActivityNameProps) {
  if (!activity.route) return activity.name;
  return (
    <button
      type="button"
      className="activity-name"
      aria-pressed={isSelected}
      title="Show this route on the map"
      onClick={() => onSelect(activity.id)}
    >
      {activity.name}
    </button>
  );
}

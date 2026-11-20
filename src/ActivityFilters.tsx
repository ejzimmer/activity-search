import './ActivityFilters.css';
import type { SportTypeOption } from '../lib/sport-types.ts';
import type { FilterValues } from './activityQuery.ts';
import { DurationInput } from './DurationInput.tsx';
import { RubbishBinIcon } from './icons/RubbishBinIcon.tsx';
import { SportTypeSelect } from './SportTypeSelect.tsx';

const NO_FILTERS: FilterValues = {
  sportType: '',
  name: '',
  distanceKm: '',
  hours: '',
  minutes: '',
};

type ActivityFiltersProps = {
  filters: FilterValues;
  sportTypeOptions: SportTypeOption[];
  onChange: (filters: FilterValues) => void;
};

export function ActivityFilters({
  filters,
  sportTypeOptions,
  onChange,
}: ActivityFiltersProps) {
  const changeFilter = (changes: Partial<FilterValues>) =>
    onChange({ ...filters, ...changes });
  const hasValues = Object.values(filters).some(Boolean);

  return (
    <search className="activity-filters">
      <SportTypeSelect
        options={sportTypeOptions}
        value={filters.sportType}
        onChange={(sportType) => changeFilter({ sportType })}
      />
      <label>
        Name
        <input
          type="search"
          value={filters.name}
          onChange={(event) => changeFilter({ name: event.target.value })}
        />
      </label>
      <label>
        Distance
        <span className="unit-input">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={filters.distanceKm}
            onChange={(event) =>
              changeFilter({ distanceKm: event.target.value })
            }
          />
          km
        </span>
      </label>
      <DurationInput
        hours={filters.hours}
        minutes={filters.minutes}
        onChange={changeFilter}
      />
      <button
        type="button"
        className="clear-filters"
        aria-label="Clear filters"
        title="Clear filters"
        onClick={() => onChange(NO_FILTERS)}
        disabled={!hasValues}
      >
        <RubbishBinIcon width="18px" />
      </button>
    </search>
  );
}

import './ActivityFilters.css';
import type { SportTypeOption } from '../lib/sport-types.ts';
import type { NewFavouriteLocation } from '../lib/types.ts';
import {
  createNearFilterValues,
  NO_FILTERS,
  readNearPoint,
  type FilterValues,
} from './activityQuery.ts';
import { DurationInput } from './DurationInput.tsx';
import { FavouriteLocationButtons } from './FavouriteLocationButtons.tsx';
import { RubbishBinIcon } from './icons/RubbishBinIcon.tsx';
import { LocationFilter } from './LocationFilter.tsx';
import { SportTypeSelect } from './SportTypeSelect.tsx';
import type { FavouriteLocation } from './useFavouriteLocations.ts';

type ActivityFiltersProps = {
  filters: FilterValues;
  sportTypeOptions: SportTypeOption[];
  onChange: (filters: FilterValues) => void;
  favourites: FavouriteLocation[];
  onAddFavourite: (location: NewFavouriteLocation) => void;
  onRemoveFavourite: (favouriteId: number) => void;
};

export function ActivityFilters({
  filters,
  sportTypeOptions,
  onChange,
  favourites,
  onAddFavourite,
  onRemoveFavourite,
}: ActivityFiltersProps) {
  const changeFilter = (changes: Partial<FilterValues>) =>
    onChange({ ...filters, ...changes });
  const hasValues = Object.values(filters).some(Boolean);
  const nearPoint = readNearPoint(filters);
  const activeFavourite = nearPoint
    ? (favourites.find(
        (favourite) =>
          favourite.lat === nearPoint.lat && favourite.lng === nearPoint.lng,
      ) ?? null)
    : null;
  const clearNearPoint = () => changeFilter({ nearLat: '', nearLng: '' });

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
      {nearPoint && (
        <LocationFilter
          nearPoint={nearPoint}
          favourite={activeFavourite}
          onClear={clearNearPoint}
          onAddFavourite={(name) => onAddFavourite({ name, ...nearPoint })}
          onRemoveFavourite={onRemoveFavourite}
        />
      )}
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
      <FavouriteLocationButtons
        favourites={favourites}
        activeFavouriteId={activeFavourite?.id ?? null}
        onSelect={(favourite) =>
          favourite
            ? changeFilter(createNearFilterValues(favourite))
            : clearNearPoint()
        }
      />
    </search>
  );
}

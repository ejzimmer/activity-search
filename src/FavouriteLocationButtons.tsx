import './FavouriteLocationButtons.css';
import { StarIcon } from './icons/StarIcon.tsx';
import type { FavouriteLocation } from './useFavouriteLocations.ts';

type FavouriteLocationButtonsProps = {
  favourites: FavouriteLocation[];
  activeFavouriteId: number | null;
  onSelect: (favourite: FavouriteLocation | null) => void;
};

export function FavouriteLocationButtons({
  favourites,
  activeFavouriteId,
  onSelect,
}: FavouriteLocationButtonsProps) {
  if (favourites.length === 0) return null;

  return (
    <div
      className="favourite-locations"
      role="group"
      aria-label="Favourite places"
    >
      <span title="Favourite places">
        <StarIcon width="16px" isFilled />
      </span>
      {favourites.map((favourite) => {
        const isActive = favourite.id === activeFavouriteId;
        return (
          <button
            key={favourite.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : favourite)}
          >
            {favourite.name}
          </button>
        );
      })}
    </div>
  );
}

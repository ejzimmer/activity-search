import './LocationFilter.css';
import { useState } from 'react';
import type { Coordinates } from '../lib/coordinates.ts';
import { CrossIcon } from './icons/CrossIcon.tsx';
import { PinIcon } from './icons/PinIcon.tsx';
import { StarIcon } from './icons/StarIcon.tsx';
import { SaveFavouriteForm } from './SaveFavouriteForm.tsx';
import type { FavouriteLocation } from './useFavouriteLocations.ts';

type LocationFilterProps = {
  nearPoint: Coordinates;
  favourite: FavouriteLocation | null;
  onClear: () => void;
  onAddFavourite: (name: string) => void;
  onRemoveFavourite: (favouriteId: number) => void;
};

const formatPoint = ({ lat, lng }: Coordinates) =>
  `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

export function LocationFilter({
  nearPoint,
  favourite,
  onClear,
  onAddFavourite,
  onRemoveFavourite,
}: LocationFilterProps) {
  const [isNaming, setIsNaming] = useState(false);

  return (
    <div className="location-filter" role="group" aria-label="Near">
      <span>Near</span>
      <div className="location-filter-box">
        <PinIcon width="16px" />
        {isNaming ? (
          <SaveFavouriteForm
            onSave={(name) => {
              onAddFavourite(name);
              setIsNaming(false);
            }}
            onCancel={() => setIsNaming(false)}
          />
        ) : (
          <>
            <span className="location-filter-name">
              {favourite?.name ?? formatPoint(nearPoint)}
            </span>
            {favourite ? (
              <button
                type="button"
                aria-label="Remove from favourites"
                title="Remove from favourites"
                onClick={() => onRemoveFavourite(favourite.id)}
              >
                <StarIcon width="16px" isFilled />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Add to favourites"
                title="Add to favourites"
                onClick={() => setIsNaming(true)}
              >
                <StarIcon width="16px" />
              </button>
            )}
            <button
              type="button"
              aria-label="Clear location"
              title="Clear location"
              onClick={onClear}
            >
              <CrossIcon width="16px" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

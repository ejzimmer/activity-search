import { useEffect, useState } from 'react';
import type {
  FavouriteLocationResponse,
  NewFavouriteLocation,
} from '../lib/types.ts';

export type FavouriteLocation = FavouriteLocationResponse;

const FAVOURITES_URL = '/api/favourite-locations';

async function fetchFromFavouritesApi(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`The API returned ${response.status}`);
  return response;
}

function sortFavouritesByName(favourites: FavouriteLocation[]) {
  return favourites.toSorted((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export function useFavouriteLocations() {
  const [favourites, setFavourites] = useState<FavouriteLocation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchFromFavouritesApi(FAVOURITES_URL, { signal: controller.signal })
      .then((response) => response.json() as Promise<FavouriteLocation[]>)
      .then(setFavourites)
      .catch((error: Error) => {
        if (error.name !== 'AbortError')
          setErrorMessage(`Couldn't load favourite places: ${error.message}`);
      });
    return () => controller.abort();
  }, []);

  const addFavourite = async (location: NewFavouriteLocation) => {
    try {
      const response = await fetchFromFavouritesApi(FAVOURITES_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(location),
      });
      const added = (await response.json()) as FavouriteLocation;
      setFavourites((current) => sortFavouritesByName([...current, added]));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(`Couldn't save the place: ${(error as Error).message}`);
    }
  };

  const removeFavourite = async (favouriteId: number) => {
    try {
      await fetchFromFavouritesApi(`${FAVOURITES_URL}/${favouriteId}`, {
        method: 'DELETE',
      });
      setFavourites((current) =>
        current.filter((favourite) => favourite.id !== favouriteId),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(`Couldn't remove the place: ${(error as Error).message}`);
    }
  };

  return { favourites, errorMessage, addFavourite, removeFavourite };
}

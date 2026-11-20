import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng } from './types.ts';

type FitMapToRoutesProps = {
  routes: LatLng[][];
};

export function FitMapToRoutes({ routes }: FitMapToRoutesProps) {
  const map = useMap();

  useEffect(() => {
    const points = routes.flat();
    if (points.length > 0) map.fitBounds(points, { padding: [8, 8] });
  }, [map, routes]);

  return null;
}

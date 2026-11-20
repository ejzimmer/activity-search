import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng } from './types.ts';

type FitMapToPointsProps = {
  points: LatLng[];
};

export function FitMapToPoints({ points }: FitMapToPointsProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) map.fitBounds(points, { padding: [8, 8] });
  }, [map, points]);

  return null;
}

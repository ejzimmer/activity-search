import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng } from './types.ts';

type FitMapToPointsOnLoadProps = {
  points: LatLng[];
};

export function FitMapToPointsOnLoad({ points }: FitMapToPointsOnLoadProps) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || points.length === 0) return;
    map.fitBounds(points, { padding: [8, 8] });
    hasFitted.current = true;
  }, [map, points]);

  return null;
}

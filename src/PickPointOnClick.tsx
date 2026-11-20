import { useMapEvents } from 'react-leaflet';
import type { Coordinates } from '../lib/coordinates.ts';

type PickPointOnClickProps = {
  onPickPoint: (point: Coordinates) => void;
};

export function PickPointOnClick({ onPickPoint }: PickPointOnClickProps) {
  useMapEvents({
    click: ({ latlng }) => onPickPoint({ lat: latlng.lat, lng: latlng.lng }),
  });
  return null;
}

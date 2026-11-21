import { Circle } from 'react-leaflet';
import { NEAR_RADIUS_M, type Coordinates } from '../lib/coordinates.ts';

type NearbyAreaProps = {
  center: Coordinates;
};

export function NearbyArea({ center }: NearbyAreaProps) {
  return (
    <Circle
      center={center}
      radius={NEAR_RADIUS_M}
      className="nearby-area"
      interactive={false}
    />
  );
}

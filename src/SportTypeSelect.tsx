import type { SportTypeOption } from '../lib/sport-types.ts';
import { formatSportType } from './format.ts';

type SportTypeSelectProps = {
  options: SportTypeOption[];
  value: string;
  onChange: (sportType: string) => void;
};

export function SportTypeSelect({
  options,
  value,
  onChange,
}: SportTypeSelectProps) {
  return (
    <label>
      Type
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map(({ sportType, isChild }) => (
          <option key={sportType} value={sportType}>
            {isChild ? ' ' : ''}
            {formatSportType(sportType)}
          </option>
        ))}
      </select>
    </label>
  );
}

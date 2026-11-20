type DurationInputsProps = {
  hours: string;
  minutes: string;
  onChange: (duration: { hours: string; minutes: string }) => void;
};

export function DurationInputs({
  hours,
  minutes,
  onChange,
}: DurationInputsProps) {
  return (
    <fieldset>
      <legend>Duration</legend>
      <span className="duration-inputs">
        <label>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            aria-label="Hours"
            value={hours}
            onChange={(event) =>
              onChange({ hours: event.target.value, minutes })
            }
          />
          h
        </label>
        <label>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            aria-label="Minutes"
            value={minutes}
            onChange={(event) =>
              onChange({ hours, minutes: event.target.value })
            }
          />
          min
        </label>
      </span>
    </fieldset>
  );
}

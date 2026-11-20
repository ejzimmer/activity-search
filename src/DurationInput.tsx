import './DurationInput.css';
import { useId, useRef, type KeyboardEvent } from 'react';

type Duration = { hours: string; minutes: string };

type DurationInputProps = Duration & {
  onChange: (duration: Duration) => void;
};

const keepDigits = (text: string) => text.replace(/\D/g, '');

export function DurationInput({
  hours,
  minutes,
  onChange,
}: DurationInputProps) {
  const labelId = useId();
  const hoursInput = useRef<HTMLInputElement>(null);
  const minutesInput = useRef<HTMLInputElement>(null);

  const changeHours = (text: string) => {
    const digits = keepDigits(text);
    if (digits.length === 0) {
      onChange({ hours: '', minutes });
      return;
    }
    onChange({
      hours: digits.charAt(0),
      minutes: digits.length > 1 ? digits.slice(1, 3) : minutes,
    });
    minutesInput.current?.focus();
  };

  const returnToHoursOnBackspace = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && minutes === '') {
      event.preventDefault();
      hoursInput.current?.focus();
    }
  };

  return (
    <div className="duration-input">
      <span id={labelId}>Duration</span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="duration-input-box"
        onClick={(event) => {
          if (event.target === event.currentTarget) hoursInput.current?.focus();
        }}
      >
        <input
          ref={hoursInput}
          aria-label="Hours"
          inputMode="numeric"
          autoComplete="off"
          className="hours"
          value={hours}
          onChange={(event) => changeHours(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        <span aria-hidden="true">:</span>
        <input
          ref={minutesInput}
          aria-label="Minutes"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          className="minutes"
          value={minutes}
          onChange={(event) =>
            onChange({ hours, minutes: keepDigits(event.target.value) })
          }
          onKeyDown={returnToHoursOnBackspace}
        />
      </div>
    </div>
  );
}

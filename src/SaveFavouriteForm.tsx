import { useState } from 'react';
import { MAX_FAVOURITE_NAME_LENGTH } from '../lib/new-favourite-location.ts';
import { CrossIcon } from './icons/CrossIcon.tsx';
import { TickIcon } from './icons/TickIcon.tsx';

type SaveFavouriteFormProps = {
  onSave: (name: string) => void;
  onCancel: () => void;
};

export function SaveFavouriteForm({
  onSave,
  onCancel,
}: SaveFavouriteFormProps) {
  const [name, setName] = useState('');

  return (
    <form
      className="save-favourite-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <input
        aria-label="Favourite name"
        title="Favourite name"
        maxLength={MAX_FAVOURITE_NAME_LENGTH}
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="submit"
        aria-label="Save favourite"
        title="Save favourite"
        disabled={!name.trim()}
      >
        <TickIcon width="16px" />
      </button>
      <button
        type="button"
        aria-label="Cancel"
        title="Cancel"
        onClick={onCancel}
      >
        <CrossIcon width="16px" />
      </button>
    </form>
  );
}

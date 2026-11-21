import './AccountBar.css';
import { useState } from 'react';
import { GarminKeyPanel } from './GarminKeyPanel.tsx';
import { InvitePanel } from './InvitePanel.tsx';
import { PasswordResetPanel } from './PasswordResetPanel.tsx';
import type { GarminKeyStatus, SignedInUser } from './parseSignedInUser.ts';

type AccountBarProps = {
  user: SignedInUser;
  onSignOut: () => void;
  onGarminKeyChange: (garminKey: GarminKeyStatus | null) => void;
};

export function AccountBar({
  user,
  onSignOut,
  onGarminKeyChange,
}: AccountBarProps) {
  const [isGarminKeyOpen, setIsGarminKeyOpen] = useState(
    !user.garminKey || user.garminKey.isRejected,
  );

  return (
    <header className="account-bar">
      <span className="email">{user.email}</span>
      <button
        type="button"
        aria-expanded={isGarminKeyOpen}
        onClick={() => setIsGarminKeyOpen((isOpen) => !isOpen)}
      >
        Garmin key
      </button>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
      <div className="panels">
        {isGarminKeyOpen && (
          <GarminKeyPanel
            garminKey={user.garminKey}
            onGarminKeyChange={onGarminKeyChange}
          />
        )}
        {user.isAdmin && <InvitePanel />}
        {user.isAdmin && <PasswordResetPanel />}
      </div>
    </header>
  );
}

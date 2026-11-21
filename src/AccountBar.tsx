import './AccountBar.css';
import { InvitePanel } from './InvitePanel.tsx';
import type { SignedInUser } from './useSession.ts';

type AccountBarProps = {
  user: SignedInUser;
  onSignOut: () => void;
};

export function AccountBar({ user, onSignOut }: AccountBarProps) {
  return (
    <header className="account-bar">
      <span className="email">{user.email}</span>
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
      {user.isAdmin && <InvitePanel />}
    </header>
  );
}

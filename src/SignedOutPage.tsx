import { useState } from 'react';
import { SignInForm } from './SignInForm.tsx';
import { SignUpForm } from './SignUpForm.tsx';
import type { SignInDetails, SignUpDetails } from './useSession.ts';

type SignedOutPageProps = {
  onSignIn: (details: SignInDetails) => Promise<string | null>;
  onSignUp: (details: SignUpDetails) => Promise<string | null>;
};

function readInviteCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('invite') ?? '';
}

function removeInviteCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', url);
}

export function SignedOutPage({ onSignIn, onSignUp }: SignedOutPageProps) {
  const [inviteCode] = useState(readInviteCodeFromUrl);
  const [isSigningUp, setIsSigningUp] = useState(inviteCode !== '');

  const signUpAndForgetInvite = async (details: SignUpDetails) => {
    const problem = await onSignUp(details);
    if (!problem) removeInviteCodeFromUrl();
    return problem;
  };

  return (
    <main>
      {isSigningUp ? (
        <SignUpForm
          inviteCode={inviteCode}
          onSignUp={signUpAndForgetInvite}
          onSwitchToSignIn={() => setIsSigningUp(false)}
        />
      ) : (
        <SignInForm
          onSignIn={onSignIn}
          onSwitchToSignUp={() => setIsSigningUp(true)}
        />
      )}
    </main>
  );
}

import { AccountBar } from './AccountBar.tsx';
import { ActivitiesPage } from './ActivitiesPage.tsx';
import { SignedOutPage } from './SignedOutPage.tsx';
import { useSession } from './useSession.ts';

export function App() {
  const { session, signIn, signUp, signOut, changeGarminKey } = useSession();

  if (session.status === 'checking') return null;
  if (session.status === 'signed-out')
    return <SignedOutPage onSignIn={signIn} onSignUp={signUp} />;
  return (
    <>
      <AccountBar
        user={session.user}
        onSignOut={signOut}
        onGarminKeyChange={changeGarminKey}
      />
      <ActivitiesPage garminKey={session.user.garminKey} />
    </>
  );
}

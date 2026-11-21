import { useState } from 'react';
import { ResetPasswordForm } from './ResetPasswordForm.tsx';
import { SignInForm } from './SignInForm.tsx';
import { SignUpForm } from './SignUpForm.tsx';
import type {
  PasswordResetDetails,
  SignInDetails,
  SignUpDetails,
} from './useSession.ts';

type SignedOutPageProps = {
  onSignIn: (details: SignInDetails) => Promise<string | null>;
  onSignUp: (details: SignUpDetails) => Promise<string | null>;
  onResetPassword: (details: PasswordResetDetails) => Promise<string | null>;
};

type SignedOutForm = 'sign-in' | 'sign-up' | 'reset-password';

const LINK_CODE_PARAMS = ['invite', 'reset'];

function readCodeFromUrl(param: string): string {
  return new URLSearchParams(window.location.search).get(param) ?? '';
}

function removeLinkCodesFromUrl() {
  const url = new URL(window.location.href);
  for (const param of LINK_CODE_PARAMS) url.searchParams.delete(param);
  window.history.replaceState(null, '', url);
}

function chooseFirstForm(inviteCode: string, resetCode: string) {
  if (resetCode) return 'reset-password';
  if (inviteCode) return 'sign-up';
  return 'sign-in';
}

export function SignedOutPage({
  onSignIn,
  onSignUp,
  onResetPassword,
}: SignedOutPageProps) {
  const [inviteCode] = useState(() => readCodeFromUrl('invite'));
  const [resetCode] = useState(() => readCodeFromUrl('reset'));
  const [form, setForm] = useState<SignedOutForm>(() =>
    chooseFirstForm(inviteCode, resetCode),
  );

  const submitAndForgetLinkCodes =
    <Details,>(submit: (details: Details) => Promise<string | null>) =>
    async (details: Details) => {
      const problem = await submit(details);
      if (!problem) removeLinkCodesFromUrl();
      return problem;
    };

  return (
    <main>
      {form === 'sign-up' && (
        <SignUpForm
          inviteCode={inviteCode}
          onSignUp={submitAndForgetLinkCodes(onSignUp)}
          onSwitchToSignIn={() => setForm('sign-in')}
        />
      )}
      {form === 'reset-password' && (
        <ResetPasswordForm
          resetCode={resetCode}
          onResetPassword={submitAndForgetLinkCodes(onResetPassword)}
          onSwitchToSignIn={() => setForm('sign-in')}
        />
      )}
      {form === 'sign-in' && (
        <SignInForm
          onSignIn={onSignIn}
          onSwitchToSignUp={() => setForm('sign-up')}
          onSwitchToPasswordReset={() => setForm('reset-password')}
        />
      )}
    </main>
  );
}

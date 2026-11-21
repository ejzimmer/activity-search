import { MIN_PASSWORD_LENGTH } from '../lib/password-rules.ts';
import { AccountForm } from './AccountForm.tsx';
import type { SignUpDetails } from './useSession.ts';

type SignUpFormProps = {
  inviteCode: string;
  onSignUp: (details: SignUpDetails) => Promise<string | null>;
  onSwitchToSignIn: () => void;
};

export function SignUpForm({
  inviteCode,
  onSignUp,
  onSwitchToSignIn,
}: SignUpFormProps) {
  return (
    <AccountForm
      heading="Create an account"
      submitLabel="Create account"
      onSubmit={(fields) =>
        onSignUp({
          email: String(fields.get('email')),
          password: String(fields.get('password')),
          inviteCode: String(fields.get('inviteCode')),
        })
      }
      footer={
        <>
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </>
      }
    >
      <label>
        Invite code
        <input
          name="inviteCode"
          defaultValue={inviteCode}
          autoComplete="off"
          required
        />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="password-help"
        />
        <span id="password-help" className="help">
          At least {MIN_PASSWORD_LENGTH} characters.
        </span>
      </label>
    </AccountForm>
  );
}

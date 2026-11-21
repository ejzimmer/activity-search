import { AccountForm } from './AccountForm.tsx';
import type { SignInDetails } from './useSession.ts';

type SignInFormProps = {
  onSignIn: (details: SignInDetails) => Promise<string | null>;
  onSwitchToSignUp: () => void;
};

export function SignInForm({ onSignIn, onSwitchToSignUp }: SignInFormProps) {
  return (
    <AccountForm
      heading="Sign in"
      submitLabel="Sign in"
      onSubmit={(fields) =>
        onSignIn({
          email: String(fields.get('email')),
          password: String(fields.get('password')),
        })
      }
      footer={
        <>
          Got an invite?{' '}
          <button type="button" onClick={onSwitchToSignUp}>
            Create an account
          </button>
        </>
      }
    >
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
    </AccountForm>
  );
}

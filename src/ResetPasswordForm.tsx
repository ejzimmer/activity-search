import { MIN_PASSWORD_LENGTH } from '../lib/password-rules.ts';
import { AccountForm } from './AccountForm.tsx';
import type { PasswordResetDetails } from './useSession.ts';

type ResetPasswordFormProps = {
  resetCode: string;
  onResetPassword: (details: PasswordResetDetails) => Promise<string | null>;
  onSwitchToSignIn: () => void;
};

export function ResetPasswordForm({
  resetCode,
  onResetPassword,
  onSwitchToSignIn,
}: ResetPasswordFormProps) {
  return (
    <AccountForm
      heading="Choose a new password"
      submitLabel="Save password"
      onSubmit={(fields) =>
        onResetPassword({
          resetCode: String(fields.get('resetCode')),
          password: String(fields.get('password')),
        })
      }
      footer={
        <p>
          Remembered it?{' '}
          <button type="button" onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </p>
      }
    >
      <label>
        Reset code
        <input
          name="resetCode"
          defaultValue={resetCode}
          autoComplete="off"
          required
          aria-describedby="reset-code-help"
        />
        <span id="reset-code-help" className="help">
          Ask the person who invited you for a reset link. If you're the admin,
          use your setup invite code.
        </span>
      </label>
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="new-password-help"
        />
        <span id="new-password-help" className="help">
          At least {MIN_PASSWORD_LENGTH} characters.
        </span>
      </label>
    </AccountForm>
  );
}

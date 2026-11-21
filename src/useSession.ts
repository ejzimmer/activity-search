import { useEffect, useState } from 'react';
import type { ProblemResponse, SignedInUserResponse } from '../lib/types.ts';
import {
  parseSignedInUser,
  type GarminKeyStatus,
  type SignedInUser,
} from './parseSignedInUser.ts';

type SessionState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: SignedInUser };

export interface SignInDetails {
  email: string;
  password: string;
}

export interface SignUpDetails extends SignInDetails {
  inviteCode: string;
}

export interface PasswordResetDetails {
  resetCode: string;
  password: string;
}

async function readProblem(response: Response): Promise<string> {
  const body = (await response
    .json()
    .catch(() => null)) as ProblemResponse | null;
  return body?.problem ?? `The API returned ${response.status}`;
}

async function postAccountRequest(path: string, details: object) {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(details),
  });
}

async function readSignedInUser(response: Response): Promise<SignedInUser> {
  return parseSignedInUser((await response.json()) as SignedInUserResponse);
}

export function useSession() {
  const [session, setSession] = useState<SessionState>({ status: 'checking' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/session', { signal: controller.signal })
      .then(async (response) => {
        setSession(
          response.ok
            ? {
                status: 'signed-in',
                user: await readSignedInUser(response),
              }
            : { status: 'signed-out' },
        );
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setSession({ status: 'signed-out' });
      });
    return () => controller.abort();
  }, []);

  /** Resolves to a problem to show the person, or null once they're signed in. */
  const submitAccountForm = async (
    path: string,
    details: SignInDetails | SignUpDetails | PasswordResetDetails,
  ): Promise<string | null> => {
    try {
      const response = await postAccountRequest(path, details);
      if (!response.ok) return readProblem(response);
      setSession({
        status: 'signed-in',
        user: await readSignedInUser(response),
      });
      return null;
    } catch (error) {
      return `Couldn't reach the server: ${(error as Error).message}`;
    }
  };

  const signIn = (details: SignInDetails) =>
    submitAccountForm('/api/sign-in', details);
  const signUp = (details: SignUpDetails) =>
    submitAccountForm('/api/sign-up', details);
  const signOut = async () => {
    await fetch('/api/sign-out', { method: 'POST' });
    setSession({ status: 'signed-out' });
  };

  const changeGarminKey = (garminKey: GarminKeyStatus | null) =>
    setSession((current) =>
      current.status === 'signed-in'
        ? { ...current, user: { ...current.user, garminKey } }
        : current,
    );

  const resetPassword = (details: PasswordResetDetails) =>
    submitAccountForm('/api/reset-password', details);

  return { session, signIn, signUp, resetPassword, signOut, changeGarminKey };
}

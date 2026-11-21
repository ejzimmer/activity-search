import { MIN_PASSWORD_LENGTH } from './password-rules.ts';

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 200;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

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

export type ParsedRequest<Details> = Details | { problem: string };

function readStringField(body: unknown, field: string): string {
  if (typeof body !== 'object' || body === null) return '';
  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

function findNewPasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Use a password of at most ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseSignInRequest(
  body: unknown,
): ParsedRequest<SignInDetails> {
  const email = normaliseEmail(readStringField(body, 'email'));
  const password = readStringField(body, 'password');
  if (!email || !password) return { problem: 'Enter your email and password.' };
  return { email, password };
}

export function parseSignUpRequest(
  body: unknown,
): ParsedRequest<SignUpDetails> {
  const email = normaliseEmail(readStringField(body, 'email'));
  const password = readStringField(body, 'password');
  const inviteCode = readStringField(body, 'inviteCode').trim();
  if (!inviteCode) return { problem: 'You need an invite to sign up.' };
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email))
    return { problem: 'Enter a valid email address.' };
  const passwordProblem = findNewPasswordProblem(password);
  if (passwordProblem) return { problem: passwordProblem };
  return { email, password, inviteCode };
}

export function parsePasswordResetRequest(
  body: unknown,
): ParsedRequest<PasswordResetDetails> {
  const resetCode = readStringField(body, 'resetCode').trim();
  const password = readStringField(body, 'password');
  if (!resetCode) return { problem: 'You need a reset link to do this.' };
  const passwordProblem = findNewPasswordProblem(password);
  if (passwordProblem) return { problem: passwordProblem };
  return { resetCode, password };
}

export function parsePasswordResetLinkRequest(
  body: unknown,
): ParsedRequest<{ email: string }> {
  const email = normaliseEmail(readStringField(body, 'email'));
  if (!email) return { problem: 'Enter the email of the account to reset.' };
  return { email };
}

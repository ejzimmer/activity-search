import type { SignedInUserResponse } from '../lib/types.ts';

export interface GarminKeyStatus {
  savedAt: Temporal.Instant;
  isRejected: boolean;
}

export type SignedInUser = Omit<SignedInUserResponse, 'garminKey'> & {
  garminKey: GarminKeyStatus | null;
};

export function parseGarminKeyStatus(
  response: SignedInUserResponse['garminKey'],
): GarminKeyStatus | null {
  return (
    response && {
      savedAt: Temporal.Instant.from(response.savedAt),
      isRejected: response.isRejected,
    }
  );
}

export function parseSignedInUser(
  response: SignedInUserResponse,
): SignedInUser {
  return { ...response, garminKey: parseGarminKeyStatus(response.garminKey) };
}

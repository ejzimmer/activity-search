import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Sql = NeonQueryFunction<false, false>;

// The functions live in a separate Neon project in Singapore, because Neon
// Functions don't run in Sydney. Neon injects that project's own database as
// DATABASE_URL, so the Sydney database needs a name of its own.
export function connectToDatabase(): Sql {
  const url = process.env.ACTIVITIES_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set ACTIVITIES_DATABASE_URL to the Sydney Neon connection string',
    );
  }
  return neon(url);
}

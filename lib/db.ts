import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

export type Sql = NeonQueryFunction<false, false>

/**
 * Netlify DB sets NETLIFY_DATABASE_URL; a Neon database created directly
 * (so you can choose the Sydney region) uses DATABASE_URL. Either works.
 */
export function getSql(): Sql {
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL
  if (!url) {
    throw new Error('Set DATABASE_URL (or NETLIFY_DATABASE_URL) to your Neon connection string')
  }
  return neon(url)
}

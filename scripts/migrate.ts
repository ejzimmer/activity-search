import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { getSql } from '../lib/db.ts'

const sql = getSql()
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')

// The Neon HTTP driver runs one statement per query, so split on semicolons.
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}
console.log(`Applied ${statements.length} statements from db/schema.sql`)

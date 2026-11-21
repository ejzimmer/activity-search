import { PGlite } from '@electric-sql/pglite';
import type { Sql } from '../../lib/db.ts';
import { ensureSchema } from '../../lib/schema.ts';

class QueryFragment {
  constructor(
    readonly strings: readonly string[],
    readonly values: readonly unknown[],
    private readonly database: PGlite,
  ) {}

  compileQuery(params: unknown[]): string {
    return this.strings.reduce((text, string, index) => {
      if (index === 0) return string;
      const value = this.values[index - 1];
      const placeholder =
        value instanceof QueryFragment
          ? value.compileQuery(params)
          : `$${params.push(value)}`;
      return text + placeholder + string;
    }, '');
  }

  then<Fulfilled, Rejected = never>(
    onFulfilled: (rows: Record<string, unknown>[]) => Fulfilled,
    onRejected?: (error: unknown) => Rejected,
  ) {
    const params: unknown[] = [];
    const text = this.compileQuery(params);
    return this.database
      .query<Record<string, unknown>>(text, params)
      .then(({ rows }) => onFulfilled(rows), onRejected);
  }
}

export interface TestDatabase {
  sql: Sql;
  clearTables: () => Promise<void>;
}

/**
 * Wraps an in-memory Postgres in the parts of the Neon driver's interface this
 * app uses: tagged templates that can nest, and `query`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const database = new PGlite();
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) =>
    new QueryFragment(strings, values, database);
  sqlTag.query = async (text: string, params: unknown[] = []) =>
    (await database.query(text, params)).rows;
  const sql = sqlTag as unknown as Sql;
  await ensureSchema(sql);
  return {
    sql,
    clearTables: async () => {
      await database.exec(
        'TRUNCATE users, sessions, invites, sign_in_failures, activities, favourite_locations, user_sync_state, password_resets, password_reset_failures RESTART IDENTITY CASCADE',
      );
      await ensureSchema(sql);
    },
  };
}

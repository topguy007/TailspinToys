import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { AsyncRemoteCallback, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../db/schema';

export type Database = SqliteRemoteDatabase<typeof schema>;

export interface DatabaseConnection {
    db: Database;
    sqlite: DatabaseSync;
}

/** Default local SQLite file used for dev/build when DATABASE_URL is unset. */
const DEFAULT_DATABASE_URL = 'file:tailspin.db';

let cachedDb: Database | undefined;

/** Resolve a local SQLite URL to the path expected by Node's built-in driver. */
function databasePath(url: string): string {
    if (url === ':memory:') {
        return url;
    }

    if (!url.startsWith('file:')) {
        throw new Error('DATABASE_URL must be a local file: URL or :memory:.');
    }

    const filePath = url.startsWith('file://') ? fileURLToPath(url) : url.slice('file:'.length);
    if (!filePath) {
        throw new Error('DATABASE_URL must include a database file path.');
    }

    mkdirSync(dirname(filePath), { recursive: true });
    return filePath;
}

/** Bridge Drizzle's async SQLite adapter to Node's synchronous built-in driver. */
function createRemoteCallback(sqlite: DatabaseSync): AsyncRemoteCallback {
    return async (sql: string, params: SQLInputValue[], method: 'run' | 'all' | 'values' | 'get') => {
        const statement = sqlite.prepare(sql);

        switch (method) {
            case 'run':
                statement.run(...params);
                return { rows: [] };
            case 'all':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'values':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'get': {
                const row = statement.get(...params);
                // Drizzle's proxy type requires an array, but its get mapper accepts no row.
                return { rows: row === undefined ? (undefined as unknown as never[]) : Object.values(row) };
            }
        }
    };
}

/**
 * Execute generated migration statements in one SQLite transaction.
 *
 * If a statement fails, all statements in the batch are rolled back before the error is rethrown.
 *
 * @param sqlite Open Node SQLite connection used to execute statements.
 * @param queries SQL statements in migration order.
 * @returns Nothing when the full migration batch commits successfully.
 */
export function executeMigrationQueries(sqlite: DatabaseSync, queries: string[]): void {
    sqlite.exec('BEGIN');
    try {
        for (const query of queries) {
            sqlite.exec(query);
        }
        sqlite.exec('COMMIT');
    } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
    }
}

/**
 * Create a Drizzle client for a local SQLite database.
 *
 * @param url Local SQLite URL; defaults to `DATABASE_URL` or `file:tailspin.db`.
 * @returns Drizzle database client using the Node SQLite driver.
 */
export function createDatabase(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): Database {
    return createDatabaseConnection(url).db;
}

/**
 * Create both the Drizzle client and its underlying Node SQLite connection.
 *
 * @param url Local SQLite URL; defaults to `DATABASE_URL` or `file:tailspin.db`.
 * @returns Database client and connection, allowing migration code to access the driver.
 */
export function createDatabaseConnection(
    url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): DatabaseConnection {
    const sqlite = new DatabaseSync(databasePath(url));
    sqlite.exec('PRAGMA short_column_names = OFF; PRAGMA full_column_names = ON;');
    const db = drizzle(createRemoteCallback(sqlite), { schema });
    return { db, sqlite };
}

/**
 * Return the shared database client, creating and caching it on first use.
 *
 * @returns The process-wide Drizzle database client.
 */
export function getDatabase(): Database {
    if (!cachedDb) {
        cachedDb = createDatabase();
    }
    return cachedDb;
}

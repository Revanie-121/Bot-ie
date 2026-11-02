import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
      allowExitOnIdle: true,
    });

    global._postgresPool.on('error', (err) => {
      // Cloud SQL Developer tier scale-to-zero or proxy can close idle sockets;
      // pg Pool automatically evicts the terminated client and opens a fresh one on next query.
      if (
        err?.message?.includes('Connection terminated unexpectedly') ||
        err?.message?.includes('Client has encountered a connection error')
      ) {
        return;
      }
      console.warn('SQL pool client notice:', err.message || err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });


import type { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate as runDrizzleMigrations } from 'drizzle-orm/bun-sql/migrator';
import { fileURLToPath } from 'node:url';
import {
  tbAuditoria, tbIdentidadesAutenticacion, tbPermisos, tbRegistrosPendientes,
  tbRoles, tbRolPermisos, tbSesiones, tbTokenAutenticacion, tbUsuarios,
} from './schema';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const journalPath = new URL('../../drizzle/meta/_journal.json', import.meta.url);
const scripts = [
  new URL('../../database/fn.sql', import.meta.url),
  new URL('../../database/datains.sql', import.meta.url),
];
const modelTables = [
  tbRoles, tbPermisos, tbRolPermisos, tbUsuarios, tbIdentidadesAutenticacion,
  tbTokenAutenticacion, tbRegistrosPendientes, tbSesiones, tbAuditoria,
];

/** Registra como baseline la primera migración si el esquema ya coincide con Drizzle. */
async function baselineExistingSchema(sql: SQL) {
  const journal = JSON.parse(await Bun.file(journalPath).text());
  const initial = journal.entries[0];
  if (!initial) throw new Error('No hay migración inicial en drizzle/meta/_journal.json');

  const [history] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present`;
  if (history.present) {
    const [count] = await sql`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`;
    if (count.total > 0) return;
  }

  let found = 0;
  const missing: string[] = [];
  for (const table of modelTables) {
    const name = getTableName(table);
    const current = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${name}`;
    if (current.length) found++;
    const actual = new Set(current.map(column => column.column_name));
    for (const column of Object.values(getTableColumns(table))) {
      if (!actual.has(column.name)) missing.push(`${name}.${column.name}`);
    }
  }
  if (found === 0) return;
  if (found !== modelTables.length || missing.length)
    throw new Error(`Esquema existente incompleto; faltan tablas o columnas: ${missing.join(', ') || 'tablas del modelo'}`);

  const migrationPath = new URL(`../../drizzle/${initial.tag}.sql`, import.meta.url);
  const hash = createHash('sha256').update(await Bun.file(migrationPath).text()).digest('hex');
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(120509, 20260923)`;
    await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await tx`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL
    )`;
    const [count] = await tx`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`;
    if (count.total === 0) await tx`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${initial.when})`;
  });
}

/** Aplica migraciones Drizzle y luego funciones y datos iniciales de PostgreSQL. */
export async function migrate(sql: SQL) {
  await baselineExistingSchema(sql);
  await runDrizzleMigrations(drizzle({ client: sql }), { migrationsFolder });
  await sql.begin(async tx => {
    for (const path of scripts) await tx.unsafe(await Bun.file(path).text());
  });
}

/** Falla al iniciar si faltan migraciones, tablas o funciones requeridas. */
export async function assertMigrated(sql: SQL) {
  const journal = JSON.parse(await Bun.file(journalPath).text());
  const latestMigration = Math.max(...journal.entries.map((entry: { when: number }) => entry.when));
  const [migrationLog] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present`;
  if (!migrationLog.present) throw new Error('Base sin preparar: ejecuta bun run db:migrate');
  const [migrationState] = await sql`SELECT max(created_at)::bigint AS applied_at FROM drizzle.__drizzle_migrations`;
  if (!migrationState?.applied_at || Number(migrationState.applied_at) < latestMigration)
    throw new Error('Hay migraciones pendientes: ejecuta bun run db:migrate');

  const [ready] = await sql`SELECT
    to_regclass('public.tb_usuarios') IS NOT NULL AS schema_ready,
    to_regprocedure('public.fn_authorized_user(integer, text)') IS NOT NULL
      AND to_regprocedure('public.fn_account_methods(integer)') IS NOT NULL
      AND to_regprocedure('public.fn_password_change(integer, text)') IS NOT NULL AS functions_ready`;
  if (!ready?.schema_ready || !ready?.functions_ready)
    throw new Error('Base sin preparar: ejecuta bun run db:migrate');
}

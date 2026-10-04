import { afterAll, beforeAll, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { migrate } from '../src/db/migrate';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL debe apuntar a una base de pruebas desechable');
const sql = new SQL(url);

class Deshacer extends Error {}

/** Ejecuta la consulta con los privilegios de `role` (SET ROLE) y deshace cualquier cambio. */
async function como(role: string, query: string) {
  try {
    await sql.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      await tx.unsafe(query);
      throw new Deshacer();
    });
  } catch (error) {
    if (error instanceof Deshacer) return 'permitido';
    // 42501 = insufficient_privilege; el texto del error depende del idioma del servidor.
    if ((error as { errno?: string }).errno === '42501') return 'denegado';
    throw error;
  }
}

beforeAll(async () => {
  // En producción los crea server-produccion/postgres/roles.sh con clave; aquí basta con adoptarlos.
  for (const role of ['astudillo_app', 'astudillo_pub', 'astudillo_lectura']) await sql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF;
  END $$`);
  await migrate(sql);
  await migrate(sql);
});

afterAll(() => sql.close());

test('el publicador solo puede tomar y cerrar publicaciones', async () => {
  expect(await como('astudillo_pub', 'SELECT fn_publication_recover()')).toBe('permitido');
  expect(await como('astudillo_pub', 'SELECT * FROM fn_publication_claim()')).toBe('permitido');
  expect(await como('astudillo_pub', `SELECT fn_publication_finish(0, true, 'ok')`)).toBe('permitido');
  expect(await como('astudillo_pub', 'SELECT * FROM tb_usuarios')).toBe('denegado');
  expect(await como('astudillo_pub', 'SELECT * FROM fn_texts_initial()')).toBe('denegado');
  expect(await como('astudillo_pub', `UPDATE tb_publicaciones SET contenido = '{}'`)).toBe('denegado');
  expect(await como('astudillo_pub', 'INSERT INTO tb_publicaciones (contenido) VALUES (\'{}\')')).toBe('denegado');
});

test('el backend usa datos y funciones pero no cambia el esquema', async () => {
  expect(await como('astudillo_app', 'SELECT * FROM fn_texts_initial()')).toBe('permitido');
  expect(await como('astudillo_app', 'SELECT count(*) FROM tb_usuarios')).toBe('permitido');
  expect(await como('astudillo_app', 'SELECT max(created_at) FROM drizzle.__drizzle_migrations')).toBe('permitido');
  expect(await como('astudillo_app', 'CREATE TABLE tb_intrusa (id integer)')).toBe('denegado');
  expect(await como('astudillo_app', 'DROP TABLE tb_auditoria')).toBe('denegado');
  expect(await como('astudillo_app', 'ALTER TABLE tb_usuarios ADD COLUMN intrusa integer')).toBe('denegado');
});

test('el usuario de consulta solo lee', async () => {
  expect(await como('astudillo_lectura', 'SELECT count(*) FROM tb_usuarios')).toBe('permitido');
  expect(await como('astudillo_lectura', 'SELECT count(*) FROM drizzle.__drizzle_migrations')).toBe('permitido');
  expect(await como('astudillo_lectura', `SELECT last_value FROM ${(await sql`
    SELECT schemaname || '.' || sequencename AS s FROM pg_sequences WHERE schemaname = 'public' LIMIT 1`)[0].s}`)).toBe('permitido');
  expect(await como('astudillo_lectura', `SELECT nextval('drizzle.__drizzle_migrations_id_seq')`)).toBe('denegado');
  expect(await como('astudillo_lectura', `UPDATE tb_usuarios SET nombres_completos = 'x'`)).toBe('denegado');
  expect(await como('astudillo_lectura', 'DELETE FROM tb_auditoria')).toBe('denegado');
  expect(await como('astudillo_lectura', 'SELECT * FROM fn_texts_initial()')).toBe('denegado');
  expect(await como('astudillo_lectura', 'CREATE TABLE tb_intrusa (id integer)')).toBe('denegado');
});

test('cualquier otro usuario no puede ejecutar funciones', async () => {
  await sql.unsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astudillo_ajeno') THEN CREATE ROLE astudillo_ajeno NOLOGIN; END IF;
  END $$`);
  await sql.unsafe('GRANT USAGE ON SCHEMA public TO astudillo_ajeno');
  expect(await como('astudillo_ajeno', 'SELECT * FROM fn_texts_initial()')).toBe('denegado');
  await sql.unsafe('REVOKE USAGE ON SCHEMA public FROM astudillo_ajeno');
  await sql.unsafe('DROP ROLE astudillo_ajeno');
});

import { SQL } from 'bun';
import { migrate } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');
const sql = new SQL(url);
try {
  const nuevas = await migrate(sql);
  console.log(nuevas
    ? `${nuevas} migración(es) de tablas aplicada(s). Funciones SQL y datos iniciales actualizados.`
    : 'Tablas al día: no había migraciones nuevas. Funciones SQL y datos iniciales actualizados.');
} finally {
  await sql.close();
}

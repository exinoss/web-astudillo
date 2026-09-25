import { SQL } from 'bun';
import { migrate } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');
const sql = new SQL(url);
try {
  await migrate(sql);
  console.log('Migraciones aplicadas');
} finally {
  await sql.close();
}

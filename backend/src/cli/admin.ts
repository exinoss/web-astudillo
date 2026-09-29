// `bun run admin:crear` y `bun run admin:transferir <correo>`: gestionan el único admin maestro.
// No hay ruta HTTP equivalente a propósito: quien roba una sesión no puede apropiarse del sitio.
import { SQL } from 'bun';
import { requireConfirmation, requireNewPassword } from '../auth/password-policy';
import { callPg } from '../db/call';
import { assertMigrated } from '../db/migrate';

type Resultado = { resultado: string; id_usuario: number | null };

// Sin terminal (entrada redirigida, pruebas) se leen las respuestas línea a línea.
const respuestas = process.stdin.isTTY ? null : (await Bun.stdin.text()).split(/\r?\n/);

/** Pregunta en la terminal; con `oculto` no muestra lo que se escribe. */
async function preguntar(texto: string, oculto = false): Promise<string> {
  if (respuestas) {
    process.stdout.write(texto + '\n');
    return respuestas.shift() ?? '';
  }
  if (!oculto) return prompt(texto) ?? '';
  process.stdout.write(texto + ' ');
  const entrada = process.stdin;
  entrada.setRawMode(true);
  entrada.resume();
  return new Promise(resolver => {
    let valor = '';
    const alTeclear = (datos: Buffer) => {
      for (const tecla of datos.toString('utf8')) {
        if (tecla === '\u0003') process.exit(130);
        if (tecla === '\r' || tecla === '\n') {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off('data', alTeclear);
          process.stdout.write('\n');
          return resolver(valor);
        }
        valor = tecla === '\u007f' || tecla === '\b' ? Array.from(valor).slice(0, -1).join('') : valor + tecla;
      }
    };
    entrada.on('data', alTeclear);
  });
}

const correoValido = (correo: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && correo.length <= 320;

/**
 * Repite el paso hasta que `validar` no lance error, mostrando el motivo cada vez.
 * Sin terminal no hay a quién volver a preguntar: el primer error termina el comando.
 */
async function hastaQueSeaValido<T>(paso: () => Promise<T>, validar: (valor: T) => void): Promise<T> {
  for (;;) {
    const valor = await paso();
    try {
      validar(valor);
      return valor;
    } catch (error) {
      if (respuestas) throw error;
      console.error(`${error instanceof Error ? error.message : error}. Inténtalo de nuevo.`);
    }
  }
}

async function crear(sql: SQL) {
  const correo = await hastaQueSeaValido(async () => (await preguntar('Correo del admin maestro:')).trim(), valor => {
    if (!correoValido(valor)) throw new Error('Correo no válido');
  });
  const nombre = await hastaQueSeaValido(async () => (await preguntar('Nombre completo:')).trim(), valor => {
    if (!valor || valor.length > 200) throw new Error('Escribe el nombre completo');
  });
  // Si la confirmación no coincide se piden las dos de nuevo, por si el error estaba en la primera.
  const contrasenia = await hastaQueSeaValido(async () => {
    const primera = await hastaQueSeaValido(() => preguntar('Contraseña:', true), requireNewPassword);
    return [primera, await preguntar('Repite la contraseña:', true)] as const;
  }, ([primera, segunda]) => requireConfirmation(primera, segunda)).then(([primera]) => primera);
  const hash = await Bun.password.hash(contrasenia, 'argon2id');
  const [fila] = await callPg<Resultado>(sql, 'masterCreate', [correo, nombre, hash]);
  const mensajes: Record<string, string> = {
    ya_existe_maestro: 'Ya existe un admin maestro. Para cambiarlo usa: bun run admin:transferir <correo>',
    correo_en_uso: 'Ese correo ya tiene cuenta. Para darle el rol de maestro usa: bun run admin:transferir <correo>',
  };
  if (fila.resultado !== 'creado') throw new Error(mensajes[fila.resultado] ?? fila.resultado);
  console.log(`Admin maestro creado (${correo}). Ya puede iniciar sesión en el sitio.`);
}

async function transferir(sql: SQL, correo: string | undefined) {
  if (!correo || !correoValido(correo)) throw new Error('Uso: bun run admin:transferir <correo>');
  const confirmacion = await preguntar(`¿Pasar el rol de admin maestro a ${correo}? El actual quedará como admin (s/N):`);
  if (confirmacion.trim().toLowerCase() !== 's') return console.log('Cancelado.');
  const [fila] = await callPg<Resultado>(sql, 'masterTransfer', [correo]);
  const mensajes: Record<string, string> = {
    sin_maestro: 'Todavía no hay admin maestro. Créalo con: bun run admin:crear',
    no_encontrado: 'No hay una cuenta activa con ese correo. La persona debe registrarse primero.',
    ya_es_maestro: 'Esa cuenta ya es el admin maestro.',
  };
  if (fila.resultado !== 'transferido') throw new Error(mensajes[fila.resultado] ?? fila.resultado);
  console.log(`${correo} es ahora el admin maestro.`);
}

const [comando, argumento] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}
const sql = new SQL(url);
try {
  await assertMigrated(sql);
  if (comando === 'crear') await crear(sql);
  else if (comando === 'transferir') await transferir(sql, argumento);
  else throw new Error('Comandos: crear | transferir <correo>');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.close();
}

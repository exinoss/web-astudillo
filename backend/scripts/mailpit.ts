// `bun run mailpit`: levanta el contenedor de Mailpit y espera, reintentando, a que su SMTP responda.
import { connect } from "node:net";

const PUERTO_MAILPIT = 1025;
const ESPERA_MS = 2000;
const host = "127.0.0.1";

const esperar = () => new Promise((resolver) => setTimeout(resolver, ESPERA_MS));

/** Pide a Docker que arranque el contenedor; falla mientras el puente hacia el daemon de WSL no responda. */
function levantarContenedor() {
  const proceso = Bun.spawnSync(
    ["docker", "compose", "-f", "compose.mailpit.yml", "up", "-d"],
    { cwd: `${import.meta.dir}/..`, stdout: "ignore", stderr: "pipe" },
  );
  return { ok: proceso.exitCode === 0, error: proceso.stderr.toString().trim().split("\n").at(-1) };
}

/** Comprueba que el SMTP publicado acepte conexiones (el contenedor puede estar arriba antes que el puerto). */
function smtpResponde() {
  return new Promise<boolean>((resolver) => {
    const socket = connect({ host, port: PUERTO_MAILPIT, timeout: 1500 });
    const terminar = (ok: boolean) => {
      socket.destroy();
      resolver(ok);
    };
    socket.once("connect", () => terminar(true));
    socket.once("timeout", () => terminar(false));
    socket.once("error", () => terminar(false));
  });
}

for (let intento = 1; ; intento++) {
  const { ok, error } = levantarContenedor();
  if (ok) break;
  console.log(`Mailpit: esperando a Docker (intento ${intento}): ${error || "sin respuesta"}`);
  await esperar();
}
for (let intento = 1; !(await smtpResponde()); intento++) {
  console.log(`Mailpit: esperando el SMTP en ${host}:${PUERTO_MAILPIT} (intento ${intento})`);
  await esperar();
}
console.log("Mailpit listo: bandeja en http://localhost:8025");

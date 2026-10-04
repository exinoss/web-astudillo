import { expect, test } from "bun:test";
import { createServer, type Socket } from "node:net";
import type { Config } from "../src/config";
import { correoHtml, correoTexto, IMAGENES, MENSAJES } from "../src/mail/plantilla";
import { createMailer } from "../src/mailer";

const url = "https://sitio.ec/cuenta/verificar/?token=abc&x=<1>";

test("los correos llevan el botón con su enlace, las imágenes incrustadas y el aviso de ignorarlo", async () => {
  for (const crear of Object.values(MENSAJES)) {
    const mensaje = crear(url);
    const html = correoHtml(mensaje);
    // El enlace va escapado: ni la URL ni los textos pueden inyectar HTML.
    expect(html).toContain('href="https://sitio.ec/cuenta/verificar/?token=abc&amp;x=&lt;1&gt;"');
    expect(html).not.toContain("<1>");
    expect(html).toContain(`>${mensaje.boton}</a>`);
    expect(html).toContain("Si usted no solicitó este correo, por favor ignórelo.");
    for (const img of Object.values(IMAGENES)) expect(html).toContain(`src="cid:${img.cid}"`);
    // La versión de texto trae lo mismo, para clientes sin HTML.
    const texto = correoTexto(mensaje);
    expect(texto).toContain(url);
    expect(texto).toContain("ignórelo");
  }
  for (const img of Object.values(IMAGENES))
    expect(await Bun.file(new URL(`../assets/correo/${img.archivo}`, import.meta.url)).exists()).toBe(true);
});

test("el transporte SMTP entrega los tres correos completos y propaga un rechazo", async () => {
  const recibidos: string[] = [], comandos: string[] = [];
  const conexiones = new Set<Socket>();
  const server = createServer(socket => {
    conexiones.add(socket);
    socket.on("close", () => conexiones.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP\r\n");
    let buffer = "", datos = false;
    socket.on("data", chunk => {
      buffer += chunk;
      while (true) {
        if (datos) {
          const fin = buffer.indexOf("\r\n.\r\n");
          if (fin < 0) return;
          recibidos.push(buffer.slice(0, fin).replace(/^\.\./gm, "."));
          buffer = buffer.slice(fin + 5);
          datos = false;
          socket.write("250 Aceptado\r\n");
          continue;
        }
        const fin = buffer.indexOf("\r\n");
        if (fin < 0) return;
        const comando = buffer.slice(0, fin);
        buffer = buffer.slice(fin + 2);
        comandos.push(comando);
        if (comando.startsWith("EHLO")) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (comando.startsWith("AUTH PLAIN")) socket.write("235 Autenticado\r\n");
        else if (comando.startsWith("RCPT TO:<rechazado@")) socket.write("550 Destinatario rechazado\r\n");
        else if (comando === "DATA") { datos = true; socket.write("354 Enviar mensaje\r\n"); }
        else if (comando === "QUIT") socket.end("221 Adios\r\n");
        else if (/^(MAIL FROM:|RCPT TO:|RSET)/.test(comando)) socket.write("250 OK\r\n");
        else socket.write("502 Comando no admitido\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP local sin puerto");
  const config: Config = {
    databaseUrl: "postgres://test@localhost/test", origin: "https://sitio.ec",
    jwtSecret: "clave-de-prueba-aleatoria-de-mas-de-32-caracteres", googleClientId: "test",
    port: 3000, bindHost: "127.0.0.1", trustProxyIp: false, production: false,
    smtp: { host: "127.0.0.1", port: address.port, user: "test", pass: "test",
      from: "remitente@example.test", name: "Sitio" },
    mediaDir: "medios-pruebas", privateMediaDir: "medios-pruebas-privados",
  };
  const mailer = createMailer(config);
  try {
    for (const crear of Object.values(MENSAJES)) {
      const mensaje = crear(url);
      await mailer.send("destino@example.test", mensaje);
      const raw = recibidos.at(-1)!;
      expect(raw).toContain("From: Sitio <remitente@example.test>");
      expect(raw).toContain("To: destino@example.test");
      const partes = raw.split(/\r\n--[^\r\n]+\r\n/);
      const cuerpo = (tipo: string) => {
        const parte = partes.find(p => p.startsWith(`Content-Type: ${tipo};`));
        if (!parte) throw new Error(`Falta ${tipo} en el correo recibido`);
        const inicio = parte.indexOf("\r\n\r\n"), contenido = parte.slice(inicio + 4);
        // MIME cambia los saltos y codifica UTF-8; se compara el contenido decodificado.
        return Buffer.from(contenido.replace(/=\r\n/g, "").replace(/=([\da-f]{2})/gi,
          (_, hex) => String.fromCharCode(parseInt(hex, 16))), "latin1").toString("utf8")
          .replace(/\r\n/g, "\n").trimEnd();
      };
      expect(cuerpo("text/plain")).toBe(correoTexto(mensaje).trimEnd());
      expect(cuerpo("text/html")).toBe(correoHtml(mensaje).trimEnd());
      for (const img of Object.values(IMAGENES)) {
        const parte = partes.find(p => p.includes(`Content-ID: <${img.cid}>`));
        expect(parte).toBeDefined();
        const contenido = parte!.slice(parte!.indexOf("\r\n\r\n") + 4);
        expect(Buffer.from(contenido, "base64")).toEqual(Buffer.from(
          await Bun.file(new URL(`../assets/correo/${img.archivo}`, import.meta.url)).arrayBuffer()));
      }
    }
    expect(recibidos).toHaveLength(Object.keys(MENSAJES).length);
    expect(comandos.filter(c => c.startsWith("AUTH PLAIN "))).toEqual(
      Object.keys(MENSAJES).map(() => `AUTH PLAIN ${Buffer.from("\0test\0test").toString("base64")}`));
    await expect(mailer.send("rechazado@example.test", MENSAJES.verificar(url)))
      .rejects.toMatchObject({ code: "EENVELOPE", responseCode: 550 });
    expect(recibidos).toHaveLength(Object.keys(MENSAJES).length);
  } finally {
    for (const socket of conexiones) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

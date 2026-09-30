import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";
import type { Config } from "./config";
import { correoHtml, correoTexto, IMAGENES, type Mensaje } from "./mail/plantilla";

export type Mailer = { send(to: string, mensaje: Mensaje): Promise<void> };

const assets = fileURLToPath(new URL("../assets/correo/", import.meta.url));
/** Las imágenes van dentro del correo: se ven sin depender de que el sitio sea accesible desde el lector. */
const attachments = Object.values(IMAGENES).map(img => ({ filename: img.archivo, path: assets + img.archivo, cid: img.cid }));

/** Crea el transporte SMTP y envía los correos de cuenta en HTML con la marca, más su versión de texto. */
export function createMailer(config: Config): Mailer {
  const transport = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    requireTLS: config.production && config.smtp.port !== 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return {
    async send(to, mensaje) {
      await transport.sendMail({
        from: { name: config.smtp.name, address: config.smtp.from },
        to, subject: mensaje.asunto, text: correoTexto(mensaje), html: correoHtml(mensaje), attachments,
      });
    },
  };
}

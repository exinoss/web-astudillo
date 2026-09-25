import nodemailer from "nodemailer";
import type { Config } from "./config";

export type Mailer = { send(to: string, subject: string, url: string): Promise<void> };

/** Crea el transporte SMTP y envía enlaces de autenticación en texto plano. */
export function createMailer(config: Config): Mailer {
  const transport = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    requireTLS: config.production && config.smtp.port !== 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return {
    /** Envía un enlace transaccional al correo indicado. */
    async send(to, subject, url) {
      await transport.sendMail({
        from: { name: config.smtp.name, address: config.smtp.from },
        to, subject, text: `${subject}\n\nAbre este enlace para continuar: ${url}\n\nSi no lo solicitaste, ignora este mensaje.`,
      });
    },
  };
}

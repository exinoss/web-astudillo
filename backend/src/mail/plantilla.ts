// Plantilla de los correos de cuenta (diseño aprobado en design/propuestas/correo/). HTML de tablas con
// estilos en línea, que es lo que respetan Gmail, Outlook y los clientes móviles. Las imágenes viajan
// incrustadas en el correo (adjuntos CID, ver mailer.ts); la maqueta de design/ las enlaza como archivos.

export interface Mensaje {
  asunto: string;
  /** Texto oculto que los clientes muestran junto al asunto en la bandeja. */
  resumen: string;
  titulo: string;
  parrafos: string[];
  boton: string;
  url: string;
  vigencia: string;
}

export interface Imagenes { logo: string; cabecera: string; hashtag: string }

/** Imágenes incrustadas: `cid` es como las cita el HTML y `archivo`, de dónde las adjunta el mailer. */
export const IMAGENES = {
  logo: { cid: 'logo@astudillo', archivo: 'logo.png' },
  cabecera: { cid: 'cabecera@astudillo', archivo: 'cabecera.jpg' },
  hashtag: { cid: 'nuevahistoria@astudillo', archivo: 'nuevahistoria.png' },
} as const;

const CID: Imagenes = {
  logo: `cid:${IMAGENES.logo.cid}`, cabecera: `cid:${IMAGENES.cabecera.cid}`, hashtag: `cid:${IMAGENES.hashtag.cid}`,
};

const AZUL = '#063176', NARANJA = '#F47F0E', AMARILLO = '#F9C31B', ROJO = '#E0121F';
/** Amarillo de la foto de cabecera: la barra del logo lo usa para que no se note la unión. */
const AMARILLO_FOTO = '#FEC110';
const TEXTO_SUAVE = '#50617d', PIE_SUAVE = '#d5e0f2';
const DISPLAY = "'Barlow Condensed','Arial Narrow','Roboto Condensed',Arial,sans-serif";
const CUERPO = "'DM Sans',Arial,Helvetica,sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** HTML del correo: cabecera con la marca, foto, título, botón y pie con #lanuevahistoria. */
export function correoHtml(m: Mensaje, img: Imagenes = CID) {
  const url = esc(m.url);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(m.asunto)}</title>
<style>
  @media (max-width: 620px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .titulo { font-size: 34px !important; }
    .boton a { display: block !important; }
  }
  a { color: ${AZUL}; }
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(m.resumen)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:3px;overflow:hidden;">

    <!-- Cabecera: como la barra del sitio (amarilla, logo y nombre). -->
    <tr><td class="px" style="background:${AMARILLO_FOTO};padding:18px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><img src="${img.logo}" width="72" height="36" alt="PSC, Lista 6" style="display:block;border:0;font-family:${CUERPO};font-size:12px;font-weight:700;color:${AZUL};"></td>
        <td class="marca-texto" style="vertical-align:middle;padding-left:14px;font-family:${DISPLAY};color:${AZUL};line-height:1;">
          <div style="font-size:15px;font-weight:600;">CARLOS</div>
          <div style="font-size:22px;font-weight:700;">ASTUDILLO</div>
          <div style="font-family:${CUERPO};font-size:9px;font-weight:700;letter-spacing:1px;padding-top:3px;">ALCALDÍA DE SAN LORENZO</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Foto de campaña. -->
    <tr><td style="background:${AMARILLO_FOTO};">
      <img src="${img.cabecera}" width="600" alt="Carlos Astudillo, candidato a la alcaldía de San Lorenzo" style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:${CUERPO};font-size:13px;line-height:1.4;color:${AZUL};padding:0;">
    </td></tr>

    <!-- Título: como la cabecera naranja de las páginas de cuenta. -->
    <tr><td class="px" style="background:${NARANJA};border-bottom:4px solid ${AMARILLO};padding:26px 32px 24px;">
      <div style="font-family:${CUERPO};font-size:11px;font-weight:700;letter-spacing:2px;color:${AZUL};">
        <span style="display:inline-block;width:30px;height:3px;background:${ROJO};vertical-align:middle;margin-right:10px;"></span>PARTICIPA EN SAN LORENZO
      </div>
      <h1 class="titulo" style="margin:10px 0 0;font-family:${DISPLAY};font-size:42px;line-height:1.05;font-weight:600;color:${AZUL};">${esc(m.titulo)}</h1>
    </td></tr>

    <!-- Mensaje y botón. -->
    <tr><td class="px" style="padding:30px 32px 8px;font-family:${CUERPO};font-size:16px;line-height:1.6;color:${AZUL};">
      ${m.parrafos.map(p => `<p style="margin:0 0 16px;">${esc(p)}</p>`).join('')}
    </td></tr>
    <tr><td class="px boton" style="padding:6px 32px 8px;">
      <a href="${url}" style="display:inline-block;background:${AZUL};color:#ffffff;font-family:${CUERPO};font-size:16px;font-weight:700;line-height:1;text-decoration:none;text-align:center;padding:18px 36px;border-radius:3px;">${esc(m.boton)}</a>
    </td></tr>
    <tr><td class="px" style="padding:14px 32px 26px;font-family:${CUERPO};font-size:13px;line-height:1.5;color:${TEXTO_SUAVE};">
      ${esc(m.vigencia)}
    </td></tr>

    <!-- Respaldo si el botón no funciona y aviso de seguridad. -->
    <tr><td class="px" style="padding:0 32px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d9e0ea;">
        <tr><td style="padding-top:18px;font-family:${CUERPO};font-size:12px;line-height:1.5;color:${TEXTO_SUAVE};">
          Si el botón no funciona, copia este enlace en tu navegador:<br>
          <a href="${url}" style="color:${TEXTO_SUAVE};word-break:break-all;">${url}</a>
        </td></tr>
        <tr><td style="padding-top:14px;font-family:${CUERPO};font-size:13px;line-height:1.5;color:${AZUL};font-weight:700;">
          Si usted no solicitó este correo, por favor ignórelo.
        </td></tr>
      </table>
    </td></tr>

    <!-- Pie azul con #lanuevahistoria. -->
    <tr><td align="center" style="background:${AZUL};padding:26px 24px 24px;">
      <img src="${img.hashtag}" width="186" height="53" alt="#lanuevahistoria" style="display:block;border:0;margin:0 auto 14px;font-family:${DISPLAY};font-size:22px;font-weight:700;color:${AMARILLO};text-align:center;">
      <div style="font-family:${DISPLAY};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px;">CARLOS ASTUDILLO</div>
      <div style="font-family:${CUERPO};font-size:12px;line-height:1.6;color:${PIE_SUAVE};padding-top:4px;">
        Partido Social Cristiano · Lista 6<br>San Lorenzo, Esmeraldas
      </div>
      <div style="font-family:${CUERPO};font-size:11px;line-height:1.5;color:${PIE_SUAVE};padding-top:12px;">
        Mensaje automático: no respondas a este correo.
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Versión de texto plano con el mismo contenido, para clientes sin HTML. */
export function correoTexto(m: Mensaje) {
  return [m.titulo, '', ...m.parrafos.flatMap(p => [p, '']), `${m.boton}: ${m.url}`, '', m.vigencia, '',
    'Si usted no solicitó este correo, por favor ignórelo.', '', '#lanuevahistoria · Carlos Astudillo · Partido Social Cristiano · Lista 6'].join('\n');
}

/** Los tres correos de cuenta; `url` la pone el backend al enviarlos. */
export const MENSAJES = {
  verificar: (url: string): Mensaje => ({
    asunto: 'Confirma tu correo', resumen: 'Un paso más para activar tu cuenta.', titulo: 'Confirma tu correo',
    parrafos: ['Hola:', 'Gracias por sumarte. Pulsa el botón para confirmar tu correo y activar tu cuenta.'],
    boton: 'Confirmar mi correo', url, vigencia: 'El enlace vence en 30 minutos y solo se puede usar una vez.',
  }),
  recuperar: (url: string): Mensaje => ({
    asunto: 'Restablece tu contraseña', resumen: 'Crea una contraseña nueva para tu cuenta.', titulo: 'Restablece tu contraseña',
    parrafos: ['Hola:', 'Recibimos una solicitud para cambiar la contraseña de tu cuenta. Pulsa el botón para crear una nueva.'],
    boton: 'Crear contraseña nueva', url, vigencia: 'El enlace vence en 30 minutos y solo se puede usar una vez.',
  }),
  acceso: (url: string): Mensaje => ({
    asunto: 'Termina de iniciar sesión', resumen: 'Por seguridad, termina de entrar desde este correo.', titulo: 'Termina de entrar',
    parrafos: ['Hola:', 'Por seguridad, para terminar de iniciar sesión en tu cuenta necesitamos que pulses el botón desde este correo.'],
    boton: 'Entrar a mi cuenta', url, vigencia: 'El enlace vence en 15 minutos y solo se puede usar una vez.',
  }),
};

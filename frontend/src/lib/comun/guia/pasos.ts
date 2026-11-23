export type Posicion = "centro" | "izquierda" | "derecha";
export type Gesto = "idle" | "sonrisa" | "explicar" | "apuntar_usuario" | "senalar_ui" | "senalar_izquierda" | "aprobacion";

export interface Visita {
  en: string;
  sel: string;
  clic?: boolean;
  max?: number;
  foco?: string[];
}

export interface Paso {
  id: string;
  pagina: string;
  texto: string;
  foco?: string[];
  posicion?: Posicion;
  gesto?: Gesto;
  arriba?: boolean;
  fijo?: boolean;
  focoSigue?: boolean;
  soloSinSesion?: boolean;
  esperar?: string;
  correo?: boolean;
  recorrido?: Visita[];
  pulsar?: string;
  ir?: string;
}

export const SALUDO = { id: "00-guia", texto: "¡Hola! ¿Te enseño a usar la página?" };

const NAV = "#main-nav";

export const PASOS: Paso[] = [
  { id: "01-bienvenida", pagina: "/", posicion: "centro", gesto: "apuntar_usuario", arriba: true,
    texto: "¡Hola! Soy Carlos Astudillo. Te enseño rápido cómo usar esta página. ¡Vamos!" },
  { id: "02-menu", pagina: "/", foco: [NAV, ".menu-toggle"], arriba: true, focoSigue: true,
    recorrido: [
      { en: "menú", sel: ".menu-toggle", clic: true },
      { en: "Acerca de mí", sel: `${NAV} button[aria-controls="about-menu"]` },
      { en: "Mi equipo", sel: `${NAV} a[href="/mi-equipo/"]` },
      { en: "Propuestas", sel: `${NAV} button[aria-controls="proposals-menu"]`, clic: true, foco: [`${NAV} button[aria-controls="proposals-menu"]`, "#proposals-menu"] },
    ],
    texto: "Arriba está el menú. En «Acerca de mí» conoces mi historia. En «Mi equipo», a quienes me acompañan. Y en «Propuestas», todos mis planes para San Lorenzo." },
  { id: "03-propuestas", pagina: "/", foco: ["#propuestas .site-container"], posicion: "derecha", focoSigue: true,
    recorrido: [
      { en: "cuadros", sel: "#propuestas .proposal-card", max: 2, foco: ["#propuestas .proposal-card"] },
      { en: "Avance de obras", sel: '#propuestas a[href="/ciudadania/obras-en-ejecucion/"]' },
    ],
    texto: "Mis propuestas también están aquí, en estos cuadros: toca el que te interese para verlo completo. Y en «Avance de obras» ves cómo van los trabajos." },
  { id: "04-preguntas", pagina: "/", foco: ["#preguntas .site-container"], posicion: "derecha", focoSigue: true,
    recorrido: [{ en: "Toca", sel: "#preguntas summary", max: 1, clic: true }],
    texto: "Aquí respondo las preguntas que más me hacen. Toca una para leer mi respuesta." },
  { id: "05-accesibilidad", pagina: "/", foco: ["#access-panel", ".access-toggle"], fijo: true,
    recorrido: [{ en: "este botón", sel: ".access-toggle", clic: true }],
    texto: "Si te cuesta leer, este botón agranda la letra y cambia los colores." },
  { id: "06-contacto", pagina: "/", foco: ["#contacto .site-container > div"], posicion: "derecha",
    recorrido: [{ en: "WhatsApp", sel: '#contacto a[aria-label*="WhatsApp"]' }],
    texto: "Y si quieres hablar conmigo, escríbeme por WhatsApp o sígueme en mis redes." },
  { id: "07-tu-voz", pagina: "/", foco: ['section[aria-label="Participación ciudadana"]'], posicion: "derecha", focoSigue: true,
    recorrido: [
      { en: "alerta", sel: '.citizen-link[href="/ciudadania/alerta-ciudadana/"]' },
      { en: "sugerencia", sel: '.citizen-link[href="/ciudadania/sugerencias/"]' },
      { en: "chat", sel: '.citizen-link[href="/ciudadania/chat/"]' },
    ],
    pulsar: '.citizen-link[href="/ciudadania/alerta-ciudadana/"]',
    texto: "En «Tu voz cuenta» podrás enviar una alerta si algo pasa en tu sector, dejarme una sugerencia y, si tienes dudas, preguntar en el chat. Mira cómo se envía una alerta." },
  { id: "08-alerta", pagina: "/ciudadania/alerta-ciudadana/", foco: ["#alerta-form"], posicion: "derecha", focoSigue: true,
    recorrido: [
      { en: "tipo", sel: "#alerta-tipo" },
      { en: "barrio", sel: "#alerta-sector" },
      { en: "qué pasa", sel: "#alerta-descripcion" },
      { en: "foto", sel: "#alerta-foto-zona" },
      { en: "«Enviar", sel: "#alerta-form [data-envia]" },
    ],
    ir: "/ciudadania/sugerencias/",
    texto: "Elige el tipo de problema, escribe tu barrio y cuéntame qué pasa. Si puedes, añade una foto. Luego toca «Enviar alerta»." },
  { id: "09-sugerencia", pagina: "/ciudadania/sugerencias/", foco: ["#sugerencia-form"], posicion: "derecha", focoSigue: true,
    recorrido: [
      { en: "tema", sel: "#sugerencia-tema" },
      { en: "idea", sel: "#sugerencia-mensaje" },
      { en: "«Enviar", sel: "#sugerencia-form [data-envia]" },
      { en: "A un lado", sel: 'aside[aria-labelledby="historial-titulo"]' },
    ],
    texto: "Una sugerencia es igual: elige el tema, escribe tu idea y toca «Enviar sugerencia». A un lado ves las que ya se publicaron." },
  { id: "10-necesitas-cuenta", pagina: "/ciudadania/sugerencias/", foco: [".account-link"], arriba: true, soloSinSesion: true, pulsar: ".account-link",
    texto: "Para enviarlas necesitas una cuenta. Te enseño a crearla." },
  { id: "11-acceso", pagina: "/cuenta/", foco: ["#login-panel"], posicion: "izquierda", soloSinSesion: true, esperar: "#login-panel:not(.invisible)", focoSigue: true,
    recorrido: [
      { en: "correo", sel: "#login-correo" },
      { en: "contraseña", sel: "#login-contrasenia" },
      { en: "Google", sel: "#google-login-button > *, #google-login-button:empty, #google-login-unavailable", max: 1 },
      { en: "crea una cuenta", sel: '#login-panel a[href="/cuenta/registro/"]' },
    ],
    pulsar: '#login-panel a[href="/cuenta/registro/"]',
    texto: "Aquí entras con tu correo y tu contraseña, o con tu cuenta de Google. Si es tu primera vez, crea una cuenta aquí." },
  { id: "12-registro", pagina: "/cuenta/registro/", foco: ["#register-form"], posicion: "izquierda", soloSinSesion: true, focoSigue: true,
    recorrido: [
      { en: "nombre", sel: "#register-name" },
      { en: "correo", sel: "#register-email" },
      { en: "contraseña", sel: "#register-password" },
      { en: "Acepta", sel: "#register-aceptacion" },
      { en: "«Enviar", sel: '#register-form button[type="submit"]' },
    ],
    texto: "Escribe tu nombre, tu correo y una contraseña con letras, números y un símbolo. Acepta los términos y toca «Enviar enlace de verificación»." },
  { id: "13-correo", pagina: "/cuenta/registro/", posicion: "izquierda", gesto: "senalar_ui", soloSinSesion: true, correo: true, foco: [".correo-guia"], fijo: true, focoSigue: true,
    recorrido: [{ en: "«Confirmar", sel: ".correo-guia-boton", clic: true }],
    texto: "Luego abre tu correo: te llegará este mensaje. Si no lo ves, revisa tu carpeta de spam. Toca «Confirmar mi correo» y ¡listo, ya puedes entrar!" },
  { id: "14-despedida", pagina: "*", posicion: "centro", gesto: "aprobacion",
    texto: "¡Gracias por acompañarme! Por ti, San Lorenzo. ¡Lista 6!" },
];

/** Fracción del audio (0-1) en que empieza cada visita: cuando se dice su palabra, `adelanto` segundos antes; sin ella, se reparten por igual. */
export function momentos(paso: Paso, duracion: number, adelanto = 0.4) {
  const dur = duracion || 5;
  return (paso.recorrido ?? []).map((visita, k, todas) => {
    const pos = paso.texto.indexOf(visita.en);
    return pos >= 0 ? Math.max(0, pos / paso.texto.length - adelanto / dur) : (k + 1) / (todas.length + 1);
  });
}

/** Lado de la pantalla opuesto al elemento, para señalarlo hacia dentro; si ocupa casi todo el ancho o está centrado, `porDefecto`. */
export function ladoPara(r: { x: number; w: number } | null, ancho: number, porDefecto: Posicion): Posicion {
  if (!r || r.w > ancho * 0.7) return porDefecto;
  const centro = r.x + r.w / 2;
  if (Math.abs(centro - ancho / 2) < ancho * 0.06) return porDefecto;
  return centro > ancho / 2 ? "izquierda" : "derecha";
}

/** Gesto con el brazo que apunta hacia el centro de la pantalla desde `posicion`. */
export const gestoDe = (posicion: Posicion): Gesto =>
  posicion === "izquierda" ? "senalar_ui" : posicion === "derecha" ? "senalar_izquierda" : "explicar";

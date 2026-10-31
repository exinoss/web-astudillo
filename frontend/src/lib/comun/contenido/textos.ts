// Botones y destinos de enlaces no están aquí a propósito (salvo las redes, en redes.ts).
// Sin dependencias: también lo usa el panel en el navegador.
export interface TextDefinition {
  lugar: string;
  campo: string;
  max: number;
  /** Página donde aparece, para «Editar en el sitio». */
  ruta: string;
}

const RUTAS: Record<string, string> = {
  "Barra superior": "/", "Todo el sitio": "/", "Pie de página": "/",
  "Detalle de cada propuesta": "/propuestas/agua-potable/", "Acerca de mí": "/acerca-de-nosotros/",
  "Biografía": "/acerca-de-nosotros/biografia/", "Por qué quiero ser alcalde": "/acerca-de-nosotros/por-que-quiero-ser-alcalde/",
  "Conoce más sobre mí": "/acerca-de-nosotros/conoce-mas/", "Obras en ejecución": "/ciudadania/obras-en-ejecucion/",
  "Mi equipo": "/mi-equipo/",
};
const t = (lugar: string, campo: string, max = 120): TextDefinition =>
  ({ lugar, campo, max, ruta: RUTAS[lugar] ?? "/" });

export const TEXTOS = {
  "global.ubicacion": t("Barra superior", "Ubicación", 60),
  "global.partido": t("Barra superior", "Partido", 60),
  "global.lista": t("Barra superior", "Lista", 20),
  "global.lema": t("Todo el sitio", "Lema (pie y contacto)", 60),
  "pie.nombre": t("Pie de página", "Nombre", 60),
  "pie.linea-1": t("Pie de página", "Primera línea", 80),
  "pie.linea-2": t("Pie de página", "Segunda línea", 80),

  "inicio.carrusel.antetitulo": t("Portada · Carrusel (móvil)", "Antetítulo", 40),
  "inicio.carrusel.titulo": t("Portada · Carrusel (móvil)", "Título", 60),
  "inicio.carrusel.texto": t("Portada · Carrusel (móvil)", "Texto", 80),
  "inicio.carrusel-2.antetitulo": t("Portada · Carrusel, diapositiva 2", "Antetítulo", 40),
  "inicio.carrusel-2.titulo": t("Portada · Carrusel, diapositiva 2", "Título", 60),
  "inicio.carrusel-2.destacado": t("Portada · Carrusel, diapositiva 2", "Título (parte amarilla)", 30),
  "inicio.participa.antetitulo": t("Portada · Tu voz cuenta", "Antetítulo", 40),
  "inicio.participa.titulo": t("Portada · Tu voz cuenta", "Título", 40),
  "inicio.conoce.antetitulo": t("Portada · Conoce a Carlos", "Antetítulo", 40),
  "inicio.conoce.titulo": t("Portada · Conoce a Carlos", "Título", 60),
  "inicio.conoce.destacado": t("Portada · Conoce a Carlos", "Título (parte azul)", 30),
  "inicio.conoce.cita": t("Portada · Conoce a Carlos", "Cita", 240),
  "inicio.conoce.texto": t("Portada · Conoce a Carlos", "Texto", 240),
  "inicio.cifras.visitas": t("Portada · Conoce a Carlos", "Cifra de visitas · texto", 40),
  "inicio.cifras.voces": t("Portada · Conoce a Carlos", "Cifra de voces ciudadanas · texto", 40),
  "inicio.cifras.personas": t("Portada · Conoce a Carlos", "Cifra de personas que se sumaron · texto", 40),
  "inicio.propuestas.antetitulo": t("Portada · Propuestas", "Antetítulo", 40),
  "inicio.propuestas.titulo": t("Portada · Propuestas", "Título", 40),
  "inicio.propuestas.destacado": t("Portada · Propuestas", "Título (parte azul)", 30),
  "inicio.propuestas.texto-1": t("Portada · Propuestas", "Texto, primera frase", 80),
  "inicio.propuestas.texto-2": t("Portada · Propuestas", "Texto, segunda frase", 120),
  "inicio.contacto.antetitulo": t("Portada · Contacto", "Antetítulo", 40),
  "inicio.contacto.titulo": t("Portada · Contacto", "Título", 40),
  "inicio.contacto.destacado": t("Portada · Contacto", "Título (segunda parte)", 30),
  "inicio.contacto.texto": t("Portada · Contacto", "Texto", 200),
  "inicio.contacto.facebook.texto": t("Portada · Contacto", "Facebook · descripción", 160),
  "inicio.contacto.instagram.texto": t("Portada · Contacto", "Instagram · descripción", 160),
  "inicio.contacto.tiktok.texto": t("Portada · Contacto", "TikTok · descripción", 160),
  "inicio.contacto.whatsapp.texto": t("Portada · Contacto", "WhatsApp · descripción", 120),

  "propuesta.antetitulo": t("Detalle de cada propuesta", "Antetítulo", 40),
  "propuesta.titulo": t("Detalle de cada propuesta", "Título", 60),
  "propuesta.texto": t("Detalle de cada propuesta", "Texto", 300),
  "propuesta.obra.antetitulo": t("Detalle de cada propuesta", "Avance de la obra · título", 40),
  "propuesta.preparacion.titulo": t("Detalle de cada propuesta", "Aviso · título", 60),
  "propuesta.preparacion.texto": t("Detalle de cada propuesta", "Aviso · texto", 300),
  "propuesta.perspectiva.titulo": t("Detalle de cada propuesta", "Sugerencias · título", 80),
  "propuesta.perspectiva.texto": t("Detalle de cada propuesta", "Sugerencias · texto (va seguido del nombre de la propuesta)", 120),

  "acerca.antetitulo": t("Acerca de mí", "Antetítulo", 40),
  "acerca.nombre": t("Acerca de mí", "Nombre", 40),
  "acerca.apellido": t("Acerca de mí", "Apellido (parte azul)", 40),
  "acerca.subtitulo": t("Acerca de mí", "Subtítulo", 160),
  "biografia.antetitulo": t("Biografía", "Antetítulo", 40),
  "biografia.titulo": t("Biografía", "Título", 40),
  "biografia.nota": t("Biografía", "Nota", 200),
  "biografia.recorre": t("Biografía", "Invitación a bajar", 40),
  "alcalde.antetitulo": t("Por qué quiero ser alcalde", "Antetítulo", 40),
  "alcalde.titulo": t("Por qué quiero ser alcalde", "Título", 80),
  "alcalde.cita": t("Por qué quiero ser alcalde", "Cita", 400),
  "alcalde.nota": t("Por qué quiero ser alcalde", "Nota", 400),
  "conoce-mas.antetitulo": t("Conoce más sobre mí", "Antetítulo", 40),
  "conoce-mas.titulo": t("Conoce más sobre mí", "Título", 80),
  "conoce-mas.texto": t("Conoce más sobre mí", "Texto", 400),
  "equipo.antetitulo": t("Mi equipo", "Antetítulo", 60),
  "equipo.titulo": t("Mi equipo", "Título", 60),
  "equipo.texto": t("Mi equipo", "Texto", 300),
  "obras.antetitulo": t("Obras en ejecución", "Antetítulo", 40),
  "obras.titulo": t("Obras en ejecución", "Título", 60),
  "obras.intro": t("Obras en ejecución", "Introducción", 160),
  "obras.nota": t("Obras en ejecución", "Nota", 240),
  "ciudadania.sugerencias.nombre": { lugar:'Sugerencias',campo:'Nombre',max:60,ruta:'/ciudadania/sugerencias/' },
  "ciudadania.sugerencias.descripcion": { lugar:'Sugerencias',campo:'Introducción',max:200,ruta:'/ciudadania/sugerencias/' },
  "ciudadania.alerta-ciudadana.nombre": { lugar:'Alerta ciudadana',campo:'Nombre',max:60,ruta:'/ciudadania/alerta-ciudadana/' },
  "ciudadania.alerta-ciudadana.descripcion": { lugar:'Alerta ciudadana',campo:'Introducción',max:200,ruta:'/ciudadania/alerta-ciudadana/' },
  "ciudadania.chat.nombre": { lugar:'Chat',campo:'Nombre',max:60,ruta:'/ciudadania/chat/' },
  "ciudadania.chat.descripcion": { lugar:'Chat',campo:'Introducción',max:200,ruta:'/ciudadania/chat/' },
} satisfies Record<string, TextDefinition>;

export type TextKey = keyof typeof TEXTOS;

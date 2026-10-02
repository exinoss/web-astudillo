// Botones y destinos de enlaces no están aquí a propósito (salvo las redes, en redes.ts).
// Sin dependencias: también lo usa el panel en el navegador.
export interface TextDefinition {
  texto: string;
  lugar: string;
  campo: string;
  max: number;
  /** Página donde aparece, para «Editar en el sitio». */
  ruta: string;
}

const RUTAS: Record<string, string> = {
  "Barra superior": "/", "Todo el sitio": "/", "Pie de página": "/",
  "Detalle de propuesta (las 7)": "/propuestas/agua-potable/", "Acerca de nosotros": "/acerca-de-nosotros/",
  "Biografía": "/acerca-de-nosotros/biografia/", "Por qué quiero ser alcalde": "/acerca-de-nosotros/por-que-quiero-ser-alcalde/",
  "Conoce más sobre Carlos": "/acerca-de-nosotros/conoce-mas/", "Obras en ejecución": "/ciudadania/obras-en-ejecucion/",
};
const t = (lugar: string, campo: string, texto: string, max = 120): TextDefinition =>
  ({ texto, lugar, campo, max, ruta: RUTAS[lugar] ?? "/" });

export const TEXTOS = {
  "global.ubicacion": t("Barra superior", "Ubicación", "San Lorenzo, Esmeraldas", 60),
  "global.partido": t("Barra superior", "Partido", "Partido Social Cristiano", 60),
  "global.lista": t("Barra superior", "Lista", "LISTA 6", 20),
  "global.lema": t("Todo el sitio", "Lema (pie y contacto)", "Por ti, San Lorenzo.", 60),
  "pie.nombre": t("Pie de página", "Nombre", "CARLOS ASTUDILLO", 60),
  "pie.linea-1": t("Pie de página", "Primera línea", "Candidato a la alcaldía de San Lorenzo", 80),
  "pie.linea-2": t("Pie de página", "Segunda línea", "Partido Social Cristiano · Lista 6", 80),

  "inicio.carrusel.antetitulo": t("Portada · Carrusel (móvil)", "Antetítulo", "PSC · LISTA 6", 40),
  "inicio.carrusel.titulo": t("Portada · Carrusel (móvil)", "Título", "Por ti,\nSan Lorenzo.", 60),
  "inicio.carrusel.texto": t("Portada · Carrusel (móvil)", "Texto", "Carlos Astudillo\nCandidato a alcalde", 80),
  "inicio.carrusel-2.antetitulo": t("Portada · Carrusel, diapositiva 2", "Antetítulo", "CONOCE AL CANDIDATO", 40),
  "inicio.carrusel-2.titulo": t("Portada · Carrusel, diapositiva 2", "Título", "Respeto.\nCoherencia.", 60),
  "inicio.carrusel-2.destacado": t("Portada · Carrusel, diapositiva 2", "Título (parte amarilla)", "Claridad.", 30),
  "inicio.participa.antetitulo": t("Portada · Tu voz cuenta", "Antetítulo", "ESTAMOS PARA ESCUCHARTE", 40),
  "inicio.participa.titulo": t("Portada · Tu voz cuenta", "Título", "Tu voz cuenta.", 40),
  "inicio.conoce.antetitulo": t("Portada · Conoce a Carlos", "Antetítulo", "CONOCE A CARLOS", 40),
  "inicio.conoce.titulo": t("Portada · Conoce a Carlos", "Título", "Una ciudad.\nTodas sus", 60),
  "inicio.conoce.destacado": t("Portada · Conoce a Carlos", "Título (parte azul)", "voces.", 30),
  "inicio.conoce.cita": t("Portada · Conoce a Carlos", "Cita",
    "«Creo en una ciudad donde el progreso no sea privilegio de pocos, sino derecho de todos».", 240),
  "inicio.conoce.texto": t("Portada · Conoce a Carlos", "Texto",
    "Carlos Astudillo, candidato a la alcaldía de San Lorenzo por el Partido Social Cristiano, Lista 6.", 240),
  "inicio.valores.1": t("Portada · Conoce a Carlos", "Valor 1", "Respeto", 20),
  "inicio.valores.2": t("Portada · Conoce a Carlos", "Valor 2", "Coherencia", 20),
  "inicio.valores.3": t("Portada · Conoce a Carlos", "Valor 3", "Claridad", 20),
  "inicio.propuestas.antetitulo": t("Portada · Propuestas", "Antetítulo", "CONOCE LOS EJES", 40),
  "inicio.propuestas.titulo": t("Portada · Propuestas", "Título", "Propuestas para", 40),
  "inicio.propuestas.destacado": t("Portada · Propuestas", "Título (parte azul)", "San Lorenzo.", 30),
  "inicio.propuestas.texto-1": t("Portada · Propuestas", "Texto, primera frase", "Explora cada tema.", 80),
  "inicio.propuestas.texto-2": t("Portada · Propuestas", "Texto, segunda frase", "Conoce lo que se propone para tu ciudad.", 120),
  "inicio.contacto.antetitulo": t("Portada · Contacto", "Antetítulo", "CERCA DE TI", 40),
  "inicio.contacto.titulo": t("Portada · Contacto", "Título", "Conecta con", 40),
  "inicio.contacto.destacado": t("Portada · Contacto", "Título (segunda parte)", "Carlos.", 30),
  "inicio.contacto.texto": t("Portada · Contacto", "Texto",
    "Sigue las actividades, conoce el día a día y participa en la conversación.", 200),
  "inicio.contacto.facebook.usuario": t("Portada · Contacto", "Facebook · usuario", "@carlosastudillo7", 60),
  "inicio.contacto.facebook.texto": t("Portada · Contacto", "Facebook · descripción", "Encuentros, noticias y actividades en San Lorenzo.", 160),
  "inicio.contacto.tiktok.usuario": t("Portada · Contacto", "TikTok · usuario", "@carlosastudillo01", 60),
  "inicio.contacto.tiktok.texto": t("Portada · Contacto", "TikTok · descripción", "Historias y momentos, más cerca de Carlos.", 160),
  "inicio.contacto.whatsapp.texto": t("Portada · Contacto", "WhatsApp · descripción", "Escríbenos directamente por WhatsApp.", 120),

  "propuesta.antetitulo": t("Detalle de propuesta (las 7)", "Antetítulo", "INFORMACIÓN DE LA PROPUESTA", 40),
  "propuesta.titulo": t("Detalle de propuesta (las 7)", "Título", "Conoce este eje.", 60),
  "propuesta.texto": t("Detalle de propuesta (las 7)", "Texto",
    "Este es uno de los siete temas presentados para la candidatura de Carlos Astudillo a la alcaldía de San Lorenzo.", 300),
  "propuesta.obra.antetitulo": t("Detalle de propuesta (las 7)", "Avance de la obra · título", "AVANCE DE LA OBRA", 40),
  "propuesta.preparacion.titulo": t("Detalle de propuesta (las 7)", "Aviso · título", "Contenido en preparación", 60),
  "propuesta.preparacion.texto": t("Detalle de propuesta (las 7)", "Aviso · texto",
    "Los objetivos, acciones y detalles de esta propuesta se incorporarán cuando estén disponibles.", 300),
  "propuesta.perspectiva.titulo": t("Detalle de propuesta (las 7)", "Sugerencias · título", "Tu perspectiva también cuenta.", 80),
  "propuesta.perspectiva.texto": t("Detalle de propuesta (las 7)", "Sugerencias · texto (va seguido del nombre de la propuesta)",
    "Comparte una idea relacionada con", 120),

  "acerca.antetitulo": t("Acerca de nosotros", "Antetítulo", "CONOCE AL CANDIDATO", 40),
  "acerca.nombre": t("Acerca de nosotros", "Nombre", "Carlos", 40),
  "acerca.apellido": t("Acerca de nosotros", "Apellido (parte azul)", "Astudillo.", 40),
  "acerca.subtitulo": t("Acerca de nosotros", "Subtítulo",
    "Candidato a la alcaldía de San Lorenzo.\nPartido Social Cristiano · Lista 6.", 160),
  "biografia.antetitulo": t("Biografía", "Antetítulo", "CONOCE AL CANDIDATO", 40),
  "biografia.titulo": t("Biografía", "Título", "Biografía", 40),
  "biografia.nota": t("Biografía", "Nota", "Los años, textos y fotos de esta línea de tiempo son provisionales.", 200),
  "biografia.recorre": t("Biografía", "Invitación a bajar", "Recorre su historia", 40),
  "alcalde.antetitulo": t("Por qué quiero ser alcalde", "Antetítulo", "EN SUS PALABRAS", 40),
  "alcalde.titulo": t("Por qué quiero ser alcalde", "Título", "Por qué quiero ser alcalde", 80),
  "alcalde.cita": t("Por qué quiero ser alcalde", "Cita",
    "«Creo en una ciudad donde el progreso no sea privilegio de pocos, sino derecho de todos».", 400),
  "alcalde.nota": t("Por qué quiero ser alcalde", "Nota", "El mensaje completo del candidato se incorporará a esta sección.", 400),
  "conoce-mas.antetitulo": t("Conoce más sobre Carlos", "Antetítulo", "CONOCE MÁS SOBRE CARLOS", 40),
  "conoce-mas.titulo": t("Conoce más sobre Carlos", "Título", "Respeto. Coherencia. Claridad.", 80),
  "conoce-mas.texto": t("Conoce más sobre Carlos", "Texto",
    "Explora los ejes de sus propuestas o comparte una sugerencia para San Lorenzo.", 400),
  "obras.antetitulo": t("Obras en ejecución", "Antetítulo", "CIUDADANÍA · TRANSPARENCIA", 40),
  "obras.titulo": t("Obras en ejecución", "Título", "Obras en ejecución", 60),
  "obras.intro": t("Obras en ejecución", "Introducción", "Sigue el avance de cada propuesta para San Lorenzo.", 160),
  "obras.nota": t("Obras en ejecución", "Nota",
    "Datos provisionales de ejemplo: los porcentajes, etapas e hitos se reemplazarán por los avances reales.", 240),
} satisfies Record<string, TextDefinition>;

export type TextKey = keyof typeof TEXTOS;

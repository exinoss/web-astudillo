export const LARGOS = {
  cuenta: { nombre: 200, direccion: 500, correo: 320, contrasenia: 128 },
  propuesta: { nombre: 120, categoria: 80, introduccion: 400, etiquetaCifra: 60, valorCifra: 30 },
  biografia: { titulo: 120, texto: 3000 },
  obra: { nota: 600, hito: 120, pie: 200 },
  chat: { pregunta: 160, palabrasClave: 300, respuesta: 1000, textoEnlace: 60, rutaEnlace: 200 },
  acercaDeCarlos: {
    tituloTarjeta: 60, textoTarjeta: 180, tituloVideo: 80, descripcionVideo: 200,
    pregunta: 160, respuesta: 1000, pie: 200,
  },
  equipo: { nombre: 80, textoParroquia: 3000 },
  descripcionFoto: 200,
  busquedaUsuarios: 120,
} as const;

/** Año de un hito de la biografía: cuatro cifras. */
export const ANIO_BIOGRAFIA = /^\d{4}$/;

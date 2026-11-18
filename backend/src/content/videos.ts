import { avisoNoInsertable, videoLinkProblem, videoSource, type MotivoNoInsertable, type VideoSource } from '../contracts/video';
import { LARGOS } from '../contracts/limites';
import { ApiError } from '../http';
import { plainText } from '../validation/texto';
import type { HomeVideoStored } from './types';

/** Título y enlace de un video validados; el enlace queda normalizado. `campo` encabeza los mensajes de error. */
export function cleanVideo<V extends HomeVideoStored>(v: V, campo: string): V {
  const source = videoSource(v.enlace);
  if (!source) throw new ApiError(422, `${campo}: ${videoLinkProblem(v.enlace)}`);
  return { ...v, titulo: plainText(v.titulo, `${campo} · título`, LARGOS.acercaDeCarlos.tituloVideo), enlace: source.url };
}

/** Rechaza con 422 el primer video que su plataforma no deja mostrar en el sitio. */
export async function assertInsertable(videos: { enlace: string; campo: string }[], checkVideo: (s: VideoSource) => Promise<MotivoNoInsertable | null>) {
  const sources = videos.map(v => videoSource(v.enlace)!);
  const motivos = await Promise.all(sources.map(source => checkVideo(source)));
  const malo = motivos.findIndex(Boolean);
  if (malo >= 0) throw new ApiError(422, `${videos[malo].campo}: ${avisoNoInsertable(sources[malo].provider, motivos[malo]!)}`);
}

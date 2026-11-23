import runtimeUrl from "../../../assets/guia-animada/runtime.js?url";
import atlasUrl from "../../../assets/guia-animada/atlas.webp?url";
import rig from "../../../assets/guia-animada/rig.json";
import { cargarScript, reintentable } from "../../../lib/comun/carga-scripts";
import type { Gesto } from "../../../lib/comun/guia/pasos";

export interface Avatar {
  audioCtx: AudioContext | null;
  activeAudioEl: HTMLMediaElement | null;
  setEstado(estado: Gesto): void;
  animarGuion(texto: string, duracionMs: number): void;
  detenerHabla(): void;
  conectarAudio(audio: HTMLMediaElement): void;
  destruir(): void;
}

const cargarRuntime = reintentable((conReintento) => cargarScript(conReintento(runtimeUrl)));

/** Dibuja al personaje en `contenedor`; la primera vez carga el runtime y el atlas. */
export async function crearAvatar(contenedor: HTMLElement): Promise<Avatar> {
  await cargarRuntime();
  const avatar: Avatar = await (window as any).CarlosGuia.crear(contenedor, { rigData: rig, atlasDataUrl: atlasUrl });
  contenedor.querySelector("canvas")?.setAttribute("aria-hidden", "true");
  return avatar;
}

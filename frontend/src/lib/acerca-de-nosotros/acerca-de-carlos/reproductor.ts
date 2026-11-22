import type { VideoSource } from "../../../../../backend/src/contracts/video";

export { avisoNoInsertable, PROVIDER_NAMES, videoLinkProblem, videoSource, type VideoSource } from "../../../../../backend/src/contracts/video";

/** Pone el reproductor del video en su escenario. */
export function mountPlayer(stage: HTMLElement, source: VideoSource, title: string) {
  stage.querySelector("iframe, video")?.remove();
  const player = source.provider === "mp4"
    ? Object.assign(document.createElement("video"), { src: source.embed, controls: true, autoplay: true, playsInline: true })
    : Object.assign(document.createElement("iframe"), { src: source.embed, title, allowFullscreen: true });
  if (player instanceof HTMLIFrameElement) player.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share";
  player.className = "absolute inset-0 h-full w-full border-0 bg-black";
  stage.append(player);
  return player;
}

/** Portada de video (`[data-video-preview]`) que, al pulsarla, monta el reproductor de su plataforma. */
export function activarVideo(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-video-stage]")!;
  const play = root.querySelector<HTMLButtonElement>("[data-video-play]")!;
  const error = root.querySelector<HTMLElement>("[data-video-error]")!;
  const source = { provider: root.dataset.provider, embed: root.dataset.embed } as VideoSource;
  const title = play.getAttribute("aria-label")!;
  const start = () => {
    error.hidden = true;
    mountPlayer(stage, source, title).addEventListener("error", () => { error.hidden = false; });
    play.hidden = true;
    root.toggleAttribute("data-reproduciendo", true);
  };
  play.addEventListener("click", start);
  root.querySelector("[data-video-retry]")!.addEventListener("click", start);
}

/** Quita el reproductor y vuelve a mostrar la portada; el video deja de sonar. */
export function detenerVideo(root: HTMLElement) {
  root.querySelector("[data-video-stage]")?.querySelector("iframe, video")?.remove();
  root.querySelector<HTMLElement>("[data-video-play]")!.hidden = false;
  root.querySelector<HTMLElement>("[data-video-error]")!.hidden = true;
  root.removeAttribute("data-reproduciendo");
}

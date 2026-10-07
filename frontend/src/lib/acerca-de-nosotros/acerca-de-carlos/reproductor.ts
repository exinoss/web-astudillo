import type { VideoSource } from "../../../../../backend/src/contracts/video";

export { PROVIDER_NAMES, videoLinkProblem, videoSource, type VideoSource } from "../../../../../backend/src/contracts/video";

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

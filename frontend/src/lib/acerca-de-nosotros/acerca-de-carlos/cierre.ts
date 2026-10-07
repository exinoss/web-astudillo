import { iconSvg } from "../../comun/iconos";

export const closingSection = (text: string, href: string, label: string) => `
<div class="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-base-300 bg-base-100 px-5 py-4 max-tablet:mt-8">
  <p class="m-0 text-[0.95rem]">${text}</p>
  <a href="${href}" class="button">${label} ${iconSvg("arrow", 18)}</a>
</div>`;

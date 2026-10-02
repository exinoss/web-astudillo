import { vigilarCambios } from "../../lib/cambios";
import { adminApi, type AdminUser } from "../../lib/data/http/admin-api";
import { renderPagination } from "../../lib/paginacion";
import { busy, DANGER, esc, GHOST, iconSvg, notify, PILL } from "./ui";

const ROLE_NAMES: Record<string, string> = { admin: "Admin", coadmin: "Coadmin", analista: "Analista", votante: "Votante" };
const ROLE_CLASSES: Record<string, string> = { admin: "bg-neutral text-neutral-content", coadmin: "bg-accent text-primary", analista: "border border-base-300", votante: "border border-base-300" };
const filters = { q: "", rol: "", estado: "", pagina: 1 };
let confirming: number | null = null; // cuenta con la desactivación pendiente de confirmar

const rolePill = (u: AdminUser) => `<span class="${PILL} ${ROLE_CLASSES[u.rol] ?? ""}">${esc(ROLE_NAMES[u.rol] ?? u.rol)}</span>`;
const statePill = (u: AdminUser) => u.estado === "activo"
  ? `<span class="${PILL} bg-[#e8f5ec] text-[#1d6b37]">Activa</span>`
  : `<span class="${PILL} bg-[#fff2f2] text-error">Desactivada</span>`;

/** Acciones de una cuenta; si la jerarquía no lo permite, el motivo genérico que da la API. */
function actions(u: AdminUser) {
  if (!u.puedeCambiarEstado) return `<span class="flex items-center gap-2 text-[0.78rem] text-[#50617d]">${iconSvg("lock", 16)} ${esc(u.motivoBloqueo)}</span>`;
  if (confirming === u.id) return `
    <span class="flex flex-wrap items-center gap-2.5">
      <span class="text-[0.8rem] font-bold">Se cerrarán sus sesiones. ¿Desactivar?</span>
      <button type="button" class="${DANGER}" data-estado="bloqueado" data-cuenta="${u.id}" data-estado-actual="${u.estado}">Sí, desactivar</button>
      <button type="button" class="${GHOST}" data-cancelar>Cancelar</button>
    </span>`;
  const select = `<select data-rol-de="${u.id}" aria-label="Nuevo rol de ${esc(u.nombresCompletos ?? u.correo)}"
      class="min-h-11 min-w-[140px] rounded-[3px] border border-[#acbacb] bg-base-100 px-3 text-sm text-primary max-tablet:flex-1">
      ${u.rolesAsignables.includes(u.rol) ? "" : `<option value="" selected disabled>${esc(ROLE_NAMES[u.rol] ?? u.rol)}</option>`}
      ${u.rolesAsignables.map((r) => `<option value="${esc(r)}" ${r === u.rol ? "selected" : ""}>${esc(ROLE_NAMES[r] ?? r)}</option>`).join("")}
    </select>`;
  return `<span class="flex flex-wrap items-center gap-2.5 max-tablet:w-full">
      <span class="flex gap-2.5 max-tablet:w-full">${select}<button type="button" class="button min-h-11 px-4 py-0" data-guardar-rol="${u.id}" data-rol-actual="${esc(u.rol)}">Guardar</button></span>
      ${u.estado === "activo"
        ? `<button type="button" class="${DANGER} max-tablet:w-full" data-desactivar="${u.id}">Desactivar</button>`
        : `<button type="button" class="${GHOST} max-tablet:w-full" data-estado="activo" data-cuenta="${u.id}" data-estado-actual="${u.estado}">Reactivar</button>`}
    </span>`;
}

export function renderUsers(section: HTMLElement) {
  const select = (id: string, label: string, options: [string, string][], current: string) => `
    <div class="flex min-w-[180px] flex-col gap-1.5 max-tablet:min-w-0">
      <label for="${id}" class="text-[0.76rem] font-bold">${label}</label>
      <select id="${id}" class="min-h-12 rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary">
        ${options.map(([v, t]) => `<option value="${v}" ${v === current ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>`;
  section.innerHTML = `
    <div class="mb-[18px] flex items-end gap-3.5 max-tablet:grid max-tablet:grid-cols-2 max-tablet:gap-2.5">
      <div class="flex flex-1 flex-col gap-1.5 max-tablet:col-span-2">
        <label for="usuarios-buscar" class="text-[0.76rem] font-bold">Buscar</label>
        <input id="usuarios-buscar" type="search" maxlength="120" value="${esc(filters.q)}" placeholder="Nombre o correo"
          class="min-h-12 rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 text-sm text-primary" />
      </div>
      ${select("usuarios-rol", "Rol", [["", "Todos"], ["admin", "Admin"], ["coadmin", "Coadmin"], ["votante", "Votante"]], filters.rol)}
      ${select("usuarios-estado", "Estado", [["", "Todos"], ["activo", "Activas"], ["bloqueado", "Desactivadas"]], filters.estado)}
      <button type="button" id="usuarios-limpiar" class="${GHOST} max-tablet:col-span-2">Limpiar filtros</button>
    </div>
    <p id="usuarios-total" class="m-0 mb-2.5 text-[0.76rem] text-[#50617d]"></p>
    <div id="usuarios-lista"></div>
    <div id="usuarios-paginas"></div>`;
  const input = section.querySelector<HTMLInputElement>("#usuarios-buscar")!;
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { filters.q = input.value; filters.pagina = 1; void load(section); }, 300);
  });
  for (const [id, key] of [["#usuarios-rol", "rol"], ["#usuarios-estado", "estado"]] as const)
    section.querySelector<HTMLSelectElement>(id)!.addEventListener("change", (e) => {
      filters[key] = (e.target as HTMLSelectElement).value;
      filters.pagina = 1;
      void load(section);
    });
  section.querySelector("#usuarios-limpiar")!.addEventListener("click", () => {
    Object.assign(filters, { q: "", rol: "", estado: "", pagina: 1 });
    renderUsers(section);
  });
  void load(section);
}

async function load(section: HTMLElement) {
  const data = await adminApi.users(filters);
  const list = section.querySelector<HTMLElement>("#usuarios-lista");
  if (!list) return;
  section.querySelector("#usuarios-total")!.textContent = `${data.total} ${data.total === 1 ? "cuenta" : "cuentas"}`;
  const name = (u: AdminUser) => esc(u.nombresCompletos ?? "Sin nombre");
  const table = `
    <div class="overflow-hidden rounded-[3px] border border-base-300 bg-base-100 max-tablet:hidden">
      <div class="grid grid-cols-[1.25fr_1fr_110px_120px_2.1fr] gap-3.5 bg-[#eef4fb] px-5 py-3 text-[0.7rem] font-bold tracking-[0.1em] uppercase">
        <span>Nombre</span><span>Correo</span><span>Rol</span><span>Estado</span><span>Acciones</span>
      </div>
      ${data.usuarios.map((u) => `
        <div class="grid min-h-16 grid-cols-[1.25fr_1fr_110px_120px_2.1fr] items-center gap-3.5 border-t border-t-base-300 px-5 py-2.5 text-[0.88rem]">
          <strong class="[overflow-wrap:anywhere]">${name(u)}</strong><span class="text-[#50617d] [overflow-wrap:anywhere]">${esc(u.correo)}</span>
          <span>${rolePill(u)}</span><span>${statePill(u)}</span>${actions(u)}
        </div>`).join("")}
    </div>`;
  const cards = `
    <div class="hidden flex-col gap-3 max-tablet:flex">
      ${data.usuarios.map((u) => `
        <div class="flex flex-col gap-2.5 rounded-[3px] border border-base-300 bg-base-100 p-3.5">
          <div class="flex justify-between gap-2.5">
            <span class="flex min-w-0 flex-col gap-0.5"><strong class="text-[0.92rem]">${name(u)}</strong><span class="text-[0.78rem] text-[#50617d] [overflow-wrap:anywhere]">${esc(u.correo)}</span></span>
            <span class="flex flex-col items-end gap-1.5">${rolePill(u)}${u.estado === "activo" ? "" : statePill(u)}</span>
          </div>
          ${actions(u)}
        </div>`).join("")}
    </div>`;
  list.innerHTML = data.usuarios.length ? table + cards : `<p class="m-0 text-[0.86rem]">Ninguna cuenta coincide con los filtros.</p>`;
  bind(section, list);
  renderPagination(section.querySelector("#usuarios-paginas")!, data, (p) => { filters.pagina = p; void load(section); });
}

function bind(section: HTMLElement, list: HTMLElement) {
  const reload = () => { confirming = null; return load(section); };
  list.querySelectorAll<HTMLButtonElement>("[data-guardar-rol]").forEach((b) => {
    // Tabla y tarjetas repiten el selector: vale el que está junto al botón pulsado.
    const select = b.parentElement!.querySelector<HTMLSelectElement>("select")!;
    vigilarCambios(b.parentElement!, b, b.dataset.rolActual, () => select.value || b.dataset.rolActual);
    // Se envía el rol que muestra la lista: si otro admin lo cambió mientras tanto, la API responde 409.
    b.addEventListener("click", () => void busy(b, async () => {
      await adminApi.changeRole(Number(b.dataset.guardarRol), select.value, b.dataset.rolActual!);
      await reload();
      notify("Rol actualizado.");
    }));
  });
  list.querySelectorAll<HTMLButtonElement>("[data-desactivar]").forEach((b) => b.addEventListener("click", () => {
    confirming = Number(b.dataset.desactivar);
    void load(section);
  }));
  list.querySelectorAll<HTMLButtonElement>("[data-cancelar]").forEach((b) => b.addEventListener("click", () => void reload()));
  list.querySelectorAll<HTMLButtonElement>("[data-estado]").forEach((b) => b.addEventListener("click", () =>
    void busy(b, async () => {
      const estado = b.dataset.estado as "activo" | "bloqueado";
      await adminApi.changeState(Number(b.dataset.cuenta), estado, b.dataset.estadoActual as "activo" | "bloqueado");
      await reload();
      notify(estado === "bloqueado" ? "Cuenta desactivada; sus sesiones se cerraron." : "Cuenta reactivada.");
    })));
}

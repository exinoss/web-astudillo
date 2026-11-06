import { GRUPOS, MAX_PRESENTACION, MAX_PUNTO_TRAYECTORIA, MAX_TRAYECTORIA, PUESTOS, type Grupo, type Puesto } from "../../../../../../backend/src/contracts/equipo";
import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { adminApi, type Photo, type TeamMemberBody } from "../../../../lib/data/http/admin-api";
import { infoPrefecto } from "../../../../lib/mi-equipo/prefecto";
import { silueta } from "../../../../lib/mi-equipo/silueta";
import { avisarVacios, busy, DRAFT_PILL, esc, field, GHOST, HINT, ICON_BUTTON, iconSvg, isPending, LABEL, notify, previewButton, reloadDraft, reloadPending, selectField, state, subirFotos, thumb, upload, value } from "../ui";

// `clave` sigue a la persona aunque cambie de lugar en la lista mientras sube su foto.
interface Persona { clave: string; puesto: Puesto | null; nombre: string; presentacion: string; trayectoria: string[]; foto: Photo | null }
let personas: Persona[] | null = null;
let marcarSinTipo = false;

const grupoDe = (puesto: Puesto | null) => PUESTOS.find((p) => p.clave === puesto)?.grupo;
const cuantos = (grupo: Grupo) => PUESTOS.filter((p) => p.grupo === grupo).length;
const ocupados = (salvo: Persona) => new Set(personas!.flatMap((p) => (p !== salvo && p.puesto ? [p.puesto] : [])));
// Se asignan primero los principales y después los suplentes: 1er, 2do y 3er concejal, y luego sus suplentes.
const delGrupo = (grupo: Grupo) => PUESTOS.filter((p) => p.grupo === grupo).sort((a, b) => a.fila - b.fila || a.columna - b.columna);
const libres = (grupo: Grupo, salvo: Persona) => delGrupo(grupo).filter((p) => !ocupados(salvo).has(p.clave));

const desdeBorrador = (): Persona[] => state.draft!.miEquipo.equipo.map(({ foto, ...p }) => ({ clave: crypto.randomUUID(), ...p, foto }));
const paraGuardar = (lista: (Omit<Persona, "clave" | "puesto"> & { puesto: Puesto | null })[]) =>
  lista.map(({ foto, ...p }) => ({
    idMedio: foto?.idMedio ?? null, puesto: p.puesto, nombre: p.nombre,
    presentacion: p.puesto === "prefecto" ? p.presentacion : "",
    trayectoria: p.puesto === "prefecto" ? p.trayectoria.map((x) => x.trim()).filter(Boolean) : [],
  }));

function capturar(form: HTMLElement) {
  personas!.forEach((p, i) => {
    p.nombre = value(form, `#persona-nombre-${i}`);
    if (p.puesto !== "prefecto") return;
    p.presentacion = value(form, `#persona-presentacion-${i}`);
    p.trayectoria = [...form.querySelectorAll<HTMLInputElement>(`[data-trayectoria="${i}"]`)].map((x) => x.value);
  });
}

/** Foto o silueta de la persona sobre el amarillo de la tarjeta, para ver el recorte. */
const miniatura = (p: Persona) => `<div class="relative aspect-[480/561] w-full overflow-hidden rounded-[3px] bg-accent max-mobile:w-[100px]">
  ${p.foto ? `<img src="${esc(thumb(p.foto))}" alt="" class="absolute inset-0 h-full w-full object-contain object-bottom" />` : silueta("absolute inset-0 h-full w-full")}
</div>`;

/** Tarjeta de una persona en el editor; la del prefecto lleva sus campos y la vista previa. */
function tarjeta(p: Persona, i: number) {
  const grupo = grupoDe(p.puesto);
  const tipo = selectField({
    id: `persona-tipo-${i}`, label: "Tipo", value: grupo ?? "", placeholder: "Elige el tipo",
    error: marcarSinTipo && !grupo ? "Elige el tipo." : undefined,
    options: GRUPOS.map((g) => {
      const lleno = g.clave !== grupo && !libres(g.clave, p).length;
      return { value: g.clave, label: lleno ? `${g.titulo} (completo)` : g.titulo, disabled: lleno };
    }),
  });
  const puesto = grupo && grupo !== "prefecto"
    ? selectField({
      id: `persona-puesto-${i}`, label: "Puesto", value: p.puesto!,
      options: delGrupo(grupo).map((x) => {
        const ocupado = ocupados(p).has(x.clave);
        return { value: x.clave, label: ocupado ? `${x.texto} (ocupado)` : x.texto, disabled: ocupado };
      }),
    })
    : `<div><span class="${LABEL}">Puesto</span><p class="m-0 flex min-h-12 items-center"><span class="rounded-[3px] px-2 py-[3px] text-[0.72rem] font-bold ${grupo ? "bg-primary text-accent" : "bg-disabled text-muted"}">${grupo ? "PREFECTO" : "Elige primero el tipo"}</span></p></div>`;
  const quitar = `<div class="mt-auto flex justify-end"><button type="button" class="${ICON_BUTTON} text-error" data-quitar="${i}" aria-label="Quitar a ${esc(p.nombre || "esta persona")}">${iconSvg("trash", 18)}</button></div>`;
  const foto = `<div class="flex w-[160px] shrink-0 flex-col gap-2 max-mobile:w-full max-mobile:flex-row max-mobile:flex-wrap max-mobile:items-end">
    ${miniatura(p)}
    <div class="flex flex-col gap-2">
      ${upload(`persona-foto-${i}`, p.foto ? "Cambiar foto" : "Subir foto")}
      ${p.foto ? `<button type="button" class="${GHOST}" data-quitar-foto="${i}">Quitar foto</button>` : ""}
    </div>
  </div>`;
  const campos = `${tipo}${puesto}${field({ id: `persona-nombre-${i}`, label: "Nombre", value: p.nombre, max: 80 , required: true })}`;
  if (p.puesto !== "prefecto")
    return `<li class="flex gap-4 rounded-[3px] border border-base-300 p-3 max-mobile:flex-col">${foto}<div class="flex min-w-0 flex-1 flex-col gap-3">${campos}${quitar}</div></li>`;
  const puntos = p.trayectoria.map((punto, j) => `<li class="flex items-center gap-1">
    <input id="persona-trayectoria-${i}-${j}" data-trayectoria="${i}" maxlength="${MAX_PUNTO_TRAYECTORIA}" value="${esc(punto)}" class="campo" aria-label="Punto ${j + 1} de la trayectoria" />
    <button type="button" class="${ICON_BUTTON}" data-quitar-punto="${j}" aria-label="Quitar el punto ${j + 1} de la trayectoria">${iconSvg("close", 18)}</button>
  </li>`).join("");
  return `<li class="col-span-2 flex gap-4 rounded-[3px] border border-base-300 p-3 max-laptop:col-span-1 max-mobile:flex-col">${foto}
    <div class="grid min-w-0 flex-1 grid-cols-2 items-start gap-5 max-laptop:grid-cols-1">
      <div class="flex flex-col gap-3">
        ${campos}
        ${field({ id: `persona-presentacion-${i}`, label: "Presentación", value: p.presentacion, max: MAX_PRESENTACION, area: true, hint: `Hasta ${MAX_PRESENTACION} caracteres. Es opcional.` })}
        <fieldset class="m-0 border-0 p-0">
          <legend class="${LABEL}">Trayectoria</legend>
          <ol class="m-0 mb-2 grid list-none gap-2 p-0">${puntos}</ol>
          ${p.trayectoria.length < MAX_TRAYECTORIA ? `<button type="button" class="${GHOST}" data-agregar-punto>${iconSvg("plus", 17)} Añadir un punto</button>` : ""}
          <p class="${HINT}">Hasta ${MAX_TRAYECTORIA} puntos de ${MAX_PUNTO_TRAYECTORIA} caracteres. Es opcional.</p>
        </fieldset>
        ${quitar}
      </div>
      <div><p class="${LABEL} m-0">Vista previa de su información</p><div data-vista-prefecto>${infoPrefecto(p.presentacion, paraGuardar([p])[0].trayectoria)}</div></div>
    </div>
  </li>`;
}

export function renderTeam(body: HTMLElement, rerender: () => void) {
  personas ??= desdeBorrador();
  body.innerHTML = `
    ${isPending("Mi equipo", "Equipo") ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="equipo-form" novalidate>
      <ol class="m-0 grid list-none grid-cols-2 gap-4 p-0 max-laptop:grid-cols-1">${personas.map(tarjeta).join("")}</ol>
      ${personas.length < PUESTOS.length ? `<button type="button" id="persona-agregar" class="${GHOST} mt-4">${iconSvg("plus", 17)} Añadir a alguien</button>` : ""}
      <p class="${HINT}">Hasta ${PUESTOS.length} personas: 1 prefecto, ${cuantos("urbanos")} concejales urbanos y ${cuantos("rurales")} rurales. Foto opcional: PNG o WebP sin fondo, de la cabeza a la cintura, de 700 × 820 px o más y hasta 8 MB.</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
        ${previewButton("/mi-equipo/")}
        <button type="submit" class="button">Guardar borrador</button>
      </div>
    </form>`;
  const form = body.querySelector<HTMLFormElement>("#equipo-form")!;
  /** Aplica un cambio y vuelve a pintar; si se indica, devuelve el foco a ese campo de la persona. */
  const editar = (cambio: () => void, foco?: { persona: Persona; campo: string }) => {
    capturar(form);
    cambio();
    rerender();
    if (foco) document.querySelector<HTMLElement>(`#persona-${foco.campo}-${personas!.indexOf(foco.persona)}`)?.focus();
  };
  form.querySelector("#persona-agregar")?.addEventListener("click", () => {
    const nueva: Persona = { clave: crypto.randomUUID(), puesto: null, nombre: "", presentacion: "", trayectoria: [], foto: null };
    editar(() => personas!.push(nueva), { persona: nueva, campo: "tipo" });
  });
  personas.forEach((p, i) => {
    form.querySelector<HTMLSelectElement>(`#persona-tipo-${i}`)!.addEventListener("change", (e) =>
      editar(() => { p.puesto = libres((e.target as HTMLSelectElement).value as Grupo, p)[0]?.clave ?? null; }, { persona: p, campo: "tipo" }));
    form.querySelector<HTMLSelectElement>(`#persona-puesto-${i}`)?.addEventListener("change", (e) =>
      editar(() => { p.puesto = (e.target as HTMLSelectElement).value as Puesto; }, { persona: p, campo: "puesto" }));
  });
  form.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach((b) => b.addEventListener("click", () => editar(() => personas!.splice(Number(b.dataset.quitar), 1))));
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-foto]").forEach((b) => b.addEventListener("click", () => editar(() => { personas![Number(b.dataset.quitarFoto)].foto = null; })));
  const prefecto = personas.find((p) => p.puesto === "prefecto");
  form.querySelector("[data-agregar-punto]")?.addEventListener("click", () => {
    editar(() => prefecto!.trayectoria.push(""));
    document.querySelector<HTMLInputElement>(`#persona-trayectoria-${personas!.indexOf(prefecto!)}-${prefecto!.trayectoria.length - 1}`)?.focus();
  });
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-punto]").forEach((b) => b.addEventListener("click", () => {
    editar(() => prefecto!.trayectoria.splice(Number(b.dataset.quitarPunto), 1));
    document.querySelector<HTMLElement>("[data-agregar-punto]")?.focus();
  }));
  form.addEventListener("input", (e) => {
    const id = (e.target as HTMLElement).id;
    if (!prefecto || !/^persona-(presentacion|trayectoria)-/.test(id)) return;
    capturar(form);
    form.querySelector("[data-vista-prefecto]")!.innerHTML = infoPrefecto(prefecto.presentacion, paraGuardar([prefecto])[0].trayectoria);
  });
  personas.forEach((p, i) => form.querySelector<HTMLInputElement>(`#persona-foto-${i}`)!.addEventListener("change", (e) => {
    const archivo = (e.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    capturar(form);
    void subirFotos([archivo], (foto) => {
      const persona = personas?.find((x) => x.clave === p.clave);
      if (!persona) {
        notify("Esa persona ya no está en la lista; la foto no se añadió.", true);
        return false;
      }
      persona.foto = foto;
      rerender();
      notify("Foto subida. Guarda el borrador para conservarla.");
    });
  }));
  vigilarCambios(form, form.querySelector("button[type=submit]")!, paraGuardar(state.draft!.miEquipo.equipo), () => {
    capturar(form);
    return paraGuardar(personas!);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capturar(form);
    const sinTipo = personas!.findIndex((p) => !p.puesto);
    if (sinTipo >= 0) {
      marcarSinTipo = true;
      rerender();
      return avisarVacios(document.querySelector("#equipo-form")!, "Elige el tipo de cada persona.");
    }
    if (personas!.some((p) => !p.nombre)) return avisarVacios(form, "Escribe el nombre de cada persona.");
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveTeam(paraGuardar(personas!) as TeamMemberBody[], state.draft!.versiones.miEquipo.equipo ?? null);
      await Promise.all([reloadDraft(), reloadPending()]);
      personas = null;
      marcarSinTipo = false;
      rerender();
      notify("Borrador del equipo guardado. Publica para que se vea en el sitio.");
    });
  });
  return () => capturar(form);
}

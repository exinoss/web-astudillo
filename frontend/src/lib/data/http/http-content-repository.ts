import type { ContentRepository } from "../content-repository";
import { MockContentRepository } from "../mock/mock-content-repository";
import { biography as seedBiography, citizenLinks, proposals as seedProposals } from "../mock/seed-data";
import type { BiographyMilestone, Proposal, UploadedPicture, WorkProgress } from "../types";

/** Forma del contenido publicado; la define `backend/src/content/types.ts` (Snapshot). */
interface Snapshot {
  version: 1;
  textos: Record<string, string>;
  propuestas: { slug: string; nombre: string; categoria: string; introduccion: string; kpis: { etiqueta: string; valor: string }[] }[];
  biografia: { anios: string; titulo: string; texto: string; alt: string | null; foto: UploadedPicture | null }[];
  obras: {
    slug: string; nota: string; actualizadoEn: string;
    hitos: { nombre: string; completado: boolean }[];
    fotos: (UploadedPicture & { pie: string })[];
  }[];
}

// Misma dirección del backend que usa el proxy de astro.config.mjs.
const API = globalThis.process?.env.API_PROXY_TARGET || "http://127.0.0.1:3000";
// En desarrollo se relee en cada página (se ve lo recién publicado al recargar); al compilar, una vez.
const DEV_TTL_MS = 1000;

/**
 * Lee el contenido publicado desde el backend al compilar o al pintar en desarrollo. Iconos y
 * modelos 3D siguen en el código y se cruzan por slug. Sin publicaciones todavía, usa la semilla.
 */
export class HttpContentRepository implements ContentRepository {
  #snapshot?: Promise<Snapshot | null>;
  #loadedAt = 0;
  readonly #seed = new MockContentRepository();

  #load() {
    if (this.#snapshot && !(import.meta.env.DEV && Date.now() - this.#loadedAt > DEV_TTL_MS)) return this.#snapshot;
    this.#loadedAt = Date.now();
    this.#snapshot = fetch(`${API}/api/contenido/publicado`, { cache: "no-store" })
      .catch(() => {
        throw new Error(`No se pudo leer el contenido publicado: el backend no responde en ${API}`);
      })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`El backend respondió ${response.status} al leer el contenido publicado`);
        const data = (await response.json()) as Snapshot;
        if (data.version !== 1) throw new Error(`Versión de contenido no soportada: ${data.version}`);
        return data;
      });
    // Un fallo no se guarda: la siguiente página lo vuelve a intentar.
    this.#snapshot.catch(() => (this.#snapshot = undefined));
    return this.#snapshot;
  }

  async getProposals(): Promise<Proposal[]> {
    const data = await this.#load();
    if (!data) return this.#seed.getProposals();
    return data.propuestas.flatMap((p) => {
      const base = seedProposals.find((s) => s.slug === p.slug);
      if (!base) return [];
      return [{
        ...base, name: p.nombre, label: p.categoria, intro: p.introduccion,
        kpis: p.kpis.map((k) => ({ label: k.etiqueta, value: k.valor })),
      }];
    });
  }

  async getProposal(slug: string) {
    return (await this.getProposals()).find((p) => p.slug === slug);
  }

  async getCitizenLinks() {
    return citizenLinks;
  }

  async getBiography(): Promise<BiographyMilestone[]> {
    const data = await this.#load();
    if (!data) return this.#seed.getBiography();
    return data.biografia.map((h, i) => ({
      years: h.anios,
      title: h.titulo,
      text: h.texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      image: h.foto,
      alt: h.alt ?? seedBiography[i]?.alt ?? h.titulo,
    }));
  }

  async getWorks(): Promise<WorkProgress[]> {
    const data = await this.#load();
    if (!data) return this.#seed.getWorks();
    return data.obras.map((o) => ({
      proposalSlug: o.slug,
      updatedAt: o.actualizadoEn.slice(0, 10),
      note: o.nota,
      milestones: o.hitos.map((h) => ({ name: h.nombre, done: h.completado })),
      evidence: o.fotos.map((f) => ({ image: f, alt: f.pie, caption: f.pie })),
    }));
  }

  async getTexts() {
    return (await this.#load())?.textos ?? this.#seed.getTexts();
  }
}

import type { ContentRepository } from "../content-repository";
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

/**
 * Lee el contenido congelado de una publicación. Iconos y modelos 3D siguen en el código y se
 * cruzan por slug. El archivo se abre con import() dinámico porque este módulo también llega a
 * scripts del navegador, donde nunca se usa.
 */
export class FileContentRepository implements ContentRepository {
  #snapshot?: Promise<Snapshot>;

  constructor(private readonly path: string) {}

  #load() {
    this.#snapshot ??= import("node:fs/promises")
      .then((fs) => fs.readFile(this.path, "utf8"))
      .then((raw) => {
        const data = JSON.parse(raw) as Snapshot;
        if (data.version !== 1) throw new Error(`Versión de contenido no soportada: ${data.version}`);
        return data;
      });
    return this.#snapshot;
  }

  async getProposals(): Promise<Proposal[]> {
    const { propuestas } = await this.#load();
    return propuestas.flatMap((p) => {
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
    const { biografia } = await this.#load();
    return biografia.map((h, i) => ({
      years: h.anios,
      title: h.titulo,
      text: h.texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      image: h.foto,
      alt: h.alt ?? seedBiography[i]?.alt ?? h.titulo,
    }));
  }

  async getWorks(): Promise<WorkProgress[]> {
    const { obras } = await this.#load();
    return obras.map((o) => ({
      proposalSlug: o.slug,
      updatedAt: o.actualizadoEn.slice(0, 10),
      note: o.nota,
      milestones: o.hitos.map((h) => ({ name: h.nombre, done: h.completado })),
      evidence: o.fotos.map((f) => ({ image: f, alt: f.pie, caption: f.pie })),
    }));
  }

  async getTexts() {
    return (await this.#load()).textos;
  }
}

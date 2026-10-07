import type { ContentRepository } from './content-repository';
import { citizenIcons, proposalIcons, proposalModels } from './presentation';
import { type ApiAboutCarlosPage, toAboutCarlosPage } from './acerca-de-carlos';
import type { BiographyMilestone, AboutCarlosPage, AboutCarlosSlug, Proposal, UploadedPicture, WorkProgress } from './types';

export interface Snapshot {
  version: 1;
  textos: Record<string, string>;
  originales?: Record<string, string>;
  propuestas: { slug: string; nombre: string; categoria: string; introduccion: string; kpis: { etiqueta: string; valor: string }[] }[];
  biografia: { anios: string; titulo: string; texto: string; alt: string | null; foto: UploadedPicture | null }[];
  obras: { slug: string; nota: string; actualizadoEn: string; hitos: { nombre: string; completado: boolean }[]; fotos: (UploadedPicture & { pie: string })[] }[];
  chat?: { pregunta: string; destacada: boolean }[];
  acercaDeCarlos?: Record<string, ApiAboutCarlosPage>;
}

export abstract class SnapshotRepository implements ContentRepository {
  protected abstract load(): Promise<Snapshot>;
  async getProposals(): Promise<Proposal[]> {
    return (await this.load()).propuestas.map(p => ({
      slug: p.slug, name: p.nombre, label: p.categoria, intro: p.introduccion,
      icon: proposalIcons[p.slug] ?? 'idea', model: proposalModels[p.slug],
      kpis: p.kpis.map(k => ({ label: k.etiqueta, value: k.valor })),
    }));
  }
  async getProposal(slug: string) { return (await this.getProposals()).find(p => p.slug === slug); }
  async getCitizenLinks() {
    const { textos } = await this.load();
    return Object.entries(citizenIcons).map(([slug, icon]) => ({
      slug, icon, name: textos[`ciudadania.${slug}.nombre`], description: textos[`ciudadania.${slug}.descripcion`],
    }));
  }
  async getBiography(): Promise<BiographyMilestone[]> {
    return (await this.load()).biografia.map(h => ({
      years: h.anios, title: h.titulo, text: h.texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
      image: h.foto, alt: h.alt ?? h.titulo,
    }));
  }
  async getWorks(): Promise<WorkProgress[]> {
    return (await this.load()).obras.map(o => ({
      proposalSlug: o.slug, updatedAt: o.actualizadoEn.slice(0,10), note: o.nota,
      milestones: o.hitos.map(h => ({ name:h.nombre, done:h.completado })),
      evidence: o.fotos.map(f => ({ image:f, alt:f.pie, caption:f.pie })),
    }));
  }
  async getTexts() { return (await this.load()).textos; }
  async getInitialTexts() { return (await this.load()).originales ?? {}; }
  async getChatQuickReplies() { return ((await this.load()).chat ?? []).filter(c => c.destacada).map(c => c.pregunta); }
  async getAboutCarlosPage(slug: AboutCarlosSlug): Promise<AboutCarlosPage> {
    return toAboutCarlosPage((await this.load()).acercaDeCarlos?.[slug]);
  }
}

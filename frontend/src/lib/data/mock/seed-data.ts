import type { ImageMetadata } from "astro";
import type { BiographyMilestone, CitizenLink, Proposal, WorkEvidence, WorkProgress } from "../types";
import posterTecnologias from "../../../assets/models/tecnologias-emergentes.png";
import hito1 from "../../../assets/biografia/hito-1.png";
import hito2 from "../../../assets/biografia/hito-2.png";
import hito3 from "../../../assets/biografia/hito-3.png";
import hito4 from "../../../assets/biografia/hito-4.png";
import hito5 from "../../../assets/biografia/hito-5.png";
import hito6 from "../../../assets/biografia/hito-6.png";

export const proposals: Proposal[] = [
  {
    slug: "agua-potable",
    name: "Agua potable",
    icon: "water",
    label: "Servicios básicos",
    intro: "Conoce este eje del plan para San Lorenzo.",
    kpis: [{ label: "Cobertura meta", value: "98%" }, { label: "Comunidades", value: "32" }, { label: "Plazo", value: "36 meses" }],
  },
  {
    slug: "centro-de-alto-rendimiento",
    name: "Centro de alto rendimiento",
    icon: "sport",
    label: "Deporte",
    intro: "Un espacio para conocer la propuesta deportiva.",
    kpis: [{ label: "Deportistas", value: "1,200" }, { label: "Disciplinas", value: "12" }, { label: "Plazo", value: "30 meses" }],
  },
  {
    slug: "mercado-municipal",
    name: "Mercado municipal",
    icon: "market",
    label: "Comercio local",
    intro: "Consulta este eje sobre el comercio de la ciudad.",
    kpis: [{ label: "Puestos", value: "420" }, { label: "Empleos", value: "+900" }, { label: "Plazo", value: "24 meses" }],
  },
  {
    slug: "terminal-terrestre",
    name: "Terminal terrestre",
    icon: "bus",
    label: "Movilidad",
    intro: "Conoce la propuesta de transporte terrestre.",
    kpis: [{ label: "Pasajeros/día", value: "18,000" }, { label: "Rutas", value: "26" }, { label: "Plazo", value: "28 meses" }],
  },
  {
    slug: "agronomia",
    name: "Agronomía",
    icon: "leaf",
    label: "Campo y producción",
    intro: "Consulta el eje dedicado al sector agrícola.",
    kpis: [{ label: "Productores", value: "2,500" }, { label: "Hectáreas", value: "1,800" }, { label: "Plazo", value: "24 meses" }],
  },
  {
    slug: "educacion",
    name: "Educación",
    icon: "book",
    label: "Aprendizaje",
    intro: "Conoce este eje del plan educativo.",
    kpis: [{ label: "Estudiantes", value: "14,500" }, { label: "Centros", value: "38" }, { label: "Plazo", value: "36 meses" }],
  },
  {
    slug: "tecnologias-emergentes",
    name: "Tecnologías emergentes",
    icon: "tech",
    label: "Innovación",
    intro: "Consulta la propuesta sobre nuevas tecnologías.",
    kpis: [{ label: "Trámites digitales", value: "40+" }, { label: "Puntos Wi-Fi", value: "60" }, { label: "Plazo", value: "18 meses" }],
    model: {
      src: "/models/tecnologias-emergentes.glb",
      poster: posterTecnologias,
      alt: "Modelo 3D de cuatro paneles solares sobre una estructura de soporte metálica",
    },
  },
];

export const citizenLinks: CitizenLink[] = [
  {
    slug: "sugerencias",
    name: "Sugerencias",
    icon: "idea",
    description: "Comparte una idea para San Lorenzo.",
  },
  {
    slug: "alerta-ciudadana",
    name: "Alerta ciudadana",
    icon: "alert",
    description: "Cuéntanos qué ocurre en tu sector.",
  },
  {
    slug: "chat",
    name: "Chat",
    icon: "chat",
    description: "Encuentra información y orientación.",
  },
];

// Textos provisionales: describen qué debe contar cada hito hasta tener la biografía real.
export const biography: BiographyMilestone[] = [
  {
    years: "19XX",
    title: "Sus raíces en San Lorenzo",
    text: ["Texto provisional. Aquí va dónde nace Carlos, quién es su familia y cómo fue crecer en el cantón."],
    image: hito1,
    alt: "Foto provisional de la infancia de Carlos Astudillo en San Lorenzo",
  },
  {
    years: "19XX",
    title: "Formación",
    text: ["Texto provisional. Aquí van sus estudios y las personas que marcaron su forma de ver la comunidad."],
    image: hito2,
    alt: "Foto provisional de la etapa de estudios de Carlos Astudillo",
  },
  {
    years: "20XX",
    title: "Primeros pasos en el trabajo",
    text: ["Texto provisional. Aquí va su oficio o profesión y cómo conoció de cerca los problemas de la ciudad."],
    image: hito3,
    alt: "Foto provisional de Carlos Astudillo en su trabajo",
  },
  {
    years: "20XX",
    title: "Servicio a la comunidad",
    text: ["Texto provisional. Aquí van las organizaciones, el voluntariado y las obras en barrios en las que participó."],
    image: hito4,
    alt: "Foto provisional de Carlos Astudillo con la comunidad",
  },
  {
    years: "20XX",
    title: "Llegada al Partido Social Cristiano",
    text: ["Texto provisional. Aquí va cuándo y por qué se une a la Lista 6."],
    image: hito5,
    alt: "Foto provisional de Carlos Astudillo en el Partido Social Cristiano",
  },
  {
    years: "20XX",
    title: "Candidato a la alcaldía de San Lorenzo",
    text: ["Texto provisional. Aquí va qué lo impulsa a postularse y qué propone para la ciudad."],
    image: hito6,
    alt: "Foto provisional de Carlos Astudillo como candidato a la alcaldía",
  },
];

// Fotos de evidencia: basta con dejar `<slug>-<n>.png` en assets/obras para que aparezcan en su obra.
const fotosObras = import.meta.glob<ImageMetadata>("../../../assets/obras/*.png", { eager: true, import: "default" });

/** Evidencias de una obra, en el orden del número del archivo. */
function evidencias(slug: string): WorkEvidence[] {
  const nombre = proposals.find((p) => p.slug === slug)?.name ?? slug;
  return Object.entries(fotosObras)
    .flatMap(([ruta, image]) => {
      const [, archivo, n] = ruta.match(/\/([a-z-]+)-(\d+)\.png$/) ?? [];
      return archivo === slug ? [{ image, n: Number(n) }] : [];
    })
    .sort((a, b) => a.n - b.n)
    .map(({ image, n }) => ({
      image,
      alt: `Foto provisional ${n} del avance de ${nombre}`,
      caption: `Foto provisional ${n}`,
    }));
}

// Avances de ejemplo para el desarrollo sin base de datos; el porcentaje sale de los hitos.
export const works: WorkProgress[] = [
  {
    proposalSlug: "agua-potable",
    updatedAt: "2026-09-15",
    note: "Datos de ejemplo. Se tiende la red de distribución en los barrios del centro.",
    milestones: [
      { name: "Estudios y diseño", done: true },
      { name: "Financiamiento", done: true },
      { name: "Contratación", done: true },
      { name: "Red de distribución", done: false },
      { name: "Conexiones domiciliarias", done: false },
    ],
    evidence: evidencias("agua-potable"),
  },
  {
    proposalSlug: "centro-de-alto-rendimiento",
    updatedAt: "2026-09-02",
    note: "Datos de ejemplo. Se revisan los estudios de suelo del terreno propuesto.",
    milestones: [
      { name: "Selección del terreno", done: true },
      { name: "Estudios técnicos", done: false },
      { name: "Diseño definitivo", done: false },
      { name: "Construcción", done: false },
      { name: "Equipamiento", done: false },
    ],
    evidence: evidencias("centro-de-alto-rendimiento"),
  },
  {
    proposalSlug: "mercado-municipal",
    updatedAt: "2026-09-18",
    note: "Datos de ejemplo. La estructura principal está terminada; siguen instalaciones y puestos.",
    milestones: [
      { name: "Diseño", done: true },
      { name: "Contratación", done: true },
      { name: "Estructura", done: true },
      { name: "Instalaciones", done: false },
      { name: "Reubicación de comerciantes", done: false },
    ],
    evidence: evidencias("mercado-municipal"),
  },
  {
    proposalSlug: "terminal-terrestre",
    updatedAt: "2026-08-28",
    note: "Datos de ejemplo. Se coordina con las cooperativas de transporte.",
    milestones: [
      { name: "Estudio de movilidad", done: true },
      { name: "Diseño", done: false },
      { name: "Financiamiento", done: false },
      { name: "Construcción", done: false },
      { name: "Puesta en servicio", done: false },
    ],
    evidence: evidencias("terminal-terrestre"),
  },
  {
    proposalSlug: "agronomia",
    updatedAt: "2026-09-10",
    note: "Datos de ejemplo. Los primeros grupos de productores reciben asistencia técnica.",
    milestones: [
      { name: "Censo de productores", done: true },
      { name: "Convenios", done: true },
      { name: "Capacitaciones", done: false },
      { name: "Entrega de insumos", done: false },
      { name: "Evaluación", done: false },
    ],
    evidence: evidencias("agronomia"),
  },
  {
    proposalSlug: "educacion",
    updatedAt: "2026-07-30",
    note: "Datos de ejemplo. Aulas rehabilitadas y entregadas a la comunidad educativa.",
    milestones: [
      { name: "Diagnóstico", done: true },
      { name: "Diseño", done: true },
      { name: "Rehabilitación", done: true },
      { name: "Entrega", done: true },
    ],
    evidence: evidencias("educacion"),
  },
  {
    proposalSlug: "tecnologias-emergentes",
    updatedAt: "2026-09-01",
    note: "Datos de ejemplo. Pendiente de aprobación del presupuesto.",
    milestones: [
      { name: "Presupuesto", done: false },
      { name: "Diseño", done: false },
      { name: "Instalación de paneles", done: false },
      { name: "Puesta en marcha", done: false },
    ],
    evidence: evidencias("tecnologias-emergentes"),
  },
];

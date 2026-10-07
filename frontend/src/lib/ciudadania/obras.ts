export type WorkStage = "por-iniciar" | "en-ejecucion" | "terminada";

export const STAGE_NAMES: Record<WorkStage, string> = {
  "por-iniciar": "Por iniciar",
  "en-ejecucion": "En ejecución",
  terminada: "Terminada",
};

/**
 * Avance de una obra según sus hitos: porcentaje de hitos completados y etapa derivada.
 * Lo usan la página pública y el panel, así ambos muestran siempre lo mismo.
 */
export function workProgress(milestones: { done: boolean }[]) {
  const done = milestones.filter((m) => m.done).length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  const stage: WorkStage = percent === 0 ? "por-iniciar" : percent === 100 ? "terminada" : "en-ejecucion";
  return { percent, stage };
}

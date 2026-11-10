// La franja (components/comun/DraftPreviewBar.astro) solo existe en la compilación de la vista previa.
export const inDraftPreview = () => Boolean(document.querySelector("[data-franja-vista-previa]"));

const AUDIOS = import.meta.glob<string>("../../../assets/audio/tutorial/*.mp3", { eager: true, query: "?url", import: "default" });

/** URL publicada del audio de un paso de la guía (`01-bienvenida`…). */
export const urlAudio = (id: string) => AUDIOS[`../../../assets/audio/tutorial/${id}.mp3`] ?? "";

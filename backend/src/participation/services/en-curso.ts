/** Junta las llamadas simultáneas con la misma clave en una sola ejecución mientras esta sigue en curso. */
export function compartirEnCurso<T>() {
  const enCurso = new Map<string, Promise<T>>();
  return (clave: string, tarea: () => Promise<T>) => {
    let promesa = enCurso.get(clave);
    if (!promesa) {
      promesa = tarea().finally(() => enCurso.delete(clave));
      enCurso.set(clave, promesa);
    }
    return promesa;
  };
}

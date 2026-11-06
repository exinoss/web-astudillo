// Primera coincidencia: las pruebas de Playwright que cubren esa ruta. Lo compartido no figura: lo cubre la integración continua.
const PRUEBAS: [RegExp, string[]][] = [
  [/^frontend\/tests\/([\w.-]+\.spec\.ts)$/, []],
  [/\/cuenta\/panel\/|\/lib\/data\/http\/admin/, ["panel.spec.ts", "vista-previa.spec.ts"]],
  [/acerca-de-carlos/, ["acerca-de-carlos.spec.ts"]],
  [/biografia/, ["biografia.spec.ts"]],
  [/mi-equipo/, ["mi-equipo.spec.ts"]],
  [/\/cuenta\//, ["account.spec.ts"]],
  [/ciudadania|participacion/, ["participacion.spec.ts"]],
  [/modo-edicion/, ["edicion.spec.ts"]],
  [/\/inicio\/|\/pages\/index\.astro$/, ["portada.spec.ts", "inicio-carruseles.spec.ts"]],
];

/** Pruebas de Playwright que cubren las rutas cambiadas; las rutas sin pruebas propias no añaden ninguna. */
export function pruebasAfectadas(rutas: string[]) {
  const specs = new Set<string>();
  for (const ruta of rutas.filter((r) => r.startsWith("frontend/"))) {
    const propia = ruta.match(PRUEBAS[0][0]);
    if (propia) specs.add(propia[1]);
    else PRUEBAS.find(([patron]) => patron.test(ruta))?.[1].forEach((s) => specs.add(s));
  }
  return [...specs];
}

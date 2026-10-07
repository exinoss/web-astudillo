// localStorage y no sessionStorage: el acceso puede pasar por otra pestaña (enlace del correo).
// La foto va en IndexedDB. Si el navegador no deja guardar, simplemente no se recupera.

export type Formulario = "alerta" | "sugerencia" | "chat";

export interface Borrador {
  formulario: Formulario;
  /** Página del formulario, a la que se vuelve tras iniciar sesión. */
  ruta: string;
  campos: Record<string, string>;
  /** La misma clave del primer intento: si aquel envío sí llegó, el reintento no lo duplica. */
  idempotencia: string;
  conFoto: boolean;
  guardadoEn: number;
}

const CLAVE = "astudillo:borrador";
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const NOMBRES: Record<Formulario, string> = { alerta: "tu alerta", sugerencia: "tu sugerencia", chat: "tu consulta" };

/** Borrador pendiente (de un formulario concreto, si se indica); los vencidos se descartan. */
export function leer(formulario?: Formulario): Borrador | null {
  try {
    const borrador = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Borrador | null;
    if (!borrador) return null;
    if (Date.now() - borrador.guardadoEn > VIGENCIA_MS) {
      borrar();
      return null;
    }
    return !formulario || borrador.formulario === formulario ? borrador : null;
  } catch {
    return null;
  }
}

/** Guarda el borrador y su foto. Devuelve false si el navegador no permite guardarlo. */
export async function guardar(datos: Omit<Borrador, "guardadoEn" | "conFoto">, foto?: File) {
  try {
    const conFoto = !!foto && await fotos("readwrite", (s) => s.put(foto, "foto")).then(() => true, () => false);
    localStorage.setItem(CLAVE, JSON.stringify({ ...datos, conFoto, guardadoEn: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export async function leerFoto(): Promise<File | null> {
  return fotos<File | undefined>("readonly", (s) => s.get("foto")).then((f) => f ?? null, () => null);
}

export function borrar() {
  try {
    localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento no hay nada que borrar */ }
  void fotos("readwrite", (s) => s.delete("foto")).catch(() => {});
}

/** Adónde ir tras un inicio de sesión correcto: al formulario que quedó a medias o a la portada. */
export const destinoTrasAcceso = () => leer()?.ruta ?? "/";

/** Aviso para la página de acceso cuando hay algo esperando a enviarse. */
export function avisoDeAcceso() {
  const borrador = leer();
  return borrador ? `Inicia sesión para enviar ${NOMBRES[borrador.formulario]}. Guardamos lo que escribiste.` : null;
}

/** Ejecuta una operación sobre el almacén de IndexedDB donde vive la foto del borrador. */
function fotos<T>(modo: IDBTransactionMode, accion: (almacen: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const apertura = indexedDB.open("astudillo-borrador", 1);
    apertura.onupgradeneeded = () => apertura.result.createObjectStore("archivos");
    apertura.onerror = () => rechazar(apertura.error);
    apertura.onsuccess = () => {
      const base = apertura.result;
      const peticion = accion(base.transaction("archivos", modo).objectStore("archivos"));
      peticion.onsuccess = () => resolver(peticion.result as T);
      peticion.onerror = () => rechazar(peticion.error);
      peticion.transaction!.oncomplete = () => base.close();
    };
  });
}

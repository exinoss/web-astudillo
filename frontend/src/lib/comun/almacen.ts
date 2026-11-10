type Zona = "local" | "sesion";

/** Almacenamiento del navegador que corresponde a cada zona. */
const zona =(tipo: Zona) => (tipo === "local" ? localStorage : sessionStorage);

/** Lee una clave del almacenamiento del navegador; si el navegador lo bloquea, devuelve null. */
export function leerClave(tipo: Zona, clave: string) {
  try {
    return zona(tipo).getItem(clave);
  } catch {
    return null;
  }
}

/** Guarda una clave (o la borra con null); devuelve false si el navegador no lo permite. */
export function guardarClave(tipo: Zona, clave: string, valor: string | null) {
  try {
    if (valor === null) zona(tipo).removeItem(clave);
    else zona(tipo).setItem(clave, valor);
    return true;
  } catch {
    return false;
  }
}

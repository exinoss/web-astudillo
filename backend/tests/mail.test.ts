import { expect, test } from "bun:test";
import { correoHtml, correoTexto, IMAGENES, MENSAJES } from "../src/mail/plantilla";

const url = "https://sitio.ec/cuenta/verificar/?token=abc&x=<1>";

test("los correos llevan el botón con su enlace, las imágenes incrustadas y el aviso de ignorarlo", async () => {
  for (const crear of Object.values(MENSAJES)) {
    const mensaje = crear(url);
    const html = correoHtml(mensaje);
    // El enlace va escapado: ni la URL ni los textos pueden inyectar HTML.
    expect(html).toContain('href="https://sitio.ec/cuenta/verificar/?token=abc&amp;x=&lt;1&gt;"');
    expect(html).not.toContain("<1>");
    expect(html).toContain(`>${mensaje.boton}</a>`);
    expect(html).toContain("Si usted no solicitó este correo, por favor ignórelo.");
    for (const img of Object.values(IMAGENES)) expect(html).toContain(`src="cid:${img.cid}"`);
    // La versión de texto trae lo mismo, para clientes sin HTML.
    const texto = correoTexto(mensaje);
    expect(texto).toContain(url);
    expect(texto).toContain("ignórelo");
  }
  for (const img of Object.values(IMAGENES))
    expect(await Bun.file(new URL(`../assets/correo/${img.archivo}`, import.meta.url)).exists()).toBe(true);
});

import { afterAll, beforeAll, expect, test } from "bun:test";
import { callPg } from "../src/db/call";
import { FORBIDDEN_ACCOUNT, FORBIDDEN_ROLE } from "../src/admin/services/hierarchy";
import { migrate } from "../src/db/migrate";
import { PASSWORD, testApp } from "./helpers";

const { sql, ids, cookies, sent, call, account, resetAccounts } = testApp();
const roleOf = async (name: string) =>
  (await sql`SELECT rol FROM tb_usuarios WHERE id_usuario = ${ids[name]}`)[0].rol;
// Como el panel: envía el rol que se ve en la lista recién cargada (o el indicado, para simular una lista vieja).
const changeRole = async (actor: string, target: string, rol: string, rolAnterior?: string) =>
  call(`/api/admin/usuarios/${ids[target]}/rol`, "PATCH", { rol, rolAnterior: rolAnterior ?? await roleOf(target), confirmacion: PASSWORD }, cookies[actor]);

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await account("maestro", "admin", true);
  await account("admin1", "admin");
  await account("admin2", "admin");
  await account("coadmin1", "coadmin");
  await account("votante1", "votante");
  await account("votante2", "votante");
});
afterAll(async () => { await sql.close(); });

test("/api/me informa rol y permisos sin exponer esMaestro", async () => {
  const admin = await (await call("/api/me", "GET", undefined, cookies.admin1)).json();
  expect(admin).toMatchObject({ rol: "admin" });
  expect(admin).not.toHaveProperty("esMaestro");
  expect(admin.permisos).toEqual(expect.arrayContaining(["usuarios.ver", "usuarios.rol.cambiar", "contenido.editar"]));
  const maestro = await (await call("/api/me", "GET", undefined, cookies.maestro)).json();
  expect(maestro).toMatchObject({ rol: "admin", permisos: admin.permisos });
  expect(maestro).not.toHaveProperty("esMaestro");
  const coadmin = await (await call("/api/me", "GET", undefined, cookies.coadmin1)).json();
  expect(coadmin.permisos).toContain("contenido.publicar");
  expect(coadmin.permisos).not.toContain("usuarios.ver");
  const votante = await (await call("/api/me", "GET", undefined, cookies.votante1)).json();
  expect(votante.permisos).not.toContain("contenido.editar");
});

test("solo los admin ven la lista, sin delatar qué cuenta es la maestra", async () => {
  expect((await call("/api/admin/usuarios")).status).toBe(401);
  expect((await call("/api/admin/usuarios", "GET", undefined, cookies.coadmin1)).status).toBe(403);
  expect((await call("/api/admin/usuarios", "GET", undefined, cookies.votante1)).status).toBe(403);
  const list = await (await call("/api/admin/usuarios", "GET", undefined, cookies.admin1)).json();
  expect(list.total).toBe(6);
  const fila = (n: string) => list.usuarios.find((u: { correo: string }) => u.correo === n + "@example.com");
  // Para un admin, el maestro es indistinguible de otro admin: mismo rol, mismo mensaje y sin esMaestro.
  expect(list.usuarios.some((u: object) => "esMaestro" in u)).toBe(false);
  expect(fila("maestro")).toMatchObject({ rol: "admin", rolesAsignables: [], motivoBloqueo: FORBIDDEN_ACCOUNT });
  expect(fila("admin2")).toMatchObject({ rolesAsignables: [], motivoBloqueo: FORBIDDEN_ACCOUNT });
  const motivos = list.usuarios.map((u: { motivoBloqueo: string | null }) => u.motivoBloqueo ?? "").join(" ");
  expect(motivos).not.toMatch(/maestro|comando|servidor/i);
  expect(fila("admin1").motivoBloqueo).toBe("No puedes modificar tu propia cuenta");
  expect(fila("votante1")).toMatchObject({ rolesAsignables: ["votante", "coadmin"], puedeCambiarEstado: true });
  const delMaestro = await (await call("/api/admin/usuarios", "GET", undefined, cookies.maestro)).json();
  expect(delMaestro.usuarios.some((u: object) => "esMaestro" in u)).toBe(false);
  expect(delMaestro.usuarios.find((u: { correo: string }) => u.correo === "admin2@example.com"))
    .toMatchObject({ rolesAsignables: ["votante", "coadmin", "admin"], puedeCambiarEstado: true });
});

test("la lista se filtra por texto, rol y estado, y pagina", async () => {
  const get = async (q: string) => (await call("/api/admin/usuarios" + q, "GET", undefined, cookies.admin1)).json();
  expect((await get("?q=votante")).total).toBe(2);
  expect((await get("?q=%25")).total).toBe(0);
  expect((await get("?rol=admin")).total).toBe(3);
  expect((await get("?rol=coadmin&estado=activo")).total).toBe(1);
  expect((await call("/api/admin/usuarios?rol=root", "GET", undefined, cookies.admin1)).status).toBe(422);
  const pagina2 = await get("?pagina=2");
  expect(pagina2).toMatchObject({ pagina: 2, porPagina: 20, total: 6 });
  expect(pagina2.usuarios).toEqual([]);
});

test("un admin sube votantes y baja coadmins, pero no nombra admins ni toca a otro admin ni al maestro", async () => {
  expect((await changeRole("admin1", "votante1", "coadmin")).status).toBe(200);
  expect(await roleOf("votante1")).toBe("coadmin");
  expect((await changeRole("admin1", "votante1", "votante")).status).toBe(200);
  const nombrarAdmin = await changeRole("admin1", "votante2", "admin");
  expect(nombrarAdmin.status).toBe(403);
  expect((await nombrarAdmin.json()).error).toBe(FORBIDDEN_ROLE);
  // La base también lo impide aunque alguien se salte la API.
  expect(await callPg(sql, "roleChange", [ids.admin1, ids.votante2, "admin", "votante"])).toEqual([]);
  expect(await roleOf("votante2")).toBe("votante");
  expect((await changeRole("maestro", "votante2", "admin")).status).toBe(200);
  expect(await roleOf("votante2")).toBe("admin");
  // Recién subido a admin: ahora solo el maestro puede bajarlo.
  const bajarAdmin = await changeRole("admin1", "votante2", "coadmin");
  expect(bajarAdmin.status).toBe(403);
  expect((await bajarAdmin.json()).error).toBe(FORBIDDEN_ACCOUNT);
  expect((await (await changeRole("admin1", "maestro", "coadmin")).json()).error).toBe(FORBIDDEN_ACCOUNT);
  expect((await changeRole("admin1", "admin2", "votante")).status).toBe(403);
  expect((await changeRole("admin1", "maestro", "coadmin")).status).toBe(403);
  expect((await changeRole("admin1", "admin1", "votante")).status).toBe(403);
  expect(await roleOf("admin2")).toBe("admin");
});

test("el maestro puede bajar a un admin; nadie cambia al maestro ni roles fuera de la lista", async () => {
  expect((await changeRole("maestro", "votante2", "coadmin")).status).toBe(200);
  expect(await roleOf("votante2")).toBe("coadmin");
  expect((await changeRole("maestro", "maestro", "votante")).status).toBe(403);
  expect((await changeRole("coadmin1", "votante1", "coadmin")).status).toBe(403);
  expect((await changeRole("maestro", "votante1", "analista")).status).toBe(422);
  const auditoria = await sql`SELECT count(*)::int AS total FROM tb_auditoria WHERE accion = 'rol_cambiado'`;
  expect(auditoria[0].total).toBe(4);
});

test("desactivar respeta la jerarquía y cierra las sesiones de la cuenta", async () => {
  const estadoDe = async (name: string) =>
    (await sql`SELECT estado FROM tb_usuarios WHERE id_usuario = ${ids[name]}`)[0]?.estado ?? "activo";
  const estado = async (actor: string, objetivo: string, valor: string) =>
    call(`/api/admin/usuarios/${ids[objetivo]}/estado`, "PATCH", { estado: valor, estadoAnterior: await estadoDe(objetivo), confirmacion: PASSWORD }, cookies[actor]);
  expect((await call("/api/me", "GET", undefined, cookies.votante1)).status).toBe(200);
  expect((await estado("admin1", "votante1", "bloqueado")).status).toBe(200);
  // El acceso vigente deja de servir aunque el JWT no haya caducado: la autorización consulta el estado.
  expect((await call("/api/me", "GET", undefined, cookies.votante1)).status).toBe(401);
  const sesiones = await sql`SELECT count(*)::int AS abiertas FROM tb_sesiones
    WHERE id_usuario = ${ids.votante1} AND revocado_en IS NULL`;
  expect(sesiones[0].abiertas).toBe(0);
  expect((await (await call("/api/admin/usuarios?estado=bloqueado", "GET", undefined, cookies.admin1)).json()).total).toBe(1);
  expect((await estado("admin1", "votante1", "activo")).status).toBe(200);
  expect((await estado("admin1", "admin2", "bloqueado")).status).toBe(403);
  expect((await estado("admin1", "maestro", "bloqueado")).status).toBe(403);
  expect((await estado("admin1", "admin1", "bloqueado")).status).toBe(403);
  expect((await estado("coadmin1", "votante2", "bloqueado")).status).toBe(403);
  expect((await estado("maestro", "admin2", "bloqueado")).status).toBe(200);
  expect((await estado("maestro", "admin2", "activo")).status).toBe(200);
  expect(await callPg(sql, "userStateChange", [ids.admin1, ids.maestro, "bloqueado", "activo"])).toEqual([]);
});

test("la base impide un segundo maestro y un maestro que no sea admin", async () => {
  // Las consultas de Bun SQL son perezosas: Promise.resolve las ejecuta; `expect().rejects` sola se queda esperando.
  const falla = (consulta: PromiseLike<unknown>) => Promise.resolve(consulta).then(() => false, () => true);
  expect(await falla(sql`UPDATE tb_usuarios SET es_maestro = true WHERE id_usuario = ${ids.admin1}`)).toBe(true);
  expect(await falla(sql`UPDATE tb_usuarios SET rol = 'coadmin' WHERE id_usuario = ${ids.maestro}`)).toBe(true);
  // Aunque la API fallara, la función de la base no deja a un admin bajar a otro admin.
  expect(await callPg(sql, "roleChange", [ids.admin1, ids.admin2, "votante", "admin"])).toEqual([]);
});

test("crear y transferir el maestro por comando", async () => {
  const [otra] = await callPg<{ resultado: string }>(sql, "masterCreate", ["nuevo@example.com", "Nuevo", "hash"]);
  expect(otra.resultado).toBe("ya_existe_maestro");
  const [transfer] = await callPg<{ resultado: string }>(sql, "masterTransfer", ["coadmin1@example.com"]);
  expect(transfer.resultado).toBe("transferido");
  const filas = await sql`SELECT correo, rol, es_maestro FROM tb_usuarios
    WHERE correo IN ('maestro@example.com', 'coadmin1@example.com') ORDER BY correo`;
  expect(filas.map((f: { correo: string; rol: string; es_maestro: boolean }) => [f.correo, f.rol, f.es_maestro])).toEqual([
    ["coadmin1@example.com", "admin", true],
    ["maestro@example.com", "admin", false],
  ]);
  const [repetida] = await callPg<{ resultado: string }>(sql, "masterTransfer", ["coadmin1@example.com"]);
  expect(repetida.resultado).toBe("ya_es_maestro");
});

test("cambiar rol o estado con una lista vieja no pisa lo que hizo otro admin; repetirlo es seguro", async () => {
  await account("votante3", "votante");
  // admin1 y admin2 ven a votante3 como votante. admin1 lo sube a coadmin.
  expect((await changeRole("admin1", "votante3", "coadmin", "votante")).status).toBe(200);
  // El maestro (coadmin1, desde la prueba anterior) no recargó: intenta subirlo a admin creyendo que sigue siendo votante.
  expect((await changeRole("coadmin1", "votante3", "admin", "votante")).status).toBe(409);
  expect(await roleOf("votante3")).toBe("coadmin");
  // Repetir exactamente el mismo cambio (doble clic) no falla ni duplica la auditoría.
  const antes = (await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'rol_cambiado'`)[0].n;
  expect((await changeRole("admin1", "votante3", "coadmin", "votante")).status).toBe(200);
  expect((await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'rol_cambiado'`)[0].n).toBe(antes);
  const estado = (actor: string, valor: string, anterior: string) =>
    call(`/api/admin/usuarios/${ids.votante3}/estado`, "PATCH", { estado: valor, estadoAnterior: anterior, confirmacion: PASSWORD }, cookies[actor]);
  expect((await estado("admin1", "bloqueado", "activo")).status).toBe(200);
  expect((await estado("admin1", "bloqueado", "activo")).status).toBe(200); // doble clic
  expect((await estado("admin2", "activo", "activo")).status).toBe(409);    // cree que está activa: no coincide
});

test("cambiar el rol o el estado exige la contraseña de quien lo hace", async () => {
  await account("votante4", "votante");
  const rol = (confirmacion?: string) => call(`/api/admin/usuarios/${ids.votante4}/rol`, "PATCH",
    { rol: "coadmin", rolAnterior: "votante", ...(confirmacion === undefined ? {} : { confirmacion }) }, cookies.admin1);
  expect((await rol()).status).toBe(422);
  const mal = await rol("otra-contraseña");
  expect(mal.status).toBe(403);
  expect((await mal.json()).error).toBe("La contraseña no es correcta");
  const desactivar = await call(`/api/admin/usuarios/${ids.votante4}/estado`, "PATCH",
    { estado: "bloqueado", estadoAnterior: "activo", confirmacion: "otra-contraseña" }, cookies.admin1);
  expect(desactivar.status).toBe(403);
  expect(await roleOf("votante4")).toBe("votante");
  expect((await sql`SELECT estado FROM tb_usuarios WHERE id_usuario = ${ids.votante4}`)[0].estado).toBe("activo");
  expect((await rol(PASSWORD)).status).toBe(200);
  expect(await roleOf("votante4")).toBe("coadmin");
});

test("tras varios fallos de contraseña hay que esperar, aunque después se escriba bien", async () => {
  const intento = (confirmacion: string) => call(`/api/admin/usuarios/${ids.votante4}/rol`, "PATCH",
    { rol: "votante", rolAnterior: "coadmin", confirmacion }, cookies.admin1);
  const estados: number[] = [];
  for (let i = 0; i < 6; i++) estados.push((await intento("otra-contraseña")).status);
  expect(estados).toEqual([403, 403, 403, 403, 403, 429]);
  expect((await intento(PASSWORD)).status).toBe(429);
  expect(await roleOf("votante4")).toBe("coadmin");
  await sql`DELETE FROM tb_limites_intentos`;
});

test("sin contraseña se confirma con un código enviado al correo, que sirve hasta vencer", async () => {
  await account("admin3", "admin");
  await sql`DELETE FROM tb_identidades_autenticacion WHERE id_usuario = ${ids.admin3}`;
  await account("votante5", "votante");
  const pedir = () => call("/api/admin/confirmacion/codigo", "POST", {}, cookies.admin3);
  const antes = sent.length;
  expect((await pedir()).status).toBe(200);
  expect((await pedir()).status).toBe(200); // doble clic: un solo correo
  const correos = sent.slice(antes);
  expect(correos).toHaveLength(1);
  expect(correos[0]).toMatchObject({ to: "admin3@example.com", subject: "Código para confirmar un cambio" });
  const codigo = correos[0].codigo;
  expect(codigo).toMatch(/^\d{6}$/);
  const rol = (nuevo: string, anterior: string, confirmacion: string) => call(`/api/admin/usuarios/${ids.votante5}/rol`, "PATCH",
    { rol: nuevo, rolAnterior: anterior, confirmacion }, cookies.admin3);
  const mal = await rol("coadmin", "votante", codigo === "000000" ? "000001" : "000000");
  expect(mal.status).toBe(403);
  expect((await mal.json()).error).toBe("El código no es correcto o ya venció");
  expect((await rol("coadmin", "votante", PASSWORD)).status).toBe(403);
  expect((await rol("coadmin", "votante", codigo)).status).toBe(200);
  expect((await rol("votante", "coadmin", codigo)).status).toBe(200);
  await sql`UPDATE tb_token_autenticacion SET creado_en = now() - interval '11 minutes', expira_en = now() - interval '1 minute'
    WHERE id_usuario = ${ids.admin3}`;
  expect((await rol("coadmin", "votante", codigo)).status).toBe(403);
  expect(await roleOf("votante5")).toBe("votante");
  await sql`DELETE FROM tb_limites_intentos`;
});

test("una cuenta con contraseña no pide código, y quien no gestiona usuarios no puede pedirlo", async () => {
  expect((await call("/api/admin/confirmacion/codigo", "POST", {}, cookies.admin1)).status).toBe(409);
  expect((await call("/api/admin/confirmacion/codigo", "POST", {}, cookies.votante2)).status).toBe(403);
});
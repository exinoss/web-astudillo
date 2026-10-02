import { pgTable, unique, integer, varchar, text, uniqueIndex, foreignKey, check, timestamp, index, jsonb, primaryKey, boolean, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const tbRoles = pgTable("tb_roles", {
	idRol: integer("id_rol").primaryKey().generatedAlwaysAsIdentity({ name: "tb_roles_id_rol_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	rol: varchar({ length: 40 }).notNull(),
	nombre: varchar({ length: 40 }).notNull(),
	descripcion: text(),
}, (table) => [
	unique("tb_roles_rol_key").on(table.rol),
]);

export const tbPermisos = pgTable("tb_permisos", {
	idPermiso: integer("id_permiso").primaryKey().generatedAlwaysAsIdentity({ name: "tb_permisos_id_permiso_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	codigo: varchar({ length: 80 }).notNull(),
	descripcion: text(),
}, (table) => [
	unique("tb_permisos_codigo_key").on(table.codigo),
]);

export const tbUsuarios = pgTable("tb_usuarios", {
	idUsuario: integer("id_usuario").primaryKey().generatedAlwaysAsIdentity({ name: "tb_usuarios_id_usuario_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	correo: varchar({ length: 320 }).notNull(),
	nombresCompletos: varchar("nombres_completos", { length: 200 }),
	direccion: text(),
	correoVerificadoEn: timestamp("correo_verificado_en", { withTimezone: true, mode: 'string' }).notNull(),
	rol: varchar({ length: 40 }).default('votante').notNull(),
	estado: varchar({ length: 20 }).default('activo').notNull(),
	// Admin maestro: uno solo, gestionado por `bun run admin:*` y nunca desde la API.
	esMaestro: boolean("es_maestro").default(false).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("uq_usuarios_correo_sin_mayusculas").using("btree", sql`lower((correo)::text)`),
	uniqueIndex("uq_usuarios_un_maestro").on(table.esMaestro).where(sql`es_maestro`),
	foreignKey({
			columns: [table.rol],
			foreignColumns: [tbRoles.rol],
			name: "tb_usuarios_rol_fkey"
		}).onUpdate("restrict").onDelete("restrict"),
	check("tb_usuarios_estado_check", sql`(estado)::text = ANY ((ARRAY['activo'::character varying, 'bloqueado'::character varying])::text[])`),
	check("ck_usuarios_maestro_admin", sql`NOT es_maestro OR (rol)::text = 'admin'::text`),
	check("ck_usuarios_correo_limpio", sql`((correo)::text = btrim((correo)::text)) AND ((correo)::text <> ''::text)`),
]);

export const tbIdentidadesAutenticacion = pgTable("tb_identidades_autenticacion", {
	idIdentidad: integer("id_identidad").primaryKey().generatedAlwaysAsIdentity({ name: "tb_identidades_autenticacion_id_identidad_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	idUsuario: integer("id_usuario").notNull(),
	proveedor: varchar({ length: 20 }).notNull(),
	sujetoExterno: varchar("sujeto_externo", { length: 255 }),
	contraseniaHash: text("contrasenia_hash"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idUsuario],
			foreignColumns: [tbUsuarios.idUsuario],
			name: "tb_identidades_autenticacion_id_usuario_fkey"
		}).onDelete("cascade"),
	unique("uq_identidad_usuario_proveedor").on(table.idUsuario, table.proveedor),
	unique("uq_identidad_proveedor_sujeto").on(table.proveedor, table.sujetoExterno),
	check("tb_identidades_autenticacion_proveedor_check", sql`(proveedor)::text = ANY ((ARRAY['correo'::character varying, 'google'::character varying])::text[])`),
	check("ck_identidad_credenciales", sql`(((proveedor)::text = 'correo'::text) AND (sujeto_externo IS NULL) AND (contrasenia_hash IS NOT NULL) AND (contrasenia_hash <> ''::text)) OR (((proveedor)::text = 'google'::text) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text) AND (contrasenia_hash IS NULL))`),
]);

export const tbTokenAutenticacion = pgTable("tb_token_autenticacion", {
	idTokenAutenticacion: integer("id_token_autenticacion").primaryKey().generatedAlwaysAsIdentity({ name: "tb_token_autenticacion_id_token_autenticacion_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	idUsuario: integer("id_usuario"),
	correo: varchar({ length: 320 }).notNull(),
	proposito: varchar({ length: 30 }).notNull(),
	tokenHash: text("token_hash").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiraEn: timestamp("expira_en", { withTimezone: true, mode: 'string' }).notNull(),
	consumidoEn: timestamp("consumido_en", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_tokens_caducidad").using("btree", table.expiraEn.asc().nullsLast().op("timestamptz_ops")),
	index("idx_tokens_usuario").using("btree", table.idUsuario.asc().nullsLast().op("int4_ops")).where(sql`(id_usuario IS NOT NULL)`),
	foreignKey({
			columns: [table.idUsuario],
			foreignColumns: [tbUsuarios.idUsuario],
			name: "tb_token_autenticacion_id_usuario_fkey"
		}).onDelete("cascade"),
	unique("tb_token_autenticacion_token_hash_key").on(table.tokenHash),
	check("tb_token_autenticacion_proposito_check", sql`(proposito)::text = ANY ((ARRAY['registro_correo'::character varying, 'recuperar_contrasenia'::character varying, 'acceso_correo'::character varying])::text[])`),
	check("tb_token_autenticacion_token_hash_check", sql`token_hash <> ''::text`),
	check("ck_token_correo_limpio", sql`((correo)::text = btrim((correo)::text)) AND ((correo)::text <> ''::text)`),
	check("ck_token_vigencia", sql`expira_en > creado_en`),
	// El registro aún no tiene usuario; recuperar y el acceso por enlace son de una cuenta existente.
	check("ck_token_destino", sql`(((proposito)::text = 'registro_correo'::text) AND (id_usuario IS NULL)) OR (((proposito)::text = ANY ((ARRAY['recuperar_contrasenia'::character varying, 'acceso_correo'::character varying])::text[])) AND (id_usuario IS NOT NULL))`),
]);

export const tbRegistrosPendientes = pgTable("tb_registros_pendientes", {
	idTokenAutenticacion: integer("id_token_autenticacion").primaryKey().notNull(),
	nombresCompletos: varchar("nombres_completos", { length: 200 }).notNull(),
	direccion: text(),
	contraseniaHash: text("contrasenia_hash").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idTokenAutenticacion],
			foreignColumns: [tbTokenAutenticacion.idTokenAutenticacion],
			name: "tb_registros_pendientes_id_token_autenticacion_fkey"
		}).onDelete("cascade"),
	check("tb_registros_pendientes_nombres_completos_check", sql`btrim((nombres_completos)::text) <> ''::text`),
	check("tb_registros_pendientes_contrasenia_hash_check", sql`contrasenia_hash <> ''::text`),
]);

export const tbSesiones = pgTable("tb_sesiones", {
	idSesion: integer("id_sesion").primaryKey().generatedAlwaysAsIdentity({ name: "tb_sesiones_id_sesion_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	idUsuario: integer("id_usuario").notNull(),
	tokenHash: text("token_hash").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiraEn: timestamp("expira_en", { withTimezone: true, mode: 'string' }).notNull(),
	revocadoEn: timestamp("revocado_en", { withTimezone: true, mode: 'string' }),
	ultimoUsoEn: timestamp("ultimo_uso_en", { withTimezone: true, mode: 'string' }),
	// Refresh token anterior a la última rotación: otra pestaña que renueva a la vez con él no cierra la sesión.
	tokenHashAnterior: text("token_hash_anterior"),
	rotadoEn: timestamp("rotado_en", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_sesiones_token_anterior").using("btree", table.tokenHashAnterior.asc().nullsLast().op("text_ops")),
	index("idx_sesiones_caducidad").using("btree", table.expiraEn.asc().nullsLast().op("timestamptz_ops")),
	index("idx_sesiones_usuario").using("btree", table.idUsuario.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idUsuario],
			foreignColumns: [tbUsuarios.idUsuario],
			name: "tb_sesiones_id_usuario_fkey"
		}).onDelete("cascade"),
	unique("tb_sesiones_token_hash_key").on(table.tokenHash),
	check("tb_sesiones_token_hash_check", sql`token_hash <> ''::text`),
	check("ck_sesion_vigencia", sql`expira_en > creado_en`),
]);

export const tbAuditoria = pgTable("tb_auditoria", {
	idAuditoria: integer("id_auditoria").primaryKey().generatedAlwaysAsIdentity({ name: "tb_auditoria_id_auditoria_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	idActor: integer("id_actor"),
	accion: varchar({ length: 80 }).notNull(),
	entidad: varchar({ length: 80 }).notNull(),
	idRegistro: integer("id_registro"),
	cambios: jsonb().default({}).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_auditoria_actor").using("btree", table.idActor.asc().nullsLast().op("int4_ops")),
	index("idx_auditoria_entidad_registro").using("btree", table.entidad.asc().nullsLast(), table.idRegistro.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idActor],
			foreignColumns: [tbUsuarios.idUsuario],
			name: "tb_auditoria_id_actor_fkey"
		}).onDelete("set null"),
	check("tb_auditoria_cambios_check", sql`jsonb_typeof(cambios) = 'object'::text`),
]);

export const tbRolPermisos = pgTable("tb_rol_permisos", {
	idRol: integer("id_rol").notNull(),
	idPermiso: integer("id_permiso").notNull(),
}, (table) => [
	index("idx_rol_permisos_permiso").using("btree", table.idPermiso.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idRol],
			foreignColumns: [tbRoles.idRol],
			name: "tb_rol_permisos_id_rol_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.idPermiso],
			foreignColumns: [tbPermisos.idPermiso],
			name: "tb_rol_permisos_id_permiso_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.idRol, table.idPermiso], name: "tb_rol_permisos_pkey"}),
]);

// Contenido editable del sitio. Estas tablas son el borrador vivo; lo publicado es la copia
// congelada en tb_publicaciones.contenido que usa la compilación del sitio.

export const tbMedios = pgTable("tb_medios", {
	idMedio: integer("id_medio").primaryKey().generatedAlwaysAsIdentity(),
	nombre: varchar({ length: 80 }).notNull(),
	ancho: integer().notNull(),
	alto: integer().notNull(),
	anchos: integer().array().notNull(),
	creadoPor: integer("creado_por"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// SHA-256 del archivo original: subir la misma foto otra vez (reintento, doble envío) reutiliza la existente.
	hashContenido: varchar("hash_contenido", { length: 64 }),
}, (table) => [
	unique("uq_medios_nombre").on(table.nombre),
	unique("uq_medios_hash_contenido").on(table.hashContenido),
	foreignKey({ columns: [table.creadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_medios_creado_por_fkey" }).onDelete("set null"),
	check("ck_medios_nombre", sql`nombre ~ '^[a-z0-9-]{8,80}$'`),
]);

export const tbTextos = pgTable("tb_textos", {
	clave: varchar({ length: 120 }).primaryKey(),
	valor: text().notNull(),
	actualizadoPor: integer("actualizado_por"),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.actualizadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_textos_actualizado_por_fkey" }).onDelete("set null"),
	check("ck_textos_clave", sql`clave ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'`),
	check("ck_textos_valor", sql`char_length(valor) BETWEEN 1 AND 1000`),
]);

export const tbPropuestas = pgTable("tb_propuestas", {
	slug: varchar({ length: 80 }).primaryKey(),
	nombre: varchar({ length: 120 }).notNull(),
	categoria: varchar({ length: 80 }).notNull(),
	introduccion: varchar({ length: 400 }).notNull(),
	orden: integer().notNull(),
	actualizadoPor: integer("actualizado_por"),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.actualizadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_propuestas_actualizado_por_fkey" }).onDelete("set null"),
]);

export const tbPropuestaKpis = pgTable("tb_propuesta_kpis", {
	idKpi: integer("id_kpi").primaryKey().generatedAlwaysAsIdentity(),
	slug: varchar({ length: 80 }).notNull(),
	orden: integer().notNull(),
	etiqueta: varchar({ length: 60 }).notNull(),
	valor: varchar({ length: 30 }).notNull(),
}, (table) => [
	index("idx_propuesta_kpis_slug").on(table.slug, table.orden),
	foreignKey({ columns: [table.slug], foreignColumns: [tbPropuestas.slug], name: "tb_propuesta_kpis_slug_fkey" }).onDelete("cascade"),
]);

export const tbBiografiaHitos = pgTable("tb_biografia_hitos", {
	idHito: integer("id_hito").primaryKey().generatedAlwaysAsIdentity(),
	orden: integer().notNull(),
	anios: varchar({ length: 40 }).notNull(),
	titulo: varchar({ length: 120 }).notNull(),
	texto: varchar({ length: 3000 }).notNull(),
	idMedio: integer("id_medio"),
	alt: varchar({ length: 200 }),
}, (table) => [
	foreignKey({ columns: [table.idMedio], foreignColumns: [tbMedios.idMedio], name: "tb_biografia_hitos_id_medio_fkey" }).onDelete("set null"),
]);

export const tbObras = pgTable("tb_obras", {
	slug: varchar({ length: 80 }).primaryKey(),
	nota: varchar({ length: 600 }).notNull(),
	actualizadoPor: integer("actualizado_por"),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.slug], foreignColumns: [tbPropuestas.slug], name: "tb_obras_slug_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.actualizadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_obras_actualizado_por_fkey" }).onDelete("set null"),
]);

export const tbObraHitos = pgTable("tb_obra_hitos", {
	idHito: integer("id_hito").primaryKey().generatedAlwaysAsIdentity(),
	slug: varchar({ length: 80 }).notNull(),
	orden: integer().notNull(),
	nombre: varchar({ length: 120 }).notNull(),
	completado: boolean().default(false).notNull(),
}, (table) => [
	index("idx_obra_hitos_slug").on(table.slug, table.orden),
	foreignKey({ columns: [table.slug], foreignColumns: [tbObras.slug], name: "tb_obra_hitos_slug_fkey" }).onDelete("cascade"),
]);

export const tbObraFotos = pgTable("tb_obra_fotos", {
	idFoto: integer("id_foto").primaryKey().generatedAlwaysAsIdentity(),
	slug: varchar({ length: 80 }).notNull(),
	orden: integer().notNull(),
	idMedio: integer("id_medio").notNull(),
	pie: varchar({ length: 200 }).notNull(),
}, (table) => [
	index("idx_obra_fotos_slug").on(table.slug, table.orden),
	foreignKey({ columns: [table.slug], foreignColumns: [tbObras.slug], name: "tb_obra_fotos_slug_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.idMedio], foreignColumns: [tbMedios.idMedio], name: "tb_obra_fotos_id_medio_fkey" }).onDelete("restrict"),
]);

export const tbPublicaciones = pgTable("tb_publicaciones", {
	idPublicacion: integer("id_publicacion").primaryKey().generatedAlwaysAsIdentity(),
	estado: varchar({ length: 20 }).default('en_cola').notNull(),
	contenido: jsonb().notNull(),
	creadoPor: integer("creado_por"),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	iniciadoEn: timestamp("iniciado_en", { withTimezone: true, mode: 'string' }),
	terminadoEn: timestamp("terminado_en", { withTimezone: true, mode: 'string' }),
	detalle: text(),
}, (table) => [
	index("idx_publicaciones_estado").on(table.estado, table.idPublicacion),
	// Una sola publicación en cola: publicar de nuevo antes de que empiece reemplaza su contenido.
	uniqueIndex("uq_publicaciones_una_en_cola").on(table.estado).where(sql`estado = 'en_cola'`),
	foreignKey({ columns: [table.creadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_publicaciones_creado_por_fkey" }).onDelete("set null"),
	check("ck_publicaciones_estado", sql`estado IN ('en_cola', 'publicando', 'publicada', 'fallida')`),
	check("ck_publicaciones_contenido", sql`jsonb_typeof(contenido) = 'object'`),
]);

// Fallos de acceso por clave (correo+IP, IP, correo). La escalada vive en fn_limit_fail (database/fn.sql).
export const tbLimitesIntentos = pgTable("tb_limites_intentos", {
	clave: varchar({ length: 400 }).primaryKey().notNull(),
	fallos: integer().notNull(),
	bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true, mode: 'string' }),
	ultimoFallo: timestamp("ultimo_fallo", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_limites_ultimo_fallo").using("btree", table.ultimoFallo.asc().nullsLast().op("timestamptz_ops")),
]);

// Alertas y sugerencias de votantes con sesión. `clave_idempotencia` la genera el navegador al
// crear el borrador: reenviar el mismo formulario (doble clic, reintento) no crea otra fila.

export const tbAlertas = pgTable("tb_alertas", {
	idAlerta: integer("id_alerta").primaryKey().generatedAlwaysAsIdentity(),
	idUsuario: integer("id_usuario").notNull(),
	tipo: varchar({ length: 20 }).notNull(),
	sector: varchar({ length: 120 }).notNull(),
	referencia: varchar({ length: 180 }),
	descripcion: varchar({ length: 1500 }).notNull(),
	// Nombre base de la foto en la carpeta privada (`<foto>-<ancho>.webp`); nginx no la sirve.
	foto: varchar({ length: 80 }),
	estado: varchar({ length: 20 }).default('recibida').notNull(),
	claveIdempotencia: uuid("clave_idempotencia").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoPor: integer("actualizado_por"),
}, (table) => [
	unique("uq_alertas_idempotencia").on(table.idUsuario, table.claveIdempotencia),
	index("idx_alertas_usuario").on(table.idUsuario, table.idAlerta),
	index("idx_alertas_estado").on(table.estado, table.idAlerta),
	foreignKey({ columns: [table.idUsuario], foreignColumns: [tbUsuarios.idUsuario], name: "tb_alertas_id_usuario_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.actualizadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_alertas_actualizado_por_fkey" }).onDelete("set null"),
	check("ck_alertas_tipo", sql`tipo IN ('agua', 'basura', 'alumbrado', 'baches', 'seguridad', 'otro')`),
	check("ck_alertas_estado", sql`estado IN ('recibida', 'en_revision', 'atendida')`),
	check("ck_alertas_descripcion", sql`char_length(descripcion) >= 10`),
	check("ck_alertas_foto", sql`foto IS NULL OR foto ~ '^[a-z0-9-]{8,80}$'`),
]);

export const tbSugerencias = pgTable("tb_sugerencias", {
	idSugerencia: integer("id_sugerencia").primaryKey().generatedAlwaysAsIdentity(),
	idUsuario: integer("id_usuario").notNull(),
	// Slug de una propuesta u «otro»; no es clave foránea para que borrar una propuesta no borre ideas.
	tema: varchar({ length: 80 }).notNull(),
	mensaje: varchar({ length: 1500 }).notNull(),
	estado: varchar({ length: 20 }).default('recibida').notNull(),
	claveIdempotencia: uuid("clave_idempotencia").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoPor: integer("actualizado_por"),
}, (table) => [
	unique("uq_sugerencias_idempotencia").on(table.idUsuario, table.claveIdempotencia),
	index("idx_sugerencias_usuario").on(table.idUsuario, table.idSugerencia),
	index("idx_sugerencias_estado").on(table.estado, table.idSugerencia),
	foreignKey({ columns: [table.idUsuario], foreignColumns: [tbUsuarios.idUsuario], name: "tb_sugerencias_id_usuario_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.actualizadoPor], foreignColumns: [tbUsuarios.idUsuario], name: "tb_sugerencias_actualizado_por_fkey" }).onDelete("set null"),
	check("ck_sugerencias_tema", sql`tema ~ '^[a-z0-9-]{1,80}$'`),
	check("ck_sugerencias_estado", sql`estado IN ('recibida', 'en_revision', 'atendida')`),
	check("ck_sugerencias_mensaje", sql`char_length(mensaje) >= 15`),
]);

// Preguntas frecuentes del chat: contenido editable y publicable como el resto del borrador.
export const tbChatRespuestas = pgTable("tb_chat_respuestas", {
	idRespuesta: integer("id_respuesta").primaryKey().generatedAlwaysAsIdentity(),
	orden: integer().notNull(),
	pregunta: varchar({ length: 160 }).notNull(),
	// Separadas por comas; el chat compara sin tildes ni mayúsculas.
	palabrasClave: varchar("palabras_clave", { length: 300 }).notNull(),
	respuesta: varchar({ length: 1000 }).notNull(),
	enlaceTexto: varchar("enlace_texto", { length: 60 }),
	enlaceRuta: varchar("enlace_ruta", { length: 200 }),
	destacada: boolean().default(false).notNull(),
}, (table) => [
	// Solo rutas del propio sitio: el chat nunca enlaza fuera.
	check("ck_chat_enlace_ruta", sql`enlace_ruta IS NULL OR enlace_ruta ~ '^/[a-z0-9/#-]*$'`),
]);

// Lo que el chat no supo responder, agrupado por texto normalizado: base para nuevas respuestas.
export const tbChatSinRespuesta = pgTable("tb_chat_sin_respuesta", {
	textoNormalizado: varchar("texto_normalizado", { length: 300 }).primaryKey(),
	ejemplo: varchar({ length: 300 }).notNull(),
	veces: integer().default(1).notNull(),
	ultimaVez: timestamp("ultima_vez", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_chat_sin_respuesta_veces").on(table.veces),
]);

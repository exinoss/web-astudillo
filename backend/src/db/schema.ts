import { pgTable, unique, integer, varchar, text, uniqueIndex, foreignKey, check, timestamp, index, jsonb, primaryKey } from "drizzle-orm/pg-core"
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
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("uq_usuarios_correo_sin_mayusculas").using("btree", sql`lower((correo)::text)`),
	foreignKey({
			columns: [table.rol],
			foreignColumns: [tbRoles.rol],
			name: "tb_usuarios_rol_fkey"
		}).onUpdate("restrict").onDelete("restrict"),
	check("tb_usuarios_estado_check", sql`(estado)::text = ANY ((ARRAY['activo'::character varying, 'bloqueado'::character varying])::text[])`),
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
	sujetoExterno: varchar("sujeto_externo", { length: 255 }),
	verificadorNavegadorHash: text("verificador_navegador_hash"),
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
	check("tb_token_autenticacion_proposito_check", sql`(proposito)::text = ANY ((ARRAY['registro_correo'::character varying, 'registro_google'::character varying, 'vincular_google'::character varying, 'recuperar_contrasenia'::character varying])::text[])`),
	check("tb_token_autenticacion_token_hash_check", sql`token_hash <> ''::text`),
	check("ck_token_correo_limpio", sql`((correo)::text = btrim((correo)::text)) AND ((correo)::text <> ''::text)`),
	check("ck_token_vigencia", sql`expira_en > creado_en`),
	check("ck_token_destino", sql`(((proposito)::text = 'registro_correo'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NULL)) OR (((proposito)::text = 'registro_google'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'vincular_google'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'recuperar_contrasenia'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NULL))`),
]);

export const tbRegistrosPendientes = pgTable("tb_registros_pendientes", {
	idTokenAutenticacion: integer("id_token_autenticacion").primaryKey().notNull(),
	nombresCompletos: varchar("nombres_completos", { length: 200 }).notNull(),
	direccion: text(),
	contraseniaHash: text("contrasenia_hash").notNull(),
	verificadorNavegadorHash: text("verificador_navegador_hash").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idTokenAutenticacion],
			foreignColumns: [tbTokenAutenticacion.idTokenAutenticacion],
			name: "tb_registros_pendientes_id_token_autenticacion_fkey"
		}).onDelete("cascade"),
	check("tb_registros_pendientes_nombres_completos_check", sql`btrim((nombres_completos)::text) <> ''::text`),
	check("tb_registros_pendientes_contrasenia_hash_check", sql`contrasenia_hash <> ''::text`),
	check("tb_registros_pendientes_verificador_navegador_hash_check", sql`verificador_navegador_hash <> ''::text`),
]);

export const tbSesiones = pgTable("tb_sesiones", {
	idSesion: integer("id_sesion").primaryKey().generatedAlwaysAsIdentity({ name: "tb_sesiones_id_sesion_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	idUsuario: integer("id_usuario").notNull(),
	tokenHash: text("token_hash").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiraEn: timestamp("expira_en", { withTimezone: true, mode: 'string' }).notNull(),
	revocadoEn: timestamp("revocado_en", { withTimezone: true, mode: 'string' }),
	ultimoUsoEn: timestamp("ultimo_uso_en", { withTimezone: true, mode: 'string' }),
}, (table) => [
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

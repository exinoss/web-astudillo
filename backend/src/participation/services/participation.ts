import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization, Limiter } from '../../auth/types';
import { callPg } from '../../db/call';
import { savePhoto, sha256 } from '../../content/services/media';
import { plainText } from '../../content/services/validation';
import { ApiError } from '../../http';
import { requireParticipationAcceptance } from '../../auth/services/consent';
import { VERSION_LEGAL } from '../../contracts/legal';

export const ALERT_TYPES = ['agua', 'basura', 'alumbrado', 'baches', 'seguridad', 'otro'] as const;
export const STATES = ['recibida', 'en_revision', 'atendida'] as const;
export type State = typeof STATES[number];
export const MAX_ALERT_PHOTO_BYTES = 5 * 1024 * 1024;
/** Anchos fijos de las fotos de alertas: miniatura del historial y vista ampliada del panel. */
export const ALERT_PHOTO_WIDTHS = [480, 1280];
export const PAGE_SIZE = 20;
const HISTORY = 20;
/** Envíos por usuario cada 10 minutos (alertas y sugerencias por separado). */
const SENDS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60_000;
const STATE_CONFLICT = 'Otra persona cambió el estado mientras tanto; recarga la lista.';

export interface AlertInput {
  idempotencia: string;
  tipo: typeof ALERT_TYPES[number];
  sector: string;
  referencia?: string;
  descripcion: string;
  foto?: File;
}

type AlertRow = {
  id_alerta: number; tipo: string; sector: string; referencia: string | null; descripcion: string;
  foto: string | null; estado: State; creado_en: string; autor?: string | null; correo?: string;
};
type SuggestionRow = {
  id_sugerencia: number; tema: string; mensaje: string; estado: State; creado_en: string;
  autor?: string | null; correo?: string;
};

/** Ruta privada de la foto; la API la sirve solo a su autor y a quien revisa la participación. */
const photoUrl = (name: string | null, width: number) => (name ? `/api/participacion/fotos/${name}-${width}.webp` : null);

const toAlert = (r: AlertRow) => ({
  id: r.id_alerta, tipo: r.tipo, sector: r.sector, referencia: r.referencia, descripcion: r.descripcion,
  estado: r.estado, creadoEn: r.creado_en,
  foto: r.foto ? { miniatura: photoUrl(r.foto, 480)!, grande: photoUrl(r.foto, 1280)! } : null,
  ...(r.correo ? { autor: r.autor ?? null, correo: r.correo } : {}),
});
const toSuggestion = (r: SuggestionRow) => ({
  id: r.id_sugerencia, tema: r.tema, mensaje: r.mensaje, estado: r.estado, creadoEn: r.creado_en,
  ...(r.correo ? { autor: r.autor ?? null, correo: r.correo } : {}),
});

export function createParticipation(sql: SQL, authorization: Authorization, limit: Limiter, photoDir: string) {
  type StateRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; estado: State };
  const stateResult = ([row]: StateRow[]) => {
    if (!row) throw new ApiError(404, 'No encontrado');
    if (row.resultado === 'conflicto') throw new ApiError(409, STATE_CONFLICT);
    return { estado: row.estado };
  };

  return {
    /**
     * Idempotente por `idempotencia`: un reintento devuelve la alerta ya creada sin volver a procesar
     * la foto. La foto se nombra por su hash, así una misma imagen no ocupa disco dos veces.
     */
    async createAlert(access: string | undefined, input: AlertInput) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      await requireParticipationAcceptance(sql, user.id_usuario);
      const [existing] = await callPg<AlertRow>(sql, 'alertByKey', [user.id_usuario, input.idempotencia]);
      if (existing) return toAlert(existing);
      limit(`alerta:${user.id_usuario}`, SENDS_PER_WINDOW, WINDOW_MS);
      const sector = plainText(input.sector, 'Sector o barrio', 120);
      const reference = input.referencia?.trim() ? plainText(input.referencia, 'Referencia', 180) : null;
      const description = plainText(input.descripcion, '¿Qué está ocurriendo?', 1500, { multiline: true });
      if (Array.from(description).length < 10) throw new ApiError(422, '¿Qué está ocurriendo?: escribe al menos 10 caracteres');
      let photo: string | null = null;
      if (input.foto && input.foto.size) {
        if (input.foto.size > MAX_ALERT_PHOTO_BYTES) throw new ApiError(413, 'La foto supera los 5 MB');
        const bytes = Buffer.from(await input.foto.arrayBuffer());
        photo = `a${sha256(bytes).slice(0, 40)}`;
        await savePhoto(bytes, photoDir, photo, ALERT_PHOTO_WIDTHS, true);
      }
      const [row] = await callPg<AlertRow>(sql, 'alertCreate', [
        user.id_usuario, input.idempotencia, input.tipo, sector, reference, description, photo, VERSION_LEGAL,
      ]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return toAlert(row);
    },

    async myAlerts(access: string | undefined) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      return { alertas: (await callPg<AlertRow>(sql, 'alertsMine', [user.id_usuario, HISTORY])).map(toAlert) };
    },

    async createSuggestion(access: string | undefined, input: { idempotencia: string; tema: string; mensaje: string }) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      await requireParticipationAcceptance(sql, user.id_usuario);
      const message = plainText(input.mensaje, '¿Qué te gustaría proponer?', 1500, { multiline: true });
      if (Array.from(message).length < 15) throw new ApiError(422, '¿Qué te gustaría proponer?: escribe al menos 15 caracteres');
      limit(`sugerencia:${user.id_usuario}`, SENDS_PER_WINDOW, WINDOW_MS);
      // Un reintento con la misma `idempotencia` devuelve la sugerencia ya creada (`nueva = false`).
      const [row] = await callPg<SuggestionRow>(sql, 'suggestionCreate', [user.id_usuario, input.idempotencia, input.tema, message, VERSION_LEGAL]);
      if (!row) throw new ApiError(403, 'Permiso insuficiente');
      return toSuggestion(row);
    },

    async mySuggestions(access: string | undefined) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      return { sugerencias: (await callPg<SuggestionRow>(sql, 'suggestionsMine', [user.id_usuario, HISTORY])).map(toSuggestion) };
    },

    async list(access: string | undefined, kind: 'alertas' | 'sugerencias', state: State | undefined, page: number) {
      const actor = await authorization.require(access, PERMISSIONS.participationView);
      const args = [actor.id_usuario, state ?? null, PAGE_SIZE, (page - 1) * PAGE_SIZE];
      const [rows, counts] = await Promise.all([
        kind === 'alertas'
          ? callPg<AlertRow>(sql, 'alertsList', args).then(r => r.map(toAlert))
          : callPg<SuggestionRow>(sql, 'suggestionsList', args).then(r => r.map(toSuggestion)),
        callPg<{ tipo: string; estado: State; total: number }>(sql, 'participationCounts', [actor.id_usuario]),
      ]);
      const conteo = (tipo: string) => Object.fromEntries(STATES.map(s =>
        [s, counts.find(c => c.tipo === tipo && c.estado === s)?.total ?? 0]));
      return { items: rows, pagina: page, porPagina: PAGE_SIZE, conteo: { alertas: conteo('alertas'), sugerencias: conteo('sugerencias') } };
    },

    /** Cambio de estado con control optimista (`expected` es el estado que veía el panel). */
    async changeState(access: string | undefined, kind: 'alertas' | 'sugerencias', id: number, state: State, expected: State) {
      const actor = await authorization.require(access, PERMISSIONS.participationManage);
      return stateResult(await callPg<StateRow>(sql, kind === 'alertas' ? 'alertStateChange' : 'suggestionStateChange',
        [actor.id_usuario, id, state, expected]));
    },

    /** Autoriza una foto privada; responde 404 también cuando no hay permiso para no revelar que existe. */
    async photoAllowed(access: string | undefined, name: string) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      const [row] = await callPg<{ permitido: boolean }>(sql, 'alertPhotoAllowed', [user.id_usuario, name]);
      if (!row?.permitido) throw new ApiError(404, 'No encontrado');
    },
  };
}

export type Participation = ReturnType<typeof createParticipation>;

import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization, Limiter } from '../../auth/types';
import { callPg } from '../../db/call';
import { savePhoto } from '../../content/services/media';
import { sha256 } from '../../security';
import { plainText } from '../../validation/texto';
import { ApiError } from '../../http';
import { requireParticipationAcceptance } from '../../auth/services/consent';
import { VERSION_LEGAL } from '../../contracts/legal';
import { compartirEnCurso } from './en-curso';
import {
  ESTADOS_PARTICIPACION, type EstadoParticipacion as State, LARGOS_PARTICIPACION, MAX_BYTES_FOTO_ALERTA, MAX_MB_FOTO_ALERTA,
  MIN_DESCRIPCION_ALERTA, MIN_MENSAJE_SUGERENCIA, type TipoAlerta,
} from '../../contracts/participacion';

/** Anchos fijos de las fotos de alertas: miniatura del historial y vista ampliada del panel. */
const ALERT_PHOTO_WIDTHS = [480, 1280];
export const PAGE_SIZE = 20;
const HISTORY = 20;
/** Envíos por usuario cada 10 minutos (alertas y sugerencias por separado). */
const SENDS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60_000;
const STATE_CONFLICT = 'Otra persona cambió el estado mientras tanto; recarga la lista.';

export interface AlertInput {
  idempotencia: string;
  tipo: TipoAlerta;
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
  const alertSending = compartirEnCurso<AlertRow>();
  const suggestionSending = compartirEnCurso<SuggestionRow>();

  return {
    /** Crea la alerta; un reintento con la misma `idempotencia` devuelve la ya creada sin procesar otra vez la foto. */
    async createAlert(access: string | undefined, input: AlertInput) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      await requireParticipationAcceptance(sql, user.id_usuario);
      return toAlert(await alertSending(`${user.id_usuario}:${input.idempotencia}`, async () => {
        const [existing] = await callPg<AlertRow>(sql, 'alertByKey', [user.id_usuario, input.idempotencia]);
        if (existing) return existing;
        limit(`alerta:${user.id_usuario}`, SENDS_PER_WINDOW, WINDOW_MS);
        const sector = plainText(input.sector, 'Sector o barrio', LARGOS_PARTICIPACION.sector);
        const reference = input.referencia?.trim() ? plainText(input.referencia, 'Referencia', LARGOS_PARTICIPACION.referencia) : null;
        const description = plainText(input.descripcion, '¿Qué está ocurriendo?', LARGOS_PARTICIPACION.descripcion, { multiline: true });
        if (Array.from(description).length < MIN_DESCRIPCION_ALERTA)
          throw new ApiError(422, `¿Qué está ocurriendo?: escribe al menos ${MIN_DESCRIPCION_ALERTA} caracteres`);
        let photo: string | null = null;
        if (input.foto && input.foto.size) {
          if (input.foto.size > MAX_BYTES_FOTO_ALERTA) throw new ApiError(413, `La foto supera los ${MAX_MB_FOTO_ALERTA} MB`);
          const bytes = Buffer.from(await input.foto.arrayBuffer());
          photo = `a${sha256(bytes).slice(0, 40)}`;
          await savePhoto(bytes, photoDir, photo, ALERT_PHOTO_WIDTHS, true);
        }
        const [row] = await callPg<AlertRow>(sql, 'alertCreate', [
          user.id_usuario, input.idempotencia, input.tipo, sector, reference, description, photo, VERSION_LEGAL,
        ]);
        if (!row) throw new ApiError(403, 'Permiso insuficiente');
        return row;
      }));
    },

    async myAlerts(access: string | undefined) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      return { alertas: (await callPg<AlertRow>(sql, 'alertsMine', [user.id_usuario, HISTORY])).map(toAlert) };
    },

    async createSuggestion(access: string | undefined, input: { idempotencia: string; tema: string; mensaje: string }) {
      const user = await authorization.require(access, PERMISSIONS.participationSend);
      await requireParticipationAcceptance(sql, user.id_usuario);
      const message = plainText(input.mensaje, '¿Qué te gustaría proponer?', LARGOS_PARTICIPACION.mensaje, { multiline: true });
      if (Array.from(message).length < MIN_MENSAJE_SUGERENCIA)
        throw new ApiError(422, `¿Qué te gustaría proponer?: escribe al menos ${MIN_MENSAJE_SUGERENCIA} caracteres`);
      return toSuggestion(await suggestionSending(`${user.id_usuario}:${input.idempotencia}`, async () => {
        const [existing] = await callPg<SuggestionRow>(sql, 'suggestionByKey', [user.id_usuario, input.idempotencia]);
        if (existing) return existing;
        limit(`sugerencia:${user.id_usuario}`, SENDS_PER_WINDOW, WINDOW_MS);
        const [row] = await callPg<SuggestionRow>(sql, 'suggestionCreate', [user.id_usuario, input.idempotencia, input.tema, message, VERSION_LEGAL]);
        if (!row) throw new ApiError(403, 'Permiso insuficiente');
        return row;
      }));
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
      const conteo = (tipo: string) => Object.fromEntries(ESTADOS_PARTICIPACION.map(s =>
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

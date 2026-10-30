import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { PARROQUIAS, type ParroquiaSlug } from '../../contracts/parroquias';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { plainText } from '../../validation/texto';
import { CONTENT_CONFLICT } from '../conflictos';
import type { MyTeam, ParishStored, TeamStored } from '../types';
import { photosById } from './media';

type SaveRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; version: string | null };

export interface TeamInput { personas: { idMedio: number | null; nombre: string; quien: string }[] }
export interface ParishInput { texto: string; fotos: { idMedio: number; alt: string }[] }

const isParish = (slug: string): slug is ParroquiaSlug => PARROQUIAS.some(p => p.slug === slug);
const EMPTY_PARISH: ParishStored = { texto: '', fotos: [] };

export const emptyMyTeam = (): MyTeam => ({ equipo: [], parroquias: PARROQUIAS.map(p => ({ slug: p.slug, texto: '', fotos: [] })) });

/** Una foto borrada deja a la persona sin foto y quita la foto de la parroquia. */
export async function listMyTeam(sql: SQL): Promise<MyTeam> {
  const rows = new Map((await callPg<{ clave: string; contenido: TeamStored | ParishStored }>(sql, 'myTeamList'))
    .map(r => [r.clave, r.contenido]));
  const team = (rows.get('equipo') as TeamStored | undefined)?.personas ?? [];
  const parishes = PARROQUIAS.map(p => ({ slug: p.slug, ...((rows.get(p.slug) as ParishStored | undefined) ?? EMPTY_PARISH) }));
  const media = await photosById(sql, [...team.flatMap(p => (p.idMedio ? [p.idMedio] : [])), ...parishes.flatMap(p => p.fotos.map(f => f.idMedio))]);
  return {
    equipo: team.map(p => ({ nombre: p.nombre, quien: p.quien, foto: p.idMedio ? media.get(p.idMedio) ?? null : null })),
    parroquias: parishes.map(p => ({
      slug: p.slug, texto: p.texto,
      fotos: p.fotos.flatMap(({ idMedio, alt }) => { const foto = media.get(idMedio); return foto ? [{ foto, alt }] : []; }),
    })),
  };
}

export function createMyTeam(sql: SQL, authorization: Authorization) {
  async function save(actor: { id_usuario: number }, key: string, content: TeamStored | ParishStored, ids: number[], version: string | null) {
    const media = await photosById(sql, ids);
    if (ids.some(id => !media.has(id))) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
    const [row] = await callPg<SaveRow>(sql, 'myTeamSave', [actor.id_usuario, key, content, version]);
    if (!row) throw new ApiError(404, 'No encontrado');
    if (row.resultado === 'conflicto') throw new ApiError(409, CONTENT_CONFLICT);
    return { version: row.version };
  }

  return {
    async saveTeam(access: string | undefined, input: TeamInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const personas = input.personas.map((p, i) => ({
        idMedio: p.idMedio,
        nombre: plainText(p.nombre, `Persona ${i + 1} · nombre`, 80),
        quien: p.quien.trim() ? plainText(p.quien, `Persona ${i + 1} · quién es`, 60) : null,
      }));
      return save(actor, 'equipo', { personas }, personas.flatMap(p => (p.idMedio ? [p.idMedio] : [])), version);
    },

    async saveParish(access: string | undefined, slug: string, input: ParishInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!isParish(slug)) throw new ApiError(404, 'No encontrado');
      const content: ParishStored = {
        texto: input.texto.trim() ? plainText(input.texto, 'Texto', 3000, { multiline: true }) : '',
        fotos: input.fotos.map((f, i) => ({ idMedio: f.idMedio, alt: plainText(f.alt, `Foto ${i + 1} · descripción`, 200) })),
      };
      return save(actor, slug, content, content.fotos.map(f => f.idMedio), version);
    },
  };
}

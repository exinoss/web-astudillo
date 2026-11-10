import type { SQL } from 'bun';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { MAX_PRESENTACION, MAX_PUNTO_TRAYECTORIA, ordenPuesto, PUESTOS } from '../../contracts/equipo';
import { PARROQUIAS, type ParroquiaSlug } from '../../contracts/parroquias';
import { LARGOS } from '../../contracts/limites';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { plainText } from '../../validation/texto';
import { existingPhotos, saved, type SaveRow } from '../guardado';
import type { MyTeam, ParishStored, TeamMemberStored, TeamStored } from '../types';
import { photosById } from './media';

interface TeamInput { personas: TeamMemberStored[] }
interface ParishInput { texto: string; fotos: { idMedio: number; alt: string }[] }

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
    equipo: team.map(({ idMedio, ...p }) => ({ ...p, foto: idMedio ? media.get(idMedio) ?? null : null })),
    parroquias: parishes.map(p => ({
      slug: p.slug, texto: p.texto,
      fotos: p.fotos.flatMap(({ idMedio, alt }) => { const foto = media.get(idMedio); return foto ? [{ foto, alt }] : []; }),
    })),
  };
}

export function createMyTeam(sql: SQL, authorization: Authorization) {
  async function save(actor: { id_usuario: number }, key: string, content: TeamStored | ParishStored, ids: number[], version: string | null) {
    await existingPhotos(sql, ids);
    return saved(await callPg<SaveRow>(sql, 'myTeamSave', [actor.id_usuario, key, content, version]));
  }

  return {
    async saveTeam(access: string | undefined, input: TeamInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (new Set(input.personas.map(p => p.puesto)).size < input.personas.length) throw new ApiError(422, 'Cada puesto puede tener una sola persona');
      // Mismo orden y mismas claves siempre: la versión es el md5 del contenido guardado.
      const personas = [...input.personas].sort((a, b) => ordenPuesto(a.puesto) - ordenPuesto(b.puesto)).map((p): TeamMemberStored => {
        const campo = PUESTOS[ordenPuesto(p.puesto)].texto;
        const prefecto = p.puesto === 'prefecto';
        return {
          idMedio: p.idMedio,
          puesto: p.puesto,
          nombre: plainText(p.nombre, `${campo} · nombre`, LARGOS.equipo.nombre),
          presentacion: prefecto && p.presentacion.trim() ? plainText(p.presentacion, `${campo} · presentación`, MAX_PRESENTACION) : '',
          trayectoria: prefecto ? p.trayectoria.filter(x => x.trim()).map((x, i) => plainText(x, `${campo} · trayectoria ${i + 1}`, MAX_PUNTO_TRAYECTORIA)) : [],
        };
      });
      return save(actor, 'equipo', { personas }, personas.flatMap(p => (p.idMedio ? [p.idMedio] : [])), version);
    },

    async saveParish(access: string | undefined, slug: string, input: ParishInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      if (!isParish(slug)) throw new ApiError(404, 'No encontrado');
      const content: ParishStored = {
        texto: input.texto.trim() ? plainText(input.texto, 'Texto', LARGOS.equipo.textoParroquia, { multiline: true }) : '',
        fotos: input.fotos.map((f, i) => ({ idMedio: f.idMedio, alt: plainText(f.alt, `Foto ${i + 1} · descripción`, LARGOS.descripcionFoto) })),
      };
      return save(actor, slug, content, content.fotos.map(f => f.idMedio), version);
    },
  };
}

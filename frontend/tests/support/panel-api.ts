import type { Page } from '@playwright/test';
import initial from '../../../backend/database/contenido-inicial.json' with { type:'json' };

// API simulada del panel: guarda el borrador en memoria para que los tests vean el efecto de cada acción.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const photo = (id: number) => ({ idMedio: id, nombre: `foto-${id}`, ancho: 1600, alto: 1200, anchos: [480, 960, 1600] });

export function panelData(rol: 'admin' | 'coadmin') {
  const permisos = ['contenido.editar', 'contenido.publicar', 'medios.subir', 'participacion.ver', 'participacion.gestionar',
    ...(rol === 'admin' ? ['usuarios.ver', 'usuarios.rol.cambiar', 'usuarios.estado.cambiar'] : [])];
  return {
    profile: { id: 1, correo: 'ana@example.com', nombresCompletos: 'Ana Torres', direccion: null, rol,
      tieneContrasenia: true, tieneGoogle: false, permisos },
    draft: {
      textos: { ...initial.textos, 'pie.lema': 'Por ti, San Lorenzo.' } as Record<string, string>,
      originales: initial.textos,
      propuestas: [
        { slug: 'agua-potable', nombre: 'Agua potable', categoria: 'Servicios básicos', introduccion: 'Agua segura para cada hogar.',
          kpis: [{ etiqueta: 'Cobertura meta', valor: '98%' }, { etiqueta: 'Comunidades', valor: '32' }, { etiqueta: 'Plazo', valor: '36 meses' }] },
        { slug: 'educacion', nombre: 'Educación', categoria: 'Desarrollo social', introduccion: 'Escuelas dignas.',
          kpis: [{ etiqueta: 'Estudiantes', valor: '14,500' }] },
      ],
      biografia: [
        { anios: '1985', titulo: 'Infancia en San Lorenzo', texto: 'Creció junto al mar.', foto: photo(1), alt: 'Carlos de niño' },
        { anios: '2003', titulo: 'Estudios', texto: 'Se graduó.', foto: null, alt: null },
      ],
      obras: [{
        slug: 'agua-potable', nota: 'Avance de la red principal.', actualizadoEn: '2026-09-01T00:00:00Z',
        hitos: [{ nombre: 'Estudios', completado: true }, { nombre: 'Diseño', completado: false }],
        fotos: [{ ...photo(2), pie: 'Tubería instalada' }],
      }],
      chat: [
        { pregunta: 'Ver propuestas', palabrasClave: 'propuesta, plan', respuesta: 'Revisa las siete propuestas.',
          enlaceTexto: 'Ver propuestas', enlaceRuta: '/#propuestas', destacada: true },
      ],
      // Como la API real: un texto sin cambiar no tiene versión. Los valores son md5 de ejemplo.
      versiones: {
        textos: { 'pie.lema': 'a'.repeat(32) } as Record<string, string>,
        propuestas: { 'agua-potable': 'b'.repeat(32), educacion: 'c'.repeat(32) } as Record<string, string>,
        biografia: 'd'.repeat(32),
        obras: { 'agua-potable': 'e'.repeat(32) } as Record<string, string>,
        chat: 'f'.repeat(32),
      },
    },
    alertas: [
      { id: 7, tipo: 'agua', sector: 'Barrio Central', referencia: null, descripcion: 'Fuga de agua en la tubería principal.',
        estado: 'recibida', creadoEn: '2026-09-30T15:00:00Z', foto: null, autor: 'María', correo: 'maria@example.com' },
    ],
    sinRespuesta: [{ clave: 'cuando hay caravana', ejemplo: '¿Cuándo hay caravana?', veces: 3, ultimaVez: '2026-09-30T15:00:00Z' }],
    pending: [] as { tipo: string; descripcion: string }[],
    users: Array.from({ length: 23 }, (_, i) => ({
      id: i + 2, correo: `persona${i + 2}@example.com`, nombresCompletos: `Persona ${i + 2}`,
      rol: i === 0 ? 'admin' : i < 3 ? 'coadmin' : 'votante', estado: i === 5 ? 'bloqueado' : 'activo',
    })),
    publications: [] as { id: number; estado: string; creadoEn: string; iniciadoEn: null; terminadoEn: null; autor: string; detalle: null }[],
  };
}

export async function mockPanelApi(page: Page, data: ReturnType<typeof panelData>) {
  await page.route('**/medios/**', route => route.fulfill({ contentType: 'image/png', body: PIXEL }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = () => route.request().postDataJSON();
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const conflict = () => json({ error: 'Otra persona guardó cambios en este contenido mientras editabas. Recarga para ver su versión; lo tuyo no se guardó.' }, 409);
    const nextVersion = () => crypto.randomUUID().replaceAll('-', '');
    const path = url.pathname;
    if (path === '/api/me') return json(data.profile);
    if (path === '/api/admin/contenido') return json(data.draft);
    if (path === '/api/admin/publicaciones/pendientes') return json({ cambios: data.pending });
    if (path === '/api/admin/publicaciones' && method === 'GET')
      return json({ total: data.publications.length, pagina: 1, porPagina: 10, publicaciones: data.publications });
    if (path === '/api/admin/publicaciones') {
      data.publications.unshift({ id: data.publications.length + 1, estado: 'publicada', creadoEn: new Date().toISOString(),
        iniciadoEn: null, terminadoEn: null, autor: 'Ana Torres', detalle: null });
      data.pending = [];
      return json({ id: data.publications.length });
    }
    const text = path.match(/^\/api\/admin\/contenido\/textos\/(.+)$/);
    if (text) {
      const key = decodeURIComponent(text[1]);
      if (body().version !== (data.draft.versiones.textos[key] ?? null)) return conflict();
      data.draft.textos[key] = body().valor ?? data.draft.originales[key as keyof typeof initial.textos];
      if (body().valor === null) delete data.draft.versiones.textos[key];
      else data.draft.versiones.textos[key] = nextVersion();
      data.pending.push({ tipo: 'Texto', descripcion: key });
      return json({ version: data.draft.versiones.textos[key] });
    }
    const work = path.match(/^\/api\/admin\/contenido\/obras\/(.+)$/);
    if (work) {
      const { version, ...fields } = body();
      if (version !== data.draft.versiones.obras[work[1]]) return conflict();
      Object.assign(data.draft.obras.find(o => o.slug === work[1])!, {
        ...fields, fotos: fields.fotos.map((f: { idMedio: number; pie: string }) => ({ ...photo(f.idMedio), pie: f.pie })),
      });
      data.draft.versiones.obras[work[1]] = nextVersion();
      data.pending.push({ tipo: 'Obra', descripcion: 'Agua potable' });
      return json({ version: data.draft.versiones.obras[work[1]] });
    }
    if (path === '/api/admin/medios') return json(photo(90));
    const proposal = path.match(/^\/api\/admin\/contenido\/propuestas\/(.+)$/);
    if (proposal) {
      const { version, ...fields } = body();
      if (version !== data.draft.versiones.propuestas[proposal[1]]) return conflict();
      Object.assign(data.draft.propuestas.find(p => p.slug === proposal[1])!, fields);
      data.draft.versiones.propuestas[proposal[1]] = nextVersion();
      data.pending.push({ tipo: 'Propuesta', descripcion: fields.nombre });
      return json({ version: data.draft.versiones.propuestas[proposal[1]] });
    }
    if (path === '/api/admin/contenido/chat') {
      if (body().version !== data.draft.versiones.chat) return conflict();
      data.draft.chat = body().respuestas;
      data.draft.versiones.chat = nextVersion();
      data.pending.push({ tipo: 'Chat', descripcion: 'Preguntas frecuentes' });
      return json({ version: data.draft.versiones.chat });
    }
    if (path === '/api/admin/chat/sin-respuesta') return json({ preguntas: data.sinRespuesta });
    if (path.startsWith('/api/admin/chat/sin-respuesta/')) {
      data.sinRespuesta = data.sinRespuesta.filter(p => p.clave !== decodeURIComponent(path.split('/').pop()!));
      return json({ ok: true });
    }
    if (path === '/api/admin/participacion/alertas' || path === '/api/admin/participacion/sugerencias') {
      const estado = url.searchParams.get('estado');
      const conteo = (list: { estado: string }[]) => Object.fromEntries(['recibida', 'en_revision', 'atendida']
        .map(s => [s, list.filter(i => i.estado === s).length]));
      const items = path.endsWith('alertas') ? data.alertas : [];
      return json({ items: items.filter(i => !estado || i.estado === estado), pagina: 1, porPagina: 20,
        conteo: { alertas: conteo(data.alertas), sugerencias: conteo([]) } });
    }
    const review = path.match(/^\/api\/admin\/participacion\/alertas\/(\d+)\/estado$/);
    if (review) {
      const alerta = data.alertas.find(a => a.id === Number(review[1]))!;
      if (alerta.estado !== body().estado && alerta.estado !== body().estadoAnterior)
        return json({ error: 'Otra persona cambió el estado mientras tanto; recarga la lista.' }, 409);
      alerta.estado = body().estado;
      return json({ estado: alerta.estado });
    }
    if (path === '/api/admin/usuarios') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const rol = url.searchParams.get('rol');
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const rows = data.users.filter(u => (!q || `${u.nombresCompletos} ${u.correo}`.toLowerCase().includes(q)) && (!rol || u.rol === rol));
      return json({ total: rows.length, pagina, porPagina: 20, usuarios: rows.slice((pagina - 1) * 20, pagina * 20).map(u => {
        const allowed = u.rol !== 'admin';
        return { ...u, rolesAsignables: allowed ? ['votante', 'coadmin', 'admin'] : [], puedeCambiarEstado: allowed,
          motivoBloqueo: allowed ? null : 'No tienes permiso para modificar esta cuenta' };
      }) });
    }
    const state = path.match(/^\/api\/admin\/usuarios\/(\d+)\/estado$/);
    if (state) {
      const user = data.users.find(u => u.id === Number(state[1]))!;
      if (user.estado !== body().estado && user.estado !== body().estadoAnterior)
        return json({ error: 'La cuenta cambió mientras tanto; recarga la lista' }, 409);
      user.estado = body().estado;
      return json({});
    }
    return json({ error: 'No encontrado' }, 404);
  });
}

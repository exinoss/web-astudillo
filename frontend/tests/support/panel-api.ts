import type { Page } from '@playwright/test';

// API simulada del panel: guarda el borrador en memoria para que los tests vean el efecto de cada acción.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const photo = (id: number) => ({ idMedio: id, nombre: `foto-${id}`, ancho: 1600, alto: 1200, anchos: [480, 960, 1600] });

export function panelData(rol: 'admin' | 'coadmin') {
  const permisos = ['contenido.editar', 'contenido.publicar', 'medios.subir',
    ...(rol === 'admin' ? ['usuarios.ver', 'usuarios.rol.cambiar', 'usuarios.estado.cambiar'] : [])];
  return {
    profile: { id: 1, correo: 'ana@example.com', nombresCompletos: 'Ana Torres', direccion: null, rol,
      tieneContrasenia: true, tieneGoogle: false, permisos },
    draft: {
      textos: { 'pie.lema': 'Por ti, San Lorenzo.' } as Record<string, string>,
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
    },
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
      data.draft.textos[key] = body().valor;
      data.pending.push({ tipo: 'Texto', descripcion: key });
      return json({ clave: key });
    }
    const work = path.match(/^\/api\/admin\/contenido\/obras\/(.+)$/);
    if (work) {
      Object.assign(data.draft.obras.find(o => o.slug === work[1])!, { ...body(), fotos: data.draft.obras[0].fotos });
      data.pending.push({ tipo: 'Obra', descripcion: 'Agua potable' });
      return json({ slug: work[1] });
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
      data.users.find(u => u.id === Number(state[1]))!.estado = body().estado;
      return json({});
    }
    return json({ error: 'No encontrado' }, 404);
  });
}

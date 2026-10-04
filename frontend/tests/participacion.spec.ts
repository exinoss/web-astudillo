import { expect, test, type Page } from '@playwright/test';
import { VERSION_LEGAL } from '../src/lib/legal';

// API simulada de participación: sesión, alertas, sugerencias y chat en memoria.
function mockApi(page: Page, opciones: { loggedIn?: boolean; accepted?: boolean } = {}) {
  const data = {
    loggedIn: opciones.loggedIn ?? false,
    accepted: opciones.accepted ?? true,
    aceptaciones: [] as object[],
    fallarAceptacion: false,
    rechazarSiguienteEnvio: false,
    alertas: [] as Record<string, unknown>[],
    envios: [] as { path: string; campos: Record<string, string>; foto?: string }[],
    preguntas: [] as string[],
    clavesChat: [] as string[],
  };
  void page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/refresh') return json(401, { error: 'Sin sesión' });
    if (path === '/api/auth/login') { data.loggedIn = true; return json(200, { user: {} }); }
    if (path === '/api/me') return data.loggedIn
      ? json(200, { id: 1, correo: 'maria@example.com', rol: 'votante', terminosAceptados: data.accepted, nombresCompletos: 'María', direccion: '', tieneContrasenia: true, tieneGoogle: false, permisos: ['participacion.enviar'] })
      : json(401, { error: 'Inicia sesión' });
    if (!data.loggedIn) return json(401, { error: 'Inicia sesión' });
    if (path === '/api/auth/accept-terms') {
      data.aceptaciones.push(request.postDataJSON());
      if (data.fallarAceptacion) return json(503, { error: 'Inténtalo de nuevo.' });
      data.accepted = true;
      return json(200, { terminosAceptados: true });
    }
    if (path.startsWith('/api/participacion/') && request.method() === 'POST' && (!data.accepted || data.rechazarSiguienteEnvio)) {
      data.accepted = false;
      data.rechazarSiguienteEnvio = false;
      return json(428, { error: 'Confirma tu aceptación para continuar', requiereAceptacion: true });
    }
    if (path === '/api/participacion/alertas/mias') return json(200, { alertas: data.alertas });
    if (path === '/api/participacion/alertas') {
      // El multipart se lee a mano: basta con los nombres de los campos y del archivo.
      const body = request.postDataBuffer()!.toString('latin1');
      const campos = Object.fromEntries([...body.matchAll(/name="(\w+)"\r\n\r\n([^\r]*)/g)].map((m) => [m[1], Buffer.from(m[2], 'latin1').toString('utf8')]));
      const foto = /name="foto"; filename="([^"]+)"/.exec(body)?.[1];
      data.envios.push({ path, campos, foto });
      const alerta = { id: data.alertas.length + 1, tipo: campos.tipo, sector: campos.sector, referencia: campos.referencia ?? null,
        descripcion: campos.descripcion, estado: 'recibida', creadoEn: '2026-10-01T15:00:00Z', foto: null };
      data.alertas.unshift(alerta);
      return json(200, alerta);
    }
    if (path === '/api/participacion/sugerencias') {
      data.envios.push({ path, campos: request.postDataJSON() });
      return json(200, { id: 1, ...request.postDataJSON(), estado: 'recibida', creadoEn: '2026-10-01T15:00:00Z' });
    }
    if (path === '/api/participacion/chat') {
      const { mensaje, idempotencia } = request.postDataJSON();
      expect(idempotencia).toMatch(/^[0-9a-f-]{36}$/);
      data.preguntas.push(mensaje);
      data.clavesChat.push(idempotencia);
      return json(200, /propuesta/i.test(mensaje)
        ? { texto: 'Puedes revisar las siete propuestas.', enlaceTexto: 'Ver propuestas', enlaceRuta: '/#propuestas' }
        : { texto: 'Todavía no tengo una respuesta para eso.', enlaceTexto: 'Ir a contacto', enlaceRuta: '/#contacto' });
    }
    return json(404, { error: 'Ruta inesperada' });
  });
  return data;
}

test('la aceptación pendiente conserva la alerta y la foto, y se guarda para los demás formularios', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true, accepted: false });
  await page.goto('/ciudadania/alerta-ciudadana/');
  await expect(page.locator('#alerta-aceptacion-block')).toBeVisible();
  await page.getByRole('radio', { name: 'Baches' }).check();
  await page.locator('#alerta-sector').fill('Barrio Central');
  await page.locator('#alerta-descripcion').fill('Hay un bache grande en la esquina');
  await page.locator('#alerta-foto').setInputFiles('src/assets/carlos.jpg');
  await page.getByRole('button', { name: 'Aceptar y enviar alerta' }).click();
  await expect(page.locator('#alerta-aceptacion-error')).toHaveText('Marca la casilla para continuar.');
  await expect(page.locator('#alerta-aceptacion')).toBeFocused();
  await expect(page.locator('#alerta-sector')).toHaveValue('Barrio Central');
  await expect(page.locator('#alerta-foto-nombre')).toContainText('carlos.jpg');
  expect(api.envios).toHaveLength(0);
  expect(api.aceptaciones).toHaveLength(0);
  await page.locator('#alerta-aceptacion').press('Space');
  await page.getByRole('button', { name: 'Aceptar y enviar alerta' }).click();
  await expect(page.locator('#alerta-estado')).toContainText('Recibimos tu alerta');
  await expect(page.locator('#alerta-aceptacion-block')).toBeHidden();
  expect(api.envios).toHaveLength(1);
  expect(api.envios[0].foto).toBe('carlos.jpg');
  expect(api.aceptaciones).toEqual([{ aceptacion: { version: VERSION_LEGAL, aceptada: true } }]);
  for (const [path, id] of [['/ciudadania/sugerencias/', 'sugerencia'], ['/ciudadania/chat/', 'chat'], ['/ciudadania/alerta-ciudadana/', 'alerta']]) {
    await page.goto(path);
    await expect(page.locator(`#${id}-aceptacion-block`)).toBeHidden();
  }
});

test('un fallo al guardar la aceptación conserva la sugerencia y permite reintentar', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true, accepted: false });
  api.fallarAceptacion = true;
  await page.goto('/ciudadania/sugerencias/');
  await expect(page.locator('#sugerencia-aceptacion-block')).toBeVisible();
  await page.getByRole('radio', { name: 'Otra idea' }).check();
  await page.locator('#sugerencia-mensaje').fill('Más iluminación alrededor del parque.');
  await page.locator('#sugerencia-aceptacion').check();
  await page.getByRole('button', { name: 'Aceptar y enviar sugerencia' }).click();
  await expect(page.locator('#sugerencia-estado')).toContainText('Inténtalo de nuevo');
  await expect(page.locator('#sugerencia-mensaje')).toHaveValue('Más iluminación alrededor del parque.');
  await expect(page.locator('#sugerencia-aceptacion')).toBeChecked();
  expect(api.envios).toHaveLength(0);
  api.fallarAceptacion = false;
  await page.getByRole('button', { name: 'Aceptar y enviar sugerencia' }).click();
  await expect(page.locator('#sugerencia-estado')).toContainText('Gracias');
  expect(api.envios).toHaveLength(1);
  await expect(page.locator('#sugerencia-aceptacion-block')).toBeHidden();
});

test('un cambio de versión conserva la alerta y la foto al recargar para revisar las condiciones', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true, accepted: false });
  await page.route('**/api/auth/accept-terms', route => route.fulfill({ status: 409,
    contentType: 'application/json', body: '{"error":"Las condiciones cambiaron. Recarga la página para revisarlas"}' }));
  await page.goto('/ciudadania/alerta-ciudadana/');
  await expect(page.locator('#alerta-aceptacion-block')).toBeVisible();
  await page.getByRole('radio', { name: 'Baches' }).check();
  await page.locator('#alerta-sector').fill('Barrio Central');
  await page.locator('#alerta-descripcion').fill('Hay un bache grande en la esquina');
  await page.locator('#alerta-foto').setInputFiles('src/assets/carlos.jpg');
  await page.locator('#alerta-aceptacion').check();
  await page.getByRole('button', { name: 'Aceptar y enviar alerta' }).click();
  await expect(page.locator('#alerta-estado')).toContainText('Recarga la página');
  await page.reload();
  await expect(page.locator('#alerta-recuperada')).toBeVisible();
  await expect(page.locator('#alerta-sector')).toHaveValue('Barrio Central');
  await expect(page.locator('#alerta-descripcion')).toHaveValue('Hay un bache grande en la esquina');
  await expect(page.locator('#alerta-foto-nombre')).toContainText('carlos.jpg');
  await expect(page.locator('#alerta-aceptacion')).not.toBeChecked();
  expect(api.envios).toHaveLength(0);
});

test('la consulta rápida espera la aceptación sin vaciar el texto ni añadir mensajes', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true, accepted: false });
  await page.goto('/ciudadania/chat/');
  await expect(page.locator('#chat-aceptacion-block')).toBeVisible();
  await page.getByRole('button', { name: 'Ver propuestas', exact: true }).click();
  await expect(page.locator('#chat-input')).toHaveValue('Ver propuestas');
  await expect(page.locator('#chat-aceptacion-error')).toBeVisible();
  await expect(page.locator('.from-user')).toHaveCount(0);
  expect(api.preguntas).toHaveLength(0);
  await page.locator('#chat-aceptacion').check();
  await page.getByRole('button', { name: 'Aceptar y enviar consulta' }).click();
  await expect(page.locator('.from-user')).toHaveCount(1);
  await expect(page.getByRole('log').getByRole('link', { name: 'Ver propuestas' })).toBeVisible();
  await expect(page.locator('#chat-aceptacion-block')).toBeHidden();
  await expect(page.locator('#chat-input')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Enviar consulta', exact: true })).toBeVisible();
  expect(api.preguntas).toEqual(['Ver propuestas']);
  expect(api.aceptaciones).toHaveLength(1);
});

test('si la aceptación falta entre comprobar y enviar, el chat vuelve a pedirla conservando la consulta', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true });
  api.rechazarSiguienteEnvio = true;
  await page.goto('/ciudadania/chat/');
  await expect(page.locator('#chat-aceptacion-block')).toBeHidden();
  await page.locator('#chat-input').fill('¿Qué propuestas hay para el barrio?');
  await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click();
  await expect(page.locator('#chat-aceptacion-block')).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveValue('¿Qué propuestas hay para el barrio?');
  await expect(page.locator('.from-user')).toHaveCount(0);
  await page.locator('#chat-aceptacion').check();
  await page.getByRole('button', { name: 'Aceptar y enviar consulta' }).click();
  await expect(page.locator('#chat-aceptacion-block')).toBeHidden();
  expect(api.preguntas).toEqual(['¿Qué propuestas hay para el barrio?']);
});

test('el doble envío durante la aceptación no duplica confirmación ni participación', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true, accepted: false });
  let confirmations = 0;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/accept-terms', async route => {
    confirmations++;
    await waiting;
    api.accepted = true;
    return route.fulfill({ contentType: 'application/json', body: '{"terminosAceptados":true}' });
  });
  await page.goto('/ciudadania/sugerencias/');
  await expect(page.locator('#sugerencia-aceptacion-block')).toBeVisible();
  await page.getByRole('radio', { name: 'Otra idea' }).check();
  await page.locator('#sugerencia-mensaje').fill('Más iluminación alrededor del parque.');
  await page.locator('#sugerencia-aceptacion').check();
  const button = page.getByRole('button', { name: 'Aceptar y enviar sugerencia' });
  await button.click();
  await expect.poll(() => confirmations).toBe(1);
  await expect(button).toBeDisabled();
  await page.locator('#sugerencia-form').dispatchEvent('submit');
  expect(confirmations).toBe(1);
  release();
  await expect(page.locator('#sugerencia-estado')).toContainText('Gracias');
  expect(api.envios).toHaveLength(1);
});

test('una alerta sin sesión se guarda, pide entrar y vuelve rellena con su foto', async ({ page }) => {
  const api = mockApi(page);
  await page.goto('/ciudadania/alerta-ciudadana/');
  await page.waitForLoadState('load');
  await expect(page.locator('#historial')).toContainText('Inicia sesión para ver tus alertas');
  // El botón siempre está activo: al tocarlo se marcan los campos que faltan.
  await page.getByRole('button', { name: 'Enviar alerta' }).click();
  await expect(page.locator('#alerta-tipo-error')).toHaveText('Elige el tipo de problema.');
  await expect(page.locator('#alerta-sector-error')).toBeVisible();
  await expect(page.locator('#alerta-descripcion-error')).toContainText('al menos 10 caracteres');
  await page.getByRole('radio', { name: 'Baches' }).check();
  await page.locator('#alerta-sector').fill('Barrio Central');
  await page.locator('#alerta-descripcion').fill('Hay un bache grande en la esquina');
  await page.locator('#alerta-foto').setInputFiles('src/assets/carlos.jpg');
  await expect(page.locator('#alerta-foto-vista')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar alerta' }).click();

  await expect(page).toHaveURL(/\/cuenta\/$/);
  await expect(page.locator('#account-status')).toHaveText('Inicia sesión para enviar tu alerta. Guardamos lo que escribiste.');
  await page.locator('#login-correo').fill('maria@example.com');
  await page.locator('#login-contrasenia').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  // Vuelve al formulario, no a la portada, con todo lo escrito y la foto.
  await expect(page).toHaveURL(/alerta-ciudadana\/$/);
  await expect(page.locator('#alerta-recuperada')).toBeVisible();
  await expect(page.locator('input[name="tipo"][value="baches"]')).toBeChecked();
  await expect(page.locator('#alerta-sector')).toHaveValue('Barrio Central');
  await expect(page.locator('#alerta-descripcion')).toHaveValue('Hay un bache grande en la esquina');
  await expect(page.locator('#alerta-foto-nombre')).toContainText('carlos.jpg');
  expect(api.envios).toHaveLength(0);
  await page.getByRole('button', { name: 'Enviar alerta' }).click();
  await expect(page.locator('#alerta-estado')).toContainText('Recibimos tu alerta');
  expect(api.envios).toHaveLength(1);
  expect(api.envios[0].campos).toMatchObject({ tipo: 'baches', sector: 'Barrio Central', descripcion: 'Hay un bache grande en la esquina' });
  expect(api.envios[0].campos.idempotencia).toMatch(/^[0-9a-f-]{36}$/);
  expect(api.envios[0].campos.nombre).toBeUndefined();
  expect(api.envios[0].foto).toBe('carlos.jpg');
  await expect(page.locator('#historial')).toContainText('Barrio Central');
  // El borrador se borra al enviarse: entrar otra vez lleva a la portada.
  expect(await page.evaluate(() => localStorage.getItem('astudillo:borrador'))).toBeNull();
});

test('la foto de la alerta: zona grande, formatos válidos y hasta 5 MB', async ({ page }) => {
  mockApi(page, { loggedIn: true });
  await page.goto('/ciudadania/alerta-ciudadana/');
  await page.waitForLoadState('load');
  const zona = page.locator('#alerta-foto-zona');
  expect((await zona.boundingBox())!.height).toBeGreaterThanOrEqual(180);
  // Sin «capture»: el celular ofrece cámara o galería.
  await expect(page.locator('#alerta-foto')).not.toHaveAttribute('capture');
  await page.locator('#alerta-foto').setInputFiles({ name: 'archivo.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.locator('#alerta-foto-error')).toContainText('JPG, PNG o WebP');
  await page.locator('#alerta-foto').setInputFiles({ name: 'grande.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.locator('#alerta-foto-error')).toContainText('5 MB');
  await page.locator('#alerta-foto').setInputFiles('src/assets/carlos.jpg');
  await expect(page.locator('#alerta-foto-error')).toBeHidden();
  await page.getByRole('button', { name: 'Quitar foto' }).click();
  await expect(zona).toBeVisible();
  await expect(page.locator('#historial')).toContainText('Aún no has enviado alertas');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(1);
    for (const opcion of await page.locator('#alerta-tipo .opcion').all())
      expect((await opcion.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test('las sugerencias eligen el tema con fichas y llegan sin nombre', async ({ page }) => {
  const api = mockApi(page, { loggedIn: true });
  await page.goto('/ciudadania/sugerencias/?tema=agua-potable');
  await page.waitForLoadState('load');
  await expect(page.locator('#topic, #name')).toHaveCount(0);
  await expect(page.locator('input[name="tema"][value="agua-potable"]')).toBeChecked();
  await page.locator('#sugerencia-mensaje').fill('corta');
  await page.getByRole('button', { name: 'Enviar sugerencia' }).click();
  await expect(page.locator('#sugerencia-mensaje-error')).toContainText('al menos 15 caracteres');
  await page.getByRole('radio', { name: 'Otra idea' }).check();
  await page.locator('#sugerencia-mensaje').fill('Más pozos de agua en las comunidades rurales.');
  await page.getByRole('button', { name: 'Enviar sugerencia' }).click();
  await expect(page.locator('#sugerencia-estado')).toContainText('Gracias por compartir tu idea');
  expect(api.envios[0].campos).toMatchObject({ tema: 'otro', mensaje: 'Más pozos de agua en las comunidades rurales.' });
  expect(Object.keys(api.envios[0].campos).sort()).toEqual(['idempotencia', 'mensaje', 'tema']);
});

test('el chat responde con enlaces, pinta todo como texto y pide sesión', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).SpeechRecognition; delete (window as any).webkitSpeechRecognition; });
  const api = mockApi(page, { loggedIn: true });
  await page.goto('/ciudadania/chat/');
  await page.waitForLoadState('load');
  // Sin reconocimiento de voz en el navegador no aparece el micrófono.
  await expect(page.locator('#chat-mic')).toBeHidden();
  await page.getByRole('button', { name: 'Ver propuestas' }).click();
  await expect(page.getByRole('log').getByRole('link', { name: 'Ver propuestas' })).toHaveAttribute('href', '/#propuestas');
  await page.locator('#chat-input').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect(page.locator('.from-user').last()).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.getByRole('log').getByRole('link', { name: 'Ir a contacto' })).toBeVisible();
  await expect(page.locator('.chat-messages img')).toHaveCount(0);
  expect(api.preguntas).toEqual(['Ver propuestas', '<img src=x onerror=alert(1)>']);
  api.loggedIn = false;
  await page.locator('#chat-input').fill('¿Cuándo es la caravana?');
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect(page).toHaveURL(/\/cuenta\/$/);
  await expect(page.locator('#account-status')).toContainText('Inicia sesión para enviar tu consulta');
  const key = await page.evaluate(() => JSON.parse(localStorage.getItem('astudillo:borrador')!).idempotencia);
  api.loggedIn = true;
  await page.goto('/ciudadania/chat/');
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect.poll(() => api.clavesChat.at(-1)).toBe(key);
});

test('el chat conserva la clave tras perder la respuesta y bloquea envíos simultáneos', async ({ page }) => {
  mockApi(page, { loggedIn: true });
  const sent: { mensaje: string; idempotencia: string }[] = [];
  const saved = new Map<string, object>();
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/participacion/chat', async route => {
    const body = route.request().postDataJSON();
    sent.push(body);
    saved.set(body.idempotencia, { texto: 'Respuesta guardada', enlaceTexto: null, enlaceRuta: null });
    if (sent.length === 1) {
      await waiting;
      return route.abort('failed');
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(saved.get(body.idempotencia)) });
  });
  await page.goto('/ciudadania/chat/');
  await page.locator('#chat-input').fill('Una pregunta');
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
  for (const button of await page.locator('[data-chat]').all()) await expect(button).toBeDisabled();
  await page.locator('#chat-input').fill('Una pregunta');
  await page.locator('#chat-form').dispatchEvent('submit');
  expect(sent).toHaveLength(1);
  await page.locator('#chat-input').fill('');
  release();
  await expect(page.getByRole('log')).toContainText('No se pudo conectar');
  await expect(page.locator('#chat-input')).toHaveValue('Una pregunta');
  await page.locator('#chat-input').press('Enter');
  await expect(page.getByRole('log')).toContainText('Respuesta guardada');
  expect(sent[1]).toEqual(sent[0]);
  expect(saved.size).toBe(1);
  await page.locator('#chat-input').fill('Una pregunta');
  await page.locator('#chat-input').press('Enter');
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[2].idempotencia).not.toBe(sent[0].idempotencia);
  expect(saved.size).toBe(2);
});

test('el micrófono escribe la pregunta y la envía al terminar de hablar', async ({ page }) => {
  // Reconocimiento de voz simulado: «escucha» una frase y termina.
  await page.addInitScript(() => {
    const Falso = class {
      onresult: any; onend: any; onerror: any;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: 'quiero ver las propuestas' }], { isFinal: true })] });
          this.onend?.();
        }, 50);
      }
      stop() { this.onend?.(); }
    };
    (window as any).SpeechRecognition = Falso;
    (window as any).webkitSpeechRecognition = Falso;
  });
  const api = mockApi(page, { loggedIn: true });
  await page.goto('/ciudadania/chat/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: 'Preguntar con tu voz' }).click();
  await expect(page.getByRole('log').getByRole('link', { name: 'Ver propuestas' })).toBeVisible();
  expect(api.preguntas).toEqual(['quiero ver las propuestas']);
});

test('portada: alertas en rojo, sugerencias en amarillo y el chat igual', async ({ page }) => {
  await page.goto('/');
  const strip = page.getByRole('region', { name: 'Participación ciudadana' });
  await expect(strip.getByRole('link', { name: /Alerta ciudadana/ })).toHaveCSS('background-color', 'rgb(224, 18, 31)');
  await expect(strip.getByRole('link', { name: /Alerta ciudadana/ })).toHaveCSS('color', 'rgb(254, 255, 255)');
  await expect(strip.getByRole('link', { name: /Sugerencias/ })).toHaveCSS('background-color', 'rgb(249, 195, 27)');
  await expect(strip.getByRole('link', { name: /Chat/ })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('la propuesta muestra el avance de su obra, cifras centradas y sin lista lateral', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/propuestas/agua-potable/');
  // Primero el texto de la propuesta, después el avance.
  const intro = await page.getByRole('heading', { name: 'Conoce este eje.' }).boundingBox();
  const obra = await page.getByRole('heading', { name: 'AVANCE DE LA OBRA' }).boundingBox();
  expect(intro!.y).toBeLessThan(obra!.y);
  await expect(page.getByRole('progressbar', { name: 'Avance de Agua potable' })).toBeVisible();
  await expect(page.getByText('Contenido en preparación')).toHaveCount(0);
  await expect(page.getByText('Así avanza la obra.')).toHaveCount(0);
  await expect(page.getByText('Explora las propuestas')).toHaveCount(0);
  // La franja de cifras queda centrada (antes quedaba pegada a la izquierda).
  const dl = (await page.locator('[aria-label^="Cifras de la propuesta"] dl').boundingBox())!;
  expect(Math.abs(dl.x - (1440 - dl.x - dl.width))).toBeLessThanOrEqual(2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(1);
  }
});

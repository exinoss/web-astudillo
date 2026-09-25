import { expect, test, type Page } from '@playwright/test';

const token = 'A'.repeat(43);

async function mockGoogleButton(page: Page, credential: string) {
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    contentType: 'text/javascript', body: `window.google={accounts:{id:{
      initialize({callback}){window.googleCallback=callback},
      renderButton(element,{width}){const button=document.createElement('button');button.type='button';
        button.style.width=width+'px';button.style.height='48px';
        button.textContent='Acceder con Google';
        button.onclick=()=>window.googleCallback({credential:'${credential}'});
        element.append(button)},disableAutoSelect(){}
    }}};`,
  }));
}

test('el botón oficial de Google acompaña el ancho del formulario al redimensionar', async ({ page }) => {
  await mockGoogleButton(page, 'credencial-prueba');
  await page.route('**/api/**', route => route.fulfill({ status: 401,
    contentType: 'application/json', body: '{"error":"Sin sesión"}' }));
  await page.goto('/cuenta/');
  await expect(page.locator('#google-login-button button, #google-login-unavailable:not([hidden])')).toBeVisible();
  test.skip(await page.locator('#google-login-unavailable').isVisible(), 'Requiere PUBLIC_GOOGLE_CLIENT_ID para renderizar Google.');
  for (const width of [1440, 1200, 1199, 768, 761, 760, 474, 390, 320]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => {
        const google = document.querySelector('#google-login-button button')?.getBoundingClientRect().width;
        const enter = document.querySelector('#login-form button[type="submit"]')?.getBoundingClientRect().width;
        return google && enter ? Math.abs(google - enter) : Infinity;
      }))
        .toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});

test('el menú refleja la sesión también fuera de la página de cuenta', async ({ page }) => {
  let loggedIn = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const status = path === '/api/me' && loggedIn ? 200 : 401;
    return route.fulfill({ status, contentType: 'application/json',
      body: JSON.stringify(status === 200 ? { nombresCompletos: 'María Pérez' } : { error: 'Inicia sesión' }) });
  });
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  loggedIn = true;
  await page.reload();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
});

test('registro valida correo, política, confirmación y visibilidad antes de enviar', async ({ page }) => {
  let sent = 0;
  await page.route('**/api/auth/register', route => {
    sent++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"ok"}' });
  });
  await page.goto('/cuenta/registro/');
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#register-name-error')).toBeVisible();
  await page.locator('#register-name').fill('María Pérez');
  await page.locator('#register-email').fill('correo-invalido');
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#register-email-error')).toContainText('correo válido');
  await page.locator('#register-email').fill('maria@example.com');
  await page.locator('#register-password').fill('abcdef');
  await page.locator('#register-confirm').fill('abcdef');
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#register-password-error')).toContainText('número y un símbolo');
  await page.locator('#register-password').fill('Ab1!xy');
  await page.locator('#register-confirm').fill('Ab1!xz');
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#register-confirm-error')).toContainText('no coinciden');
  await page.locator('#register-confirm').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(page.locator('#register-password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Enviar enlace de verificación' }).click();
  await expect(page.locator('#register-form')).toBeHidden();
  await expect(page.locator('#account-status')).toContainText('recibirás un enlace');
  expect(sent).toBe(1);
});

test('acceso, perfil y cambio de contraseña muestran solo los datos aprobados', async ({ page }) => {
  let loggedIn = false;
  let changeCount = 0;
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status: number, body: object) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/refresh') return json(401, { error: 'Sesión no válida' });
    if (path === '/api/auth/login') { loggedIn = true; return json(200, { user: {} }); }
    if (path === '/api/me' && request.method() === 'GET') return json(loggedIn ? 200 : 401,
      loggedIn ? { id: 1, correo: 'maria@example.com', rol: 'votante',
        nombresCompletos: 'María Pérez', direccion: 'Barrio central',
        tieneContrasenia: true, tieneGoogle: false } : { error: 'Inicia sesión' });
    if (path === '/api/me' && request.method() === 'PATCH') return json(200, {
      id: 1, correo: 'maria@example.com', rol: 'votante',
      nombresCompletos: 'María Nueva', direccion: 'Centro',
    });
    if (path === '/api/auth/password/change') {
      changeCount++;
      if (changeCount === 1) return json(403, { error: 'La contraseña actual es incorrecta' });
      loggedIn = false;
      return json(200, { message: 'Contraseña actualizada' });
    }
    return json(404, { error: 'Ruta inesperada' });
  });
  await page.goto('/cuenta/');
  await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await page.locator('#login-correo').fill('maria@example.com');
  await page.locator('#login-contrasenia').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#profile-panel')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  const logout = page.locator('#logout-button');
  await expect(logout).toBeVisible();
  expect((await logout.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect((await logout.boundingBox())!.width).toBeGreaterThan(250);
  await expect(page.locator('#profile-panel')).not.toContainText('maria@example.com');
  await expect(page.locator('#profile-panel')).not.toContainText('votante');
  await page.locator('#profile-name').fill('María Nueva');
  await page.locator('#profile-address').fill('Centro');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#account-status')).toContainText('Datos guardados');
  await page.locator('#current-password').fill('Mal1!xy');
  await page.locator('#new-password').fill('Cd2@xy');
  await page.locator('#confirm-new-password').fill('Cd2@xy');
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.locator('#account-status')).toContainText('actual es incorrecta');
  await page.locator('#current-password').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.locator('#account-status')).toContainText('Inicia sesión de nuevo');
});

test('cuenta Google muestra el mismo cierre de sesión y actualiza el menú', async ({ page }) => {
  let loggedIn = true;
  let logouts = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = (status: number, body: object) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me') return json(loggedIn ? 200 : 401,
      loggedIn ? { id: 1, nombresCompletos: 'María Pérez', direccion: '',
        tieneContrasenia: false, tieneGoogle: true } : { error: 'Inicia sesión' });
    if (path === '/api/auth/logout') {
      loggedIn = false;
      logouts++;
      return json(200, { message: 'Sesión cerrada' });
    }
    if (path === '/api/auth/refresh') return json(401, { error: 'Sesión no válida' });
    return json(404, { error: 'Ruta inesperada' });
  });
  await page.goto('/cuenta/');
  await expect(page.locator('#add-password-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toBeVisible();
  await expect(page.locator('#google-password-step')).toBeHidden();
  await page.locator('#add-password').fill('Ab1!xy');
  await page.locator('#add-confirm').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.locator('#google-password-step')).toBeVisible();
  await expect(page.locator('#google-password-step')).toContainText('Confirma tu identidad con Google');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  const logout = page.locator('#logout-google-button');
  await expect(logout).toBeVisible();
  expect((await logout.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await logout.click();
  await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  expect(logouts).toBe(1);
});

test('al entrar con Google se puede añadir contraseña sin repetir el acceso', async ({ page }) => {
  const credential = 'credencial-google-reciente';
  let loggedIn = false;
  let hasPassword = false;
  let additions = 0;
  await mockGoogleButton(page, credential);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status: number, body: object) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/refresh') return json(401, { error: 'Sin sesión' });
    if (path === '/api/auth/google') {
      loggedIn = true;
      return json(200, { user: { id: 1 } });
    }
    if (path === '/api/me') return json(loggedIn ? 200 : 401,
      loggedIn ? { id: 1, correo: 'maria@example.com', rol: 'votante',
        nombresCompletos: 'María Pérez', direccion: '', tieneContrasenia: hasPassword,
        tieneGoogle: true } : { error: 'Sin sesión' });
    if (path === '/api/auth/password') {
      expect(request.postDataJSON().credential).toBe(credential);
      additions++;
      hasPassword = true;
      return json(200, { message: 'Contraseña agregada' });
    }
    return json(404, { error: 'Ruta inesperada' });
  });
  await page.goto('/cuenta/');
  await expect(page.locator('#google-login-button button, #google-login-unavailable:not([hidden])')).toBeVisible();
  test.skip(await page.locator('#google-login-unavailable').isVisible(), 'Requiere PUBLIC_GOOGLE_CLIENT_ID para probar el acceso Google.');
  await page.locator('#google-login-button button').click();
  await expect(page.locator('#add-password-panel')).toBeVisible();
  await expect(page.locator('#google-password-step')).toBeHidden();
  await page.locator('#add-password').fill('Ab1!xy');
  await page.locator('#add-confirm').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.locator('#change-password-panel')).toBeVisible();
  await expect(page.locator('#add-password-panel')).toBeHidden();
  expect(additions).toBe(1);
});

test('una sesión Google anterior confirma la identidad antes de añadir contraseña', async ({ page }) => {
  const credential = 'confirmacion-google';
  let hasPassword = false;
  let additions = 0;
  await mockGoogleButton(page, credential);
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status: number, body: object) => route.fulfill({ status,
      contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/me') return json(200, { id: 1, correo: 'maria@example.com', rol: 'votante',
      nombresCompletos: 'María Pérez', direccion: '', tieneContrasenia: hasPassword,
      tieneGoogle: true });
    if (path === '/api/auth/password') {
      expect(request.postDataJSON().credential).toBe(credential);
      additions++;
      hasPassword = true;
      return json(200, { message: 'Contraseña agregada' });
    }
    return json(404, { error: 'Ruta inesperada' });
  });
  await page.goto('/cuenta/');
  await expect(page.locator('#add-password-panel')).toBeVisible();
  await page.locator('#add-password').fill('Ab1!xy');
  await page.locator('#add-confirm').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.locator('#google-password-step')).toBeVisible();
  await expect(page.locator('#google-password-button button, #google-password-unavailable:not([hidden])')).toBeVisible();
  test.skip(await page.locator('#google-password-unavailable').isVisible(), 'Requiere PUBLIC_GOOGLE_CLIENT_ID para probar la confirmación Google.');
  await page.locator('#google-password-button button').click();
  await expect(page.locator('#change-password-panel')).toBeVisible();
  expect(additions).toBe(1);
});

test('recuperación, restablecimiento y verificación conservan los enlaces de un uso', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const status = path === '/api/auth/verify-email' && !route.request().postDataJSON()?.contrasenia ? 403 : 200;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(
      status === 403 ? { error: 'Confirma con contraseña' } : { message: 'ok' }) });
  });
  await page.goto('/cuenta/recuperar/');
  await page.locator('#recovery-email').fill('mal');
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
  await expect(page.locator('#recovery-email-error')).toContainText('correo válido');
  await page.locator('#recovery-email').fill('maria@example.com');
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
  await expect(page.locator('#recovery-form')).toBeHidden();
  await page.goto(`/cuenta/restablecer/?token=${token}`);
  await expect(page).not.toHaveURL(/token=/);
  await page.locator('#reset-password').fill('Ab1!xy');
  await page.locator('#reset-confirm').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.locator('#reset-done')).toBeVisible();
  await page.goto(`/cuenta/verificar/?token=${token}`);
  await expect(page.locator('#verify-form')).toBeVisible();
  await page.locator('#verify-password').fill('Ab1!xy');
  await page.getByRole('button', { name: 'Confirmar correo' }).click();
  await expect(page.locator('#verify-done')).toBeVisible();
});

test('la cuenta se usa en móvil y conserva los modos de accesibilidad', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cuenta/registro/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar menú' }).click();
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).click();
  await page.getByRole('button', { name: 'Aumentar texto' }).click();
  await expect(page.locator('html')).toHaveClass(/text-large/);
  for (const setting of ['grayscale', 'high-contrast', 'negative-contrast', 'light-bg',
    'underline-links', 'readable-font', 'reduce-motion']) {
    await page.locator(`[data-setting="${setting}"]`).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(setting));
  }
  await page.getByRole('button', { name: 'Restablecer ajustes' }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

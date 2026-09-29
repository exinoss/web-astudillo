import { expect, test } from '@playwright/test';

const paginas = [
  ['Biografía', '/acerca-de-nosotros/biografia/'],
  ['Por qué quiero ser alcalde', '/acerca-de-nosotros/por-que-quiero-ser-alcalde/'],
  ['Conoce más sobre Carlos', '/acerca-de-nosotros/conoce-mas/'],
] as const;

test('el desplegable «Acerca de nosotros» lleva a sus tres páginas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [nombre, ruta] of paginas) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Acerca de nosotros' }).hover();
    await page.locator('#about-menu').getByRole('link', { name: nombre }).click();
    await page.waitForURL(`**${ruta}`);
    await expect(page.locator('main h1')).toBeVisible();
  }
});

test('la línea de tiempo alterna seis hitos y cada punto baja al siguiente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/acerca-de-nosotros/biografia/');
  const hitos = page.locator('.hito');
  await expect(hitos).toHaveCount(6);
  const lado = (i: number) => hitos.nth(i).locator('img').evaluate(img => img.getBoundingClientRect().x);
  expect(await lado(0)).toBeLessThan(await lado(1));
  await expect(hitos.locator('button.punto')).toHaveCount(5);
  await hitos.nth(0).scrollIntoViewIfNeeded();
  await hitos.nth(0).locator('button.punto').click({ force: true });
  await expect(async () => {
    const top = await hitos.nth(1).evaluate(el => el.getBoundingClientRect().top);
    expect(Math.abs(top - 30)).toBeLessThan(140);
  }).toPass();
});

test('con reducir movimiento todos los hitos se ven sin hacer scroll', async ({ page }) => {
  await page.goto('/acerca-de-nosotros/biografia/');
  await page.getByRole('button', { name: 'Herramientas de accesibilidad' }).last().click();
  await page.getByRole('button', { name: 'Reducir movimiento' }).click();
  const opacidades = await page.locator('.hito').evaluateAll(els => els.map(el => getComputedStyle(el).opacity));
  expect(opacidades).toEqual(Array(6).fill('1'));
});

for (const ancho of [320, 390, 768, 1440]) {
  test(`las páginas de «Acerca de nosotros» no desbordan a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    for (const ruta of ['/acerca-de-nosotros/', ...paginas.map(([, r]) => r), '/ciudadania/obras-en-ejecucion/']) {
      await page.goto(ruta);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(sobra, ruta).toBe(0);
    }
  });
}

test('la portada de «Acerca de nosotros» enlaza sus tres páginas en un índice', async ({ page }) => {
  await page.goto('/acerca-de-nosotros/');
  const indice = page.getByRole('navigation', { name: 'Conoce a Carlos' });
  await expect(indice.getByRole('link')).toHaveCount(3);
  for (const [nombre, ruta] of paginas) {
    await page.goto('/acerca-de-nosotros/');
    await indice.getByRole('link', { name: nombre }).click();
    await page.waitForURL(`**${ruta}`);
  }
});

test('el fondo de la biografía sigue visible al bajar por la línea de tiempo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/acerca-de-nosotros/biografia/');
  await page.locator('.hito').nth(2).evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 200));
  await page.waitForTimeout(300);
  const top = await page.locator('section img[alt=""]').evaluate(img => img.getBoundingClientRect().top);
  expect(top).toBe(0);
});

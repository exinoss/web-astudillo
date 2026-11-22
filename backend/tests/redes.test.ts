import { expect, test } from 'bun:test';
import { linkValue } from '../src/content/services/validation';
import { esRutaDelSitio } from '../src/contracts/redes';

test('Instagram acepta solo enlaces https a su dominio', () => {
  expect(linkValue('enlace.instagram', 'https://www.instagram.com/carlosastudillo/')).toBe('https://www.instagram.com/carlosastudillo/');
  for (const malo of ['http://www.instagram.com/carlos', 'https://instagram.com.malo.example/x', 'javascript:alert(1)', 'carlosastudillo'])
    expect(() => linkValue('enlace.instagram', malo)).toThrow('Instagram: el enlace debe ser de instagram.com');
});

test('una ruta del sitio no puede llevar a la API', () => {
  for (const buena of ['/', '/propuestas/agua-potable/', '/ciudadania/alertas/#historial', '/apidemo/'])
    expect(esRutaDelSitio(buena)).toBe(true);
  for (const mala of ['/api', '/api/', '/api/participacion/fotos/x-1280', '/api#x', '//malo.example'])
    expect(esRutaDelSitio(mala)).toBe(false);
});

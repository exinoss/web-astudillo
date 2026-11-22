import { expect, test } from 'bun:test';
import { linkValue } from '../src/content/services/validation';

test('Instagram acepta solo enlaces https a su dominio', () => {
  expect(linkValue('enlace.instagram', 'https://www.instagram.com/carlosastudillo/')).toBe('https://www.instagram.com/carlosastudillo/');
  for (const malo of ['http://www.instagram.com/carlos', 'https://instagram.com.malo.example/x', 'javascript:alert(1)', 'carlosastudillo'])
    expect(() => linkValue('enlace.instagram', malo)).toThrow('Instagram: el enlace debe ser de instagram.com');
});

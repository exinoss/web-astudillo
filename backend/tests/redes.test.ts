import { expect, test } from 'bun:test';
import { linkValue } from '../src/content/services/validation';
import { usuarioRed } from '../src/contracts/redes';

test('Instagram acepta solo enlaces https a su dominio', () => {
  expect(linkValue('enlace.instagram', 'https://www.instagram.com/carlosastudillo/')).toBe('https://www.instagram.com/carlosastudillo/');
  for (const malo of ['http://www.instagram.com/carlos', 'https://instagram.com.malo.example/x', 'javascript:alert(1)', 'carlosastudillo'])
    expect(() => linkValue('enlace.instagram', malo)).toThrow('Instagram: el enlace debe ser de instagram.com');
});

test('el usuario de cada tarjeta sale del enlace del perfil', () => {
  expect(usuarioRed('facebook', 'https://www.facebook.com/carlosastudillo7')).toBe('@carlosastudillo7');
  expect(usuarioRed('instagram', 'https://www.instagram.com/carlos.astudillo/?hl=es')).toBe('@carlos.astudillo');
  expect(usuarioRed('tiktok', 'https://www.tiktok.com/@carlosastudillo01')).toBe('@carlosastudillo01');
  expect(usuarioRed('facebook', 'https://www.facebook.com/profile.php?id=1000')).toBeNull();
  expect(usuarioRed('instagram', 'https://www.instagram.com/p/abc123/')).toBeNull();
  expect(usuarioRed('tiktok', 'https://www.tiktok.com/')).toBeNull();
  expect(usuarioRed('facebook', 'https://facebook.com.malo.example/carlos')).toBeNull();
});

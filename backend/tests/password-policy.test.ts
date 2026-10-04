import { expect, test } from 'bun:test';
import { requirePassword } from '../../frontend/src/lib/auth/password';
import { requireConfirmation, requireNewPassword } from '../src/auth/password-policy';
import { ApiError } from '../src/http';

const validators = [requireNewPassword, (password: string) => requirePassword(password, password)];

test('ambos validadores conservan longitud, composición y confirmación', () => {
  for (const validate of validators) {
    for (const password of ['Ab1!x', 'a'.repeat(127) + '1!', 'abcdef', 'Abcdef1', '12345!', 'Abcdef!']) {
      expect(() => validate(password)).toThrow();
    }
    for (const password of ['Ab1!xy', 'a'.repeat(126) + '1!', 'ñ1!🙂xy']) {
      expect(() => validate(password)).not.toThrow();
    }
  }
  expect(() => requireConfirmation('Ab1!xy', 'Ab1!xz')).toThrow('no coinciden');
  expect(() => requirePassword('Ab1!xy', 'Ab1!xz')).toThrow('no coinciden');
});

test('ambos validadores rechazan todas las sucesiones ASCII de cuatro en ambos sentidos', () => {
  for (const reference of ['0123456789', 'abcdefghijklmnopqrstuvwxyz']) {
    for (let i = 0; i <= reference.length - 4; i++) {
      const sequence = reference.slice(i, i + 4);
      for (const run of [sequence, [...sequence].reverse().join('')]) {
        const password = run + (reference[0] === '0' ? 'a!' : '1!');
        for (const validate of validators) {
          expect(() => validate(password)).toThrow('Evita secuencias');
          expect(() => validate(password.toUpperCase())).toThrow('Evita secuencias');
        }
      }
    }
  }
  for (const password of ['1234567*a', 'abcde123*', 'Abcd1*', '7654a*', 'a!xYz1234', '1!aBcDxy']) {
    expect(() => requireNewPassword(password)).toThrow(ApiError);
    expect(() => requirePassword(password, password)).toThrow('Evita secuencias');
  }
  try { requireNewPassword('Abcd1*'); }
  catch (error) { expect((error as ApiError).status).toBe(422); }
});

test('ambos validadores aceptan tramos de tres, separadores y patrones fuera del alcance', () => {
  for (const password of [
    'abc1!x', 'cba1!x', 'xyz1!a', '123a!*', '321a!*', '789a!*',
    'abc!d1', '12!34a', 'ab12cd*', '12🙂34a!', 'ijKl1*', 'mnñop1!',
    'qwerty1!', '1111a!', 'aaaa1!', 'juan124*', '8901a!', 'zabc1!',
  ]) {
    for (const validate of validators) expect(() => validate(password)).not.toThrow();
  }
});

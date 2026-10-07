import { expect, test } from 'bun:test';
import { plainText } from '../src/content/services/validation';

const reason = (value: string, multiline = false) => {
  try { plainText(value, 'Campo', 400, { multiline }); return null; } catch (error) { return (error as Error).message; }
};

test('acepta el texto copiado de redes: emojis compuestos, invisibles y tabuladores', () => {
  const emojis = 'Te escucho \u{1F64B}\u200d♂️ · Por las familias \u{1F468}\u200d\u{1F469}\u200d\u{1F467} · \u{1F1EA}\u{1F1E8}';
  expect(plainText(emojis, 'Campo', 400)).toBe(emojis);
  expect(plainText('\ufeffHola\u200b San\u200e Lorenzo\u200f', 'Campo', 400)).toBe('Hola San Lorenzo');
  expect(plainText('Agua\tpotable', 'Campo', 400)).toBe('Agua potable');
});

test('quita las marcas de dirección de WhatsApp y rechaza las que invierten las letras', () => {
  expect(plainText('Llama al \u202a+593 98 565 8595\u202c o \u2067aquí\u2069', 'Campo', 400)).toBe('Llama al +593 98 565 8595 o aquí');
  expect(reason('Ana\u202enimda')).toBe('Campo: contiene caracteres no permitidos');
  expect(reason('Ana\u202dadmin')).toBe('Campo: contiene caracteres no permitidos');
});

test('los saltos de línea se conservan donde caben y se explican donde no', () => {
  expect(plainText('Línea 1\r\nLínea 2\u2028Línea 3', 'Campo', 400, { multiline: true })).toBe('Línea 1\nLínea 2\nLínea 3');
  expect(reason('Línea 1\nLínea 2')).toBe('Campo: escribe el texto en una sola línea');
});

test('sigue rechazando etiquetas, controles y textos vacíos o largos', () => {
  expect(reason('<script>alert(1)</script>')).toBe('Campo: escribe solo texto, sin etiquetas');
  expect(reason('Hola\u0007')).toBe('Campo: contiene caracteres no permitidos');
  expect(reason('\u200b \u200e')).toBe('Campo: no puede quedar vacío');
  expect(reason('a'.repeat(401))).toBe('Campo: máximo 400 caracteres');
});

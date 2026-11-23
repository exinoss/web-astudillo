import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gestoDe, ladoPara, momentos, PASOS, type Paso } from '../src/lib/comun/guia/pasos.ts';

const paso: Paso = { id: 'x', pagina: '/', texto: 'Arriba está el menú y abajo el pie.', recorrido: [{ en: 'menú', sel: 'a' }, { en: 'pie', sel: 'b' }, { en: 'no está', sel: 'c' }] };

test('cada visita empieza cuando se dice su palabra, 0,4 s antes; sin la palabra, se reparten por igual', () => {
  const [menu, pie, otra] = momentos(paso, 10);
  assert.equal(menu, paso.texto.indexOf('menú') / paso.texto.length - 0.04);
  assert.equal(pie, paso.texto.indexOf('pie') / paso.texto.length - 0.04);
  assert.equal(otra, 3 / 4);
  assert.equal(momentos({ ...paso, recorrido: [{ en: 'Arriba', sel: 'a' }] }, 10)[0], 0);
});

test('Carlos se pone al lado contrario del elemento, salvo si está centrado o es muy ancho', () => {
  assert.equal(ladoPara({ x: 900, w: 200 }, 1440, 'centro'), 'izquierda');
  assert.equal(ladoPara({ x: 100, w: 200 }, 1440, 'centro'), 'derecha');
  assert.equal(ladoPara({ x: 620, w: 200 }, 1440, 'derecha'), 'derecha');
  assert.equal(ladoPara({ x: 0, w: 1200 }, 1440, 'izquierda'), 'izquierda');
  assert.equal(ladoPara(null, 1440, 'centro'), 'centro');
  assert.equal(gestoDe('izquierda'), 'senalar_ui');
  assert.equal(gestoDe('derecha'), 'senalar_izquierda');
});

test('cada palabra clave del recorrido aparece en el texto que se graba', () => {
  for (const p of PASOS) for (const visita of p.recorrido ?? []) assert.ok(p.texto.includes(visita.en), `${p.id}: «${visita.en}»`);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gestoDe, ladoPara, momentos, PASOS, type Paso } from '../src/lib/comun/guia/pasos.ts';
import { colocacion, CUERPO, globoArriba } from '../src/lib/comun/guia/colocacion.ts';

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

test('fuera del celular, Carlos y el globo van donde iban antes', () => {
  const m = { ventana: 1440, carlos: { w: 300, h: 225 }, globo: 380, celular: false, arriba: true };
  for (const [posicion, x] of [['izquierda', 12], ['derecha', 1128], ['centro', 570]] as const) {
    const { carlos, globo } = colocacion(posicion, m);
    assert.equal(carlos, x);
    assert.deepEqual(globo, { left: Math.min(Math.max(12, x + 150 - 190), 1440 - 380 - 12), width: null, top: null, bottom: 219 });
  }
});

test('en celular, Carlos se pega al borde con el globo a su lado, o el globo va arriba', () => {
  const m = { ventana: 360, carlos: { w: 180, h: 135 }, globo: 336, celular: true, arriba: false };
  const der = colocacion('derecha', m);
  assert.equal(der.carlos + CUERPO.hasta * 180, 356);
  assert.deepEqual(der.globo, { left: 12, width: der.carlos + CUERPO.desde * 180 - 4 - 12, top: null, bottom: 8 });
  const izq = colocacion('izquierda', m);
  assert.equal(izq.carlos + CUERPO.desde * 180, 4);
  assert.equal(izq.globo.left, izq.carlos + CUERPO.hasta * 180 + 4);
  assert.equal(izq.globo.left + izq.globo.width!, 348);
  assert.equal(colocacion('centro', m).globo.bottom, 129);
  assert.deepEqual(colocacion('derecha', { ...m, arriba: true }).globo, { left: 12, width: 336, top: 8, bottom: null });
});

test('el globo sube si arriba tapa claramente menos del foco, y no vuelve a bajar por poco', () => {
  assert.equal(globoArriba({ y: 300, h: 300 }, 500, 120, false), true);
  assert.equal(globoArriba({ y: 60, h: 500 }, 500, 120, false), false);
  assert.equal(globoArriba({ y: 100, h: 440 }, 500, 120, false), false);
  assert.equal(globoArriba({ y: 100, h: 440 }, 500, 120, true), true);
});

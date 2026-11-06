import { expect, test } from "bun:test";
import { rangos } from "./antes-de-subir";

const CEROS = "0".repeat(40), A = "a".repeat(40), B = "b".repeat(40), M = "m".repeat(40);

test("cada push compara desde lo ya subido; una rama nueva, desde su base en main", () => {
  const base = () => M, existe = () => true;
  expect(rangos(`refs/heads/x ${A} refs/heads/x ${B}\n`, base, existe)).toEqual([{ desde: B, hasta: A }]);
  expect(rangos(`refs/heads/x ${A} refs/heads/x ${CEROS}\n`, base, existe)).toEqual([{ desde: M, hasta: A }]);
  expect(rangos(`refs/heads/x ${A} refs/heads/x ${B}\n`, base, () => false)).toEqual([{ desde: M, hasta: A }]);
  expect(rangos(`(delete) ${CEROS} refs/heads/x ${B}\n`, base, existe)).toEqual([]);
  expect(rangos("", base, existe)).toEqual([]);
});

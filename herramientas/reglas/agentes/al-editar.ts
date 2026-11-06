import { informe, revisar } from "../revisar";
import { rutasEditadas } from "./entrada";

const rutas = rutasEditadas(await Bun.stdin.json());
const faltas = rutas.length ? revisar(rutas, "diff") : [];
if (faltas.length) console.log(JSON.stringify({ decision: "block", reason: informe(faltas) }));

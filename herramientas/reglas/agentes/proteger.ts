import { rutasEditadas, type Entrada } from "./entrada";

const PROTEGIDAS = /^(?:\.claude|\.codex|\.githooks|\.git|herramientas\/reglas)(?:\/|$)/;
// La memoria de Claude vive en `~/.claude/projects/`: no es parte del árbitro.
const EN_COMANDO = /\.claude[\\/](?!projects[\\/])|\.codex[\\/]|\.githooks|herramientas[\\/]reglas|\.git[\\/](?:hooks|config)|--no-verify|core\.hooksPath|--congelar/i;

const entrada: Entrada = await Bun.stdin.json();
const codex = process.argv.includes("--codex");
const tocaArbitro = ["Bash", "PowerShell"].includes(entrada.tool_name ?? "")
  ? EN_COMANDO.test(String(entrada.tool_input?.command ?? ""))
  : rutasEditadas(entrada).some((r) => PROTEGIDAS.test(r));
if (!tocaArbitro) process.exit(0);

// Solo Claude Code, en estos modos, muestra un aviso que responde una persona; Codex aún no admite «ask».
const conAviso = !codex && ["default", "acceptEdits", "plan"].includes(entrada.permission_mode ?? "");
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: conAviso ? "ask" : "deny",
    permissionDecisionReason: conAviso
      ? "Este cambio toca los controles del proyecto (hooks, reglas o su lista de excepciones): solo se hace si el usuario lo autoriza."
      : codex
        ? "Los controles del proyecto (hooks, reglas y su lista de excepciones) solo se modifican con autorización del usuario: pídele que lo haga él o que desactive este hook un momento en /hooks."
        : "Los controles del proyecto (hooks, reglas y su lista de excepciones) solo se modifican con autorización del usuario. Pídele que cambie al modo normal (Shift+Tab) para aprobarlo en el aviso.",
  },
}));

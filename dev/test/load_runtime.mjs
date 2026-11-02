// Carrega arquivos do runtime (scripts clássicos) num contexto vm, como o validador fará.
import vm from "node:vm";
import { readFileSync } from "node:fs";
export const RUNTIME = new URL("../../skills/bonequinho-estudio/assets/runtime/", import.meta.url);
export function loadRuntime(files, extra = {}) {
  const ctx = vm.createContext({ console, Math, JSON, Float32Array, Float64Array, Uint8Array, Int32Array, Array, Object, Proxy, Error, Map, Set, Promise, ...extra });
  ctx.globalThis = ctx;
  for (const f of files) vm.runInContext(readFileSync(new URL(f, RUNTIME), "utf8"), ctx, { filename: f });
  return ctx;
}

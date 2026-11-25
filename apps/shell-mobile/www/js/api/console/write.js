import { getInstalled } from "../../core/store.js";

const LEVELS = new Set(["log", "info", "warn", "error", "debug"]);
const MAX_TEXT = 10000;

export default function (params = {}, context) {
  const rec = context.appId ? getInstalled(context.appId) : null;
  const source = rec ? rec.name : context.appId || "unknown";
  const level = LEVELS.has(params.level) ? params.level : "log";
  context.debugConsole.push(source, level, String(params.text ?? "").slice(0, MAX_TEXT));
  return { ok: true };
}

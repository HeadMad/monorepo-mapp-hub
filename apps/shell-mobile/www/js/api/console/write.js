const LEVELS = new Set(["log", "info", "warn", "error", "debug"]);
const MAX_TEXT = 8000;

export default function (params = {}, context) {
  const level = LEVELS.has(params.level) ? params.level : "log";
  context.bus.publish(context.appId, {
    type: `console.${level}`,
    data: { text: String(params.text ?? "").slice(0, MAX_TEXT), ts: Date.now() },
  });
  return { ok: true };
}

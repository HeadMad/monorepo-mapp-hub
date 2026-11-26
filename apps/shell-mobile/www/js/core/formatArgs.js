export function formatArgs(args) {
  return args
    .map((v) => {
      if (typeof v === "string") return v;
      if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
      try {
        const s = JSON.stringify(v);
        return s === undefined ? String(v) : s;
      } catch {
        return String(v);
      }
    })
    .join(" ");
}

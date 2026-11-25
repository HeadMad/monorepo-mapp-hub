// Версия оболочки. Воркфлоу сборки подставляет сюда значение из поля version при ручном запуске,
// поэтому держи это значение синхронным с release-manifest.json и package.json.
export const SHELL_VERSION = "0.2.0-beta.2";

const PRE_ORDER = { alpha: 0, beta: 1, rc: 2 };

export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/.exec(String(v));
  if (!m) return null;
  return {
    major: +m[1], minor: +m[2], patch: +m[3],
    pre: m[4] ? { tag: m[4], n: +m[5] } : null,
  };
}

// Возвращает >0, если a новее b; <0, если старше; 0, если равны. Релиз новее своей pre-release.
export function compareVersions(a, b) {
  const A = parseVersion(a);
  const B = parseVersion(b);
  if (!A || !B) throw new Error(`Некорректная версия: ${a} / ${b}`);
  for (const k of ["major", "minor", "patch"]) {
    if (A[k] !== B[k]) return A[k] - B[k];
  }
  if (!A.pre && !B.pre) return 0;
  if (!A.pre) return 1;
  if (!B.pre) return -1;
  if (A.pre.tag !== B.pre.tag) return (PRE_ORDER[A.pre.tag] ?? 0) - (PRE_ORDER[B.pre.tag] ?? 0);
  return A.pre.n - B.pre.n;
}

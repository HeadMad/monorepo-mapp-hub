export default async function (params = {}) {
  await navigator.clipboard.writeText(String(params.text ?? ""));
  return { written: true };
}

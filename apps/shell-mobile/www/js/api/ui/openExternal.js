export default async function (params = {}) {
  let url;
  try {
    url = new URL(String(params.url ?? ""));
  } catch {
    throw new Error("Некорректный URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Разрешены только http и https ссылки");
  }
  const win = window.open(url.href, "_blank");
  if (win) win.opener = null;
  return { opened: !!win };
}

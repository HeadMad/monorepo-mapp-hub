export default async function (params = {}) {
  if (typeof navigator.share !== "function") {
    throw new Error("Системное меню «Поделиться» недоступно");
  }
  const data = {};
  if (params.title) data.title = String(params.title);
  if (params.text) data.text = String(params.text);
  if (params.url) {
    const url = String(params.url);
    if (!/^https?:\/\//.test(url)) throw new Error("В url разрешены только http и https");
    data.url = url;
  }
  if (!data.text && !data.url) throw new Error("Нужен text или url");
  try {
    await navigator.share(data);
  } catch (e) {
    if (e.name === "AbortError") return { shared: false };
    throw e;
  }
  return { shared: true };
}

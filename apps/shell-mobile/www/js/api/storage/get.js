// Хранилище изолировано по appId: приложение видит только свои ключи.
export default async function ({ key }, context) {
  if (!context.appId) throw new Error("Вызов не из установленного мини-приложения");
  if (!key) throw new Error("Не указан key");
  const raw = localStorage.getItem(`mapp_store_${context.appId}_${key}`);
  return { key, value: raw ? JSON.parse(raw) : null };
}

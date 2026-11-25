export default async function ({ key, value }, context) {
  if (!context.appId) throw new Error("Вызов не из установленного мини-приложения");
  if (!key) throw new Error("Не указан key");
  localStorage.setItem(`mapp_store_${context.appId}_${key}`, JSON.stringify(value ?? null));
  return { key, saved: true };
}

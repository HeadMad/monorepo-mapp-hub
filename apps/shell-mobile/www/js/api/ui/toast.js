export default async function (params = {}, context) {
  const message = String(params.message ?? "");
  if (!message) throw new Error("Нужен текст уведомления (message)");
  return context.toast({ message, duration: params.duration });
}

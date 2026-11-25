export default function (params = {}, context) {
  if (typeof params.appId !== "string" || typeof params.method !== "string") {
    throw new Error("Нужны строковые параметры appId и method");
  }
  return context.services.invoke({
    to: params.appId,
    from: context.appId,
    method: params.method,
    params: params.params || {},
  });
}

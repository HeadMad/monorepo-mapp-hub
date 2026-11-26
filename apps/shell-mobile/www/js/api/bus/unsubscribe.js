export default function (params = {}, context) {
  return { ok: context.bus.unsubscribe(params.subId, context.appId) };
}

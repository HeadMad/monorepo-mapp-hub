export default function (params = {}, context) {
  if (!context.caller) {
    throw Object.assign(new Error("Подписка недоступна через relay"), { code: -32601 });
  }
  return context.bus.subscribe(context.caller, params.filter, { replay: !!params.replay });
}

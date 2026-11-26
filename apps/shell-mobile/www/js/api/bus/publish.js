export default function (params = {}, context) {
  return context.bus.publish(context.appId, params);
}

export default function (params = {}, context) {
  context.services.setLayout(params.mode, params.height);
  return { ok: true };
}

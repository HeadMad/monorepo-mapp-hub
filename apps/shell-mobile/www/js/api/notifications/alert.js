export default async function (params, context) {
  const { title = "Системное уведомление", message = "" } = params;
  await context.showModal({ title, message, buttons: [{ text: "OK", primary: true }] });
  return { status: "acknowledged" };
}

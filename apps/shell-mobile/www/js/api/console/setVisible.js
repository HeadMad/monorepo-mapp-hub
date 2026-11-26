export default function (params = {}, context) {
  return context.console.setVisible(!!params.visible);
}

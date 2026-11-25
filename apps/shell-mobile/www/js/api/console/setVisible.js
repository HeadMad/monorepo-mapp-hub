export default function (params = {}, context) {
  context.debugConsole.setVisible(!!params.visible);
  return context.debugConsole.getState();
}

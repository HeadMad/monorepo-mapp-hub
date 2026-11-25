export default async function () {
  return { text: await navigator.clipboard.readText() };
}

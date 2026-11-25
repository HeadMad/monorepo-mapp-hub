export default async function ({ key }) {
  const raw = localStorage.getItem("mapp_store_" + key);
  return { key, value: raw ? JSON.parse(raw) : null };
}

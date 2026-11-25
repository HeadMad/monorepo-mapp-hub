export default async function () {
  if (!navigator.geolocation) throw new Error("Геолокация недоступна");
  const pos = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.message || "Не удалось получить координаты")), {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    }));
  const { latitude, longitude, accuracy } = pos.coords;
  return { latitude, longitude, accuracy, timestamp: pos.timestamp };
}

export default async function () {
  return {
    platform: "mobile-capacitor",
    userAgent: navigator.userAgent,
    screen: { width: window.innerWidth, height: window.innerHeight },
    timestamp: Date.now()
  };
}

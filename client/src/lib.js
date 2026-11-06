export const MAX_CITIES = 7;

export const DEFAULT_CITIES = [
  { name: "New York", region: "New York", country: "United States", lat: 40.71, lon: -74.01 },
  { name: "London", region: "England", country: "United Kingdom", lat: 51.51, lon: -0.13 },
  { name: "Tokyo", region: "Tokyo", country: "Japan", lat: 35.69, lon: 139.69 },
  { name: "Mumbai", region: "Maharashtra", country: "India", lat: 19.07, lon: 72.88 },
  { name: "Sydney", region: "New South Wales", country: "Australia", lat: -33.87, lon: 151.21 },
];

export const METRICS = [
  { k: "aqi", label: "Air quality", emoji: "🍃", unit: "", color: "#2e9e5b" },
  { k: "precipitation", label: "Rain", emoji: "☔", unit: " mm", color: "#1a73e8" },
  { k: "humidity", label: "Humidity", emoji: "💦", unit: "%", color: "#00a3b5" },
  { k: "wind", label: "Wind", emoji: "🌬️", unit: " km/h", color: "#7e57c2" },
  { k: "dewPoint", label: "Dew point", emoji: "💧", unit: "°", color: "#3f8cff" },
  { k: "uv", label: "UV (sun)", emoji: "😎", unit: "", color: "#f59e0b" },
];

const AQI_BANDS = [
  { max: 50, color: "#2e9e5b", face: "😄", text: "Super fresh air!" },
  { max: 100, color: "#c99a00", face: "🙂", text: "Air is okay" },
  { max: 150, color: "#e8741a", face: "😷", text: "Sensitive friends, take care" },
  { max: 200, color: "#d93a3a", face: "🥴", text: "Yucky air – play inside" },
  { max: 300, color: "#8e3fa8", face: "🤢", text: "Very yucky air" },
  { max: 9999, color: "#7a1f3d", face: "☠️", text: "Stay indoors!" },
];
export const AQI_LEGEND = AQI_BANDS.slice(0, 5).map((b, i) => ({ ...b, range: ["0–50", "51–100", "101–150", "151–200", "201–300"][i] }));
export const aqiBand = (v) => (v == null ? { color: "#8896a5", face: "❓", text: "No data" } : AQI_BANDS.find((b) => v <= b.max));

// Kid-friendly one-liners per metric: returns [emoji, sentence]
export function explain(k, v) {
  if (v == null) return ["❓", "No data for this day."];
  switch (k) {
    case "aqi": { const b = aqiBand(v); return [b.face, b.text]; }
    case "precipitation": return v === 0 ? ["🌞", "No rain – dry day!"] : v < 2.5 ? ["🌦️", "A little drizzle"] : v < 10 ? ["🌧️", "Bring an umbrella!"] : ["⛈️", "Puddle jumping weather!"];
    case "humidity": return v < 30 ? ["🏜️", "Super dry air"] : v < 60 ? ["🙂", "Comfy air"] : v < 80 ? ["😅", "A bit sticky"] : ["🥵", "Very sticky and damp"];
    case "wind": return v < 10 ? ["🍃", "Just a gentle breeze"] : v < 25 ? ["🪁", "Great for flying a kite!"] : v < 40 ? ["💨", "Hold on to your hat!"] : ["🌪️", "Super windy!"];
    case "dewPoint": return v < 10 ? ["😎", "Feels fresh and dry"] : v < 16 ? ["🙂", "Feels comfy"] : v < 21 ? ["😓", "Feels a bit muggy"] : ["🥵", "Feels very muggy"];
    case "uv": return v < 3 ? ["🙂", "Low – sun is gentle"] : v < 6 ? ["🧢", "Medium – wear a hat"] : v < 8 ? ["🧴", "High – use sunscreen"] : ["🕶️", "Very high – stay in shade"];
    default: return ["", ""];
  }
}

export function weatherIcon(code) {
  if (code == null) return "🌡️";
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const defaultRange = () => {
  const t = new Date(), f = new Date();
  f.setDate(t.getDate() - 5);
  return { from: iso(f), to: iso(t) };
};
export const cityKey = (c) => `${c.lat},${c.lon}`;
export const dayLabel = (s, today) =>
  s === today ? "Today" : new Date(s + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const loadLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

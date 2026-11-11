// MCP server (stdio) exposing weather + air-quality tools backed by Open-Meteo (free, no API key).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";


const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Upstream ${r.status}: ${await r.text()}`);
  return r.json();
};
const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const max = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.max(...v) : null; };
const sum = (a) => a.filter((x) => x != null).reduce((s, x) => s + x, 0);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

export function createServer() {
  const server = new McpServer({ name: "kids-weather", version: "1.0.0" });
  server.tool(
    "search_city",
    "Find cities by name. Returns name, country, latitude, longitude.",
    { query: z.string().min(2) },
    async ({ query }) => {
      const d = await getJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en`
      );
      return text(
        (d.results || []).map((c) => ({
          id: c.id, name: c.name, region: c.admin1 || "", country: c.country || "",
          lat: c.latitude, lon: c.longitude,
        }))
      );
    }
  );

  server.tool(
    "get_weather_range",
    "Daily air quality (US AQI, peak hourly value of the day), precipitation, humidity, wind, dew point and UV index for a city between two dates (YYYY-MM-DD, within the last ~90 days up to ~5 days ahead).",
    {
      lat: z.number(), lon: z.number(),
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    },
    async ({ lat, lon, from_date, to_date }) => {
      const range = `latitude=${lat}&longitude=${lon}&start_date=${from_date}&end_date=${to_date}&timezone=auto`;
      const [w, a] = await Promise.all([
        getJson(`https://api.open-meteo.com/v1/forecast?${range}&hourly=relative_humidity_2m,dew_point_2m,wind_speed_10m,precipitation,temperature_2m,weather_code&daily=uv_index_max`),
        getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${range}&hourly=us_aqi`),
      ]);
      const byDay = {};
      const push = (t, k, v) => ((byDay[t.slice(0, 10)] ??= {})[k] ??= []).push(v);
      w.hourly.time.forEach((t, i) => {
        push(t, "hum", w.hourly.relative_humidity_2m[i]);
        push(t, "dew", w.hourly.dew_point_2m[i]);
        push(t, "wind", w.hourly.wind_speed_10m[i]);
        push(t, "rain", w.hourly.precipitation[i]);
        push(t, "temp", w.hourly.temperature_2m[i]);
        push(t, "code", w.hourly.weather_code[i]);
      });
      a.hourly.time.forEach((t, i) => push(t, "aqi", a.hourly.us_aqi[i]));
      const days = Object.keys(byDay).sort().map((date) => {
        const d = byDay[date];
        const uv = w.daily.uv_index_max[w.daily.time.indexOf(date)];
        // most severe weather code of the afternoon-ish: use the max code of the day
        return {
          date,
          // Daily AQI = worst hour of the day, so evening spikes (e.g. Diwali fireworks) aren't averaged away.
          aqi: d.aqi ? max(d.aqi) : null,
          aqiAvg: d.aqi ? Math.round(avg(d.aqi) ?? NaN) || null : null,
          precipitation: r1(sum(d.rain || [])),
          humidity: Math.round(avg(d.hum || []) ?? NaN) || null,
          wind: r1(avg(d.wind || [])),
          windMax: r1(max(d.wind || [])),
          dewPoint: r1(avg(d.dew || [])),
          uv: r1(uv),
          tempHigh: r1(max(d.temp || [])),
          tempLow: r1(Math.min(...(d.temp || [0]).filter((x) => x != null))),
          code: max(d.code || []),
        };
      });
      return text({ lat, lon, timezone: w.timezone, units: { precipitation: "mm", wind: "km/h", dewPoint: "°C", temp: "°C" }, days });
    }
  );
  return server;
}

// Run over stdio only when executed directly (local dev); Vercel imports createServer instead.
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await createServer().connect(new StdioServerTransport());
}

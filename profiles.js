// Profile storage: Upstash Redis when configured (Vercel), otherwise a local JSON file (dev).
import { Redis } from "@upstash/redis";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
export const storageKind = redis ? "redis" : "file";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "profiles.json");
const readFile = async () => { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return {}; } };

const keyOf = (name) => String(name || "").trim().replace(/\s+/g, " ").slice(0, 30).toLowerCase();

async function get(key) {
  if (redis) return (await redis.get(`profile:${key}`)) ?? null;
  return (await readFile())[key] ?? null;
}
async function set(key, value) {
  if (redis) return void (await redis.set(`profile:${key}`, value));
  const all = await readFile();
  all[key] = value;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(all, null, 2));
}

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x) => String(x ?? "").slice(0, 80);

function sanitize(body) {
  const cities = (Array.isArray(body?.cities) ? body.cities : []).slice(0, 10)
    .map((c) => ({ name: str(c?.name), region: str(c?.region), country: str(c?.country), lat: num(c?.lat), lon: num(c?.lon) }))
    .filter((c) => c.name && c.lat != null && c.lon != null);
  const shown = {};
  for (const k of ["aqi", "precipitation", "humidity", "wind", "dewPoint", "uv"]) shown[k] = body?.shown?.[k] !== false;
  return { cities, shown };
}

/** Shared by the Express server and the Vercel function. Returns { status, body }. */
export async function profileApi(method, query, body) {
  try {
    const key = keyOf(method === "GET" ? query?.name : body?.name);
    if (!key) return { status: 400, body: { error: "Name is required" } };
    if (method === "GET") return { status: 200, body: { profile: await get(key), storage: storageKind } };
    if (method === "PUT") {
      const profile = { name: String(body.name).trim().slice(0, 30), ...sanitize(body), updatedAt: new Date().toISOString() };
      await set(key, profile);
      return { status: 200, body: { profile, storage: storageKind } };
    }
    return { status: 405, body: { error: "Method not allowed" } };
  } catch (e) {
    return { status: 500, body: { error: String(e.message || e) } };
  }
}

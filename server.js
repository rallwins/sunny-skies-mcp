// Web gateway: acts as an MCP *client*, spawns mcp-server.js over stdio, and exposes it to the browser.
import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const mcp = new Client({ name: "kids-weather-web", version: "1.0.0" });
await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, "mcp-server.js")] }));
console.log("MCP tools:", (await mcp.listTools()).tools.map((t) => t.name).join(", "));

const call = async (name, args) => {
  const res = await mcp.callTool({ name, arguments: args });
  if (res.isError) throw new Error(res.content?.[0]?.text || "Tool error");
  return JSON.parse(res.content[0].text);
};

const app = express();
app.use(express.static(path.join(here, "public")));
const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req)); } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};

app.get("/api/search", wrap((req) => call("search_city", { query: String(req.query.q || "") })));
app.get("/api/weather", wrap((req) =>
  call("get_weather_range", {
    lat: Number(req.query.lat), lon: Number(req.query.lon),
    from_date: String(req.query.from), to_date: String(req.query.to),
  })));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Open http://localhost:${port}`));

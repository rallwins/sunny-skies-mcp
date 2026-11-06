// Serverless helper: runs the MCP server and a client in the same process via an in-memory transport.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../mcp-server.js";

let clientP;
const getClient = () =>
  (clientP ??= (async () => {
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await createServer().connect(st);
    const client = new Client({ name: "kids-weather-vercel", version: "1.0.0" });
    await client.connect(ct);
    return client;
  })());

export async function callTool(name, args) {
  const res = await (await getClient()).callTool({ name, arguments: args });
  if (res.isError) throw new Error(res.content?.[0]?.text || "Tool error");
  return JSON.parse(res.content[0].text);
}

export const handle = (fn) => async (req, res) => {
  try { res.status(200).json(await fn(req.query)); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};

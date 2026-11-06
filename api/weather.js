import { callTool, handle } from "./_mcp.js";
export default handle((q) =>
  callTool("get_weather_range", { lat: Number(q.lat), lon: Number(q.lon), from_date: String(q.from), to_date: String(q.to) }));

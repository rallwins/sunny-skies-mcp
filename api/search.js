import { callTool, handle } from "./_mcp.js";
export default handle((q) => callTool("search_city", { query: String(q.q || "") }));

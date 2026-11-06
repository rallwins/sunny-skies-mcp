# Sunny Skies – kids weather & air-quality app

React (Vite) frontend + an MCP server (`mcp-server.js`) exposing `search_city` and `get_weather_range` tools (Open-Meteo, no API key).

```
npm install
npm run run     # build the React app and start on http://localhost:3000
```

- Local: `server.js` is an MCP client that spawns the MCP server over stdio.
- Vercel: `api/*.js` run the same MCP server in-process (`npx vercel --prod`).

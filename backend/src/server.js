import http from "node:http";
import { routeRequest } from "./app.js";
import { readJson, sendJson } from "./lib/http.js";

async function handler(req, res) {
  const body = req.method === "GET" || req.method === "OPTIONS" ? {} : await readJson(req);
  const result = await routeRequest(req.method, req.url ?? "/", body);
  sendJson(res, result.statusCode, result.body);
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  });
});

const port = Number(process.env.PORT ?? "4000");
const host = process.env.HOST ?? "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

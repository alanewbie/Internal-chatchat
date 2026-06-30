import { routeRequest } from "./app.js";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-admin-token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export async function handler(event) {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
    const path = event.rawPath ?? event.path ?? "/";
    const adminToken = process.env.ADMIN_TOKEN;
    const requestToken = event.headers?.["x-admin-token"] ?? event.headers?.["X-Admin-Token"];

    if (path.startsWith("/admin/") && (!adminToken || requestToken !== adminToken)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : {};
    const result = await routeRequest(method, path, body);
    return { statusCode: result.statusCode, headers, body: JSON.stringify(result.body) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }) };
  }
}

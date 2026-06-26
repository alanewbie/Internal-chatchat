import http from "node:http";
import { addFaq, getPromptConfig, listFaqs, setPromptConfig } from "./data/store.js";
import { matchFaq } from "./lib/faqMatcher.js";
import { readJson, sendJson } from "./lib/http.js";

const documents = [
  {
    id: "doc-1",
    title: "Remote Work Policy",
    url: "https://example.com/remote-work-policy.pdf"
  }
];

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const entries = listFaqs();
  const match = matchFaq(body.question ?? "", entries);

  if (match) {
    sendJson(res, 200, {
      answer: match.answer,
      mode: "faq",
      sources: []
    });
    return;
  }

  sendJson(res, 200, {
    answer:
      "No FAQ matched yet. This is where the Bedrock RAG flow will answer from uploaded documents in the next step.",
    mode: "rag",
    sources: documents
  });
}

async function handler(req, res) {
  if (!req.url) {
    notFound(res);
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/chat/ask") {
    await handleChat(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/admin/faqs") {
    sendJson(res, 200, { items: listFaqs() });
    return;
  }

  if (req.method === "POST" && req.url === "/admin/faqs") {
    const body = await readJson(req);
    const created = addFaq({
      question: body.question ?? "",
      answer: body.answer ?? "",
      tags: Array.isArray(body.tags) ? body.tags : []
    });
    sendJson(res, 201, created);
    return;
  }

  if (req.method === "GET" && req.url === "/admin/prompt") {
    sendJson(res, 200, getPromptConfig());
    return;
  }

  if (req.method === "PUT" && req.url === "/admin/prompt") {
    const body = await readJson(req);
    sendJson(res, 200, setPromptConfig(body.systemPrompt ?? ""));
    return;
  }

  if (req.method === "GET" && req.url === "/admin/documents") {
    sendJson(res, 200, { items: documents });
    return;
  }

  notFound(res);
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  });
});

const port = 4000;
const host = "127.0.0.1";

server.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

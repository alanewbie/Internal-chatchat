import http from "node:http";
import {
  addFaq,
  addLog,
  answerFromRag,
  createDocumentUpload,
  deleteDocument,
  indexDocument,
  getPromptConfig,
  getRuntimeStatus,
  listDocuments,
  listFaqs,
  listLogs,
  setPromptConfig
} from "./data/store.js";
import { matchFaq } from "./lib/faqMatcher.js";
import { readJson, sendJson } from "./lib/http.js";

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const startedAt = Date.now();
  console.log(`Chat request started: ${(body.question ?? "").slice(0, 80)}`);
  const entries = await listFaqs();
  const match = matchFaq(body.question ?? "", entries);

  if (match) {
    await addLog({
      question: body.question ?? "",
      mode: "faq",
      answer: match.answer
    });
    sendJson(res, 200, {
      answer: match.answer,
      mode: "faq",
      sources: []
    });
    console.log(`Chat request completed in ${Date.now() - startedAt}ms using FAQ`);
    return;
  }

  const ragResult = await answerFromRag(body.question ?? "");

  await addLog({
    question: body.question ?? "",
    mode: "rag",
    answer: ragResult.answer
  });

  sendJson(res, 200, {
    answer: ragResult.answer,
    mode: "rag",
    sources: ragResult.sources
  });
  console.log(`Chat request completed in ${Date.now() - startedAt}ms using RAG`);
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
    sendJson(res, 200, { ok: true, runtime: getRuntimeStatus() });
    return;
  }

  if (req.method === "POST" && req.url === "/chat/ask") {
    await handleChat(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/admin/faqs") {
    sendJson(res, 200, { items: await listFaqs() });
    return;
  }

  if (req.method === "POST" && req.url === "/admin/faqs") {
    const body = await readJson(req);
    const created = await addFaq({
      question: body.question ?? "",
      answer: body.answer ?? "",
      tags: Array.isArray(body.tags) ? body.tags : []
    });
    sendJson(res, 201, created);
    return;
  }

  if (req.method === "GET" && req.url === "/admin/prompt") {
    sendJson(res, 200, await getPromptConfig());
    return;
  }

  if (req.method === "PUT" && req.url === "/admin/prompt") {
    const body = await readJson(req);
    sendJson(res, 200, await setPromptConfig(body.systemPrompt ?? ""));
    return;
  }

  if (req.method === "GET" && req.url === "/admin/documents") {
    sendJson(res, 200, { items: await listDocuments() });
    return;
  }

  if (req.method === "POST" && req.url === "/admin/documents/upload-url") {
    const body = await readJson(req);
    const payload = await createDocumentUpload({
      title: body.title ?? body.fileName ?? "Untitled document",
      fileName: body.fileName ?? "document.txt",
      contentType: body.contentType ?? "text/plain",
      uploadedBy: body.uploadedBy ?? "admin"
    });
    sendJson(res, 201, payload);
    return;
  }

  if (req.method === "POST" && req.url === "/admin/documents/index") {
    const body = await readJson(req);
    const payload = await indexDocument(body.documentId ?? "");
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/admin/documents/")) {
    const documentId = decodeURIComponent(req.url.replace("/admin/documents/", ""));
    const payload = await deleteDocument(documentId);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "GET" && req.url === "/admin/logs") {
    sendJson(res, 200, { items: await listLogs() });
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

const port = Number(process.env.PORT ?? "4000");
const host = process.env.HOST ?? "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

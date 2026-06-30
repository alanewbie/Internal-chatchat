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

async function handleChat(body) {
  const entries = await listFaqs();
  const match = matchFaq(body.question ?? "", entries);

  if (match) {
    await addLog({ question: body.question ?? "", mode: "faq", answer: match.answer });
    return { answer: match.answer, mode: "faq", sources: [] };
  }

  const ragResult = await answerFromRag(body.question ?? "");
  await addLog({ question: body.question ?? "", mode: "rag", answer: ragResult.answer });
  return { answer: ragResult.answer, mode: "rag", sources: ragResult.sources };
}

export async function routeRequest(method, url, body = {}) {
  if (method === "OPTIONS") return { statusCode: 200, body: { ok: true } };
  if (method === "GET" && url === "/health") return { statusCode: 200, body: { ok: true, runtime: getRuntimeStatus() } };
  if (method === "POST" && url === "/chat/ask") return { statusCode: 200, body: await handleChat(body) };
  if (method === "GET" && url === "/admin/faqs") return { statusCode: 200, body: { items: await listFaqs() } };
  if (method === "POST" && url === "/admin/faqs") return { statusCode: 201, body: await addFaq({ question: body.question ?? "", answer: body.answer ?? "", tags: Array.isArray(body.tags) ? body.tags : [] }) };
  if (method === "GET" && url === "/admin/prompt") return { statusCode: 200, body: await getPromptConfig() };
  if (method === "PUT" && url === "/admin/prompt") return { statusCode: 200, body: await setPromptConfig(body.systemPrompt ?? "") };
  if (method === "GET" && url === "/admin/documents") return { statusCode: 200, body: { items: await listDocuments() } };
  if (method === "POST" && url === "/admin/documents/upload-url") return { statusCode: 201, body: await createDocumentUpload({ title: body.title ?? body.fileName ?? "Untitled document", fileName: body.fileName ?? "document.txt", contentType: body.contentType ?? "text/plain", uploadedBy: body.uploadedBy ?? "admin" }) };
  if (method === "POST" && url === "/admin/documents/index") return { statusCode: 200, body: await indexDocument(body.documentId ?? "") };
  if (method === "DELETE" && url.startsWith("/admin/documents/")) return { statusCode: 200, body: await deleteDocument(decodeURIComponent(url.replace("/admin/documents/", ""))) };
  if (method === "GET" && url === "/admin/logs") return { statusCode: 200, body: { items: await listLogs() } };
  return { statusCode: 404, body: { error: "Not found" } };
}

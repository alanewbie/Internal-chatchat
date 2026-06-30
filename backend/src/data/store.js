import "dotenv/config";
import crypto from "node:crypto";
import { config } from "../config.js";
import { answerWithContext, createEmbedding } from "../lib/bedrock.js";
import {
  buildDocumentKey,
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  readJsonObject,
  readObjectBuffer,
  readTextObject,
  writeJsonObject
} from "../lib/s3.js";

const APP_STATE_KEY = process.env.APP_STATE_KEY ?? "app/state.json";
const MAX_RAG_CHUNKS = Number(process.env.MAX_RAG_CHUNKS ?? "59");

const defaultState = {
  faqs: [
    {
      id: "faq-seed-1",
      question: "How do I reset my VPN password?",
      answer: "Open the IT portal, choose Password Reset, and follow the MFA verification steps.",
      tags: ["it", "vpn", "password"]
    },
    {
      id: "faq-seed-2",
      question: "How do I request annual leave?",
      answer: "Submit your leave request in Workday and notify your line manager for approval.",
      tags: ["hr", "leave"]
    }
  ],
  prompt: "You are an internal HR and IT assistant. Answer clearly, be concise, and prefer approved internal guidance.",
  documents: [],
  chunks: [],
  logs: []
};

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function readState() {
  return readJsonObject(APP_STATE_KEY, defaultState);
}

async function writeState(state) {
  await writeJsonObject(APP_STATE_KEY, state);
}

async function updateState(work) {
  const state = await readState();
  const result = await work(state);
  await writeState(state);
  return result;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function chunkText(text, chunkSize = 4000, overlap = 400) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks.filter(Boolean);
}

function cosineSimilarity(left, right) {
  if (left.length === 0 || left.length !== right.length) return Number.NEGATIVE_INFINITY;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return Number.NEGATIVE_INFINITY;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

async function extractDocumentText(document) {
  const lowerName = document.fileName.toLowerCase();

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return readTextObject(document.s3Key);
  }

  if (lowerName.endsWith(".pdf")) {
    if (!globalThis.DOMMatrix) globalThis.DOMMatrix = class DOMMatrix {};
    const { PDFParse } = await import("pdf-parse");
    const buffer = await readObjectBuffer(document.s3Key);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text;
  }

  throw new Error("Only .txt, .md, and .pdf indexing is supported");
}

export async function listFaqs() {
  const state = await readState();
  return state.faqs;
}

export async function addFaq({ question, answer, tags }) {
  return updateState((state) => {
    const faq = { id: newId("faq"), question, answer, tags };
    state.faqs.unshift(faq);
    return faq;
  });
}

export async function getPromptConfig() {
  const state = await readState();
  return { systemPrompt: state.prompt };
}

export async function setPromptConfig(systemPrompt) {
  return updateState((state) => {
    state.prompt = systemPrompt;
    return { systemPrompt };
  });
}

export async function listDocuments() {
  const state = await readState();
  return Promise.all(
    state.documents.map(async (document) => ({
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      status: document.status,
      url: await createDownloadUrl(document.s3Key)
    }))
  );
}

export async function createDocumentUpload({ title, fileName, contentType, uploadedBy = "admin" }) {
  const documentId = newId("doc");
  const s3Key = buildDocumentKey(fileName);
  const uploadUrl = await createUploadUrl({ key: s3Key, contentType });

  await updateState((state) => {
    state.documents.unshift({
      id: documentId,
      title,
      fileName,
      s3Key,
      status: "uploaded",
      uploadedBy,
      uploadedAt: new Date().toISOString()
    });
  });

  return { documentId, s3Key, uploadUrl };
}

export async function indexDocument(documentId) {
  const state = await readState();
  const document = state.documents.find((item) => item.id === documentId);

  if (!document) throw new Error("Document not found");

  let text;
  try {
    text = await extractDocumentText(document);
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.Code === "NoSuchKey") {
      document.status = "missing_file";
      await writeState(state);
      throw new Error(`S3 file is missing for this document: ${document.s3Key}. Delete this record and upload the PDF again.`);
    }
    throw error;
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("Document text extraction returned no readable content");
  if (chunks.length > MAX_RAG_CHUNKS) {
    throw new Error(`This PDF is too large for cheap demo indexing: ${chunks.length} chunks detected, limit is ${MAX_RAG_CHUNKS}.`);
  }

  const vectorChunks = [];
  for (const [index, chunk] of chunks.entries()) {
    if (index > 0) await sleep(1_000);
    vectorChunks.push({
      chunkId: newId("chunk"),
      documentId: document.id,
      title: document.title,
      s3Key: document.s3Key,
      chunkText: chunk,
      vector: await createEmbedding(chunk)
    });
  }

  state.chunks = state.chunks.filter((chunk) => chunk.documentId !== document.id).concat(vectorChunks);
  document.status = "indexed";
  await writeState(state);

  return { documentId: document.id, indexedChunks: vectorChunks.length, status: "indexed" };
}

export async function deleteDocument(documentId) {
  const state = await readState();
  const document = state.documents.find((item) => item.id === documentId);

  if (!document) throw new Error("Document not found");

  await deleteObject(document.s3Key);
  state.documents = state.documents.filter((item) => item.id !== document.id);
  state.chunks = state.chunks.filter((chunk) => chunk.documentId !== document.id);
  await writeState(state);

  return { documentId: document.id, deleted: true };
}

export async function listLogs() {
  const state = await readState();
  return state.logs.slice(0, 200);
}

export async function addLog(entry) {
  await updateState((state) => {
    state.logs.unshift({
      id: newId("log"),
      timestamp: new Date().toISOString(),
      question: entry.question,
      mode: entry.mode,
      answer: entry.answer
    });
    state.logs = state.logs.slice(0, 200);
  });
}

export async function answerFromRag(question) {
  const state = await readState();
  const indexedDocuments = state.documents.filter((document) => document.status === "indexed");

  if (indexedDocuments.length === 0) {
    return { answer: "I could not find indexed uploaded documents yet. Please upload and index a PDF first.", sources: [] };
  }

  const embedding = await createEmbedding(question);
  const chunks = state.chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(embedding, chunk.vector) }))
    .filter((chunk) => Number.isFinite(chunk.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  if (chunks.length === 0) {
    return { answer: "I could not find relevant uploaded documents yet. Please upload and index source material first.", sources: [] };
  }

  const answer = await answerWithContext({
    systemPrompt: state.prompt,
    question,
    contexts: chunks.map((chunk) => chunk.chunkText)
  });

  const uniqueSources = new Map();
  for (const chunk of chunks) {
    if (!uniqueSources.has(chunk.s3Key)) uniqueSources.set(chunk.s3Key, { title: chunk.title, s3Key: chunk.s3Key });
  }

  const sources = await Promise.all(
    Array.from(uniqueSources.values()).map(async (source) => ({
      title: source.title,
      url: await createDownloadUrl(source.s3Key)
    }))
  );

  return { answer, sources };
}

export function getRuntimeStatus() {
  return {
    awsRegion: config.awsRegion,
    stateStore: `s3://${config.s3.bucket}/${APP_STATE_KEY}`,
    vectorStore: "s3-json",
    s3Bucket: config.s3.bucket,
    bedrockChatModelId: config.bedrock.chatModelId,
    bedrockEmbedModelId: config.bedrock.embedModelId
  };
}

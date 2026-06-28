import "dotenv/config";
import { PDFParse } from "pdf-parse";
import { config } from "../config.js";
import { answerWithContext, createEmbedding } from "../lib/bedrock.js";
import { withDb, newId } from "../lib/db.js";
import { deleteDocumentChunks, indexDocumentChunks, searchRelevantChunks } from "../lib/opensearch.js";
import {
  buildDocumentKey,
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  readObjectBuffer,
  readTextObject
} from "../lib/s3.js";

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) {
      break;
    }
    start = end - overlap;
  }

  return chunks.filter(Boolean);
}

async function extractDocumentText(document) {
  const lowerName = document.file_name.toLowerCase();

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return readTextObject(document.s3_key);
  }

  if (lowerName.endsWith(".pdf")) {
    const buffer = await readObjectBuffer(document.s3_key);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text;
  }

  throw new Error("Only .txt, .md, and .pdf indexing is supported");
}

export async function listFaqs() {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT id, question, answer, tags
        FROM faq_entries
        ORDER BY updated_at DESC
      `
    );
    return result.rows;
  });
}

export async function addFaq({ question, answer, tags }) {
  return withDb(async (client) => {
    const id = newId("faq");
    const result = await client.query(
      `
        INSERT INTO faq_entries (id, question, answer, tags)
        VALUES ($1, $2, $3, $4)
        RETURNING id, question, answer, tags
      `,
      [id, question, answer, tags]
    );
    return result.rows[0];
  });
}

export async function getPromptConfig() {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT system_prompt AS "systemPrompt"
        FROM app_config
        WHERE config_key = 'system'
      `
    );
    return result.rows[0];
  });
}

export async function setPromptConfig(systemPrompt) {
  return withDb(async (client) => {
    const result = await client.query(
      `
        UPDATE app_config
        SET system_prompt = $1, updated_at = NOW()
        WHERE config_key = 'system'
        RETURNING system_prompt AS "systemPrompt"
      `,
      [systemPrompt]
    );
    return result.rows[0];
  });
}

export async function listDocuments() {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT document_id, title, file_name, s3_key, status
        FROM documents
        ORDER BY uploaded_at DESC
      `
    );

    return Promise.all(
      result.rows.map(async (row) => ({
        id: row.document_id,
        title: row.title,
        fileName: row.file_name,
        status: row.status,
        url: await createDownloadUrl(row.s3_key)
      }))
    );
  });
}

export async function createDocumentUpload({ title, fileName, contentType, uploadedBy = "admin" }) {
  const documentId = newId("doc");
  const s3Key = buildDocumentKey(fileName);
  const uploadUrl = await createUploadUrl({ key: s3Key, contentType });

  await withDb(async (client) => {
    await client.query(
      `
        INSERT INTO documents (document_id, title, file_name, s3_key, status, uploaded_by)
        VALUES ($1, $2, $3, $4, 'uploaded', $5)
      `,
      [documentId, title, fileName, s3Key, uploadedBy]
    );
  });

  return {
    documentId,
    s3Key,
    uploadUrl
  };
}

export async function indexDocument(documentId) {
  const document = await withDb(async (client) => {
    const result = await client.query(
      `
        SELECT document_id, title, file_name, s3_key, status
        FROM documents
        WHERE document_id = $1
      `,
      [documentId]
    );
    return result.rows[0];
  });

  if (!document) {
    throw new Error("Document not found");
  }

  const text = await extractDocumentText(document);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("Document text extraction returned no readable content");
  }

  const vectorChunks = [];
  for (const chunk of chunks) {
    const vector = await createEmbedding(chunk);
    vectorChunks.push({
      chunkId: newId("chunk"),
      documentId: document.document_id,
      title: document.title,
      s3Key: document.s3_key,
      chunkText: chunk,
      vector
    });
  }

  await indexDocumentChunks(vectorChunks);

  await withDb(async (client) => {
    await client.query(
      `
        UPDATE documents
        SET status = 'indexed'
        WHERE document_id = $1
      `,
      [documentId]
    );
  });

  return {
    documentId: document.document_id,
    indexedChunks: vectorChunks.length,
    status: "indexed"
  };
}

export async function deleteDocument(documentId) {
  const document = await withDb(async (client) => {
    const result = await client.query(
      `
        SELECT document_id, s3_key
        FROM documents
        WHERE document_id = $1
      `,
      [documentId]
    );
    return result.rows[0];
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await deleteDocumentChunks(document.document_id);
  await deleteObject(document.s3_key);

  await withDb(async (client) => {
    await client.query(
      `
        DELETE FROM documents
        WHERE document_id = $1
      `,
      [document.document_id]
    );
  });

  return { documentId: document.document_id, deleted: true };
}

export async function listLogs() {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT
          log_id AS id,
          created_at AS timestamp,
          question,
          mode,
          answer
        FROM chat_logs
        ORDER BY created_at DESC
        LIMIT 200
      `
    );
    return result.rows;
  });
}

export async function addLog(entry) {
  return withDb(async (client) => {
    await client.query(
      `
        INSERT INTO chat_logs (log_id, question, mode, answer)
        VALUES ($1, $2, $3, $4)
      `,
      [newId("log"), entry.question, entry.mode, entry.answer]
    );
  });
}

async function countIndexedDocuments() {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM documents
        WHERE status = 'indexed'
      `
    );
    return result.rows[0]?.count ?? 0;
  });
}

export async function answerFromRag(question) {
  const indexedDocumentCount = await countIndexedDocuments();

  if (indexedDocumentCount === 0) {
    return {
      answer: "I could not find indexed uploaded documents yet. Please upload and index a PDF first.",
      sources: []
    };
  }

  const embedding = await createEmbedding(question);
  const chunks = await searchRelevantChunks(embedding);

  if (chunks.length === 0) {
    return {
      answer: "I could not find relevant uploaded documents yet. Please upload and index source material first.",
      sources: []
    };
  }

  const promptConfig = await getPromptConfig();
  const answer = await answerWithContext({
    systemPrompt: promptConfig.systemPrompt,
    question,
    contexts: chunks.map((chunk) => chunk.chunk_text)
  });

  const uniqueSources = new Map();
  for (const chunk of chunks) {
    if (!uniqueSources.has(chunk.s3_key)) {
      uniqueSources.set(chunk.s3_key, {
        title: chunk.title,
        s3Key: chunk.s3_key
      });
    }
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
    rdsHost: config.rds.host,
    openSearchEndpoint: config.openSearch.endpoint,
    s3Bucket: config.s3.bucket,
    bedrockChatModelId: config.bedrock.chatModelId,
    bedrockEmbedModelId: config.bedrock.embedModelId
  };
}

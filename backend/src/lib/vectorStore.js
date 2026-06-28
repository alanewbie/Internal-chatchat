import { withDb } from "./db.js";

function normalizeVector(value) {
  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value === "string") {
    return JSON.parse(value).map(Number);
  }

  return [];
}

function cosineSimilarity(left, right) {
  if (left.length === 0 || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export async function indexDocumentChunks(chunks) {
  if (chunks.length === 0) {
    return;
  }

  const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))];

  await withDb(async (client) => {
    await client.query("BEGIN");

    try {
      await client.query("DELETE FROM document_chunks WHERE document_id = ANY($1::text[])", [documentIds]);

      for (const chunk of chunks) {
        await client.query(
          `
            INSERT INTO document_chunks (
              chunk_id,
              document_id,
              title,
              s3_key,
              chunk_text,
              embedding
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            chunk.chunkId,
            chunk.documentId,
            chunk.title,
            chunk.s3Key,
            chunk.chunkText,
            JSON.stringify(chunk.vector)
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function searchRelevantChunks(queryVector, size = 4) {
  const query = normalizeVector(queryVector);

  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT document_id, title, s3_key, chunk_text, embedding
        FROM document_chunks
      `
    );

    return result.rows
      .map((row) => ({
        document_id: row.document_id,
        title: row.title,
        s3_key: row.s3_key,
        chunk_text: row.chunk_text,
        score: cosineSimilarity(query, normalizeVector(row.embedding))
      }))
      .filter((row) => Number.isFinite(row.score))
      .sort((left, right) => right.score - left.score)
      .slice(0, size);
  });
}

export async function deleteDocumentChunks(documentId) {
  await withDb(async (client) => {
    await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);
  });
}

import "dotenv/config";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { config } from "../config.js";

export const openSearchClient = new Client({
  ...AwsSigv4Signer({
    region: config.openSearch.region,
    service: "es",
    getCredentials: () => defaultProvider()()
  }),
  node: config.openSearch.endpoint,
  maxRetries: 1,
  requestTimeout: 15_000
});

let indexEnsured = false;

export async function ensureVectorIndex() {
  if (indexEnsured || !config.openSearch.endpoint || !config.openSearch.embeddingDimension) {
    return;
  }

  const exists = await openSearchClient.indices.exists({
    index: config.openSearch.vectorIndex
  });

  if (!exists.body) {
    await openSearchClient.indices.create({
      index: config.openSearch.vectorIndex,
      body: {
        settings: {
          index: {
            knn: true
          }
        },
        mappings: {
          properties: {
            vector: {
              type: "knn_vector",
              dimension: config.openSearch.embeddingDimension
            },
            document_id: { type: "keyword" },
            title: { type: "text" },
            s3_key: { type: "keyword" },
            chunk_text: { type: "text" }
          }
        }
      }
    });
  }

  indexEnsured = true;
}

export async function searchRelevantChunks(vector, size = 4) {
  await ensureVectorIndex();

  if (!config.openSearch.endpoint || !config.openSearch.embeddingDimension) {
    return [];
  }

  const response = await openSearchClient.search({
    index: config.openSearch.vectorIndex,
    body: {
      size,
      query: {
        knn: {
          vector: {
            vector,
            k: size
          }
        }
      },
      _source: ["document_id", "title", "s3_key", "chunk_text"]
    }
  });

  return response.body.hits.hits.map((hit) => hit._source);
}

export async function indexDocumentChunks(chunks) {
  await ensureVectorIndex();

  if (!chunks.length) {
    return;
  }

  const body = chunks.flatMap((chunk) => [
    {
      index: {
        _index: config.openSearch.vectorIndex,
        _id: chunk.chunkId
      }
    },
    {
      document_id: chunk.documentId,
      title: chunk.title,
      s3_key: chunk.s3Key,
      chunk_text: chunk.chunkText,
      vector: chunk.vector
    }
  ]);

  await openSearchClient.bulk({
    refresh: true,
    body
  });
}

export async function deleteDocumentChunks(documentId) {
  await ensureVectorIndex();

  await openSearchClient.deleteByQuery({
    index: config.openSearch.vectorIndex,
    refresh: true,
    body: {
      query: {
        term: {
          document_id: documentId
        }
      }
    }
  });
}

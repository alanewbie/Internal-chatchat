import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";
import { Signer } from "@aws-sdk/rds-signer";
import { config } from "../config.js";

const { Client } = pg;

const schemaSql = `
CREATE TABLE IF NOT EXISTS faq_entries (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  config_key TEXT PRIMARY KEY,
  system_prompt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by TEXT
);

CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
ON document_chunks (document_id);

CREATE TABLE IF NOT EXISTS chat_logs (
  log_id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  mode TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

let schemaInitialized = false;

function buildSigner() {
  return new Signer({
    region: config.awsRegion,
    hostname: config.rds.host,
    port: config.rds.port,
    username: config.rds.user
  });
}

async function createClient() {
  const password = config.rds.useIamAuth ? await buildSigner().getAuthToken() : process.env.RDS_PASSWORD;

  return new Client({
    host: config.rds.host,
    port: config.rds.port,
    database: config.rds.database,
    user: config.rds.user,
    password,
    ssl: config.rds.sslMode === "require" ? { rejectUnauthorized: false } : undefined
  });
}

async function seedDefaults(client) {
  await client.query(
    `
      INSERT INTO app_config (config_key, system_prompt)
      VALUES ('system', $1)
      ON CONFLICT (config_key) DO NOTHING
    `,
    ["You are an internal HR and IT assistant. Answer clearly, be concise, and prefer approved internal guidance."]
  );

  await client.query(
    `
      INSERT INTO faq_entries (id, question, answer, tags)
      VALUES
        ('faq-seed-1', 'How do I reset my VPN password?', 'Open the IT portal, choose Password Reset, and follow the MFA verification steps.', ARRAY['it', 'vpn', 'password']),
        ('faq-seed-2', 'How do I request annual leave?', 'Submit your leave request in Workday and notify your line manager for approval.', ARRAY['hr', 'leave'])
      ON CONFLICT (id) DO NOTHING
    `
  );
}

export async function withDb(work) {
  const client = await createClient();
  await client.connect();

  try {
    if (!schemaInitialized) {
      await client.query(schemaSql);
      await seedDefaults(client);
      schemaInitialized = true;
    }

    return await work(client);
  } finally {
    await client.end();
  }
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

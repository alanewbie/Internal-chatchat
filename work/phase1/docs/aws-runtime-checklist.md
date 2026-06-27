# AWS Runtime Checklist

Current project root:
- `/Users/alant/Documents/Codex/2026-06-26/Internal chatchat`

Current AWS services selected:
- `Aurora and RDS` with `Amazon Aurora PostgreSQL`
- `Amazon OpenSearch Service`
- `Amazon S3`

Provided values:
- Region: `us-east-1`
- Aurora host: `database-1-instance-1.c2hkuqg2i7op.us-east-1.rds.amazonaws.com`
- Aurora database: `postgres`
- Aurora user: `postgres`
- OpenSearch domain ARN: `arn:aws:es:us-east-1:379683255100:domain/internalfile`
- S3 bucket: `rag-files-folder`
- S3 prefix: `uploads/`
- Private downloads: `yes`

Still needed before backend wiring:
- OpenSearch endpoint URL
- OpenSearch index name confirmation if you want something other than `internal-chatchat-vectors`
- Cognito user pool ID and app client ID, if auth wiring starts now

Bedrock models selected:
- Chat model ID: `anthropic.claude-opus-4-5-20251101-v1:0`
- Embedding model ID: `amazon.titan-embed-text-v2:0`

Aurora note:
- Your connection snippet uses `aws rds generate-db-auth-token`, so the backend should use IAM database authentication instead of a static password.

OpenSearch note:
- The domain ARN alone is not enough for application calls. We also need the domain endpoint from `Amazon OpenSearch Service`.

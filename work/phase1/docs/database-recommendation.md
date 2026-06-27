# Database Recommendation

## Production recommendation

Use these three storage layers:

### 1. Relational data: Amazon Aurora PostgreSQL

Use Aurora PostgreSQL for:
- FAQ records
- prompt settings
- document metadata
- user chat logs
- admin audit logs
- future user feedback tables

Why Aurora PostgreSQL:
- relational data fits FAQ, settings, and logs very well
- strong consistency and SQL querying
- easy to model reports and joins later
- good long-term AWS architecture choice

### 2. Vector data: Amazon OpenSearch Serverless

Use OpenSearch Serverless vector collections for:
- chunk embeddings
- vector similarity search
- chunk-level retrieval metadata

Why OpenSearch Serverless:
- managed AWS-native vector search
- good fit for Bedrock-based RAG
- easier to explain and scale than running your own Redis cluster

### 3. Original files: Amazon S3

Use S3 for:
- uploaded PDF files
- source documents for RAG
- download targets for cited resources

## Local development recommendation

For local development:
- stop using in-memory data
- use SQLite or a file-backed local store first

If you want the cleanest next step, use:
- local: SQLite
- AWS target: Aurora PostgreSQL + OpenSearch Serverless + S3

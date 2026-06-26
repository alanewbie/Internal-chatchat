# Phase 1 Build Plan

## Decision summary

- Use Cognito, not IAM users, for email/password login.
- Use Bedrock for generation and embeddings.
- Use Amplify for frontend hosting.
- Use API Gateway + Lambda for the first backend.
- Use S3 for document storage.
- Use DynamoDB for FAQ and prompt storage.
- Use OpenSearch Serverless for vector search.
- Keep SageMaker AI out of the first cut unless a later need appears.

## MVP implementation order

1. Bootstrap frontend
   - login page
   - user chat page
   - admin navigation

2. Bootstrap backend
   - health endpoint
   - FAQ CRUD
   - prompt config CRUD
   - chat endpoint with placeholder response

3. Add auth
   - Cognito user pool
   - admin and user groups
   - protected routes

4. Add document upload
   - generate signed upload URL
   - upload file to S3
   - list uploaded files

5. Add ingestion
   - read uploaded file
   - chunk text
   - embed content
   - index vectors

6. Add Bedrock chat flow
   - FAQ first
   - RAG fallback
   - return citations

## Suggested first deliverable

The first working milestone should be:
- login works
- admin can create FAQ
- user can ask a question
- if it matches FAQ, the answer appears

This is the fastest way to get an end-to-end demo running before adding RAG.

## Suggested second deliverable

- admin uploads text documents
- ingestion indexes them
- user asks non-FAQ question
- system answers from document context and shows source links

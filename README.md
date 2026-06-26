# Internal HR/IT Assistant

This repository contains the Phase 1 MVP scaffold for an internal HR/IT assistant.

## Apps

- `frontend`: React app for user chat and admin management
- `backend`: Node API for FAQ-first chat, FAQ CRUD, prompt config, and document listing

## Phase 1 MVP target

The first working milestone is:
- email/password login UI
- admin can manage FAQs
- user can ask a question
- FAQ matches return an admin-defined answer

RAG is planned next, but the first code scaffold focuses on FAQ-first flow so we can get an end-to-end demo moving quickly.

## Planned AWS integration

- Amazon Cognito for login
- AWS Amplify for hosting
- API Gateway + Lambda or containerized API backend
- DynamoDB for FAQ and prompt config
- S3 for document storage
- Bedrock for generation and embeddings

## Quick structure

```text
frontend/
backend/
work/phase1/
```

## Next step

Install dependencies and run the two apps locally, then replace mock auth and mock storage with real AWS services.

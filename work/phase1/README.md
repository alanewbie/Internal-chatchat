# Internal HR/IT Assistant - Phase 1

This project is a simple internal virtual HR/IT assistant built on AWS.

Phase 1 goals:
- Admin can manage FAQ answers.
- Admin can upload documents for retrieval-augmented generation (RAG).
- Admin can edit the system prompt.
- End users can log in, ask questions, and receive answers.
- If the answer uses uploaded documents, the UI shows the source document and a download link.

## Phase 1 scope

We are intentionally keeping the first release simple:
- Authentication with Amazon Cognito email/password login
- Role separation for `admin` and `user`
- AWS Amplify-hosted frontend
- API backend on Amazon API Gateway + AWS Lambda
- Amazon Bedrock for text generation
- Amazon S3 for document storage
- Amazon DynamoDB for FAQ and prompt configuration
- Vector store kept simple with Amazon OpenSearch Serverless

## Why Cognito instead of IAM user login

We should not use IAM users for application login.

Use Amazon Cognito because it is designed for:
- email/password sign-in
- user session management
- access tokens and identity tokens
- integration with Amplify frontend apps
- separation between application users and AWS operators

IAM is for AWS resource access, not for end-user authentication to the app.

## Suggested Phase 1 architecture

1. User opens the Amplify-hosted web app.
2. User signs in through Cognito.
3. Frontend calls API Gateway.
4. Lambda checks FAQ first.
5. If FAQ does not match, Lambda performs RAG:
   - query vector index for relevant chunks
   - fetch source metadata
   - call Bedrock with prompt + retrieved context
6. API returns answer plus citations and S3 download links.

Admin flow:
1. Admin signs in through Cognito.
2. Admin manages FAQ entries and system prompt through the admin page.
3. Admin uploads documents to S3.
4. Upload event triggers ingestion worker.
5. Worker chunks text, creates embeddings, and stores vectors plus metadata.

## Service choices

- Frontend: AWS Amplify Hosting
- Authentication: Amazon Cognito
- API: Amazon API Gateway
- App logic: AWS Lambda
- LLM: Amazon Bedrock
- Document storage: Amazon S3
- Structured config: Amazon DynamoDB
- Vector search: Amazon OpenSearch Serverless
- Optional async ingestion compute: ECS or Lambda

## Notes on SageMaker AI

For Phase 1, SageMaker AI is not required.
Bedrock can cover the LLM layer and embeddings with less setup.

We can introduce SageMaker AI later for:
- custom embedding pipelines
- evaluation workflows
- model experimentation
- advanced document processing

## Next build steps

1. Define the data model and API contract.
2. Define the document ingestion flow.
3. Scaffold frontend pages for login, user chat, and admin console.
4. Scaffold backend APIs and placeholder Bedrock integration.
5. Add infrastructure as code.

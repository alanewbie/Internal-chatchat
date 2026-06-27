import "dotenv/config";

function requireEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

export const config = {
  awsRegion: requireEnv("AWS_REGION", "us-east-1"),
  rds: {
    host: requireEnv("RDS_HOST"),
    port: Number(requireEnv("RDS_PORT", "5432")),
    database: requireEnv("RDS_DATABASE", "postgres"),
    user: requireEnv("RDS_USER", "postgres"),
    sslMode: requireEnv("RDS_SSLMODE", "require"),
    useIamAuth: requireEnv("RDS_USE_IAM_AUTH", "true") === "true"
  },
  openSearch: {
    region: requireEnv("OPENSEARCH_REGION", "us-east-1"),
    domainArn: requireEnv("OPENSEARCH_DOMAIN_ARN"),
    endpoint: requireEnv(
      "OPENSEARCH_ENDPOINT",
      "https://vpc-mydomain-rxg54uahgjrmy3bgoxgi2swbtm.us-east-1.es.amazonaws.com"
    ),
    vectorIndex: requireEnv("OPENSEARCH_VECTOR_INDEX", "internal-chatchat-vectors"),
    embeddingDimension: Number(requireEnv("OPENSEARCH_EMBEDDING_DIMENSION", "1024"))
  },
  s3: {
    bucket: requireEnv("S3_BUCKET"),
    region: requireEnv("S3_REGION", "us-east-1"),
    uploadPrefix: requireEnv("S3_UPLOAD_PREFIX", "uploads/"),
    privateDownloads: requireEnv("S3_PRIVATE_DOWNLOADS", "true") === "true"
  },
  bedrock: {
    region: requireEnv("BEDROCK_REGION", "us-east-1"),
    chatModelId: requireEnv("BEDROCK_CHAT_MODEL_ID", "anthropic.claude-opus-4-5-20251101-v1:0"),
    embedModelId: requireEnv("BEDROCK_EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")
  },
  cognito: {
    region: requireEnv("COGNITO_REGION", "us-east-1"),
    userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
    appClientId: requireEnv("COGNITO_APP_CLIENT_ID")
  }
};

export type ChatResponse = {
  answer: string;
  mode: "faq" | "rag";
  sources: Array<{ title: string; url: string }>;
};

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

export type PromptConfig = {
  systemPrompt: string;
};

export type DocumentRecord = {
  id: string;
  title: string;
  fileName: string;
  url: string;
  status: string;
};

export type LogRecord = {
  id: string;
  timestamp: string;
  question: string;
  mode: "faq" | "rag";
  answer: string;
};

export type UploadDocumentResponse = {
  documentId: string;
  s3Key: string;
  uploadUrl: string;
};

export type IndexDocumentResponse = {
  documentId: string;
  indexedChunks: number;
  status: string;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "https://in-2c1ae487a2ab4bbc9f7e6f3944c712e5.ecs.us-east-1.on.aws";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ADMIN_TOKEN = localStorage.getItem("internal-chatchat-admin-token")?.trim();
  const adminHeaders = path.startsWith("/admin/") && ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {};

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders,
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function askQuestion(question: string) {
  return request<ChatResponse>("/chat/ask", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export function loadFaqs() {
  return request<{ items: FaqEntry[] }>("/admin/faqs");
}

export function createFaq(entry: Omit<FaqEntry, "id">) {
  return request<FaqEntry>("/admin/faqs", {
    method: "POST",
    body: JSON.stringify(entry)
  });
}

export function loadPrompt() {
  return request<PromptConfig>("/admin/prompt");
}

export function savePrompt(systemPrompt: string) {
  return request<PromptConfig>("/admin/prompt", {
    method: "PUT",
    body: JSON.stringify({ systemPrompt })
  });
}

export function loadDocuments() {
  return request<{ items: DocumentRecord[] }>("/admin/documents");
}

export function loadLogs() {
  return request<{ items: LogRecord[] }>("/admin/logs");
}

export function createDocumentUpload(input: {
  title: string;
  fileName: string;
  contentType: string;
  uploadedBy: string;
}) {
  return request<UploadDocumentResponse>("/admin/documents/upload-url", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function uploadFileToSignedUrl(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/pdf"
    },
    body: file
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

export function indexDocument(documentId: string) {
  return request<IndexDocumentResponse>("/admin/documents/index", {
    method: "POST",
    body: JSON.stringify({ documentId })
  });
}

export function deleteDocument(documentId: string) {
  return request<{ documentId: string; deleted: boolean }>(`/admin/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE"
  });
}

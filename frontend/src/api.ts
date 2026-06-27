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

const API_BASE = "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
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

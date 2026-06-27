import { FormEvent, useEffect, useState } from "react";
import {
  askQuestion,
  createDocumentUpload,
  createFaq,
  indexDocument,
  loadDocuments,
  loadFaqs,
  loadLogs,
  loadPrompt,
  savePrompt,
  uploadFileToSignedUrl,
  type ChatResponse,
  type DocumentRecord,
  type FaqEntry,
  type LogRecord
} from "./api";

type Role = "user" | "admin";
type AdminView = "overview" | "faq" | "rag" | "logs" | "prompt";

const mockUsers = {
  "admin@example.com": "admin",
  "user@example.com": "user"
} as const;

export function App() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [adminView, setAdminView] = useState<AdminView>("overview");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqTags, setFaqTags] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [status, setStatus] = useState("Ready.");

  useEffect(() => {
    if (role === "admin") {
      void refreshAdminData();
    }
  }, [role]);

  async function refreshAdminData() {
    const [faqData, promptData, documentData, logData] = await Promise.all([
      loadFaqs(),
      loadPrompt(),
      loadDocuments(),
      loadLogs()
    ]);
    setFaqs(faqData.items);
    setSystemPrompt(promptData.systemPrompt);
    setDocuments(documentData.items);
    setLogs(logData.items);
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRole = mockUsers[email as keyof typeof mockUsers];

    if (!nextRole || password.length === 0) {
      setStatus("Use admin@example.com or user@example.com with any password.");
      return;
    }

    setRole(nextRole);
    setStatus(`Signed in as ${nextRole}. Replace this mock login with Cognito.`);
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await askQuestion(question);
    setChat(result);
    setStatus(`Answered in ${result.mode.toUpperCase()} mode.`);
    if (role === "admin") {
      await refreshAdminData();
    }
  }

  async function handleCreateFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createFaq({
      question: faqQuestion,
      answer: faqAnswer,
      tags: faqTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqTags("");
    await refreshAdminData();
    setStatus("FAQ created.");
  }

  async function handleSavePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await savePrompt(systemPrompt);
    setStatus("Prompt saved.");
  }

  async function handleUploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setStatus("Choose a PDF file first.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Only PDF upload is enabled in this admin step.");
      return;
    }

    setIsUploadingDocument(true);

    try {
      const upload = await createDocumentUpload({
        title: documentTitle.trim() || selectedFile.name.replace(/\.pdf$/i, ""),
        fileName: selectedFile.name,
        contentType: selectedFile.type || "application/pdf",
        uploadedBy: email
      });

      await uploadFileToSignedUrl(upload.uploadUrl, selectedFile);
      const indexed = await indexDocument(upload.documentId);

      setDocumentTitle("");
      setSelectedFile(null);
      await refreshAdminData();
      setStatus(`PDF uploaded and indexed. ${indexed.indexedChunks} chunks are ready for RAG.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  function handleLogout() {
    setRole(null);
    setAdminView("overview");
    setQuestion("");
    setChat(null);
    setStatus("Logged out.");
  }

  function renderAdminPanel() {
    if (adminView === "faq") {
      return (
        <section className="admin-content">
          <h2>FAQ setting</h2>
          <p className="hint">List all FAQ first. Admin can add and adjust later.</p>
          <form onSubmit={handleCreateFaq} className="stack compact-form">
            <input
              value={faqQuestion}
              onChange={(event) => setFaqQuestion(event.target.value)}
              placeholder="FAQ question"
            />
            <textarea
              rows={4}
              value={faqAnswer}
              onChange={(event) => setFaqAnswer(event.target.value)}
              placeholder="FAQ answer"
            />
            <input
              value={faqTags}
              onChange={(event) => setFaqTags(event.target.value)}
              placeholder="tags: hr, leave"
            />
            <button type="submit">Add FAQ</button>
          </form>
          <div className="data-list">
            {faqs.map((faq) => (
              <div key={faq.id} className="data-card">
                <strong>{faq.question}</strong>
                <p>{faq.answer}</p>
                <span>{faq.tags.join(", ")}</span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (adminView === "rag") {
      return (
        <section className="admin-content">
          <h2>RAG resource</h2>
          <p className="hint">Upload a PDF, then this backend extracts text, creates embeddings, and stores vectors for RAG.</p>
          <form onSubmit={handleUploadDocument} className="stack compact-form upload-form">
            <input
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Document title"
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <button type="submit" disabled={isUploadingDocument}>
              {isUploadingDocument ? "Uploading..." : "Upload PDF and index"}
            </button>
          </form>
          <div className="data-list">
            {documents.map((document) => (
              <div key={document.id} className="data-card">
                <strong>{document.title}</strong>
                <p>{document.fileName}</p>
                <span>Status: {document.status}</span>
                <a href={document.url} target="_blank" rel="noreferrer">
                  Download source
                </a>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (adminView === "logs") {
      return (
        <section className="admin-content">
          <h2>User log</h2>
          <p className="hint">Read-only audit of chat requests and answer mode.</p>
          <div className="data-list">
            {logs.map((log) => (
              <div key={log.id} className="data-card">
                <strong>{log.question}</strong>
                <p>{log.answer}</p>
                <span>
                  {log.mode.toUpperCase()} | {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (adminView === "prompt") {
      return (
        <section className="admin-content">
          <h2>Prompt setting</h2>
          <p className="hint">Single system prompt for the assistant.</p>
          <form onSubmit={handleSavePrompt} className="stack compact-form">
            <textarea
              rows={12}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
            <button type="submit">Save prompt</button>
          </form>
        </section>
      );
    }

    return (
      <section className="admin-content">
        <h2>Dashboard</h2>
        <p>This area changes based on the service admin wants to manage.</p>
        <div className="overview-grid">
          <div className="overview-box">FAQ count: {faqs.length}</div>
          <div className="overview-box">RAG files: {documents.length}</div>
          <div className="overview-box">User logs: {logs.length}</div>
          <div className="overview-box">Prompt ready</div>
        </div>
      </section>
    );
  }

  if (!role) {
    return (
      <main className="page login-page">
        <div className="frame login-frame">
          <h1>Internal Chatchat</h1>
          <form onSubmit={handleLogin} className="stack">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
            />
            <button type="submit">Login</button>
          </form>
          <p className="hint">{status}</p>
        </div>
      </main>
    );
  }

  if (role === "user") {
    return (
      <main className="page">
        <div className="frame">
          <div className="frame-header">
            <h1>Internal Chatchat</h1>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <div className="user-layout">
            <section className="conversation-panel">
              <div className="conversation-box">
                {chat ? (
                  <>
                    <div className="conversation-title">Conversation</div>
                    <p className="bubble user-bubble">{question}</p>
                    <p className="bubble assistant-bubble">{chat.answer}</p>
                  </>
                ) : (
                  <div className="placeholder">Conversation</div>
                )}
              </div>
              <form onSubmit={handleAsk} className="input-row">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="User insert"
                />
              </form>
            </section>
            <aside className="resource-panel">
              <div className="sidebar-title">Additional info (EX: RAG resource)</div>
              {chat?.sources.length ? (
                <ul className="resource-list">
                  {chat.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url}>{source.title}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No additional source yet.</p>
              )}
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="frame">
        <div className="admin-layout">
          <aside className="admin-nav">
            <h1>Chatchat admin</h1>
            <button type="button" className="nav-item" onClick={() => setAdminView("overview")}>
              Dashboard
            </button>
            <button type="button" className="nav-item" onClick={() => setAdminView("faq")}>
              FAQ setting
            </button>
            <button type="button" className="nav-item" onClick={() => setAdminView("rag")}>
              RAG resource
            </button>
            <button type="button" className="nav-item" onClick={() => setAdminView("logs")}>
              User log
            </button>
            <button type="button" className="nav-item" onClick={() => setAdminView("prompt")}>
              Prompt setting
            </button>
            <button type="button" className="nav-item logout-item" onClick={handleLogout}>
              Log out
            </button>
          </aside>
          <section className="admin-main">{renderAdminPanel()}</section>
        </div>
      </div>
      <p className="footnote">{status}</p>
    </main>
  );
}

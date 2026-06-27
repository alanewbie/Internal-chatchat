import { FormEvent, useEffect, useState } from "react";
import {
  askQuestion,
  createFaq,
  loadFaqs,
  loadPrompt,
  savePrompt,
  type ChatResponse,
  type FaqEntry
} from "./api";

type Role = "user" | "admin";

const mockUsers = {
  "admin@example.com": "admin",
  "user@example.com": "user"
} as const;

export function App() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqTags, setFaqTags] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [status, setStatus] = useState("Ready.");

  useEffect(() => {
    if (role !== "admin") {
      return;
    }

    void refreshAdminData();
  }, [role]);

  async function refreshAdminData() {
    const [faqData, promptData] = await Promise.all([loadFaqs(), loadPrompt()]);
    setFaqs(faqData.items);
    setSystemPrompt(promptData.systemPrompt);
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRole = mockUsers[email as keyof typeof mockUsers];

    if (!nextRole || password.length === 0) {
      setStatus("Use admin@example.com or user@example.com with any password.");
      return;
    }

    setRole(nextRole);
    setStatus(`Signed in as ${nextRole}. Replace this with Cognito next.`);
  }

  function handleLogout() {
    setRole(null);
    setPassword("");
    setQuestion("");
    setChat(null);
    setFaqs([]);
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqTags("");
    setSystemPrompt("");
    setStatus("Signed out. Choose admin@example.com or user@example.com to switch roles.");
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Checking FAQs and preparing answer...");
    const result = await askQuestion(question);
    setChat(result);
    setStatus(`Answered in ${result.mode.toUpperCase()} mode.`);
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
    setStatus("System prompt saved.");
  }

  if (!role) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Phase 1 MVP</p>
          <h1>Internal HR/IT Assistant</h1>
          <p className="lede">
            FAQ-first support assistant with a path to Bedrock-powered RAG.
          </p>
        </section>
        <section className="panel auth-panel">
          <h2>Sign In</h2>
          <p className="muted">
            Mock login for scaffold stage. We will replace this with Cognito.
          </p>
          <form onSubmit={handleLogin} className="stack">
            <label>
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Any non-empty value"
              />
            </label>
            <button type="submit">Enter Workspace</button>
          </form>
          <p className="status">{status}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell app-shell">
      <section className="hero compact hero-bar">
        <div>
          <p className="eyebrow">Signed in as {role}</p>
          <h1>Internal HR/IT Assistant</h1>
          <p className="lede">
            Phase 1 flow: FAQ first, then RAG fallback when we add document retrieval.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={handleLogout}>
          Log Out
        </button>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>User Chat</h2>
          <form onSubmit={handleAsk} className="stack">
            <label>
              <span>Ask a question</span>
              <textarea
                rows={5}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How do I reset my VPN password?"
              />
            </label>
            <button type="submit">Ask Assistant</button>
          </form>

          {chat ? (
            <div className="answer">
              <p className="badge">{chat.mode.toUpperCase()}</p>
              <p>{chat.answer}</p>
              {chat.sources.length > 0 ? (
                <ul className="sources">
                  {chat.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url}>{source.title}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No source documents returned in this response.</p>
              )}
            </div>
          ) : null}
        </div>

        {role === "admin" ? (
          <>
            <div className="panel">
              <h2>FAQ Admin</h2>
              <form onSubmit={handleCreateFaq} className="stack">
                <label>
                  <span>Question</span>
                  <input
                    value={faqQuestion}
                    onChange={(event) => setFaqQuestion(event.target.value)}
                    placeholder="How do I request annual leave?"
                  />
                </label>
                <label>
                  <span>Answer</span>
                  <textarea
                    rows={4}
                    value={faqAnswer}
                    onChange={(event) => setFaqAnswer(event.target.value)}
                    placeholder="Submit the request in Workday and notify your manager."
                  />
                </label>
                <label>
                  <span>Tags</span>
                  <input
                    value={faqTags}
                    onChange={(event) => setFaqTags(event.target.value)}
                    placeholder="hr, leave"
                  />
                </label>
                <button type="submit">Create FAQ</button>
              </form>

              <div className="list">
                {faqs.map((faq) => (
                  <article key={faq.id} className="list-item">
                    <h3>{faq.question}</h3>
                    <p>{faq.answer}</p>
                    <p className="muted">{faq.tags.join(", ")}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Prompt Admin</h2>
              <form onSubmit={handleSavePrompt} className="stack">
                <label>
                  <span>System Prompt</span>
                  <textarea
                    rows={10}
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                  />
                </label>
                <button type="submit">Save Prompt</button>
              </form>
            </div>
          </>
        ) : null}
      </section>

      <p className="status">{status}</p>
    </main>
  );
}

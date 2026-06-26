const faqEntries = [
  {
    id: "faq-1",
    question: "How do I reset my VPN password?",
    answer: "Open the IT portal, choose Password Reset, and follow the MFA verification steps.",
    tags: ["it", "vpn", "password"]
  },
  {
    id: "faq-2",
    question: "How do I request annual leave?",
    answer: "Submit your leave request in Workday and notify your line manager for approval.",
    tags: ["hr", "leave"]
  }
];

const promptConfig = {
  systemPrompt:
    "You are an internal HR and IT assistant. Answer clearly, be concise, and prefer approved internal guidance."
};

export function listFaqs() {
  return faqEntries;
}

export function addFaq({ question, answer, tags }) {
  const entry = {
    id: `faq-${faqEntries.length + 1}`,
    question,
    answer,
    tags
  };
  faqEntries.unshift(entry);
  return entry;
}

export function getPromptConfig() {
  return promptConfig;
}

export function setPromptConfig(systemPrompt) {
  promptConfig.systemPrompt = systemPrompt;
  return promptConfig;
}

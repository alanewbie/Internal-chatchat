function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function matchFaq(question, entries) {
  const questionTerms = new Set(normalize(question));
  let best = null;

  for (const entry of entries) {
    const candidateTerms = normalize(`${entry.question} ${entry.tags.join(" ")}`);
    let score = 0;

    for (const term of candidateTerms) {
      if (questionTerms.has(term)) {
        score += 1;
      }
    }

    if (!best || score > best.score) {
      best = {
        score,
        entry
      };
    }
  }

  if (!best || best.score < 2) {
    return null;
  }

  return best.entry;
}

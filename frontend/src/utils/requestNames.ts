// Real-life LLM request names — pools for random generation
const WRITING_REQUESTS = [
  'Write a cover letter for Google SWE role',
  'Draft an apology email to my manager',
  'Write a product description for wireless earbuds',
  'Create a LinkedIn bio for a data scientist',
  'Write a thank-you note after a job interview',
  'Draft a resignation letter with 2 weeks notice',
];

const CODE_REQUESTS = [
  'Debug Python segfault in my ML pipeline',
  'Review this SQL query for N+1 performance issues',
  'Generate unit tests for my React components',
  'Explain why my async function returns undefined',
  'Refactor this nested callback into async/await',
  'Fix memory leak in my Node.js Express server',
];

const CREATIVE_REQUESTS = [
  'Write a bedtime story about a robot who learned to dream',
  'Generate 5 startup name ideas for a fintech app',
  'Create a short poem about missing home',
  'Write dialogue for a detective thriller opening scene',
  'Give me 3 catchy slogans for an eco-friendly brand',
  'Write a toast speech for my best friend\'s wedding',
];

const KNOWLEDGE_REQUESTS = [
  'Explain quantum computing to a 10-year-old',
  'Summarize this 20-page legal contract in 5 bullets',
  'Translate "Good morning, how are you?" into Japanese',
  'What are the pros and cons of microservices vs monolith?',
  'Explain PagedAttention in simple terms',
  'Describe the difference between GPT-4 and Claude',
];

const DATA_REQUESTS = [
  'Analyze this CSV sales report and find trends',
  'Convert this JSON to a readable markdown table',
  'Write a Python script to scrape product prices',
  'Create a SQL schema for a multi-tenant SaaS app',
  'Generate mock user data for my database seed',
  'Write a regex to validate international phone numbers',
];

const ALL_REQUESTS = [
  ...WRITING_REQUESTS,
  ...CODE_REQUESTS,
  ...CREATIVE_REQUESTS,
  ...KNOWLEDGE_REQUESTS,
  ...DATA_REQUESTS,
];

let _usedIndices: Set<number> = new Set();

export function getRandomRequestName(): string {
  if (_usedIndices.size >= ALL_REQUESTS.length) _usedIndices.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * ALL_REQUESTS.length); }
  while (_usedIndices.has(idx));
  _usedIndices.add(idx);
  return ALL_REQUESTS[idx];
}

export function getRequestsByCategory() {
  return { WRITING_REQUESTS, CODE_REQUESTS, CREATIVE_REQUESTS, KNOWLEDGE_REQUESTS, DATA_REQUESTS };
}

// Emoji for request type
export function getRequestEmoji(name: string): string {
  if (CODE_REQUESTS.some(r => r === name)) return '💻';
  if (WRITING_REQUESTS.some(r => r === name)) return '✍️';
  if (CREATIVE_REQUESTS.some(r => r === name)) return '🎨';
  if (KNOWLEDGE_REQUESTS.some(r => r === name)) return '🧠';
  if (DATA_REQUESTS.some(r => r === name)) return '📊';
  return '📬';
}

// Short display name (truncated to 28 chars)
export function shortName(name: string, maxLen = 28): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

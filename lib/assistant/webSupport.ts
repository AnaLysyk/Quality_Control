import "server-only";

type WebSupportResult = {
  title: string;
  url?: string | null;
  snippet: string;
  source: string;
};

const WEB_INTENT_PATTERN = /\b(internet|web|google|pesquisa|pesquisar|buscar online|procura online|not[ií]cia|noticias|notícias|atual|hoje|agora|última|ultima|latest|documenta[cç][aã]o oficial|docs oficiais|site oficial|pre[cç]o|vers[aã]o atual)\b/i;
const URL_PATTERN = /https?:\/\/[^\s)]+/gi;

function compactText(value: unknown, max = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getUrls(message: string) {
  return Array.from(new Set(message.match(URL_PATTERN) ?? [])).slice(0, 3);
}

function hasUrl(message: string) {
  return /https?:\/\/[^\s)]+/i.test(message);
}

function cleanSearchQuery(message: string) {
  return message
    .replace(URL_PATTERN, " ")
    .replace(/\b(pesquisa|pesquisar|busca|buscar|procura|procurar|na internet|no google|online|web)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageSummary(url: string): Promise<WebSupportResult | null> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "user-agent": "QualityControlAssistant/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || url;
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1]
      || stripHtml(html).slice(0, 900);
    return {
      title: compactText(stripHtml(title), 160),
      url,
      snippet: compactText(stripHtml(description), 700),
      source: "url",
    };
  } catch {
    return null;
  }
}

async function braveSearch(query: string): Promise<WebSupportResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !query) return [];
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
  const response = await fetchWithTimeout(url, {
    headers: { accept: "application/json", "x-subscription-token": apiKey },
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } } | null;
  return (payload?.web?.results ?? [])
    .map((item) => ({
      title: compactText(item.title, 160),
      url: item.url ?? null,
      snippet: compactText(item.description, 700),
      source: "brave",
    }))
    .filter((item) => item.title || item.snippet);
}

async function tavilySearch(query: string): Promise<WebSupportResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query) return [];
  const response = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: "basic" }),
  });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as { results?: Array<{ title?: string; url?: string; content?: string }> } | null;
  return (payload?.results ?? [])
    .map((item) => ({
      title: compactText(item.title, 160),
      url: item.url ?? null,
      snippet: compactText(item.content, 700),
      source: "tavily",
    }))
    .filter((item) => item.title || item.snippet);
}

async function duckDuckGoInstantAnswer(query: string): Promise<WebSupportResult[]> {
  if (!query) return [];
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    } | null;
    const results: WebSupportResult[] = [];
    if (payload?.AbstractText) {
      results.push({
        title: compactText(payload.Heading || query, 160),
        url: payload.AbstractURL ?? null,
        snippet: compactText(payload.AbstractText, 700),
        source: "duckduckgo",
      });
    }
    for (const topic of payload?.RelatedTopics?.slice(0, 4) ?? []) {
      if (!topic.Text) continue;
      results.push({ title: compactText(topic.Text.split(" - ")[0] || query, 160), url: topic.FirstURL ?? null, snippet: compactText(topic.Text, 700), source: "duckduckgo" });
    }
    return results;
  } catch {
    return [];
  }
}

export function shouldUseWebSupport(message: string) {
  const text = String(message ?? "").trim();
  if (!text) return false;
  return hasUrl(text) || WEB_INTENT_PATTERN.test(text);
}

export async function buildWebSupportContext(message: string) {
  const query = cleanSearchQuery(message);
  const urls = getUrls(message);
  const pageResults = (await Promise.all(urls.map((url) => fetchPageSummary(url)))).filter(Boolean) as WebSupportResult[];
  let searchResults: WebSupportResult[] = [];

  if (query) {
    searchResults = await braveSearch(query).catch(() => []);
    if (searchResults.length === 0) searchResults = await tavilySearch(query).catch(() => []);
    if (searchResults.length === 0) searchResults = await duckDuckGoInstantAnswer(query).catch(() => []);
  }

  const results = [...pageResults, ...searchResults].slice(0, 7);
  if (results.length === 0) {
    return [
      "[Apoio externo/web]",
      "O usuário pediu apoio externo, mas não encontrei resultado externo disponível nesta execução.",
      "Se houver BRAVE_SEARCH_API_KEY ou TAVILY_API_KEY configurado, o assistente usará busca web. Links enviados pelo usuário são lidos diretamente quando acessíveis.",
    ].join("\n");
  }

  return [
    "[Apoio externo/web]",
    `Consulta interpretada: ${query || urls.join(", ")}`,
    ...results.map((item, index) => [
      `${index + 1}. ${item.title || "Fonte externa"}`,
      item.url ? `URL: ${item.url}` : null,
      `Resumo: ${item.snippet}`,
      `Fonte: ${item.source}`,
    ].filter(Boolean).join("\n")),
    "Use estes dados apenas como apoio. Priorize o Brain e o contexto interno do sistema quando houver conflito.",
  ].join("\n\n");
}

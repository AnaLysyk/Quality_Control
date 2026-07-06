export type BrainWebSearchResult = {
  title: string;
  url: string;
  content: string;
};

export type BrainWebSearchResponse = {
  enabled: boolean;
  provider: "tavily" | "serper" | "none";
  query: string;
  results: BrainWebSearchResult[];
  warning?: string;
};

type TavilyItem = { title?: string; url?: string; content?: string; snippet?: string };
type SerperItem = { title?: string; link?: string; snippet?: string };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeResults(items: unknown[], provider: "tavily" | "serper") {
  return items
    .map((item) => {
      const record = item as TavilyItem & SerperItem;
      return {
        title: clean(record.title) || "Resultado sem título",
        url: provider === "serper" ? clean(record.link) : clean(record.url),
        content: clean(record.content) || clean(record.snippet),
      };
    })
    .filter((item) => item.url || item.content)
    .slice(0, 5);
}

export function isWeatherIntent(message: string) {
  const text = normalizeText(message);
  return /\b(clima|tempo|previsao|temperatura|chuva|frio|calor)\b/.test(text);
}

export function isCurrentExternalIntent(message: string) {
  const text = normalizeText(message);
  return /\b(internet|web|online|pesquisa|pesquisar|busca|buscar|noticia|noticias|atual|atualizado|hoje|agora|recente|recentes)\b/.test(text);
}

export function shouldUseWebSearch(message: string) {
  return isWeatherIntent(message) || isCurrentExternalIntent(message);
}

export function buildWebSearchQuery(message: string) {
  const raw = clean(message);
  if (isWeatherIntent(raw) && !/\b(em|para|porto alegre|sao paulo|rio de janeiro|brasilia|curitiba|florianopolis)\b/i.test(raw)) {
    return `${raw} Brasil previsão do tempo hoje`;
  }
  return raw;
}

export async function searchBrainWeb(query: string): Promise<BrainWebSearchResponse> {
  const searchQuery = buildWebSearchQuery(query);
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;

  if (tavilyKey) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: tavilyKey, query: searchQuery, max_results: 5, search_depth: "basic" }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Tavily falhou: ${response.status}`);
    const payload = (await response.json()) as { results?: TavilyItem[] };
    return { enabled: true, provider: "tavily", query: searchQuery, results: normalizeResults(payload.results ?? [], "tavily") };
  }

  if (serperKey) {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
      body: JSON.stringify({ q: searchQuery, num: 5 }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Serper falhou: ${response.status}`);
    const payload = (await response.json()) as { organic?: SerperItem[] };
    return { enabled: true, provider: "serper", query: searchQuery, results: normalizeResults(payload.organic ?? [], "serper") };
  }

  return {
    enabled: false,
    provider: "none",
    query: searchQuery,
    results: [],
    warning: "Busca web disponível quando TAVILY_API_KEY ou SERPER_API_KEY estiver configurada no ambiente.",
  };
}

export function formatWebSearchForBrain(search: BrainWebSearchResponse) {
  if (!search.enabled) return search.warning ?? "Busca web não configurada.";
  if (!search.results.length) return "Busquei na web, mas não encontrei resultados úteis.";
  return search.results
    .map((item, index) => `${index + 1}. ${item.title}\n${item.content}\n${item.url}`)
    .join("\n\n");
}

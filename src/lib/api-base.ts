/**
 * Decide para onde vão as chamadas "/api/...".
 *
 * - Com VITE_API_URL definido (arquivo .env): vão para o seu backend real,
 *   ex.: VITE_API_URL=https://meu-backend.com  →  https://meu-backend.com/api/empresas
 * - Sem VITE_API_URL: modo demo, respondidas pelo backend simulado em src/mock/.
 *
 * Funciona interceptando o fetch, então as páginas não precisam mudar.
 */
import { handleMockRequest } from "@/mock/server";

const API_URL =(import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") ?? "";

export const isDemoMode = API_URL === "";

function apiPath(input: RequestInfo | URL): URL | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/api") return null;
  return url;
}

export function installApiFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = apiPath(input);
    if (!url) return originalFetch(input, init);

    if (isDemoMode) {
      // Backend simulado carregado junto com o app (sem import dinâmico, que falhava no StackBlitz).
      // Qualquer erro vira uma resposta 500 com a mensagem real, em vez de "Erro de conexão".
      try {
        return await handleMockRequest(url, init, input instanceof Request ? input : undefined);
      } catch (e) {
        console.error("[EFFIO demo] erro no backend simulado:", e);
        return new Response(JSON.stringify({ error: `Modo demo: ${e instanceof Error ? e.message : String(e)}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const target = `${API_URL}${url.pathname}${url.search}`;
    if (input instanceof Request) return originalFetch(new Request(target, input), init);
    return originalFetch(target, init);
  };
}

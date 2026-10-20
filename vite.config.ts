import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Configuração simples, sem dependências do Replit.
// Roda no StackBlitz, no seu computador (npm run dev) ou em qualquer host estático.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // O pacote do monorepo do Replit foi recriado dentro do projeto:
      "@workspace/api-client-react": path.resolve(__dirname, "src/lib/api-client"),
    },
    dedupe: ["react", "react-dom"],
  },
  // Analisa todas as páginas na inicialização, para o Vite não precisar
  // reotimizar dependências (e recarregar a página) no meio do uso — isso
  // acontecia no StackBlitz ao abrir telas novas pela primeira vez.
  optimizeDeps: {
    entries: ["index.html", "src/**/*.{ts,tsx}"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});

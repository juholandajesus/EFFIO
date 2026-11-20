import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { isDemoMode } from "@/lib/api-base";
import { DEMO_EMAIL, DEMO_SENHA } from "@/mock/seed";
import { useT } from "@/i18n";
import { resetDemoDb } from "@/mock/server";

/** Aviso discreto de que o app está usando dados de demonstração. */
export function DemoBanner() {
  const [aberto, setAberto] = useState(false);
  const { t } = useT();
  if (!isDemoMode) return null;

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md hover:bg-muted"
      >
        <FlaskConical className="h-3.5 w-3.5 text-primary" /> {t("demo.short")}
      </button>
    );
  }

  function resetar() {
    resetDemoDb();
    try {
      ["effio_token", "effio_refresh", "effio_user", "effio_empresa"].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.href = import.meta.env.BASE_URL + "login";
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-3 text-xs shadow-lg">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> {t("demo.title")}
        </span>
        <button onClick={() => setAberto(false)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-muted-foreground">
        {t("demo.body")}
      </p>
      <p className="mt-1.5 text-muted-foreground">
        Login: <span className="font-mono text-foreground">{DEMO_EMAIL}</span>
        <br />
        {t("login.password")}: <span className="font-mono text-foreground">{DEMO_SENHA}</span>
      </p>
      <button onClick={resetar} className="mt-2 font-medium text-primary hover:underline">
        {t("demo.reset")}
      </button>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { en, type Dict } from "./en";
import { pt } from "./pt";

export type Lang = "en" | "pt";
const DICTS: Record<Lang, Dict> = { en, pt };
const KEY = "effio_lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "pt") return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof Dict, vars?: Vars) => string;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: keyof Dict, vars?: Vars) => {
      let s: string = DICTS[lang][key] ?? en[key] ?? String(key);
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, locale: lang === "pt" ? "pt-BR" : "en-US" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="flex items-center rounded-md border text-xs font-semibold overflow-hidden" data-testid="lang-toggle">
      {(["en", "pt"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2 py-1 uppercase transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

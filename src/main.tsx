import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/archivo/wdth.css";
import "./index.css";
import "./vitrine.css";
import { installApiFetch } from "./lib/api-base";

// Redireciona as chamadas /api para o backend real (VITE_API_URL) ou para o modo demo.
installApiFetch();

createRoot(document.getElementById("root")!).render(<App />);

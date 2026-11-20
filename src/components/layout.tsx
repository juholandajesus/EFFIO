import { ReactNode } from "react";
import { useLocation } from "wouter";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EmpresaSelector } from "./empresa-selector";
import { CopilotPanel } from "./copilot-panel";
import { DemoBanner } from "./demo-banner";
import { LangToggle } from "@/i18n";

interface LayoutProps {
  children: ReactNode;
}

/** Screens that use the night "cinema" palette for the whole shell. */
const CINEMA = ["/inicio"];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const cinema = CINEMA.includes(location);
  return (
    <SidebarProvider>
      <div className={`flex min-h-screen w-full bg-background text-foreground ${cinema ? "cinema-shell" : ""}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="h-14 border-b flex items-center px-4 bg-card gap-3">
            <SidebarTrigger />
            <div className="hidden text-sm font-medium text-muted-foreground sm:block">EFFIO Cockpit</div>
            <div className="flex-1" />
            <EmpresaSelector />
            <LangToggle />
          </div>
          <div className={`flex-1 overflow-auto ${cinema ? "" : "p-6 pb-24"}`}>
            {children}
          </div>
        </main>
        <CopilotPanel />
        <DemoBanner />
      </div>
    </SidebarProvider>
  );
}

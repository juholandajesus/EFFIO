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

/** Screens that draw edge to edge (no page padding). */
const FULL_BLEED = ["/inicio"];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const bleed = FULL_BLEED.includes(location);
  return (
    <SidebarProvider>
      <div className="cinema-shell flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="app-topbar sticky top-0 z-20 flex h-14 items-center gap-3 px-4">
            <SidebarTrigger />
            
            <div className="flex-1" />
            <div className="min-w-0 shrink"><EmpresaSelector /></div>
            <div className="shrink-0"><LangToggle /></div>
          </div>
          <div className={`flex-1 overflow-auto ${bleed ? "" : "app-page px-[4%] py-8 pb-24 md:px-10"}`}>
            {children}
          </div>
        </main>
        <CopilotPanel />
        <DemoBanner />
      </div>
    </SidebarProvider>
  );
}

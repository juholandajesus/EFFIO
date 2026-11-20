import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EmpresaSelector } from "./empresa-selector";
import { CopilotPanel } from "./copilot-panel";
import { DemoBanner } from "./demo-banner";
import { LangToggle } from "@/i18n";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="h-14 border-b flex items-center px-4 bg-card gap-3">
            <SidebarTrigger />
            <div className="hidden text-sm font-medium text-muted-foreground sm:block">EFFIO Cockpit</div>
            <div className="flex-1" />
            <EmpresaSelector />
            <LangToggle />
          </div>
          <div className="flex-1 p-6 pb-24 overflow-auto">
            {children}
          </div>
        </main>
        <CopilotPanel />
        <DemoBanner />
      </div>
    </SidebarProvider>
  );
}

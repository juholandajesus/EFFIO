import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  requiredPerfil?: string[];
}

export function ProtectedRoute({ children, requiredPerfil }: Props) {
  const { isAuthenticated, usuario } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setTimeout(() => setLocation("/login"), 0);
    return null;
  }

  if (requiredPerfil && usuario && !requiredPerfil.includes(usuario.perfil)) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Sem permissão para acessar esta página.</p>
      </div>
    );
  }

  return <>{children}</>;
}

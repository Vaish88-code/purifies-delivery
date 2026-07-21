import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (isAuthenticated && user?.role === 'delivery') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

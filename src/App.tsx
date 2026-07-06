import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { FirebaseStatus } from "@shared/components/FirebaseStatus";
import { RequireDeliveryAuth } from "@/components/auth/RequireDeliveryAuth";

// Auth
import Login from "./pages/Login";

// Delivery Pages
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <FirebaseStatus />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login */}
            <Route path="/login" element={<Login />} />

            {/* Delivery Routes — all protected */}
            <Route path="/" element={<RequireDeliveryAuth><DeliveryDashboard /></RequireDeliveryAuth>} />

            {/* Catch-all */}
            <Route path="*" element={<RequireDeliveryAuth><DeliveryDashboard /></RequireDeliveryAuth>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { FirebaseStatus } from "@shared/components/FirebaseStatus";
import { RequireDeliveryAuth } from "@/components/auth/RequireDeliveryAuth";
import { GuestOnly } from "@/components/auth/GuestOnly";

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";

// Delivery Pages
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import DeliveryEarnings from "./pages/delivery/DeliveryEarnings";
import DeliveryPayoutHistory from "./pages/delivery/DeliveryPayoutHistory";

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
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />

            <Route path="/dashboard" element={<RequireDeliveryAuth><DeliveryDashboard /></RequireDeliveryAuth>} />
            <Route path="/earnings" element={<RequireDeliveryAuth><DeliveryEarnings /></RequireDeliveryAuth>} />
            <Route path="/payout-history" element={<RequireDeliveryAuth><DeliveryPayoutHistory /></RequireDeliveryAuth>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

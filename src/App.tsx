import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LinkGraphView from "./pages/LinkGraphView";
import InternalLinkGraphView from "./pages/InternalLinkGraphView";
import AboutShubhojit from "./pages/AboutShubhojit";
import CmsLogin from "./pages/CmsLogin";
import CmsDashboard from "./pages/CmsDashboard";
import { AppHeader } from "./components/AppHeader";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppHeader />
        <div className="pt-14">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/shubhojit-das" element={<AboutShubhojit />} />
            <Route path="/link-graph-view" element={<LinkGraphView />} />
            <Route path="/internal-link-graph-view" element={<InternalLinkGraphView />} />
            <Route path="/cms/login" element={<CmsLogin />} />
            <Route path="/cms" element={<CmsDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

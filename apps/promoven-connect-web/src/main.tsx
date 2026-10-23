import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { LoginPage, ForgotPage, ResetPage } from "./pages/AuthPages";
import { Portal } from "./pages/Portal";
import { InvitePage } from "./pages/Brokers";
import "./style.css";

// Capture the fragment before the Auth client inspects and clears callback fragments.
if (window.location.pathname === "/invite") {
  const invitation = new URLSearchParams(window.location.hash.slice(1)).get("invite");
  if (invitation && /^[a-f0-9]{64}$/.test(invitation)) {
    sessionStorage.setItem("connect-invite-token", invitation);
    window.history.replaceState(null, "", "/invite");
  }
}

function App() { return <BrowserRouter><AuthProvider><Routes>
  <Route path="/" element={<Navigate to="/connect" replace />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/forgot-password" element={<ForgotPage />} />
  <Route path="/reset-password" element={<ResetPage />} />
  <Route path="/invite" element={<InvitePage />} />
  <Route path="/invite/:token" element={<InvitePage />} />
  <Route path="/connect/*" element={<Portal />} />
  <Route path="*" element={<main className="state-page"><h1>Página não encontrada</h1><a href="/connect">Voltar ao portal</a></main>} />
</Routes></AuthProvider></BrowserRouter>; }
createRoot(document.getElementById("root")!).render(<App />);

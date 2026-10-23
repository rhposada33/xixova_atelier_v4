import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./style.css";
const PublicCatalog=lazy(()=>import("./pages/PublicCatalog").then(m=>({default:m.PublicCatalog})));
const PrivateApp=lazy(()=>import("./PrivateApp").then(m=>({default:m.PrivateApp})));

// Capture the fragment before the Auth client inspects and clears callback fragments.
if (window.location.pathname === "/invite") {
  const invitation = new URLSearchParams(window.location.hash.slice(1)).get("invite");
  if (invitation && /^[a-f0-9]{64}$/.test(invitation)) {
    sessionStorage.setItem("connect-invite-token", invitation);
    window.history.replaceState(null, "", "/invite");
  }
}

function App() { return <BrowserRouter><Suspense fallback={<main className="state-page" role="status">Carregando…</main>}><Routes>
  <Route path="/p/:publicSlug" element={<PublicCatalog/>}/>
  <Route path="/p/:publicSlug/u/:unitCode" element={<PublicCatalog/>}/>
  <Route path="/s/:shareToken" element={<PublicCatalog/>}/>
  <Route path="/*" element={<PrivateApp/>}/>
</Routes></Suspense></BrowserRouter>; }
createRoot(document.getElementById("root")!).render(<App />);

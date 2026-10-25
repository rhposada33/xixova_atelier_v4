import { createRoot } from "react-dom/client";
import "./style.css";
import "./remote.css";

// Deliberately has no dependency on Auth, APIs, catalogs or the local entrypoint.
function RemoteUnavailable() {
  return <main className="auth-layout remote-unavailable">
    <section className="auth-brand" aria-label="Promoven Connect">
      <a className="brand" href="https://www.promoven.online"><span className="brand-icon" aria-hidden="true">P</span> PROMOVEN <b>CONNECT</b></a>
      <div><p className="eyebrow">ECOSSISTEMA PROMOVEN</p><h2>Conexões que abrem novas possibilidades.</h2><p>Um espaço privado para aproximar incorporadoras e corretores.</p></div>
      <small>Promoven Connect</small>
    </section>
    <section className="auth-panel" aria-labelledby="availability-title">
      <div className="auth-card">
        <p className="eyebrow">{import.meta.env.VITE_CONNECT_ENV === "preview" ? "PRÉVIA PRIVADA" : "PROMOVEN CONNECT"}</p>
        <h1 id="availability-title">Estamos preparando seu acesso.</h1>
        <p className="subtle">O Connect ainda não está disponível neste ambiente. O acesso será liberado após a conclusão das validações.</p>
        <p className="notice" role="status">Nenhum cadastro ou atendimento comercial está disponível nesta página.</p>
        <a className="back-link" href="https://www.promoven.online">Visitar a Promoven <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<RemoteUnavailable />);

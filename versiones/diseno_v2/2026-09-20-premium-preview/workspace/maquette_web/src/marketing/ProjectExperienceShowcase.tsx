export function ProjectExperienceShowcase(){
  return <section className="project-experience" aria-labelledby="project-experience-title">
    <div className="project-experience-wrap">
      <header className="project-experience-heading">
        <h2 id="project-experience-title">Todo o projeto,<br/><em>em uma só<br/>experiência.</em></h2>
        <p>A navegação guia o comprador desde a fachada até cada ambiente. Uma experiência coerente, precisa e pensada para a sua marca.</p>
      </header>
      <div className="project-experience-images">
        <figure><img src="/marketing/promoven-interior.jpg" alt="Vista completa da distribuição interior de uma residência ilustrativa" width="1536" height="1024" loading="lazy"/></figure>
        <figure><img src="/marketing/promoven-detail.jpg" alt="Detalhe ilustrativo de sala integrada a uma varanda" width="1280" height="960" loading="lazy"/></figure>
      </div>
    </div>
  </section>;
}

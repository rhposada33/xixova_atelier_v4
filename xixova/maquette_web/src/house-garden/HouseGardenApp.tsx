import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { houseGarden, type Resource } from './config';
import './house-garden.css';

type Audience = 'buyer' | 'broker';
type Preview = 'plan' | 'gallery' | null;
const buyerRows = [
  ['apartments', houseGarden.rowLabels.buyer.apartments, 'building'],
  ['plans', houseGarden.rowLabels.buyer.plans, 'plan'],
  ['project', houseGarden.rowLabels.buyer.project, 'book'],
  ['location', houseGarden.rowLabels.buyer.location, 'pin'],
  ['contact', houseGarden.rowLabels.buyer.contact, 'whatsapp'],
] as const;
const brokerRows = [
  ['availability', houseGarden.rowLabels.broker.availability, 'table'],
  ['conditions', houseGarden.rowLabels.broker.conditions, 'percent'],
  ['materials', houseGarden.rowLabels.broker.materials, 'image'],
  ['book', houseGarden.rowLabels.broker.book, 'book'],
  ['contact', houseGarden.rowLabels.broker.contact, 'whatsapp'],
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    building: <><path d="M4 20V6l8-3v17M12 8h8v12M2 20h20M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2"/></>,
    plan: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v7h5v5h7M3 15h6v6"/></>,
    book: <><path d="M12 6c-2-2-5-2-9-2v15c4 0 7 0 9 2 2-2 5-2 9-2V4c-4 0-7 0-9 2Zm0 0v15"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    whatsapp: <><path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.7 2.5 2 4 4.5 5l1.4-1.2 1.5 1.3c-.7 2.4-2.1 2.7-4.5 1.5-2.5-1.2-4.2-3-5-5.5-.4-1.4 0-2.5 1.3-3l1.4 1.9Z"/></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></>,
    percent: <><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 19 19 5"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 3 3-3 6 6"/></>,
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.arrow}</svg>;
}

function External({ resource, children, className = '' }: { resource: Resource; children: ReactNode; className?: string }) {
  return resource.url ? <a className={className} href={resource.url} target="_blank" rel="noopener noreferrer">{children}<span className="hg-external" aria-hidden="true">↗</span></a> : null;
}

function BrandMark() {
  return <svg className="hg-mark" viewBox="0 0 46 46" role="img" aria-label="Marca House Garden"><path d="M23 23C17 17 17 9 23 2c6 7 6 15 0 21ZM20 27C10 27 4 22 3 14c9 0 16 5 17 13ZM26 27c1-8 8-13 17-13-1 8-7 13-17 13Z" fill="currentColor"/><path d="M23 23v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

export default function HouseGardenApp() {
  const [audience, setAudience] = useState<Audience>('buyer');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [openedRows, setOpenedRows] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<Preview>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    if (preview) dialogRef.current?.showModal();
  }, [preview]);

  function openPreview(kind: Exclude<Preview, null>, opener: HTMLElement, index = 0) {
    openerRef.current = opener;
    setGalleryIndex(index);
    setPreview(kind);
  }
  function closePreview() { dialogRef.current?.close(); }
  function finishPreview() {
    setPreview(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }
  function selectAudience(next: Audience) {
    setAudience(next);
    setOpenRow(null);
    setShareMessage('');
  }
  function toggleRow(key: string) {
    setOpenedRows(previous => new Set(previous).add(key));
    setOpenRow(previous => previous === key ? null : key);
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === 'ArrowRight' || event.key === 'End' ? 'broker' : event.key === 'ArrowLeft' || event.key === 'Home' ? 'buyer' : null;
    if (!next) return;
    event.preventDefault();
    selectAudience(next);
    document.getElementById(`hg-tab-${next}`)?.focus();
  }
  async function copyLink() {
    const url = `${location.origin}/demo/house-garden`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Link copiado.');
    } catch {
      setShareMessage(`Copie o link: ${url}`);
    }
  }
  async function share() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: 'House Garden', url: `${location.origin}/demo/house-garden` });
      setShareMessage('Link compartilhado.');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') await copyLink();
    }
  }
  const contact = houseGarden.contacts[audience];
  const rows = audience === 'buyer' ? buyerRows : brokerRows;
  const galleryItem = houseGarden.gallery[galleryIndex];
  const picture = preview === 'plan' ? houseGarden.plans[0] : galleryItem;

  function panel(id: string): ReactNode {
    switch (id) {
      case 'apartments': return <><p>{houseGarden.copy.apartmentsIntro}</p><p className="hg-note">{houseGarden.copy.otherBuilding}</p><Link className="hg-action" to={houseGarden.demoUrl}>Explorar demonstração 3D <Icon name="arrow"/></Link></>;
      case 'plans': return <><div className="hg-plan-grid">{houseGarden.plans.map((plan, index) => <article className="hg-plan-card" key={plan.label}>{plan.thumbnail ? <button className="hg-thumb" type="button" onClick={event => openPreview('plan', event.currentTarget)} aria-label={`Ampliar ${plan.label}`}><img src={plan.thumbnail} alt={`Miniatura da ${plan.label} de House Garden`} loading="lazy"/></button> : <div className="hg-missing-thumb" aria-hidden="true"><Icon name="plan"/></div>}<strong>{plan.label}</strong><small>{plan.note}</small>{plan.url && index === 0 ? <button className="hg-text-button" type="button" onClick={event => openPreview('plan', event.currentTarget)}>Ampliar planta</button> : <span className="hg-pending">Planta pendente</span>}</article>)}</div><External resource={houseGarden.tour} className="hg-action">Ver tour virtual</External><p className="hg-note">{houseGarden.copy.tourNote}</p></>;
      case 'project': return <><p>{houseGarden.copy.projectIntro}</p><button className="hg-action" type="button" onClick={event => openPreview('gallery', event.currentTarget)}>Abrir galeria <Icon name="arrow"/></button><External resource={houseGarden.book} className="hg-subaction">Abrir book digital</External><External resource={{ label: 'Site oficial', status: 'verified', url: houseGarden.siteUrl }} className="hg-subaction">Conhecer o site do projeto</External></>;
      case 'location': return <><p>{houseGarden.address}</p><a className="hg-action" href={houseGarden.mapUrl} target="_blank" rel="noopener noreferrer">Ver no mapa <span aria-hidden="true">↗</span></a><p className="hg-note">{houseGarden.copy.mapNote}</p></>;
      case 'contact': return <><p className="hg-note">Mensagem de exemplo</p><blockquote>{contact.message}</blockquote>{contact.number ? <a className="hg-action" href={`https://wa.me/${contact.number}?text=${encodeURIComponent(contact.message)}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp <span aria-hidden="true">↗</span></a> : <p className="hg-pending">{houseGarden.copy.pendingContact}</p>}</>;
      case 'availability': return <><p className="hg-demo-label">Dados demonstrativos</p><table className="hg-table"><thead><tr><th>Unidade</th><th>Tipo</th><th>Status</th></tr></thead><tbody>{houseGarden.availability.map(item => <tr key={item.unit}><td>{item.unit}</td><td>{item.type}</td><td>{item.status}</td></tr>)}</tbody></table><p className="hg-note">{houseGarden.copy.availabilityNote}</p></>;
      case 'conditions': return <><p className="hg-pending">{houseGarden.copy.pendingConditions}</p><p className="hg-note">{houseGarden.copy.conditionsNote}</p></>;
      case 'materials': return <div className="hg-materials"><h3>Imagens</h3><div className="hg-material-images">{houseGarden.gallery.map((item, index) => <button type="button" key={item.label} onClick={event => openPreview('gallery', event.currentTarget, index)}><img src={item.thumbnail} alt={`${item.label} · perspectiva ilustrativa`} loading="lazy"/><span>{item.label}</span></button>)}</div><h3>Vídeos e tour</h3><External resource={houseGarden.tour} className="hg-subaction">Abrir tour virtual</External><h3>Documentos</h3><External resource={houseGarden.book} className="hg-subaction">Abrir book digital (PDF)</External></div>;
      case 'book': return <><p>{houseGarden.copy.bookIntro}</p><External resource={houseGarden.book} className="hg-action">Abrir book digital (PDF)</External></>;
      default: return null;
    }
  }

  return <main className="hg" id="conteudo"><div className="hg-shell"><div className="hg-header"><span className="hg-demo-tag">Demonstração</span><BrandMark/><h1>{houseGarden.name}</h1><p>{houseGarden.subtitle}</p></div><div className="hg-card"><div className="hg-tabs" data-audience={audience} role="tablist" aria-label="Escolha seu perfil"><button type="button" role="tab" id="hg-tab-buyer" aria-selected={audience === 'buyer'} aria-controls="hg-content" tabIndex={audience === 'buyer' ? 0 : -1} onKeyDown={moveTab} onClick={() => selectAudience('buyer')}>Quero comprar</button><button type="button" role="tab" id="hg-tab-broker" aria-selected={audience === 'broker'} aria-controls="hg-content" tabIndex={audience === 'broker' ? 0 : -1} onKeyDown={moveTab} onClick={() => selectAudience('broker')}>Sou corretor</button></div><div key={audience} id="hg-content" role="tabpanel" aria-labelledby={`hg-tab-${audience}`} className="hg-rows">{rows.map(([id, label, icon]) => { const key = `${audience}-${id}`, expanded = openRow === key; return <section className="hg-row" key={key}><h2><button id={`hg-control-${key}`} type="button" className={`hg-row-button ${id === 'contact' ? 'hg-contact-row' : ''}`} aria-expanded={expanded} aria-controls={`hg-panel-${key}`} onClick={() => toggleRow(key)}><Icon name={icon}/><span>{label}</span><Icon name="arrow"/></button></h2><div className={`hg-panel ${expanded ? 'is-open' : ''}`} id={`hg-panel-${key}`} role="region" aria-labelledby={`hg-control-${key}`} aria-hidden={!expanded} inert={!expanded}><div className="hg-panel-clip"><div className="hg-panel-inner">{openedRows.has(key) && panel(id)}</div></div></div></section>; })}</div><div className="hg-share"><button type="button" onClick={share}><Icon name="share"/> Compartilhar</button><button type="button" onClick={copyLink}><Icon name="copy"/> Copiar link</button><span role="status" aria-live="polite">{shareMessage}</span></div></div><p className="hg-footer">Uma demonstração Promoven · Informações comerciais sob consulta</p></div>{preview && <dialog ref={dialogRef} className="hg-dialog" aria-label={preview === 'plan' ? 'Planta ampliada' : 'Galeria de imagens'} onClose={finishPreview} onClick={event => { if (event.target === event.currentTarget) closePreview(); }}><div className="hg-dialog-content"><div className="hg-dialog-head"><div><strong>{picture.label}</strong><small>{preview === 'gallery' ? 'Perspectiva ilustrativa do House Garden' : 'Planta publicada pelo House Garden'}</small></div><button type="button" onClick={closePreview} aria-label="Fechar visualização"><Icon name="close"/></button></div><img src={picture.url} alt={preview === 'plan' ? 'Planta ampliada de 73,36 m² do House Garden' : `${picture.label}, perspectiva ilustrativa do House Garden`}/>{preview === 'gallery' && <div className="hg-dialog-nav"><button type="button" onClick={() => setGalleryIndex((galleryIndex + houseGarden.gallery.length - 1) % houseGarden.gallery.length)}>Anterior</button><span>{galleryIndex + 1} / {houseGarden.gallery.length}</span><button type="button" onClick={() => setGalleryIndex((galleryIndex + 1) % houseGarden.gallery.length)}>Próxima</button></div>}</div></dialog>}</main>;
}

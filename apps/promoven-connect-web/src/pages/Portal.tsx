import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { ConnectMembership, ConnectOrganization, ConnectProfile, MembershipRole } from "@promoven/connect-contracts";
import { chooseOrganization, visibleOrganizations } from "../access";
import { useAuth } from "../auth";
import { connectClient } from "../supabase";
import { ImportInventory, ProjectDetail, Projects, Units } from "./Projects";
import { Brokers, BrokerHome, BrokerProfilePage } from "./Brokers";
import { BrokerCatalogProjects, BrokerCatalogInventory, BrokerCatalogUnitDetail } from "./BrokerCatalog";

interface PortalData { profile: ConnectProfile; organizations: ConnectOrganization[]; memberships: ConnectMembership[]; platformAdmin: boolean; }
function State({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) { return <main className="state-page" role="status"><div className="state-mark">P</div><h1>{title}</h1><p>{detail}</p>{retry && <button type="button" className="secondary" onClick={retry}>Tentar novamente</button>}</main>; }

export function Portal() {
  const auth = useAuth(); const location = useLocation(); const userId = auth.session?.user.id;
  const [data, setData] = useState<PortalData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true; setLoading(true); setError("");
    void (async () => {
      const client = connectClient();
      const [profileResult, memberResult, platformResult] = await Promise.all([
        client.from("profiles").select("user_id,full_name,active").eq("user_id", userId).maybeSingle(),
        client.from("organization_members").select("organization_id,user_id,role,active,version").eq("user_id", userId),
        client.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);
      if (profileResult.error || memberResult.error || platformResult.error || !profileResult.data) throw new Error("Não foi possível validar seu acesso.");
      const memberships: ConnectMembership[] = (memberResult.data ?? []).map((item) => ({ organizationId: item.organization_id, userId: item.user_id, role: item.role as MembershipRole, active: item.active, version: item.version }));
      const organizationIds = memberships.filter((item) => item.active).map((item) => item.organizationId);
      const organizationResult = organizationIds.length ? await client.from("organizations").select("id,name,slug,status,version").in("id", organizationIds) : { data: [], error: null };
      if (organizationResult.error) throw new Error("Não foi possível carregar as organizações.");
      const organizations = visibleOrganizations((organizationResult.data ?? []).map((item) => ({ id: item.id, name: item.name, slug: item.slug, status: item.status as ConnectOrganization["status"], version: item.version })), memberships);
      if (active) {
        setData({ profile: { userId: profileResult.data.user_id, fullName: profileResult.data.full_name, active: profileResult.data.active }, organizations, memberships, platformAdmin: !!platformResult.data });
        const saved = localStorage.getItem(`connect-org-${userId}`);
        setSelectedId((previous) => chooseOrganization(organizations, previous ?? saved));
      }
    })().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Acesso indisponível."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, revision]);
  if (auth.loading || loading) return <State title="Preparando o portal" detail="Validando sua conta e suas organizações…" />;
  if (!auth.session) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  if (error || !data) return <State title="Acesso indisponível" detail={error || "Não foi possível carregar o portal."} retry={refresh} />;
  if (!data.profile.active) return <State title="Conta inativa" detail="Seu acesso foi desativado. Fale com o administrador da organização." />;
  const organization = data.organizations.find((item) => item.id === selectedId) ?? null;
  const membership = data.memberships.find((item) => item.organizationId === organization?.id);
  const selectOrganization = (id: string) => { if (!data.organizations.some((item) => item.id === id)) return; setSelectedId(id); localStorage.setItem(`connect-org-${userId}`, id); };
  return <div className="portal-shell"><aside className="sidebar"><Link className="brand" to="/connect"><span className="brand-icon">P</span><span>PROMOVEN <b>CONNECT</b></span></Link><p className="sidebar-label">ÁREA DE TRABALHO</p><nav aria-label="Navegação principal">{(organization || data.platformAdmin) && <><NavLink end to="/connect">Visão geral</NavLink><NavLink to="/connect/projects">Empreendimentos</NavLink><NavLink to="/connect/brokers">Corretores</NavLink></>}<NavLink to="/connect/broker">Área do corretor</NavLink><NavLink to="/connect/broker/projects">Catálogo</NavLink><NavLink to="/connect/broker/profile">Perfil profissional</NavLink><NavLink to="/connect/profile">Meu perfil</NavLink></nav><div className="sidebar-bottom"><span>Ambiente Connect</span><button type="button" onClick={() => void auth.signOut()}>Sair da conta</button></div></aside><div className="portal-content"><header className="topbar"><div><span className="eyebrow">ESPAÇO DE TRABALHO</span><strong>{organization?.name ?? (data.platformAdmin ? "Administração da plataforma" : "Rede de corretores")}</strong></div>{data.organizations.length > 1 && <label className="org-picker">Organização<select aria-label="Organização ativa" value={organization?.id ?? ""} onChange={(event) => selectOrganization(event.target.value)}>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<span className="user-chip">{data.profile.fullName || auth.session.user.email}</span></header><main className="main-content"><Routes><Route index element={organization || data.platformAdmin ? <Dashboard organization={organization} role={membership?.role} platformAdmin={data.platformAdmin} refresh={refresh} /> : <Navigate to="/connect/broker" replace />} /><Route path="profile" element={<Profile profile={data.profile} onSaved={refresh} />} /><Route path="projects" element={<Projects organizationId={organization?.id??null} canAdmin={membership?.role==="organization_admin"}/>} /><Route path="projects/:id" element={<ProjectDetail organizationId={organization?.id??null} canAdmin={membership?.role==="organization_admin"}/>} /><Route path="projects/:id/units" element={<Units organizationId={organization?.id??null}/>} /><Route path="projects/:id/import" element={<ImportInventory organizationId={organization?.id??null}/>} /><Route path="brokers" element={<Brokers organizationId={organization?.id??null} canAdmin={membership?.role==="organization_admin"}/>} /><Route path="broker" element={<BrokerHome/>} /><Route path="broker/profile" element={<BrokerProfilePage/>} /><Route path="broker/projects" element={<BrokerCatalogProjects/>} /><Route path="broker/projects/:id" element={<BrokerCatalogInventory/>} /><Route path="broker/projects/:id/units/:unitId" element={<BrokerCatalogUnitDetail/>} /><Route path="*" element={<State title="Página não encontrada" detail="Esta área ainda não existe no Connect." />} /></Routes></main></div></div>;
}

function Dashboard({ organization, role, platformAdmin, refresh }: { organization: ConnectOrganization | null; role?: MembershipRole; platformAdmin: boolean; refresh: () => void }) {
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function create(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const { error } = await connectClient().rpc("connect_create_organization", { p_name: name, p_slug: slug }); if (error) throw error; setName(""); setSlug(""); setMessage("Organização criada com sucesso."); refresh(); } catch { setMessage("Não foi possível criar a organização. Revise os dados e tente novamente."); } finally { setBusy(false); } }
  return <><div className="page-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>Seu espaço comercial</h1><p>Contas, empreendimentos e inventário da sua organização.</p></div><span className="phase-tag">PROMOVEN CONNECT</span></div>{organization ? <div className="dashboard-grid"><section className="summary-card"><span className="card-icon">01</span><p>Organização ativa</p><h2>{organization.name}</h2><small>Identificador: {organization.slug}</small></section><section className="summary-card"><span className="card-icon">02</span><p>Seu papel</p><h2>{role === "organization_admin" ? "Administrador" : "Gerente comercial"}</h2><small>Permissões verificadas no banco de dados</small></section><Link className="summary-card summary-link" to="/connect/projects"><span className="card-icon">03</span><p>Projetos e inventário</p><h2>Empreendimentos</h2><small>Acessar projetos, unidades e importação CSV →</small></Link></div> : <section className="empty-card"><h2>Nenhuma organização ativa</h2><p>Seu usuário ainda não possui um vínculo ativo. Peça acesso ao administrador da plataforma.</p></section>}{platformAdmin && <section className="panel create-panel"><div><p className="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</p><h2>Criar organização</h2><p>Uma nova organização começa com você como administrador.</p></div><form className="form inline-form" onSubmit={create}><label>Nome<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Identificador<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} /></label><button className="primary" disabled={busy}>{busy ? "Criando…" : "Criar organização"}</button>{message && <p role="status">{message}</p>}</form></section>}</>;
}
function Profile({ profile, onSaved }: { profile: ConnectProfile; onSaved: () => void }) {
  const [name, setName] = useState(profile.fullName); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const { error } = await connectClient().rpc("connect_update_my_profile", { p_full_name: name }); if (error) throw error; setMessage("Perfil atualizado."); onSaved(); } catch { setMessage("Não foi possível atualizar o perfil."); } finally { setBusy(false); } }
  return <><div className="page-heading"><div><p className="eyebrow">MINHA CONTA</p><h1>Meu perfil</h1><p>Mantenha seus dados de apresentação atualizados.</p></div></div><section className="panel profile-panel"><form className="form" onSubmit={save}><label>Nome completo<input maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</button>{message && <p role="status">{message}</p>}</form></section></>;
}

import {lazy,Suspense,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {MarketingLanding} from './marketing/MarketingLanding';import {PrivacyPage} from './marketing/PrivacyPage';
import {demoUrl,legacyDemoTarget} from './routing/demoQuery';
const DemoApp=lazy(()=>import('./demo/DemoApp'));
const AuthApp=lazy(()=>import('./auth/AuthApp'));
const PortalApp=lazy(()=>import('./portal/PortalApp'));
function Loading({label='Carregando…'}:{label?:string}){return <main className="route-loading" aria-live="polite">{label}</main>}
function Home(){const {search}=useLocation();const target=legacyDemoTarget(search);return target?<Navigate to={target} replace/>:<MarketingLanding/>}
function DemoRoute(){const {search}=useLocation(),target=demoUrl(search);return target!==`/demo${search}`?<Navigate to={target} replace/>:<Suspense fallback={<Loading label="Abrindo a experiência 3D…"/>}><DemoApp/></Suspense>}
function NotFound(){return <main className="route-not-found"><p>404</p><h1>Página não encontrada</h1><p>O endereço informado não existe ou foi alterado.</p><div><a href="/">Voltar ao início</a><a href="/demo">Abrir demonstração</a></div></main>}
const seo={home:{title:'Promoven | Experiências imobiliárias interativas',description:'Apresente empreendimentos em 3D, conecte disponibilidade e ajude seus clientes a encontrar a unidade ideal com a Promoven.'},demo:{title:'Demonstração 3D | Promoven',description:'Explore uma demonstração 3D da plataforma imobiliária Promoven.'},privacy:{title:'Política de Privacidade | Promoven',description:'Entenda como a Promoven trata dados para contato comercial.'}};
function Seo(){const {pathname}=useLocation();const page=pathname==='/demo'?seo.demo:pathname==='/privacidade'?seo.privacy:seo.home;useEffect(()=>{document.title=page.title;const description=document.querySelector('meta[name="description"]');description?.setAttribute('content',page.description);const robots=document.querySelector('meta[name="robots"]');if(robots)robots.setAttribute('content',pathname.startsWith('/portal')||pathname==='/login'||pathname.includes('password')||pathname==='/accept-invitation'?'noindex,nofollow':'index,follow')},[page,pathname]);return null}
function App(){return <BrowserRouter><Seo/><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/demo" element={<DemoRoute/>}/>
  <Route path="/privacidade" element={<PrivacyPage/>}/>
  <Route path="/login" element={<Suspense fallback={<Loading/>}><AuthApp page="login"/></Suspense>}/>
  <Route path="/forgot-password" element={<Suspense fallback={<Loading/>}><AuthApp page="forgot-password"/></Suspense>}/>
  <Route path="/reset-password" element={<Suspense fallback={<Loading/>}><AuthApp page="reset-password"/></Suspense>}/>
  <Route path="/accept-invitation" element={<Suspense fallback={<Loading/>}><AuthApp page="accept-invitation"/></Suspense>}/>
  <Route path="/portal/*" element={<Suspense fallback={<Loading label="Carregando o portal…"/>}><AuthApp page="portal"><PortalApp/></AuthApp></Suspense>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes></BrowserRouter>}
createRoot(document.getElementById('root')!).render(<App/>);

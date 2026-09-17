import {lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {MarketingLanding} from './marketing/MarketingLanding';
import {demoUrl,legacyDemoTarget} from './routing/demoQuery';
const DemoApp=lazy(()=>import('./demo/DemoApp'));
const AuthApp=lazy(()=>import('./auth/AuthApp'));
const PortalApp=lazy(()=>import('./portal/PortalApp'));
function Loading({label='Carregando…'}:{label?:string}){return <main className="route-loading" aria-live="polite">{label}</main>}
function Home(){const {search}=useLocation();const target=legacyDemoTarget(search);return target?<Navigate to={target} replace/>:<MarketingLanding/>}
function DemoRoute(){const {search}=useLocation(),target=demoUrl(search);return target!==`/demo${search}`?<Navigate to={target} replace/>:<Suspense fallback={<Loading label="Abrindo a experiência 3D…"/>}><DemoApp/></Suspense>}
function NotFound(){return <main className="route-not-found"><p>404</p><h1>Página não encontrada</h1><p>O endereço informado não existe ou foi alterado.</p><div><a href="/">Voltar ao início</a><a href="/demo">Abrir demonstração</a></div></main>}
function App(){return <BrowserRouter><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/demo" element={<DemoRoute/>}/>
  <Route path="/login" element={<Suspense fallback={<Loading/>}><AuthApp page="login"/></Suspense>}/>
  <Route path="/forgot-password" element={<Suspense fallback={<Loading/>}><AuthApp page="forgot-password"/></Suspense>}/>
  <Route path="/reset-password" element={<Suspense fallback={<Loading/>}><AuthApp page="reset-password"/></Suspense>}/>
  <Route path="/accept-invitation" element={<Suspense fallback={<Loading/>}><AuthApp page="accept-invitation"/></Suspense>}/>
  <Route path="/portal/*" element={<Suspense fallback={<Loading label="Carregando o portal…"/>}><AuthApp page="portal"><PortalApp/></AuthApp></Suspense>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes></BrowserRouter>}
createRoot(document.getElementById('root')!).render(<App/>);

import {lazy,Suspense,useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Route,Routes} from 'react-router-dom';
import {BuildingApp} from './building/BuildingApp';
import {InventoryProvider} from './infrastructure/inventory/InventoryContext';
import type {PropertyUnit} from './domain/inventory';
import {AuthProvider} from './auth/AuthContext';
import {ForgotPasswordPage,LoginPage,ResetPasswordPage} from './auth/AuthPages';
import './building/building.css';
const InteriorApp=lazy(()=>import('./InteriorApp'));
const PortalApp=lazy(()=>import('./portal/PortalApp'));
function PublicViewer(){
  const [interior,setInterior]=useState(new URLSearchParams(location.search).get('vista')==='interior');
  useEffect(()=>{const pop=()=>setInterior(new URLSearchParams(location.search).get('vista')==='interior');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  const navigate=(enter:boolean,unit?:PropertyUnit)=>{const url=new URL(location.href);if(enter&&unit?.interiorProjectId){url.searchParams.set('vista','interior');url.searchParams.set('maqueta',unit.interiorProjectId);url.searchParams.set('piso',String(unit.floor));url.searchParams.set('unidad',unit.code);}else{url.searchParams.set('vista','edificio');url.searchParams.delete('maqueta');url.searchParams.delete('piso');}history.pushState(null,'',url);setInterior(enter);};
  return interior?<><button className="building-return" onClick={()=>navigate(false)}>← Voltar ao edifício</button><Suspense fallback={<div className="building-loading">Abrindo o interior ilustrativo…</div>}><InteriorApp/></Suspense></>:<BuildingApp onExplore={unit=>navigate(true,unit)}/>;
}
function AuthRoute({children}:{children:React.ReactNode}){return <AuthProvider>{children}</AuthProvider>}
function NotFound(){return <main style={{padding:'3rem',fontFamily:'system-ui'}}><h1>Página não encontrada</h1><p>O endereço informado não existe.</p><a href="/">Voltar ao visualizador</a></main>}
function App(){return <BrowserRouter><Routes><Route path="/" element={<InventoryProvider><PublicViewer/></InventoryProvider>}/><Route path="/login" element={<AuthRoute><LoginPage/></AuthRoute>}/><Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage/></AuthRoute>}/><Route path="/reset-password" element={<AuthRoute><ResetPasswordPage/></AuthRoute>}/><Route path="/portal/*" element={<AuthRoute><Suspense fallback={<main className="portal-state">Carregando o portal…</main>}><PortalApp/></Suspense></AuthRoute>}/><Route path="*" element={<NotFound/>}/></Routes></BrowserRouter>}
createRoot(document.getElementById('root')!).render(<App/>);

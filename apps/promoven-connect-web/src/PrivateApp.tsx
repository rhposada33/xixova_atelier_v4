import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { LoginPage, ForgotPage, ResetPage } from "./pages/AuthPages";
import { Portal } from "./pages/Portal";
import { InvitePage } from "./pages/Brokers";
export function PrivateApp(){return <AuthProvider><Routes><Route path="/" element={<Navigate to="/connect" replace/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/forgot-password" element={<ForgotPage/>}/><Route path="/reset-password" element={<ResetPage/>}/><Route path="/invite" element={<InvitePage/>}/><Route path="/invite/:token" element={<InvitePage/>}/><Route path="/connect/*" element={<Portal/>}/><Route path="*" element={<main className="state-page"><h1>Página não encontrada</h1><a href="/connect">Voltar ao portal</a></main>}/></Routes></AuthProvider>;}

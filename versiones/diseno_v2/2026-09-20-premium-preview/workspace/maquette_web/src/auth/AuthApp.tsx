import type {ReactNode} from 'react';
import {AuthProvider} from './AuthContext';
import {ForgotPasswordPage,LoginPage,ResetPasswordPage} from './AuthPages';
import {AcceptInvitationPage} from './AcceptInvitationPage';
import './auth.css';
export default function AuthApp({page,children}:{page:'login'|'forgot-password'|'reset-password'|'accept-invitation'|'portal';children?:ReactNode}){
  const content=page==='login'?<LoginPage/>:page==='forgot-password'?<ForgotPasswordPage/>:page==='reset-password'?<ResetPasswordPage/>:page==='accept-invitation'?<AcceptInvitationPage/>:children;
  return <AuthProvider>{content}</AuthProvider>;
}

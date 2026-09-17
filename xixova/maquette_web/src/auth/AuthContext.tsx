import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {getSupabaseClient} from '../infrastructure/supabase/client';

interface AuthValue {session:Session|null;loading:boolean;configurationError:boolean;signOut:()=>Promise<void>;}
const AuthContext=createContext<AuthValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true);const [configurationError,setConfigurationError]=useState(false);
  useEffect(()=>{
    let client;try{client=getSupabaseClient();}catch{setConfigurationError(true);setLoading(false);return}let mounted=true;
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
    const initialize=async()=>{const fragment=new URLSearchParams(location.hash.slice(1));const accessToken=fragment.get('access_token');const refreshToken=fragment.get('refresh_token');if(accessToken&&refreshToken){await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});history.replaceState(history.state,'',location.pathname+location.search);}const {data}=await client.auth.getSession();if(mounted){setSession(data.session);setLoading(false);}};void initialize();
    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  const value=useMemo(()=>({session,loading,configurationError,signOut:async()=>{await getSupabaseClient().auth.signOut();}}),[session,loading,configurationError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider não configurado.');return value;}

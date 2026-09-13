import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {getSupabaseClient} from '../infrastructure/supabase/client';

interface AuthValue {session:Session|null;loading:boolean;signOut:()=>Promise<void>;}
const AuthContext=createContext<AuthValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const client=getSupabaseClient();let mounted=true;
    client.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false);}});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  const value=useMemo(()=>({session,loading,signOut:async()=>{await getSupabaseClient().auth.signOut();}}),[session,loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider não configurado.');return value;}

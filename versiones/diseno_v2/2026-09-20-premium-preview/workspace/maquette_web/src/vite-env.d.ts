/// <reference types="vite/client" />

interface ImportMetaEnv {readonly VITE_APP_ENV?:'production'|'staging';readonly VITE_INVENTORY_PROVIDER?:'static'|'supabase';readonly VITE_SUPABASE_URL?:string;readonly VITE_SUPABASE_PUBLISHABLE_KEY?:string;readonly VITE_SUPABASE_ANON_KEY?:string;readonly VITE_SUPABASE_TEST_URL?:string;readonly VITE_SUPABASE_TEST_PUBLISHABLE_KEY?:string;readonly VITE_INVENTORY_DEV_DELAY_MS?:string;readonly VITE_INVENTORY_DEV_FAIL?:string;readonly VITE_PROMOVEN_CALENDAR_URL?:string;readonly VITE_PROMOVEN_WHATSAPP_NUMBER?:string;}
interface ImportMeta {readonly env:ImportMetaEnv;}

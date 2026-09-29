import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests",
  timeout:30_000,
  workers:1,
  use:{
    baseURL:"http://127.0.0.1:8892",
    headless:true,
    viewport:{width:1280,height:800},
    launchOptions:{executablePath:"/usr/bin/google-chrome",args:["--use-angle=swiftshader","--enable-webgl"]},
  },
  webServer:{
    command:"VITE_E2E_PUBLIC_DIR=../../artefactos/catalogo VITE_SUPABASE_URL=http://supabase.test VITE_SUPABASE_PUBLISHABLE_KEY=test-public-key npm exec vite -- --config vite.config.ts --host 127.0.0.1 --port 8892",
    url:"http://127.0.0.1:8892/",
    reuseExistingServer:false,
    timeout:30_000,
  },
});

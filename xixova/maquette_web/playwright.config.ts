import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests",
  timeout:30_000,
  use:{
    baseURL:"http://127.0.0.1:8892",
    headless:true,
    viewport:{width:1280,height:800},
    launchOptions:{executablePath:"/usr/bin/google-chrome",args:["--use-angle=swiftshader","--enable-webgl"]},
  },
  webServer:{
    command:"cd ../.. && python3 -m http.server 8892 --bind 127.0.0.1 --directory publicaciones/catalogo_xixova",
    url:"http://127.0.0.1:8892/catalog.json",
    reuseExistingServer:false,
    timeout:30_000,
  },
});

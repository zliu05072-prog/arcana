import {defineConfig} from 'vite';
export default defineConfig({base:process.env.GITHUB_PAGES==='true'?'/arcana/':'/',build:{outDir:'dist/client',rollupOptions:{input:{main:'index.html',onchain:'onchain.html'}}},server:{proxy:{'/api':'http://127.0.0.1:8787'}}});

import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'dist/client',rollupOptions:{input:{main:'index.html',onchain:'onchain.html'}}},server:{proxy:{'/api':'http://127.0.0.1:8787'}}});

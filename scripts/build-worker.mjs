import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
await build({entryPoints:['server/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',minify:true});
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Arcana server, frontend and database migrations built.');

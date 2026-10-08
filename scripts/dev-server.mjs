import {spawn} from 'node:child_process';
async function run(args){await new Promise((resolve,reject)=>{const child=spawn('pnpm',args,{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Command failed: pnpm '+args.join(' '))));});}
await run(['build']);
await run(['exec','wrangler','d1','migrations','apply','arcana-local','--local']);
await run(['exec','wrangler','dev','--ip','127.0.0.1','--port','8787']);

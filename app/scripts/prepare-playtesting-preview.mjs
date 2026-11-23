import {mkdtemp,mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const source=new URL('../',import.meta.url).pathname;
const target=await mkdtemp(join(tmpdir(),'doku-testing-release-')),app=join(target,'app');
await mkdir(app,{recursive:true});
const paths=['src/testing','server/playtesting.ts','server/playtest-store.ts','server/playtest-app.ts','testing.html','vite.testing.config.ts','tsconfig.json','package-lock.json','public/assets/brand/doku-icon.png'];
for(const path of paths){await mkdir(join(app,path,'..'),{recursive:true});await cp(join(source,path),join(app,path),{recursive:true});}
const pkg=JSON.parse(await readFile(join(source,'package.json'),'utf8'));pkg.scripts={build:'vite build --config vite.testing.config.ts'};
await writeFile(join(app,'package.json'),JSON.stringify(pkg,null,2)+'\n');
await mkdir(join(app,'api'),{recursive:true});await writeFile(join(app,'api/index.ts'),"export {playtestApp as default} from '../server/playtest-app.js';\n");
await writeFile(join(app,'vercel.json'),JSON.stringify({framework:null,installCommand:'npm ci',buildCommand:'npm run build',outputDirectory:'dist/testing',redirects:[{source:'/',destination:'/testing/',permanent:false},{source:'/testing',destination:'/testing/',permanent:true},{source:'/testing/results',destination:'/testing/results/',permanent:true}],rewrites:[{source:'/api/:path*',destination:'/api'},{source:'/testing/',destination:'/testing.html'},{source:'/testing/results/',destination:'/testing.html'}],headers:[{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}]},null,2)+'\n');
await mkdir(join(target,'.vercel'));await writeFile(join(target,'.vercel/project.json'),JSON.stringify({projectId:'prj_TlNU6WEArfwxdwTTeSERTnpLcp8S',orgId:'team_ytH1bwUDJr0GFhbHA5HqEmDk',projectName:'stardoku'}));
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else files.push({file:relative(app,p),sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}await walk(app);
await writeFile(join(target,'SOURCE-MANIFEST.json'),JSON.stringify({date:new Date().toISOString(),purpose:'Testing-only preview; live player unchanged; no research files or credentials',files},null,2));
console.log(target);

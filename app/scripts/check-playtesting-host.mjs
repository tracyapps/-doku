// Uses the ignored local owner key; never prints it or sends it in a URL.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const host=process.argv[2];assert.match(host||'',/^https:\/\/[a-z0-9-]+\.vercel\.app$/);
const key=(await readFile(new URL('../.data/playtesting-owner-key.txt',import.meta.url),'utf8')).trim();
const catalog=JSON.parse(await readFile(new URL('../src/testing/catalog.json',import.meta.url),'utf8'));
async function readJSON(path){const response=await fetch(host+path,{redirect:'error'});assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/json/);return response.json();}
const config=await readJSON('/api/playtesting/config');assert.equal(config.audioAudience,'public');
const {ticket}=await readJSON('/api/playtesting/ticket');assert.equal(typeof ticket,'string');
const {nonce}=JSON.parse(Buffer.from(ticket.split('.')[0],'base64url').toString());let work=0;while(!createHash('sha256').update(nonce+':'+work).digest('hex').startsWith('000'))work++;
await new Promise(r=>setTimeout(r,4200));
const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
const body={ticket,work,round:catalog.round,kind:'example',model:catalog.samples[0].model,sample:catalog.samples[0].id,name:'Owner setup check',notes:'Automated deployment verification. Excluded from public tester results.',ratings:{clarity:3},publicConsent:true,audioConsent:true,setupCheck:true,audio:{mime:'audio/wav',base64:wav.toString('base64')}};
const send=()=>fetch(host+'/api/playtesting/responses',{method:'POST',headers:{'Content-Type':'application/json',Origin:host,Authorization:'Bearer '+key},body:JSON.stringify(body)});
const rejected=await fetch(host+'/api/playtesting/responses',{method:'POST',headers:{'Content-Type':'application/json',Origin:host,Authorization:'Bearer '+key},body:JSON.stringify({...body,audioConsent:false})});assert.equal(rejected.status,400);
const created=await send();assert.equal(created.status,201,await created.text().then(s=>s.slice(0,120))); // parse a separate response below after idempotent retry
const retry=await send();assert.equal(retry.status,200);const receipt=await retry.json();assert.equal(receipt.duplicate,true);
const publicAudio=await fetch(host+'/api/playtesting/audio/'+receipt.id);assert.equal(publicAudio.status,403);
const ownerAudio=await fetch(host+'/api/playtesting/audio/'+receipt.id,{headers:{Authorization:'Bearer '+key}});assert.equal(ownerAudio.status,200);assert.deepEqual(Buffer.from(await ownerAudio.arrayBuffer()),wav);
const results=await(await fetch(host+'/api/playtesting/results')).json();assert.ok(Array.isArray(results.responses));assert.ok(!results.responses.some(r=>r.id===receipt.id));
const evidence={host,checkedAt:new Date().toISOString(),receipt:receipt.id,checks:['Public audio policy with explicit consent required','No-login ticket','Signed proof and same-origin submission','PostgreSQL response and audio round trip','Idempotent retry','Private audio denied publicly','Owner audio verified byte for byte','Setup excluded from public opinions'],publicResponses:results.responses.length};
await mkdir(new URL('../docs/qa/',import.meta.url),{recursive:true});await writeFile(new URL('../docs/qa/playtesting-host.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));

import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseHTML} from 'linkedom';
const root=process.argv[2]?path.resolve(process.argv[2]):fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.filter(e=>!['node_modules','.git','dist','test-results','playwright-report'].includes(e.name)).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
const files=await walk(root),errors=[];let scripts=0,refs=0;
async function reference(file,ref){if(!ref||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref))return;const target=path.resolve(ref.startsWith('/')?root:path.dirname(file),ref.split(/[?#]/)[0].replace(/^\//,''));try{const s=await stat(decodeURIComponent(target));if(s.isDirectory())await stat(path.join(target,'index.html'));refs++;}catch{errors.push(path.relative(root,file)+': referência ausente '+ref);}}
for(const file of files){
 if(/\.(m?js)$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status)errors.push(r.stderr);scripts++;}
 if(file.endsWith('.html')){const {document}=parseHTML(await readFile(file,'utf8'));for(const n of document.querySelectorAll('[src],[href]')){await reference(file,n.getAttribute('src'));await reference(file,n.getAttribute('href'));}}
 if(file.endsWith('.css')){for(const m of (await readFile(file,'utf8')).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))await reference(file,m[1]);}
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`OK: sintaxe de ${scripts} scripts e ${refs} referências HTML/CSS locais.`);

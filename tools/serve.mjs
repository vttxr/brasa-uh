import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname.includes('\\') || pathname.split('/').some(p=>p.startsWith('.') || ['node_modules','supabase','tests','tools'].includes(p))) {res.writeHead(403);res.end();return;}
    let filename = path.resolve(root,'.'+pathname);
    if (filename !== path.resolve(root) && !filename.startsWith(root)) {res.writeHead(403);res.end();return;}
    if ((await stat(filename)).isDirectory()) filename=path.join(filename,'index.html');
    const data=await readFile(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Arquivo não encontrado.');}
}).listen(port,'127.0.0.1',()=>console.log(`BRASA UH: http://127.0.0.1:${port} · painel /admin/`));

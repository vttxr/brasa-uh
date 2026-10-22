import { config } from './config.js';
import {setIconText} from './icons.js';
const base = () => typeof location === 'undefined' ? 'https://brasauh-test.netlify.app/' : new URL('../', import.meta.url).href;
export function safeLink(value) {
  const text = String(value ?? '').trim();
  if (!text || /[\u0000-\u001f\u007f\\]/.test(text) || text.startsWith('//')) return '';
  if (text.startsWith('#')) return text;
  if (text.startsWith('mailto:')) return /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(text) ? text : '';
  if (text.startsWith('tel:')) return /^tel:\+?[\d ()-]{3,30}$/.test(text) ? text : '';
  try {
    const url = new URL(text, base());
    if (url.username || url.password) return '';
    if (url.protocol === 'https:') return url.href;
    if (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return url.href;
  } catch { /* Invalid URL is never rendered. */ }
  return '';
}
export function safeImage(value) {
  const text = String(value ?? '').trim();
  if (!text || /[\u0000-\u001f\u007f\\]/.test(text) || text.startsWith('//')) return '';
  try {
    const url = new URL(text, base());
    const local = new URL(base());
    if (url.username || url.password || !/\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return '';
    const ownAsset = url.origin === local.origin && url.pathname.startsWith(new URL('assets/',local).pathname);
    const storage = url.origin === config.url && url.pathname.startsWith('/storage/v1/object/public/site-images/');
    return ownAsset || storage ? url.href : '';
  } catch { return ''; }
}
export async function validateImage(file) {
  if (!file || !file.size || file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB.');
  const allowed = {'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed[file.type]?.includes(ext)) throw new Error('Use JPG, PNG ou WebP.');
  const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const jpg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const png = [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  const webp = String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if (!({'image/jpeg':jpg,'image/png':png,'image/webp':webp})[file.type]) throw new Error('O conteúdo do arquivo não corresponde ao formato da imagem.');
  return true;
}
export function makeImagePath(file) {
  const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if (!ext) throw new Error('Formato de imagem não permitido.');
  return `${crypto.randomUUID()}.${ext}`;
}
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) setIconText(node,text);
  if (className) node.className = className;
  return node;
}
export function externalLink(label, url, className='arrow-link') {
  const safe = safeLink(url); if (!safe) return null;
  const link = element('a',label,className);link.href=safe;
  link.target='_blank';link.rel='noopener noreferrer';return link;
}

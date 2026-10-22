import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {decorateIcons,setIconText} from '../cms/icons.js';
import {applyContent} from '../cms/public.js';

test('symbols become SVGs without changing input values or interpreting markup',()=>{
 const {document}=parseHTML('<html><body><a id="link">Conhecer ↗️</a><textarea>Texto →</textarea><input value="↗"></body></html>');
 decorateIcons(document.body);
 const link=document.getElementById('link');
 assert.equal(link.querySelectorAll('svg').length,1);
 assert.equal(link.querySelector('svg').namespaceURI,'http://www.w3.org/2000/svg');
 assert.equal(link.querySelector('svg').getAttribute('aria-hidden'),'true');
 assert.equal(document.querySelector('textarea').textContent,'Texto →');
 assert.equal(document.querySelector('input').getAttribute('value'),'↗');
 decorateIcons(document.body);
 assert.equal(link.querySelectorAll('svg').length,1);
 setIconText(link,'<img src=x onerror=bad()> →');
 assert.equal(link.querySelectorAll('img').length,0);
 assert.equal(link.querySelectorAll('svg').length,1);
 assert.equal(link.textContent,'<img src=x onerror=bad()> →');
});

test('CMS updates retain vector arrows through repeated edits',()=>{
 const {document}=parseHTML('<html><body><a id="cta">Participar</a></body></html>');
 const definition={page:'index',section:'intro',field:'cta',kind:'text',target:'#cta'};
 for(const value of ['Participar ↗','Voltar ←','Continuar →']) {
  applyContent([{...definition,value,published:true}],[definition],document);
  assert.equal(document.querySelectorAll('#cta svg').length,1);
  assert.equal(document.querySelector('#cta').textContent,value);
 }
});

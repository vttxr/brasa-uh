import {safeLink, safeImage} from '../cms/safety.js';
import {setIconText} from '../cms/icons.js';
import {el, button, field, loading, heading, notify, errorText, confirmAction, showError, allRows, setBusy, userError} from './ui.js';
import {createImageField} from './media.js';

const PAGE_NAMES = {index:'Página Inicial', 'quem-somos':'Quem Somos', diretoria:'Diretoria', calendario:'Calendário', parcerias:'Parcerias', 'faca-parte':'Faça Parte', shared:'Cabeçalho e rodapé'};
let catalogPromise;
let settingsPromise;
async function fetchCatalog(file) {
  const response = await fetch(new URL('../cms/' + file, import.meta.url), {cache:'no-cache'});
  if (!response.ok) throw userError('O catálogo de conteúdo não foi encontrado. Verifique os arquivos da instalação.');
  const data = await response.json();
  if (!Array.isArray(data)) throw userError('O catálogo de conteúdo está em um formato inesperado.');
  return data;
}
export function getCatalog() {
  if (!catalogPromise) catalogPromise = fetchCatalog('content-catalog.json').catch(error => { catalogPromise = undefined; throw error; });
  return catalogPromise;
}
export function getSettingsCatalog() {
  if (!settingsPromise) settingsPromise = fetchCatalog('settings-catalog.json').catch(error => { settingsPromise = undefined; throw error; });
  return settingsPromise;
}
function keyOf(row) { return row.page + '/' + row.section + '/' + row.field; }
function validateValue(kind, value, label) {
  if (value.length > 20000) throw userError('O campo "' + label + '" ultrapassa o limite de 20.000 caracteres.');
  if (kind === 'url' && value && !safeLink(value)) throw userError('Informe um link válido no campo "' + label + '".');
  if (kind === 'image' && value && !safeImage(value)) throw userError('Informe uma imagem válida no campo "' + label + '".');
  return value;
}

function contentControl(ctx, definition, state, changed) {
  let control;
  let image;
  const label = definition.label || definition.field || definition.key;
  if (definition.kind === 'image') {
    image = createImageField(ctx, state.value, label, changed);
    control = image.node;
  } else {
    const long = definition.kind === 'text' && (state.value.length > 100 || state.value.includes('\n'));
    const input = el(long ? 'textarea' : 'input', {
      ...(long ? {rows:4} : {type:definition.key === 'email' ? 'email' : 'text'}),
      value:state.value, maxlength:definition.kind === 'url' ? 2048 : 20000, autocomplete:'off'
    });
    input.addEventListener('input', changed);
    const kindHint = {text:'Texto simples. A formatação da página é preservada.', url:'Endereço HTTPS, link interno ou outro protocolo de contato permitido.', alt:'Descreva o conteúdo da imagem para quem usa leitor de tela.'};
    control = field(label, input, kindHint[definition.kind]);
    control.dataset.inputId = input.id;
  }
  const published = el('input', {type:'checkbox', checked:state.published});
  published.addEventListener('change', changed);
  const publishLabel = el('label', {class:'checkbox-label'}, [published, 'Publicado']);
  const node = el('div', {class:'content-field'}, [control, publishLabel]);
  return {
    node, definition,
    getValue:() => image ? image.getValue() : control.querySelector('input,textarea').value,
    getPublished:() => published.checked,
    isBusy:() => image?.isBusy() || false,
    saved:{value:state.value, published:state.published}
  };
}

export async function renderPageEditor(target, ctx, page, {embedded = false} = {}) {
  const body = el('div', {}, [loading('Carregando campos desta página…')]);
  if (!embedded) target.append(heading(PAGE_NAMES[page] || page, 'Edite os textos, as imagens e os links. Confira o resultado antes de salvar.'));
  target.append(body);
  const load = async () => {
    body.replaceChildren(loading('Carregando campos desta página…'));
    try {
      const [catalog, stored, settings] = await Promise.all([
        getCatalog(),
        allRows(ctx.client, 'site_content', '*', query => query.in('page', page === 'shared' ? ['shared', 'index'] : [page, 'shared']).order('id')),
        allRows(ctx.client, 'site_settings', '*', query => query.order('key'))
      ]);
      const definitions = catalog.filter(item => item.page === page);
      if (!definitions.length) throw userError('Esta página ainda não possui campos no catálogo de conteúdo.');
      buildEditor(body, ctx, {definitions, stored, settings, page, table:'site_content'});
    } catch (error) { showError(body, error, load); }
  };
  await load();
}

export async function renderSettings(target, ctx) {
  target.append(heading('Configurações', 'Atualize os canais de contato, os links externos e o conteúdo compartilhado do site.'));
  const content = el('div');
  const linksTab = button('Links e contatos', () => switchTab('settings'), 'tab-button active');
  const sharedTab = button('Cabeçalho e rodapé', () => switchTab('shared'), 'tab-button');
  target.append(el('div', {class:'editor-tabs', role:'group', 'aria-label':'Áreas das configurações'}, [linksTab, sharedTab]), content);
  let current = 'settings';
  async function switchTab(next) {
    if (next === current) return;
    if (!await ctx.confirmLeave()) return;
    ctx.setDirty(false);
    current = next;
    linksTab.classList.toggle('active', next === 'settings');
    sharedTab.classList.toggle('active', next === 'shared');
    content.replaceChildren();
    if (next === 'shared') await renderPageEditor(content, ctx, 'shared', {embedded:true});
    else await loadSettings();
  }
  async function loadSettings() {
    content.replaceChildren(loading());
    try {
      const [definitions, stored, rows] = await Promise.all([
        getSettingsCatalog(),
        allRows(ctx.client, 'site_settings', '*', query => query.order('key')),
        allRows(ctx.client, 'site_content', '*', query => query.in('page', ['shared', 'index']).order('id'))
      ]);
      if (current !== 'settings') return;
      buildEditor(content, ctx, {definitions, stored, rows, page:'index', table:'site_settings'});
    } catch (error) { showError(content, error, loadSettings); }
  }
  await loadSettings();
}

function buildEditor(target, ctx, {definitions, stored, settings = [], rows = [], page, table}) {
  const isSettings = table === 'site_settings';
  const key = isSettings ? row => row.key : keyOf;
  const storedMap = new Map(stored.map(row => [key(row), row]));
  const controls = [];
  let previewOpen = false;
  let saving = false;
  let timer;
  let iframeReady = false;
  const form = el('form', {class:'content-form'});
  const status = el('p', {class:'save-status', role:'status', text:'Nenhuma alteração pendente.'});
  const save = el('button', {type:'submit', class:'button', disabled:true}, 'Salvar alterações');
  const previewButton = button('Abrir prévia ↗', () => {
    previewOpen = !previewOpen;
    previewPane.hidden = !previewOpen;
    setIconText(previewButton,previewOpen ? 'Fechar prévia' : 'Abrir prévia ↗');
    layout.classList.toggle('with-preview', previewOpen);
    if (previewOpen && !iframe.src) iframe.src = '../' + (page === 'shared' ? 'index' : page) + '.html?cms-preview=1';
    updatePreview();
  }, 'button secondary');
  const reset = button('Descartar alterações', async () => {
    if (!changedControls().length) return;
    if (!await confirmAction({title:'Descartar alterações?', message:'As mudanças ainda não salvas serão perdidas.', confirm:'Descartar', danger:true})) return;
    ctx.setDirty(false);
    buildEditor(target, ctx, {definitions, stored, settings, rows, page, table});
  }, 'text-button');
  const iframe = el('iframe', {title:'Prévia da página ' + (PAGE_NAMES[page] || page), class:'site-preview', referrerpolicy:'same-origin'});
  const previewPane = el('aside', {class:'preview-pane', hidden:true}, [
    el('div', {class:'preview-toolbar'}, [
      el('span', {text:'PRÉVIA · NÃO PUBLICADA'}),
      button('Tela ampla', () => { previewPane.classList.toggle('wide-preview'); }, 'text-button')
    ]),
    el('p', {class:'preview-note', text:'Confira o conteúdo na página real. Rascunhos aparecem aqui; no site público, campos não publicados usam o texto original.'}),
    iframe
  ]);
  const layout = el('div', {class:'editor-layout'}, [form, previewPane]);
  const groups = new Map();
  const changed = () => {
    if (saving || !layout.isConnected) return;
    const count = changedControls().length;
    ctx.setDirty(count > 0);
    save.disabled = !count;
    status.textContent = count ? count + ' campo(s) com alterações pendentes.' : 'Nenhuma alteração pendente.';
    clearTimeout(timer);
    timer = setTimeout(updatePreview, 120);
  };
  function changedControls() {
    return controls.filter(item => item.getValue() !== item.saved.value || item.getPublished() !== item.saved.published);
  }
  for (const definition of definitions) {
    const record = storedMap.get(key(definition));
    const state = {value:String(record?.value ?? definition.value ?? ''), published:record ? record.published !== false : true};
    const groupName = isSettings ? 'Canais e informações públicas' : definition.section;
    if (!groups.has(groupName)) groups.set(groupName, []);
    const control = contentControl(ctx, definition, state, changed);
    controls.push(control);
    groups.get(groupName).push(control.node);
  }
  let groupIndex = 0;
  for (const [name, fields] of groups) {
    const sectionNames = {intro:'Navegação e destaques', footer:'Rodapé', topbar:'Barra superior', header:'Navegação principal'};
    const sectionNumber = /^section-(\d+)$/.exec(name);
    const title = isSettings ? name : sectionNames[name] || (sectionNumber ? 'Seção ' + Number(sectionNumber[1]) : name.replace(/[-_]/g, ' '));
    const details = el('details', {class:'editor-section', open:groupIndex++ === 0 || isSettings}, [
      el('summary', {}, [el('span', {text:title}), el('span', {class:'section-count', text:fields.length + ' campos'})]),
      el('div', {class:'editor-section-body'}, fields)
    ]);
    form.append(details);
  }
  const savebar = el('div', {class:'savebar'}, [el('div', {}, [status, el('small', {text:'Salvar atualiza o banco. Não é necessário publicar o site novamente.'})]), el('div', {class:'savebar-actions'}, [reset, previewButton, save])]);
  form.append(savebar);
  target.replaceChildren(
    el('div', {class:'info-banner'}, 'A opção “Publicado” controla cada campo. Desmarcar mantém o valor salvo como rascunho; o site público mostra o conteúdo original nesse lugar. Imagens enviadas à biblioteca são públicas.'),
    layout
  );
  function currentRows() {
    const edited = controls.map(item => ({
      ...(isSettings ? {key:item.definition.key} : {page:item.definition.page, section:item.definition.section, field:item.definition.field}),
      kind:item.definition.kind,
      value:item.getValue(),
      published:item.getPublished()
    }));
    const editedKeys = new Set(edited.map(key));
    return stored.filter(row => !editedKeys.has(key(row))).concat(edited);
  }
  function updatePreview() {
    if (!previewOpen || !iframeReady || !iframe.contentWindow) return;
    const current = currentRows().map(row => ({...row, published:true}));
    iframe.contentWindow.postMessage({
      type:'brasa-cms-preview',
      rows:isSettings ? rows : current,
      settings:isSettings ? current : settings
    }, location.origin);
  }
  iframe.addEventListener('load', () => { iframeReady = true; updatePreview(); });
  const onReady = event => {
    if (event.origin === location.origin && event.source === iframe.contentWindow && event.data?.type === 'brasa-cms-preview-ready') updatePreview();
  };
  window.addEventListener('message', onReady);
  // The observer removes a listener when navigation discards this editor.
  const observer = new MutationObserver(() => {
    if (!target.isConnected || !layout.isConnected) {
      window.removeEventListener('message', onReady);
      clearTimeout(timer);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('workspace'), {childList:true, subtree:true});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    if (controls.some(item => item.isBusy())) { notify('Aguarde o envio da imagem terminar antes de salvar.', 'error'); return; }
    const dirty = changedControls();
    if (!dirty.length) return;
    try {
      const payload = dirty.map(item => ({
        ...(isSettings ? {key:item.definition.key} : {page:item.definition.page, section:item.definition.section, field:item.definition.field}),
        kind:item.definition.kind,
        value:validateValue(item.definition.kind, item.getValue(), item.definition.label),
        published:item.getPublished()
      }));
      saving = true;
      setBusy(form, true);
      status.textContent = 'Salvando alterações…';
      const result = await ctx.client.from(table).upsert(payload, {onConflict:isSettings ? 'key' : 'page,section,field'}).select();
      if (result.error) throw result.error;
      if (!result.data || result.data.length !== payload.length) throw userError('Não foi possível confirmar o salvamento de todos os campos. Atualize e confira antes de tentar novamente.');
      for (const updated of result.data) {
        const index = stored.findIndex(row => key(row) === key(updated));
        if (index >= 0) stored[index] = updated;
        else stored.push(updated);
      }
      for (const item of dirty) item.saved = {value:item.getValue(), published:item.getPublished()};
      ctx.setDirty(false);
      status.textContent = 'Alterações salvas com sucesso.';
      notify('Conteúdo salvo. Os campos publicados já podem ser exibidos no site.');
    } catch (error) {
      console.error(error);
      status.textContent = errorText(error);
      notify(errorText(error), 'error');
    } finally {
      saving = false;
      setBusy(form, false);
      save.disabled = !changedControls().length;
    }
  });
}

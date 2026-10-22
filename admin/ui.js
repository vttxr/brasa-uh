import {decorateIcons} from '../cms/icons.js';
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'checked') node.checked = Boolean(value);
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  const items = Array.isArray(children) ? children : [children];
  for (const child of items) {
    if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  decorateIcons(node);
  return node;
}

export function clear(node, ...children) { node.replaceChildren(...children); }
export function button(label, onClick, className = 'button secondary') {
  return el('button', {type:'button', class:className, onclick:onClick}, label);
}
export function heading(title, description, actions) {
  return el('div', {class:'page-heading'}, [
    el('div', {}, [el('p', {class:'eyebrow', text:'BRASA UH · ADMINISTRAÇÃO'}), el('h1', {text:title}), el('p', {text:description})]),
    actions ? el('div', {class:'heading-actions'}, actions) : null
  ]);
}
export function loading(message = 'Carregando informações…') {
  return el('div', {class:'loading', role:'status'}, [el('span', {class:'spinner', 'aria-hidden':'true'}), message]);
}
export function emptyState(title, description, action) {
  return el('div', {class:'empty-state'}, [el('span', {class:'empty-icon', 'aria-hidden':'true', text:'✳'}), el('h3', {text:title}), el('p', {text:description}), action]);
}
export function errorText(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  if (message.includes('email not confirmed')) return 'Esta conta ainda não foi confirmada. Consulte a pessoa responsável pelo acesso.';
  if (code === '23505') return 'Já existe um registro com estes dados. Atualize a página e tente novamente.';
  if (code === '23514' || code === '22P02') return 'Algum campo não atende ao formato esperado. Confira os valores informados.';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied') || message.includes('unauthorized')) return 'Sua conta não tem permissão para esta ação. Verifique o acesso com a pessoa responsável.';
  if (code === '42P01' || code === 'PGRST205' || message.includes('schema cache')) return 'A configuração do banco ainda não está pronta. Confira as migrações no guia de instalação.';
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to load')) return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
  if (message.includes('rate limit') || error?.status === 429) return 'Foram feitas muitas tentativas. Aguarde um pouco e tente novamente.';
  if (message.includes('referenc') || message.includes('em uso')) return 'Esta imagem está vinculada ao conteúdo do site. Remova as referências antes de excluí-la.';
  if (error?.userMessage) return error.userMessage;
  return 'Não foi possível concluir a ação. Tente novamente. Se o problema continuar, consulte a pessoa responsável pela configuração.';
}
export function userError(message) { const error = new Error(message); error.userMessage = message; return error; }
export function showError(target, error, retry) {
  console.error('BRASA UH:', error);
  clear(target, el('div', {class:'error-card', role:'alert'}, [
    el('h2', {text:'Não foi possível carregar esta área.'}),
    el('p', {text:errorText(error)}),
    retry ? button('Tentar novamente', retry) : null
  ]));
}
export function notify(message, type = 'success') {
  const host = document.getElementById('notifications');
  const note = el('div', {class:'toast ' + type, role:type === 'error' ? 'alert' : 'status'}, [
    el('span', {text:message}),
    button('×', () => note.remove(), 'toast-close')
  ]);
  note.lastChild.setAttribute('aria-label', 'Fechar mensagem');
  host.append(note);
  setTimeout(() => note.remove(), type === 'error' ? 14000 : 7000);
}
export async function confirmAction({title, message, confirm = 'Confirmar', danger = false}) {
  return new Promise(resolve => {
    const dialog = el('dialog', {class:'confirm-dialog', 'aria-labelledby':'confirm-title'});
    let done = false;
    const cancel = button('Cancelar', () => finish(false), 'button secondary');
    const proceed = button(confirm, () => finish(true), danger ? 'button danger' : 'button');
    const finish = answer => { if (done) return; done = true; dialog.close(); dialog.remove(); resolve(answer); };
    dialog.append(el('h2', {id:'confirm-title', text:title}), el('p', {text:message}), el('div', {class:'dialog-actions'}, [cancel, proceed]));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', ...(withTime ? {timeStyle:'short'} : {}), timeZone:'America/Chicago'}).format(date);
}
export function formatEventDate(value) {
  if (!value) return 'Sem data';
  const parts = value.split('-');
  return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : value;
}
export async function allRows(client, table, columns = '*', modify = query => query) {
  const output = [];
  for (let offset = 0; ; offset += 500) {
    const result = await modify(client.from(table).select(columns)).range(offset, offset + 499);
    if (result.error) throw result.error;
    output.push(...(result.data || []));
    if ((result.data || []).length < 500) return output;
    if (offset >= 49500) throw userError('Há muitos registros para esta operação. Peça ajuda à pessoa responsável pelo sistema.');
  }
}
export function statusBadge(published) {
  return el('span', {class:'badge ' + (published ? 'published' : 'draft'), text:published ? 'Publicado' : 'Rascunho'});
}
export function field(label, control, hint) {
  const id = control.id || 'field-' + crypto.randomUUID();
  control.id = id;
  return el('div', {class:'field'}, [el('label', {for:id, text:label}), control, hint ? el('small', {class:'field-hint', text:hint}) : null]);
}
export function setBusy(form, busy) {
  form.setAttribute('aria-busy', String(busy));
  for (const control of form.querySelectorAll('button, input, textarea, select')) {
    if (busy) { control.dataset.wasDisabled = control.disabled ? '1' : '0'; control.disabled = true; }
    else if (control.dataset.wasDisabled !== undefined) { control.disabled = control.dataset.wasDisabled === '1'; delete control.dataset.wasDisabled; }
  }
}

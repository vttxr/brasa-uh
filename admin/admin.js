import {getAdminClient} from '../cms/client.js';
import {el, button, heading, loading, emptyState, notify, errorText, confirmAction, showError, formatDate, userError} from './ui.js';
import {renderPageEditor, renderSettings, getCatalog, getSettingsCatalog} from './content.js';
import {renderRecords} from './records.js';
import {renderImages} from './media.js';

const ROUTES = {
  overview:{title:'Visão Geral'},
  home:{title:'Página Inicial', page:'index'},
  about:{title:'Quem Somos', page:'quem-somos'},
  leadership:{title:'Diretoria', record:'leadership'},
  events:{title:'Calendário', record:'events'},
  partners:{title:'Parcerias', record:'partners'},
  join:{title:'Faça Parte', page:'faca-parte'},
  images:{title:'Gerenciar Imagens'},
  settings:{title:'Configurações'}
};
const boot = document.getElementById('boot');
const loginView = document.getElementById('login-view');
const shell = document.getElementById('app-shell');
const workspace = document.getElementById('workspace');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const restoreButton = document.getElementById('restore-session');
let client;
let authorizedUser = null;
let dirty = false;
let currentRoute = 'overview';
let checkingUser = null;
let authorizationPromise;
let sessionGeneration = 0;
let navigationPending = false;
let navigationGeneration = 0;

const ctx = {
  get client() { return client; },
  setDirty(value) {
    dirty = Boolean(value);
    document.title = (dirty ? '● ' : '') + (ROUTES[currentRoute]?.title || 'Administração') + ' | BRASA UH';
  },
  confirmLeave:async () => !dirty || await confirmAction({
    title:'Sair sem salvar?',
    message:'Há alterações pendentes nesta área. Se continuar, elas serão descartadas.',
    confirm:'Descartar e continuar',
    danger:true
  }),
  navigate
};
window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

function setSidebar(open) {
  shell.classList.toggle('sidebar-open', open);
  document.getElementById('sidebar-toggle').setAttribute('aria-expanded', String(open));
  document.getElementById('sidebar-toggle').setAttribute('aria-label', open ? 'Fechar navegação' : 'Abrir navegação');
  document.getElementById('sidebar-shade').hidden = !open;
}
document.getElementById('sidebar-toggle').addEventListener('click', () => setSidebar(!shell.classList.contains('sidebar-open')));
document.getElementById('sidebar-shade').addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setSidebar(false); });
document.getElementById('admin-nav').addEventListener('click', event => {
  const link = event.target.closest('[data-route]');
  if (!link) return;
  event.preventDefault();
  navigate(link.dataset.route);
});
document.querySelector('#sidebar > .brand').addEventListener('click', event => { event.preventDefault(); navigate('overview'); });
window.addEventListener('hashchange', async () => {
  if (!authorizedUser) return;
  const requested = location.hash.slice(1);
  if (requested === currentRoute) return;
  const accepted = await navigate(requested, false);
  if (!accepted) history.replaceState(null, '', '#' + currentRoute);
});

function showLogin(message = '', retry = false) {
  sessionGeneration++;
  navigationGeneration++;
  navigationPending = false;
  authorizedUser = null;
  ctx.setDirty(false);
  boot.hidden = true;
  shell.hidden = true;
  loginView.hidden = false;
  workspace.replaceChildren();
  for (const dialog of document.querySelectorAll('dialog')) { dialog.close(); dialog.remove(); }
  loginMessage.textContent = message;
  restoreButton.hidden = !retry;
  setSidebar(false);
}

async function authorize(session) {
  if (!session?.user?.id) { showLogin(); return false; }
  if (authorizedUser?.id === session.user.id) return true;
  if (checkingUser === session.user.id && authorizationPromise) return authorizationPromise;
  const generation = sessionGeneration;
  checkingUser = session.user.id;
  authorizationPromise = (async () => {
    const result = await client.from('admin_users').select('user_id,role').eq('user_id', session.user.id).maybeSingle();
    if (generation !== sessionGeneration) return false;
    if (result.error) {
      console.error('BRASA UH: autorização', result.error);
      showLogin('Não foi possível verificar a autorização desta conta. ' + errorText(result.error), true);
      return false;
    }
    if (!result.data?.user_id) {
      await client.auth.signOut({scope:'local'});
      showLogin('Esta conta não está autorizada a administrar a BRASA UH. Solicite acesso à pessoa responsável.');
      return false;
    }
    authorizedUser = session.user;
    loginView.hidden = true;
    boot.hidden = true;
    shell.hidden = false;
    restoreButton.hidden = true;
    document.getElementById('account-email').textContent = session.user.email || 'Administrador';
    document.getElementById('login-password').value = '';
    await navigate(location.hash.slice(1) || 'overview', false, true);
    return true;
  })().catch(error => {
    if (generation === sessionGeneration) showLogin(errorText(error), true);
    return false;
  }).finally(() => { checkingUser = null; authorizationPromise = undefined; });
  return authorizationPromise;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const submit = document.getElementById('login-submit');
  submit.disabled = true;
  submit.textContent = 'Verificando acesso…';
  loginMessage.textContent = '';
  try {
    if (!client) client = await getAdminClient();
    const {data, error} = await client.auth.signInWithPassword({
      email:document.getElementById('login-email').value.trim(),
      password:document.getElementById('login-password').value
    });
    if (error) throw error;
    await authorize(data.session);
  } catch (error) {
    console.error('BRASA UH: autenticação', error);
    loginMessage.textContent = errorText(error);
  } finally { submit.disabled = false; submit.textContent = 'Entrar no painel ↗'; }
});
restoreButton.addEventListener('click', async () => {
  restoreButton.disabled = true;
  loginMessage.textContent = 'Verificando sessão…';
  try {
    if (!client) client = await getAdminClient();
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await authorize(data.session);
    else showLogin('Sua sessão não está mais disponível. Entre novamente.');
  } catch (error) { loginMessage.textContent = errorText(error); }
  finally { restoreButton.disabled = false; }
});
document.getElementById('logout').addEventListener('click', async () => {
  if (!await ctx.confirmLeave()) return;
  const button = document.getElementById('logout');
  button.disabled = true;
  try {
    const {error} = await client.auth.signOut({scope:'local'});
    if (error) throw error;
    showLogin('Você saiu do painel.');
  } catch (error) { notify(errorText(error), 'error'); }
  finally { button.disabled = false; }
});

async function navigate(route, updateHistory = true, force = false) {
  if (!authorizedUser || navigationPending) return false;
  const key = Object.hasOwn(ROUTES, route) ? route : 'overview';
  if (!force && key === currentRoute && workspace.childElementCount) { setSidebar(false); return true; }
  navigationPending = true;
  const generation = navigationGeneration;
  try {
    if (!force && !await ctx.confirmLeave()) return false;
    if (generation !== navigationGeneration || !authorizedUser) return false;
    ctx.setDirty(false);
    currentRoute = key;
    ctx.setDirty(false);
    if (updateHistory) history.pushState(null, '', '#' + key);
    setSidebar(false);
    document.querySelectorAll('[data-route]').forEach(link => {
      if (link.dataset.route === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const stage = el('div', {class:'page-content'});
    workspace.replaceChildren(stage);
    workspace.focus({preventScroll:true});
    window.scrollTo({top:0, behavior:'instant'});
    const config = ROUTES[key];
    try {
      if (config.page) await renderPageEditor(stage, ctx, config.page);
      else if (config.record) await renderRecords(stage, ctx, config.record);
      else if (key === 'images') await renderImages(stage, ctx);
      else if (key === 'settings') await renderSettings(stage, ctx);
      else await renderOverview(stage);
    } catch (error) { showError(stage, error, () => navigate(key, false, true)); }
    return true;
  } finally { if (generation === navigationGeneration) navigationPending = false; }
}

async function renderOverview(target) {
  target.append(heading('Visão Geral', 'Acompanhe o conteúdo da BRASA UH e continue de onde parou.', [
    el('a', {href:'../index.html', target:'_blank', rel:'noopener noreferrer', class:'button secondary'}, 'Ver site público ↗')
  ]));
  const body = el('div', {}, [loading('Buscando os números da comunidade…')]);
  target.append(body);
  const load = async () => {
    body.replaceChildren(loading());
    try {
      const requests = [
        client.from('leadership_members').select('id', {count:'exact', head:true}).eq('published', true),
        client.from('events').select('id', {count:'exact', head:true}),
        client.from('partners').select('id', {count:'exact', head:true}),
        client.from('site_content').select('page,section,field,updated_at').order('updated_at', {ascending:false}).limit(5),
        client.from('leadership_members').select('full_name,updated_at').order('updated_at', {ascending:false}).limit(4),
        client.from('events').select('title,updated_at').order('updated_at', {ascending:false}).limit(4),
        client.from('partners').select('name,updated_at').order('updated_at', {ascending:false}).limit(4),
        client.from('site_settings').select('key,updated_at').order('updated_at', {ascending:false}).limit(3)
      ];
      const [results, contentCatalog, settingsCatalog] = await Promise.all([
        Promise.all(requests),
        getCatalog().catch(() => []),
        getSettingsCatalog().catch(() => [])
      ]);
      const contentLabels = new Map(contentCatalog.map(item => [item.page + '/' + item.section + '/' + item.field, item.label]));
      const settingsLabels = new Map(settingsCatalog.map(item => [item.key, item.label]));
      const failed = results.find(result => result.error);
      if (failed) throw failed.error;
      const cards = [
        {value:results[0].count, label:'Integrantes publicados', hint:'Pessoas que aparecem na diretoria', route:'leadership', icon:'♧'},
        {value:results[1].count, label:'Eventos cadastrados', hint:'Publicados e rascunhos', route:'events', icon:'▦'},
        {value:results[2].count, label:'Parcerias cadastradas', hint:'Conexões da comunidade local', route:'partners', icon:'↗'}
      ];
      const metrics = el('div', {class:'metrics-grid'}, cards.map(card => el('article', {class:'metric-card'}, [
        el('div', {class:'metric-top'}, [el('span', {text:card.label}), el('span', {'aria-hidden':'true', text:card.icon})]),
        el('strong', {text:String(card.value ?? 0)}), el('p', {text:card.hint}),
        button('Gerenciar →', () => navigate(card.route), 'text-button')
      ])));
      const pageRoute = {'index':'home', 'quem-somos':'about', 'diretoria':'leadership', 'calendario':'events', 'parcerias':'partners', 'faca-parte':'join', 'shared':'settings'};
      const recent = [
        ...(results[3].data || []).map(row => ({title:row.page === 'shared' ? 'Cabeçalho e rodapé' : ROUTES[pageRoute[row.page]]?.title || 'Conteúdo do site', detail:contentLabels.get(row.page + '/' + row.section + '/' + row.field) || 'Conteúdo da página atualizado', date:row.updated_at, route:pageRoute[row.page] || 'settings'})),
        ...(results[4].data || []).map(row => ({title:row.full_name, detail:'Diretoria', date:row.updated_at, route:'leadership'})),
        ...(results[5].data || []).map(row => ({title:row.title, detail:'Calendário', date:row.updated_at, route:'events'})),
        ...(results[6].data || []).map(row => ({title:row.name, detail:'Parcerias', date:row.updated_at, route:'partners'})),
        ...(results[7].data || []).map(row => ({title:settingsLabels.get(row.key) || 'Configurações do site', detail:'Configuração atualizada', date:row.updated_at, route:'settings'}))
      ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 7);
      const activity = el('section', {class:'panel activity-panel'}, [
        el('div', {class:'panel-heading'}, [el('h2', {text:'Atualizações recentes'}), el('span', {class:'muted', text:'Horário de Houston'})]),
        recent.length ? el('ul', {class:'activity-list'}, recent.map(item => el('li', {}, [
          el('div', {}, [button(item.title, () => navigate(item.route), 'activity-link'), el('small', {text:item.detail})]),
          el('time', {datetime:item.date, text:formatDate(item.date, true)})
        ]))) : emptyState('O próximo capítulo começa aqui.', 'Os conteúdos salvos aparecem nesta lista.')
      ]);
      const quickLinks = el('section', {class:'panel quick-panel'}, [
        el('h2', {text:'Por onde vamos começar?'}),
        el('p', {text:'Atalhos para cuidar do que a comunidade vê.'}),
        button('Editar página inicial ↗', () => navigate('home'), 'quick-link'),
        button('Organizar o calendário ↗', () => navigate('events'), 'quick-link'),
        button('Enviar novas imagens ↗', () => navigate('images'), 'quick-link'),
        el('div', {class:'quick-note'}, [el('span', {'aria-hidden':'true', text:'✳'}), el('p', {text:'Seus conteúdos publicados aparecem no site sem um novo deploy.'})])
      ]);
      body.replaceChildren(metrics, el('div', {class:'overview-grid'}, [activity, quickLinks]));
    } catch (error) { showError(body, error, load); }
  };
  await load();
}

async function start() {
  try {
    client = await getAdminClient();
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') showLogin('Sua sessão foi encerrada. Entre novamente para continuar.');
      else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id !== authorizedUser?.id) {
        // Auth callbacks must return before querying the same client.
        setTimeout(() => authorize(session), 0);
      }
    });
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await authorize(data.session);
    else showLogin();
  } catch (error) {
    console.error('BRASA UH: inicialização', error);
    showLogin('Não foi possível iniciar o painel. ' + errorText(error), true);
  }
}
start();

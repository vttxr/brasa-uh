import {safeImage, safeLink} from '../cms/safety.js';
import {el, button, field, loading, heading, emptyState, notify, errorText, confirmAction, showError, allRows, formatEventDate, statusBadge, setBusy, userError} from './ui.js';
import {createImageField} from './media.js';
import {renderPageEditor} from './content.js';

export const RECORD_TYPES = {
  leadership: {
    table:'leadership_members', page:'diretoria', title:'Diretoria', singular:'integrante', titleKey:'full_name', imageKey:'photo_url',
    description:'Apresente as pessoas que fazem a BRASA UH acontecer.', add:'Adicionar integrante',
    fields:[
      {key:'full_name', label:'Nome completo', required:true, max:200},
      {key:'role', label:'Cargo', required:true, max:200},
      {key:'biography', label:'Biografia', type:'textarea', max:10000},
      {key:'photo_url', label:'Foto do perfil', type:'image'},
      {key:'linkedin_url', label:'Perfil no LinkedIn', type:'url'}
    ]
  },
  events: {
    table:'events', page:'calendario', title:'Calendário', singular:'evento', titleKey:'title', imageKey:'image_url',
    description:'Organize os próximos encontros da comunidade.', add:'Adicionar evento',
    fields:[
      {key:'title', label:'Título do evento', required:true, max:300},
      {key:'description', label:'Descrição', type:'textarea', max:10000},
      {key:'event_date', label:'Data', type:'date', required:true},
      {key:'start_time', label:'Horário de início', type:'time'},
      {key:'end_time', label:'Horário de encerramento', type:'time'},
      {key:'location', label:'Local', max:500},
      {key:'category', label:'Categoria', type:'select', options:['Cultura','Social','Carreira','Comunidade']},
      {key:'registration_url', label:'Link de inscrição', type:'url'},
      {key:'image_url', label:'Imagem do evento', type:'image'}
    ]
  },
  partners: {
    table:'partners', page:'parcerias', title:'Parcerias', singular:'parceiro', titleKey:'name', imageKey:'logo_url',
    description:'Gerencie as organizações e os benefícios da rede local.', add:'Adicionar parceiro',
    fields:[
      {key:'name', label:'Nome da organização', required:true, max:200},
      {key:'description', label:'Sobre a organização', type:'textarea', max:10000},
      {key:'logo_url', label:'Logo', type:'image'},
      {key:'website_url', label:'Site da organização', type:'url'},
      {key:'benefit', label:'Benefícios da parceria', type:'textarea', max:10000},
      {key:'conditions', label:'Condições para utilizar', type:'textarea', max:10000}
    ]
  }
};

export async function renderRecords(target, ctx, type) {
  const spec = RECORD_TYPES[type];
  target.append(heading(spec.title, spec.description));
  const content = el('div');
  const recordsTab = button('Gerenciar ' + (type === 'leadership' ? 'integrantes' : type === 'events' ? 'eventos' : 'parceiros'), () => switchTab('records'), 'tab-button active');
  const textsTab = button('Textos e links da página', () => switchTab('texts'), 'tab-button');
  target.append(el('div', {class:'editor-tabs', role:'group', 'aria-label':'Áreas desta página'}, [recordsTab, textsTab]), content);
  let current = 'records';
  async function switchTab(next) {
    if (current === next) return;
    if (!await ctx.confirmLeave()) return;
    current = next;
    ctx.setDirty(false);
    recordsTab.classList.toggle('active', next === 'records');
    textsTab.classList.toggle('active', next === 'texts');
    content.replaceChildren();
    if (next === 'texts') await renderPageEditor(content, ctx, spec.page, {embedded:true});
    else await renderList();
  }
  async function renderList() {
    const list = el('div', {}, [loading()]);
    const search = el('input', {type:'search', placeholder:'Buscar por nome ou título…', 'aria-label':'Buscar registros'});
    const filter = el('select', {'aria-label':'Filtrar por publicação'}, [
      el('option', {value:'all', text:'Todos os registros'}),
      el('option', {value:'published', text:'Publicados'}),
      el('option', {value:'draft', text:'Rascunhos'})
    ]);
    let rows = [];
    let operation = false;
    const add = button(spec.add + ' +', async () => {
      const nextOrder = Math.max(0, ...rows.map(row => row.display_order || 0)) + 10;
      if (await editRecord(ctx, spec, {display_order:nextOrder, published:false, category:'Comunidade'})) await refresh();
    }, 'button');
    content.replaceChildren(el('div', {class:'list-toolbar'}, [search, filter, add]), list);
    if (type !== 'events') content.append(el('p', {class:'field-hint', text:'As setas alteram a ordem de exibição. Para reordenar, mantenha a busca vazia e o filtro em “Todos os registros”.'}));
    search.addEventListener('input', draw);
    filter.addEventListener('change', draw);
    async function refresh() {
      list.replaceChildren(loading());
      try {
        rows = await allRows(ctx.client, spec.table, '*', query => type === 'events' ?
          query.order('event_date', {ascending:false}).order('start_time', {ascending:true}).order('id') :
          query.order('display_order', {ascending:true}).order('created_at', {ascending:true}).order('id'));
        draw();
      } catch (error) { showError(list, error, refresh); }
    }
    async function mutate(action, success) {
      if (operation) return;
      operation = true;
      setBusy(content, true);
      try { await action(); notify(success); await refresh(); }
      catch (error) { console.error(error); notify(errorText(error), 'error'); }
      finally { operation = false; setBusy(content, false); }
    }
    async function reorder(row, direction) {
      const index = rows.findIndex(item => item.id === row.id);
      const destination = index + direction;
      if (destination < 0 || destination >= rows.length) return;
      const ordered = [...rows];
      [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
      await mutate(async () => {
        const {data, error} = await ctx.client.rpc('reorder_cms_records', {
          entity:spec.table,
          ordered_ids:ordered.map(item => item.id)
        });
        if (error) throw error;
        if (data !== ordered.length) throw userError('Não foi possível confirmar a nova ordem. Atualize a lista antes de tentar novamente.');
      }, 'Ordem de exibição atualizada.');
    }
    function draw() {
      const query = search.value.trim().toLocaleLowerCase('pt-BR');
      const visible = rows.filter(row => {
        const matches = (row[spec.titleKey] + ' ' + (row.role || row.location || '')).toLocaleLowerCase('pt-BR').includes(query);
        return matches && (filter.value === 'all' || (filter.value === 'published' ? row.published : !row.published));
      });
      if (!visible.length) {
        list.replaceChildren(emptyState(rows.length ? 'Nenhum registro encontrado.' : 'Tudo pronto para começar.', rows.length ? 'Altere a busca ou o filtro para encontrar o conteúdo.' : 'Adicione o primeiro ' + spec.singular + ' quando tiver as informações confirmadas.'));
        return;
      }
      const stack = el('div', {class:'record-list'});
      for (const row of visible) {
        const index = rows.findIndex(item => item.id === row.id);
        const imageURL = safeImage(row[spec.imageKey]);
        const thumb = imageURL ? el('img', {class:'record-thumbnail', src:imageURL, alt:'', loading:'lazy'}) : el('span', {class:'record-initials', 'aria-hidden':'true', text:initials(row[spec.titleKey])});
        const description = type === 'leadership' ? row.role : type === 'events' ? formatEventDate(row.event_date) + (row.start_time ? ' · ' + row.start_time.slice(0, 5) : '') + ' · ' + row.category : row.benefit || row.description;
        const edit = button('Editar', async () => { if (await editRecord(ctx, spec, row)) await refresh(); }, 'button secondary compact');
        const publish = button(row.published ? 'Despublicar' : 'Publicar', () => mutate(async () => {
          const result = await ctx.client.from(spec.table).update({published:!row.published}).eq('id', row.id).select('id').single();
          if (result.error) throw result.error;
        }, row.published ? 'Registro movido para rascunho.' : 'Registro publicado.'), 'text-button');
        const remove = button('Excluir', async () => {
          if (!await confirmAction({title:'Excluir ' + spec.singular + '?', message:'“' + row[spec.titleKey] + '” será removido permanentemente. A imagem associada permanecerá na biblioteca.', confirm:'Excluir', danger:true})) return;
          await mutate(async () => {
            const result = await ctx.client.from(spec.table).delete().eq('id', row.id).select('id').single();
            if (result.error) throw result.error;
          }, 'Registro excluído.');
        }, 'text-button danger-text');
        const actions = [edit, publish, remove];
        if (type !== 'events') {
          const up = button('↑', () => reorder(row, -1), 'icon-button');
          const down = button('↓', () => reorder(row, 1), 'icon-button');
          up.setAttribute('aria-label', 'Mover ' + row[spec.titleKey] + ' para cima');
          down.setAttribute('aria-label', 'Mover ' + row[spec.titleKey] + ' para baixo');
          up.disabled = index === 0 || Boolean(query) || filter.value !== 'all';
          down.disabled = index === rows.length - 1 || Boolean(query) || filter.value !== 'all';
          actions.unshift(el('div', {class:'reorder-buttons'}, [up, down]));
        }
        stack.append(el('article', {class:'record-row'}, [
          thumb,
          el('div', {class:'record-info'}, [el('h3', {text:row[spec.titleKey]}), el('p', {text:description || ''}), statusBadge(row.published)]),
          el('div', {class:'record-actions'}, actions)
        ]));
      }
      list.replaceChildren(el('p', {class:'result-count', text:visible.length + ' registro(s) · ' + rows.filter(row => row.published).length + ' publicado(s)'}), stack);
    }
    await refresh();
  }
  await renderList();
}

function initials(name = '') {
  const words = String(name).trim().split(/\s+/);
  return (words[0]?.[0] || '') + (words.length > 1 ? words[words.length - 1][0] : '');
}

export async function editRecord(ctx, spec, record) {
  return new Promise(resolve => {
    let dirty = false;
    let saving = false;
    let finished = false;
    const controls = new Map();
    const form = el('form', {class:'record-form'});
    const dialog = el('dialog', {class:'record-dialog', 'aria-label':(record.id ? 'Editar ' : 'Adicionar ') + spec.singular});
    const preview = el('div', {class:'record-preview'});
    const formError = el('p', {class:'form-message error-text', role:'alert'});
    const markChanged = () => { if (!dialog.isConnected) return; dirty = true; ctx.setDirty(true); updatePreview(); };
    const close = async () => {
      if (saving) return;
      if ([...controls.values()].some(item => item.image?.isBusy())) { notify('Aguarde o envio da imagem terminar antes de fechar.', 'error'); return; }
      if (dirty && !await confirmAction({title:'Descartar alterações?', message:'As mudanças deste formulário ainda não foram salvas.', confirm:'Descartar', danger:true})) return;
      finish(false);
    };
    const finish = saved => {
      if (finished) return;
      finished = true;
      if (dialog.isConnected) ctx.setDirty(false);
      dialog.close();
      dialog.remove();
      resolve(saved);
    };
    dialog.append(el('div', {class:'dialog-heading'}, [el('div', {}, [el('p', {class:'eyebrow', text:spec.title.toLocaleUpperCase('pt-BR')}), el('h2', {text:(record.id ? 'Editar ' : 'Novo ') + spec.singular})]), button('Fechar ×', close, 'text-button')]));
    for (const definition of spec.fields) {
      if (definition.type === 'image') {
        const image = createImageField(ctx, record[definition.key] || '', definition.label, markChanged);
        controls.set(definition.key, {definition, image, value:() => image.getValue()});
        form.append(image.node);
        continue;
      }
      let input;
      if (definition.type === 'textarea') input = el('textarea', {rows:4, maxlength:definition.max, value:record[definition.key] || ''});
      else if (definition.type === 'select') {
        input = el('select', {}, definition.options.map(option => el('option', {value:option, text:option})));
        input.value = record[definition.key] || definition.options[0];
      } else input = el('input', {
        type:definition.type === 'url' ? 'text' : definition.type || 'text',
        value:record[definition.key] || '', required:definition.required || false,
        maxlength:definition.max || (definition.type === 'url' ? 2048 : undefined), autocomplete:'off',
        ...(definition.type === 'time' ? {step:60} : {})
      });
      input.addEventListener('input', markChanged);
      input.addEventListener('change', markChanged);
      controls.set(definition.key, {definition, input, value:() => input.value.trim()});
      const hint = definition.type === 'time' || definition.type === 'date' ? (definition.key === 'end_time' ? 'Horário de Houston. Se for anterior ao início, o evento termina no dia seguinte.' : 'Horário local de Houston · America/Chicago.') :
        definition.type === 'url' ? 'Use um endereço HTTPS completo ou um link interno válido.' : undefined;
      form.append(field(definition.label + (definition.required ? ' *' : ''), input, hint));
    }
    const published = el('input', {type:'checkbox', checked:record.published === true});
    published.addEventListener('change', markChanged);
    form.append(el('div', {class:'publish-option'}, [
      el('label', {class:'checkbox-label'}, [published, 'Publicar no site']),
      el('small', {text:'Desmarcado: o registro fica como rascunho e não aparece para visitantes.'})
    ]));
    const save = el('button', {type:'submit', class:'button'}, record.id ? 'Salvar alterações' : 'Criar ' + spec.singular);
    form.append(formError, el('div', {class:'dialog-actions sticky-actions'}, [button('Cancelar', close), save]));
    dialog.append(el('div', {class:'record-editor-layout'}, [form, el('aside', {class:'record-preview-pane'}, [el('p', {class:'eyebrow', text:'PRÉVIA DO CONTEÚDO'}), preview, el('small', {class:'field-hint', text:'O site utiliza a apresentação visual da página correspondente.'})])]));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => finish(false));
    document.body.append(dialog);
    dialog.showModal();
    updatePreview();
    form.querySelector('input, textarea')?.focus();
    function updatePreview() {
      const title = controls.get(spec.titleKey)?.value() || (record.id ? record[spec.titleKey] : 'Nome ou título');
      const imageURL = safeImage(controls.get(spec.imageKey)?.value());
      const subtitleKey = spec.table === 'leadership_members' ? 'role' : spec.table === 'events' ? 'location' : 'benefit';
      preview.replaceChildren(...[
        imageURL ? el('img', {src:imageURL, alt:'Prévia da imagem', class:'record-preview-image'}) : el('div', {class:'preview-placeholder', 'aria-hidden':'true', text:initials(title)}),
        el('h3', {text:title}),
        el('p', {text:controls.get(subtitleKey)?.value() || ''}),
        spec.table === 'events' ? el('p', {text:formatEventDate(controls.get('event_date')?.value()) + ' · ' + (controls.get('start_time')?.value() || 'Horário a confirmar')}) : null,
        statusBadge(published.checked)
      ].filter(Boolean));
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving) return;
      if ([...controls.values()].some(item => item.image?.isBusy())) { formError.textContent = 'Aguarde o envio da imagem terminar antes de salvar.'; return; }
      if (!form.reportValidity()) return;
      try {
        const payload = {published:published.checked};
        for (const [key, item] of controls) {
          const value = item.value();
          const definition = item.definition;
          if (definition.required && !value) throw userError('Preencha o campo "' + definition.label + '".');
          if (definition.type === 'url' && value && !safeLink(value)) throw userError('Confira o endereço no campo "' + definition.label + '".');
          if (definition.type === 'image' && value && !safeImage(value)) throw userError('Escolha uma imagem válida no campo "' + definition.label + '".');
          if (definition.type === 'select' && !definition.options.includes(value)) throw userError('Escolha uma categoria válida.');
          payload[key] = definition.type === 'time' && !value ? null : value;
        }
        if (spec.table === 'events') {
          if (payload.end_time && !payload.start_time) throw userError('Informe o horário de início antes de definir o encerramento.');
        } else if (!record.id) payload.display_order = record.display_order || 0;
        saving = true;
        setBusy(form, true);
        formError.textContent = '';
        save.textContent = 'Salvando…';
        const query = record.id ? ctx.client.from(spec.table).update(payload).eq('id', record.id) : ctx.client.from(spec.table).insert(payload);
        const result = await query.select('id').single();
        if (result.error) throw result.error;
        if (!result.data?.id) throw userError('Não foi possível confirmar o salvamento. Atualize a lista antes de tentar novamente.');
        notify('Registro salvo ' + (payload.published ? 'e publicado.' : 'como rascunho.'));
        finish(true);
      } catch (error) { console.error(error); formError.textContent = errorText(error); }
      finally { saving = false; setBusy(form, false); save.textContent = record.id ? 'Salvar alterações' : 'Criar ' + spec.singular; }
    });
  });
}

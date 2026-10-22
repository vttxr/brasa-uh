import {safeImage, validateImage, makeImagePath} from '../cms/safety.js';
import {el, button, field, loading, emptyState, notify, errorText, confirmAction, showError, allRows, formatDate, userError} from './ui.js';

const BUCKET = 'site-images';
const MIME_BY_EXTENSION = {jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp'};

export async function uploadImage(client, file, onProgress = () => {}) {
  onProgress('Validando a imagem…');
  try { await validateImage(file); }
  catch (error) { throw userError(error.message || 'Escolha um arquivo JPG, PNG ou WebP válido de até 5 MB.'); }
  onProgress('Enviando a imagem…');
  const path = await makeImagePath(file);
  const type = file.type || MIME_BY_EXTENSION[file.name.split('.').pop().toLowerCase()];
  const {error} = await client.storage.from(BUCKET).upload(path, file, {cacheControl:'3600', upsert:false, contentType:type});
  if (error) throw error;
  const {data} = client.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw userError('O envio terminou, mas não foi possível obter o endereço da imagem. Consulte a biblioteca antes de tentar novamente.');
  onProgress('Imagem enviada. Salve o conteúdo para usá-la no site.');
  return data.publicUrl;
}

export async function listImages(client) {
  const folders = [''];
  const files = [];
  let visited = 0;
  while (folders.length) {
    const folder = folders.shift();
    if (++visited > 1000) throw userError('A biblioteca tem muitas pastas. Consulte a pessoa responsável para organizar os arquivos.');
    for (let offset = 0; ; offset += 100) {
      const {data, error} = await client.storage.from(BUCKET).list(folder, {limit:100, offset, sortBy:{column:'name', order:'asc'}});
      if (error) throw error;
      for (const entry of data || []) {
        const path = folder ? folder + '/' + entry.name : entry.name;
        if (!entry.id && !entry.metadata) folders.push(path);
        else {
          const {data:publicData} = client.storage.from(BUCKET).getPublicUrl(path);
          files.push({...entry, path, url:publicData.publicUrl});
        }
      }
      if ((data || []).length < 100) break;
      if (offset >= 9900) throw userError('Esta pasta tem muitos arquivos. Peça ajuda à pessoa responsável pelo sistema.');
    }
  }
  return files.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function imagePreview(value, className = 'image-preview') {
  const url = safeImage(value);
  const image = el('img', {class:className, alt:'Prévia da imagem selecionada', loading:'lazy'});
  if (url) image.src = url;
  else image.hidden = true;
  image.addEventListener('error', () => { image.hidden = true; });
  return image;
}

export function createImageField(ctx, value = '', label = 'Imagem', onChange = () => {}) {
  const input = el('input', {type:'text', value, maxlength:2048, placeholder:'URL da imagem ou assets/arquivo.jpg', autocomplete:'off'});
  const preview = imagePreview(value);
  const progress = el('progress', {'aria-label':'Envio de imagem', hidden:true});
  const message = el('p', {class:'upload-message', role:'status'});
  const fileInput = el('input', {type:'file', accept:'image/jpeg,image/png,image/webp', class:'visually-hidden', tabindex:'-1'});
  let busy = false;
  const update = next => {
    input.value = next;
    const url = safeImage(next);
    preview.hidden = !url;
    if (url) preview.src = url;
    else preview.removeAttribute('src');
    onChange(next);
  };
  const upload = button('Enviar imagem', () => fileInput.click(), 'button secondary compact');
  const library = button('Escolher na biblioteca', async () => {
    const selected = await chooseImage(ctx);
    if (selected) update(selected.url);
  }, 'button secondary compact');
  const remove = button('Remover referência', () => update(''), 'text-button');
  input.addEventListener('input', () => update(input.value));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    busy = true;
    progress.hidden = false;
    upload.disabled = library.disabled = input.disabled = remove.disabled = true;
    try {
      const url = await uploadImage(ctx.client, file, text => { message.textContent = text; });
      update(url);
      message.className = 'upload-message success-text';
    } catch (error) {
      console.error('BRASA UH: upload', error);
      message.textContent = errorText(error);
      message.className = 'upload-message error-text';
    } finally {
      busy = false;
      progress.hidden = true;
      upload.disabled = library.disabled = input.disabled = remove.disabled = false;
      fileInput.value = '';
    }
  });
  const container = el('div', {class:'image-field'}, [
    field(label, input, 'JPG, PNG ou WebP, até 5 MB. Imagens locais existentes continuam funcionando.'),
    el('div', {class:'image-field-actions'}, [upload, library, remove, fileInput]),
    progress, message, preview,
    el('small', {class:'field-hint', text:'Trocar a imagem não exclui o arquivo anterior da biblioteca.'})
  ]);
  return {node:container, getValue:() => input.value.trim(), isBusy:() => busy, focus:() => input.focus()};
}

export async function chooseImage(ctx) {
  const dialog = el('dialog', {class:'library-dialog', 'aria-label':'Escolher imagem da biblioteca'});
  const container = el('div', {class:'library-content'}, [loading()]);
  let done = false;
  return new Promise(resolve => {
    const finish = value => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      el('div', {class:'dialog-heading'}, [el('h2', {text:'Escolher imagem'}), button('Fechar', () => finish(null), 'text-button')]),
      el('p', {text:'Selecione uma imagem já enviada para reutilizá-la.'}),
      container
    );
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    document.body.append(dialog);
    dialog.showModal();
    listImages(ctx.client).then(images => {
      if (!images.length) {
        container.replaceChildren(emptyState('Sua biblioteca está vazia.', 'Envie uma imagem pelo formulário ou pelo gerenciador.'));
        return;
      }
      const grid = el('div', {class:'media-grid picker-grid'});
      for (const image of images) {
        const pick = button('', () => finish(image), 'image-pick');
        pick.setAttribute('aria-label', 'Usar imagem ' + image.name);
        pick.append(imagePreview(image.url, 'media-thumbnail'), el('span', {text:image.name}));
        grid.append(pick);
      }
      container.replaceChildren(grid);
    }).catch(error => showError(container, error, () => { finish(null); }));
  });
}

// Mirrors the backend reference check, including links and direct object paths.
export function storageObjectName(value) {
  let reference = String(value || '').trim().split(/[?#]/, 1)[0];
  if (!reference) return '';
  const match = reference.match(/^(?:https?:\/\/[^/]+)?\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/site-images\/(.+)$/i);
  if (match) reference = match[1];
  else if (reference.startsWith('site-images/')) reference = reference.slice(12);
  else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(reference) || reference.startsWith('/')) return '';
  try {
    // SQL decodes valid %HH bytes while keeping a malformed '%' literal.
    // Decode once; invalid UTF-8 or NUL falls back to the original object path.
    const decoded = decodeURIComponent(reference.replace(/%(?![0-9a-f]{2})/ig, '%25'));
    return decoded.includes('\0') ? reference : decoded;
  } catch { return reference; }
}

export async function imageReferences(client, imageURL) {
  const target = storageObjectName(imageURL);
  if (!target) throw userError('Não foi possível verificar o endereço deste arquivo.');
  const requests = [
    ['site_content', 'page,section,field,kind,value', row => [row.value], row => 'Conteúdo: ' + row.page + ' / ' + row.section + ' / ' + row.field],
    ['site_settings', 'key,kind,value', row => [row.value], row => 'Configuração: ' + row.key],
    ['leadership_members', 'full_name,photo_url,linkedin_url', row => [row.photo_url, row.linkedin_url], row => 'Diretoria: ' + row.full_name],
    ['events', 'title,image_url,registration_url', row => [row.image_url, row.registration_url], row => 'Evento: ' + row.title],
    ['partners', 'name,logo_url,website_url', row => [row.logo_url, row.website_url], row => 'Parceria: ' + row.name]
  ];
  const results = await Promise.all(requests.map(async ([table, columns, value, label]) => {
    const rows = await allRows(client, table, columns, query => query.order(table === 'site_settings' ? 'key' : 'id'));
    return rows.filter(row => value(row).some(reference => storageObjectName(reference) === target)).map(label);
  }));
  return results.flat();
}

export async function renderImages(target, ctx) {
  const add = button('Enviar imagem +', () => file.click(), 'button');
  const file = el('input', {type:'file', accept:'image/jpeg,image/png,image/webp', class:'visually-hidden'});
  const progress = el('progress', {'aria-label':'Envio de imagem', hidden:true});
  const message = el('p', {class:'upload-message', role:'status'});
  const content = el('div', {}, [loading()]);
  const search = el('input', {type:'search', placeholder:'Buscar pelo nome do arquivo…', 'aria-label':'Buscar imagens'});
  target.append(
    el('div', {class:'page-heading'}, [el('div', {}, [el('p', {class:'eyebrow', text:'BIBLIOTECA BRASA UH'}), el('h1', {text:'Gerenciar Imagens'}), el('p', {text:'Envie, reutilize e organize as imagens do site.'})]), add]),
    el('div', {class:'info-banner'}, 'Imagens enviadas são públicas. A exclusão verifica referências em textos, configurações, diretoria, eventos e parceiros, incluindo rascunhos. Os arquivos locais em assets/ permanecem no projeto.'),
    el('div', {class:'media-toolbar'}, [search, file]), progress, message, content
  );
  let images = [];
  let operation = false;
  const draw = () => {
    const query = search.value.toLocaleLowerCase('pt-BR');
    const visible = images.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(query));
    if (!visible.length) {
      content.replaceChildren(emptyState(images.length ? 'Nenhuma imagem encontrada.' : 'Sua biblioteca começa aqui.', images.length ? 'Tente buscar por outro nome.' : 'Envie a primeira imagem para usá-la nos conteúdos do site.'));
      return;
    }
    const grid = el('div', {class:'media-grid'});
    for (const image of visible) {
      const link = el('a', {href:safeImage(image.url), target:'_blank', rel:'noopener noreferrer', class:'media-preview-link', 'aria-label':'Abrir imagem ' + image.name}, imagePreview(image.url, 'media-thumbnail'));
      const copy = button('Copiar URL', async () => {
        try { await navigator.clipboard.writeText(image.url); notify('Endereço da imagem copiado.'); }
        catch { notify('Não foi possível copiar automaticamente. Abra a imagem e copie o endereço.', 'error'); }
      }, 'text-button');
      const remove = button('Excluir', async () => {
        if (operation) return;
        operation = true;
        remove.disabled = true;
        try {
          let references = await imageReferences(ctx.client, image.url);
          if (references.length) {
            await confirmAction({title:'Esta imagem está em uso.', message:'Antes de excluir, remova as referências: ' + references.slice(0, 8).join('; ') + (references.length > 8 ? '; e outras ' + (references.length - 8) + '.' : '.'), confirm:'Entendi'});
            return;
          }
          if (!await confirmAction({title:'Excluir imagem?', message:'O arquivo ' + image.name + ' será removido permanentemente da biblioteca. Nenhum conteúdo, nem rascunho, usa esta imagem no momento.', confirm:'Excluir imagem', danger:true})) return;
          references = await imageReferences(ctx.client, image.url);
          if (references.length) throw userError('Esta imagem passou a ser usada por um conteúdo. Atualize a lista e confira as referências.');
          const {data, error} = await ctx.client.storage.from(BUCKET).remove([image.path]);
          if (error) throw error;
          if (!Array.isArray(data) || data.length !== 1) throw userError('A exclusão não foi confirmada. O arquivo pode estar em uso ou seu acesso pode ter mudado. Atualize a biblioteca antes de tentar novamente.');
          images = images.filter(item => item.path !== image.path);
          draw();
          notify('Imagem excluída da biblioteca.');
        } catch (error) { console.error(error); notify(errorText(error), 'error'); }
        finally { operation = false; remove.disabled = false; }
      }, 'text-button danger-text');
      const size = image.metadata?.size ? (image.metadata.size / 1024).toFixed(0) + ' KB · ' : '';
      grid.append(el('article', {class:'media-card'}, [
        link,
        el('div', {class:'media-card-body'}, [el('h3', {text:image.name}), el('p', {text:size + formatDate(image.created_at)}), el('div', {class:'row-actions'}, [copy, remove])])
      ]));
    }
    content.replaceChildren(el('p', {class:'result-count', text:visible.length + ' imagem(ns)'}), grid);
  };
  const refresh = async () => {
    content.replaceChildren(loading());
    try { images = await listImages(ctx.client); draw(); }
    catch (error) { showError(content, error, refresh); }
  };
  search.addEventListener('input', draw);
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    add.disabled = true;
    progress.hidden = false;
    try {
      await uploadImage(ctx.client, selected, text => { message.textContent = text; });
      message.textContent = 'Imagem enviada e disponível na biblioteca.';
      notify('Imagem enviada com sucesso.');
      await refresh();
    } catch (error) { console.error(error); message.textContent = errorText(error); notify(errorText(error), 'error'); }
    finally { add.disabled = false; progress.hidden = true; file.value = ''; }
  });
  await refresh();
}

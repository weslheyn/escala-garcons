(function(){
'use strict';

const STORAGE_KEY = 'gerenciador_tarefas_cache_v1';
const nowISO = () => new Date().toISOString();
const uid = p => p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);

const THEMES = [
  {id:'dark-gold', nome:'Coco Premium', css:'radial-gradient(circle at 18% 0%,#4a120f 0%,#11131d 42%,#070910 100%)'},
  {id:'black-marble', nome:'Mármore escuro', css:'linear-gradient(135deg,#050609,#171a22 45%,#08090c)'},
  {id:'wine', nome:'Vinho elegante', css:'linear-gradient(135deg,#400b13,#130813 55%,#05070d)'},
  {id:'blue', nome:'Azul executivo', css:'linear-gradient(135deg,#071c34,#0a0e18 60%,#03050a)'},
  {id:'green', nome:'Verde operação', css:'linear-gradient(135deg,#06351e,#09151a 55%,#05080d)'},
  {id:'wood', nome:'Madeira premium', css:'linear-gradient(135deg,#3b2115,#7a4b24 42%,#17100d)'},
  {id:'city', nome:'Cidade noturna', css:'linear-gradient(135deg,#10182a,#1f2d4a 45%,#070910)'},
  {id:'clean', nome:'Cinza clean', css:'linear-gradient(135deg,#2b303b,#121620 55%,#0a0d14)'},
  {id:'sunset', nome:'Pôr do sol', css:'linear-gradient(135deg,#55210d,#b55b18 45%,#12101a)'},
  {id:'custom', nome:'Imagem personalizada', css:'linear-gradient(135deg,#111827,#334155)'}
];

const LABELS = [
  {id:'green', nome:'Verde', cor:'#35d07f'},
  {id:'yellow', nome:'Amarelo', cor:'#f5c842'},
  {id:'orange', nome:'Laranja', cor:'#f39c12'},
  {id:'red', nome:'Vermelho', cor:'#ff6b6b'},
  {id:'blue', nome:'Azul', cor:'#58a6ff'},
  {id:'purple', nome:'Roxo', cor:'#a78bfa'}
];

let state = {version:1, activeWorkspaceId:null, activeBoardId:null, workspaces:{}};
let remoteReady = false;
let saveTimer = null;
let editingCard = null;

function clone(obj){ return JSON.parse(JSON.stringify(obj || {})); }
function arr(obj){ return obj ? Object.values(obj) : []; }
function byOrder(a,b){ return (a.order||0) - (b.order||0); }
function $(id){ return document.getElementById(id); }
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }

function toast(msg){
  const el = $('gtToast'); if(!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>el.classList.remove('show'), 2300);
}

function defaultData(){
  const wsId = uid('area');
  const boardId = uid('quadro');
  const col1 = uid('lista'), col2 = uid('lista'), col3 = uid('lista');
  const card1 = uid('card');
  return {
    version:1,
    activeWorkspaceId:wsId,
    activeBoardId:boardId,
    workspaces:{
      [wsId]:{
        id:wsId,
        nome:'Área Principal',
        descricao:'Área inicial do Gerenciador de Tarefas',
        criadoEm:nowISO(),
        atualizadoEm:nowISO(),
        boards:{
          [boardId]:{
            id:boardId,
            nome:'Quadro Principal',
            theme:'dark-gold',
            customBg:'',
            criadoEm:nowISO(),
            atualizadoEm:nowISO(),
            columns:{
              [col1]:{id:col1,nome:'A Fazer',order:1,cards:{[card1]:{id:card1,titulo:'Criar primeira tarefa',descricao:'Clique no card para editar detalhes, checklist, prazo e etiquetas.',responsavel:'',prioridade:'Média',prazo:'',labels:['yellow'],checklist:[],comentarios:[],order:1,criadoEm:nowISO(),atualizadoEm:nowISO()}}},
              [col2]:{id:col2,nome:'Em Andamento',order:2,cards:{}},
              [col3]:{id:col3,nome:'Concluído',order:3,cards:{}}
            }
          }
        }
      }
    }
  };
}

function normalize(data){
  let d = data && data.workspaces ? clone(data) : defaultData();
  d.version = d.version || 1;
  d.workspaces = d.workspaces || {};
  const wss = arr(d.workspaces);
  if(!wss.length) d = defaultData();
  if(!d.activeWorkspaceId || !d.workspaces[d.activeWorkspaceId]) d.activeWorkspaceId = Object.keys(d.workspaces)[0];
  const ws = d.workspaces[d.activeWorkspaceId];
  ws.boards = ws.boards || {};
  if(!Object.keys(ws.boards).length){
    const bid = uid('quadro');
    ws.boards[bid] = {id:bid,nome:'Novo Quadro',theme:'dark-gold',customBg:'',criadoEm:nowISO(),atualizadoEm:nowISO(),columns:{}};
  }
  if(!d.activeBoardId || !ws.boards[d.activeBoardId]) d.activeBoardId = Object.keys(ws.boards)[0];
  return d;
}

function currentWorkspace(){ return state.workspaces[state.activeWorkspaceId] || null; }
function currentBoard(){ const ws = currentWorkspace(); return ws && ws.boards ? ws.boards[state.activeBoardId] : null; }
function getTheme(board){
  if(!board) return THEMES[0];
  if(board.theme === 'custom' && board.customBg) return {css:`linear-gradient(#0005,#0009),url(${board.customBg})`};
  return THEMES.find(t => t.id === board.theme) || THEMES[0];
}

function loadLocal(){
  try{ return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')); }
  catch(e){ return defaultData(); }
}
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function scheduleSave(){
  saveLocal();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async()=>{
    if(remoteReady && window.GerenciadorTarefasFirebase){
      try{ await GerenciadorTarefasFirebase.saveAll(state); }
      catch(e){ console.warn('Falha ao salvar Gerenciador:', e); }
    }
  }, 350);
}

function applyBackground(){
  const main = document.querySelector('.gt-main');
  const board = currentBoard();
  const theme = getTheme(board);
  if(main) main.style.background = theme.css;
}

function render(){
  state = normalize(state);
  applyBackground();
  renderWorkspaces();
  renderBoards();
  renderBoard();
  renderKpis();
}

function renderWorkspaces(){
  const wrap = $('gtWorkspaces'); if(!wrap) return;
  const list = arr(state.workspaces).sort((a,b)=>(a.criadoEm||'').localeCompare(b.criadoEm||''));
  wrap.innerHTML = list.map(ws=>{
    const count = Object.keys(ws.boards||{}).length;
    return `<button class="gt-ws ${ws.id===state.activeWorkspaceId?'active':''}" onclick="GT.selectWorkspace('${ws.id}')"><span>${esc(ws.nome)}<small>${count} quadro${count===1?'':'s'}</small></span><em>›</em></button>`;
  }).join('');
}

function renderBoards(){
  const nav = $('gtBoards'); if(!nav) return;
  const ws = currentWorkspace();
  const boards = arr(ws && ws.boards).sort((a,b)=>(a.criadoEm||'').localeCompare(b.criadoEm||''));
  nav.innerHTML = boards.map(b=>`<button class="${b.id===state.activeBoardId?'active':''}" onclick="GT.selectBoard('${b.id}')">${esc(b.nome)}</button>`).join('');
}

function renderKpis(){
  const ws = currentWorkspace(); const b = currentBoard();
  const boards = arr(ws && ws.boards);
  const columns = arr(b && b.columns).sort(byOrder);
  const cards = columns.flatMap(c => arr(c.cards));
  if($('gtCurrentWorkspace')) $('gtCurrentWorkspace').textContent = ws ? ws.nome : 'Área de trabalho';
  if($('gtCurrentBoard')) $('gtCurrentBoard').textContent = b ? b.nome : 'Quadro';
  if($('gtKpiBoards')) $('gtKpiBoards').textContent = boards.length;
  if($('gtKpiColumns')) $('gtKpiColumns').textContent = columns.length;
  if($('gtKpiCards')) $('gtKpiCards').textContent = cards.length;
}

function renderBoard(){
  const wrap = $('gtBoard'); if(!wrap) return;
  const board = currentBoard();
  if(!board){ wrap.innerHTML = `<div class="gt-empty"><h3>Nenhum quadro</h3><p>Crie um quadro para começar.</p></div>`; return; }
  board.columns = board.columns || {};
  const columns = arr(board.columns).sort(byOrder);
  if(!columns.length){
    wrap.innerHTML = `<div class="gt-empty"><h3>Quadro vazio</h3><p>Crie listas como A Fazer, Em Andamento e Concluído.</p><button class="gt-create" onclick="GT.openColumnModal()">+ Criar primeira lista</button></div>`;
    return;
  }
  wrap.innerHTML = columns.map(col => renderColumn(col)).join('') + `<button class="gt-add-column" onclick="GT.openColumnModal()">+ Adicionar outra lista</button>`;
  bindDrag();
}

function renderColumn(col){
  const cards = arr(col.cards).sort(byOrder);
  return `<div class="gt-column" data-col="${col.id}">
    <div class="gt-col-head"><div class="gt-col-title">${esc(col.nome)} <small>(${cards.length})</small></div><button class="gt-col-menu" onclick="GT.openColumnMenu('${col.id}')">⋯</button></div>
    <div class="gt-cards" data-col="${col.id}">${cards.map(c=>renderCard(c, col.id)).join('')}</div>
    <button class="gt-col-add" onclick="GT.openCardModal(null,'${col.id}')">+ Adicionar card</button>
  </div>`;
}

function renderCard(card, colId){
  const labels = (card.labels||[]).map(id => LABELS.find(l=>l.id===id)).filter(Boolean).map(l=>`<span class="gt-label" style="background:${l.cor}"></span>`).join('');
  const done = (card.checklist||[]).filter(x=>x.done).length;
  const total = (card.checklist||[]).length;
  const dueBad = card.prazo && new Date(card.prazo+'T23:59:59') < new Date() && String(card.status||'').toLowerCase()!=='concluido';
  return `<article class="gt-card" draggable="true" data-card="${card.id}" data-col="${colId}" onclick="GT.openCardModal('${card.id}','${colId}')">
    ${labels?`<div class="gt-labels">${labels}</div>`:''}
    <div class="gt-card-title">${esc(card.titulo || 'Sem título')}</div>
    ${card.descricao?`<div class="gt-card-desc">${esc(card.descricao).slice(0,140)}</div>`:''}
    <div class="gt-meta">
      ${card.prazo?`<span class="gt-pill ${dueBad?'bad':'due'}">📅 ${esc(formatDate(card.prazo))}</span>`:''}
      ${total?`<span class="gt-pill">☑ ${done}/${total}</span>`:''}
      ${card.responsavel?`<span class="gt-pill">👤 ${esc(card.responsavel)}</span>`:''}
      ${card.prioridade?`<span class="gt-pill">⚑ ${esc(card.prioridade)}</span>`:''}
    </div>
  </article>`;
}

function formatDate(s){
  if(!s) return '';
  const [y,m,d] = s.split('-');
  return d && m ? `${d}/${m}` : s;
}

function bindDrag(){
  document.querySelectorAll('.gt-card').forEach(card=>{
    card.addEventListener('dragstart', ev=>{
      card.classList.add('dragging');
      ev.dataTransfer.setData('text/plain', JSON.stringify({cardId:card.dataset.card, fromCol:card.dataset.col}));
    });
    card.addEventListener('dragend', ()=>card.classList.remove('dragging'));
  });
  document.querySelectorAll('.gt-cards').forEach(zone=>{
    zone.addEventListener('dragover', ev=>{ ev.preventDefault(); zone.style.background='#dfe3ea'; });
    zone.addEventListener('dragleave', ()=>{ zone.style.background=''; });
    zone.addEventListener('drop', ev=>{
      ev.preventDefault(); zone.style.background='';
      try{
        const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
        moveCard(data.cardId, data.fromCol, zone.dataset.col);
      }catch(e){}
    });
  });
}

function moveCard(cardId, fromCol, toCol){
  if(!cardId || !fromCol || !toCol || fromCol===toCol) return;
  const board = currentBoard(); if(!board || !board.columns[fromCol] || !board.columns[toCol]) return;
  const card = board.columns[fromCol].cards && board.columns[fromCol].cards[cardId];
  if(!card) return;
  delete board.columns[fromCol].cards[cardId];
  board.columns[toCol].cards = board.columns[toCol].cards || {};
  card.order = arr(board.columns[toCol].cards).length + 1;
  card.atualizadoEm = nowISO();
  board.columns[toCol].cards[cardId] = card;
  board.atualizadoEm = nowISO();
  scheduleSave(); render(); toast('Card movido');
}

function fieldHtml(label, id, value, type='text', extra=''){
  return `<div class="gt-field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(value||'')}" ${extra}></div>`;
}

function selectHtml(label, id, value, options){
  return `<div class="gt-field"><label>${label}</label><select id="${id}">${options.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
}

window.GT = {
  async init(){
    state = loadLocal(); render();
    if(window.GerenciadorTarefasFirebase){
      remoteReady = await GerenciadorTarefasFirebase.init();
      if(remoteReady){
        GerenciadorTarefasFirebase.listen(data=>{
          if(data && data.workspaces){ state = normalize(data); saveLocal(); render(); }
          else { scheduleSave(); }
        });
      }
    }
  },
  selectWorkspace(id){
    if(!state.workspaces[id]) return;
    state.activeWorkspaceId = id;
    const ws = state.workspaces[id];
    state.activeBoardId = Object.keys(ws.boards||{})[0] || null;
    scheduleSave(); render(); document.body.classList.remove('gt-menu-open');
  },
  selectBoard(id){
    const ws = currentWorkspace(); if(!ws || !ws.boards[id]) return;
    state.activeBoardId = id; scheduleSave(); render();
  },
  openWorkspaceModal(){
    openModal('Nova área de trabalho', `<div class="gt-form">
      ${fieldHtml('Nome da área','gtWsName','')}
      <div class="gt-field"><label>Descrição</label><textarea id="gtWsDesc" placeholder="Opcional"></textarea></div>
      <div class="gt-form-actions"><button onclick="GT.closeModal()">Cancelar</button><button class="primary" onclick="GT.saveWorkspace()">Criar área</button></div>
    </div>`);
  },
  saveWorkspace(){
    const nome = $('gtWsName').value.trim(); if(!nome) return toast('Informe o nome da área');
    const id = uid('area');
    const bid = uid('quadro');
    state.workspaces[id] = {id,nome,descricao:$('gtWsDesc').value.trim(),criadoEm:nowISO(),atualizadoEm:nowISO(),boards:{[bid]:{id:bid,nome:'Quadro Principal',theme:'dark-gold',customBg:'',criadoEm:nowISO(),atualizadoEm:nowISO(),columns:{}}}};
    state.activeWorkspaceId = id; state.activeBoardId = bid;
    scheduleSave(); render(); closeModal(); toast('Área criada');
  },
  openBoardModal(){
    const ws = currentWorkspace(); if(!ws) return;
    openModal('Novo quadro', `<div class="gt-form">
      ${fieldHtml('Nome do quadro','gtBoardName','')}
      <div class="gt-form-actions"><button onclick="GT.closeModal()">Cancelar</button><button class="primary" onclick="GT.saveBoard()">Criar quadro</button></div>
    </div>`);
  },
  saveBoard(){
    const ws = currentWorkspace(); if(!ws) return;
    const nome = $('gtBoardName').value.trim(); if(!nome) return toast('Informe o nome do quadro');
    const id = uid('quadro');
    ws.boards = ws.boards || {};
    ws.boards[id] = {id,nome,theme:'dark-gold',customBg:'',criadoEm:nowISO(),atualizadoEm:nowISO(),columns:{}};
    state.activeBoardId = id;
    scheduleSave(); render(); closeModal(); toast('Quadro criado');
  },
  openColumnModal(colId){
    const board = currentBoard(); if(!board) return;
    const col = colId && board.columns ? board.columns[colId] : null;
    openModal(col?'Editar lista':'Nova lista', `<div class="gt-form">
      ${fieldHtml('Nome da lista','gtColName',col?col.nome:'')}
      <div class="gt-form-actions">
        ${col?`<button class="gt-danger" onclick="GT.deleteColumn('${col.id}')">Excluir</button>`:''}
        <button onclick="GT.closeModal()">Cancelar</button><button class="primary" onclick="GT.saveColumn('${col?col.id:''}')">Salvar</button>
      </div>
    </div>`);
  },
  openColumnMenu(colId){ this.openColumnModal(colId); },
  saveColumn(colId){
    const board = currentBoard(); if(!board) return;
    const nome = $('gtColName').value.trim(); if(!nome) return toast('Informe o nome da lista');
    board.columns = board.columns || {};
    if(colId && board.columns[colId]){ board.columns[colId].nome = nome; board.columns[colId].atualizadoEm = nowISO(); }
    else { const id = uid('lista'); board.columns[id] = {id,nome,order:arr(board.columns).length+1,cards:{},criadoEm:nowISO(),atualizadoEm:nowISO()}; }
    board.atualizadoEm = nowISO(); scheduleSave(); render(); closeModal();
  },
  deleteColumn(colId){
    const board = currentBoard(); if(!board || !board.columns[colId]) return;
    if(!confirm('Excluir esta lista e todos os cards dela?')) return;
    delete board.columns[colId]; scheduleSave(); render(); closeModal(); toast('Lista excluída');
  },
  openCardModal(cardId, colId){
    const board = currentBoard(); if(!board || !board.columns[colId]) return;
    const card = cardId ? board.columns[colId].cards[cardId] : null;
    editingCard = {cardId, colId};
    const labels = LABELS.map(l=>`<label class="gt-check"><input type="checkbox" value="${l.id}" ${(card?.labels||[]).includes(l.id)?'checked':''} name="gtLabels"><span><i style="display:inline-block;width:28px;height:8px;border-radius:9px;background:${l.cor};margin-right:8px"></i>${l.nome}</span></label>`).join('');
    const checks = (card?.checklist||[]).map((c,i)=>checkItemHtml(c.text,c.done,i)).join('');
    $('gtCardEditor').innerHTML = `<div class="gt-form">
      ${fieldHtml('Título','gtCardTitle',card?.titulo||'')}
      <div class="gt-field"><label>Descrição</label><textarea id="gtCardDesc">${esc(card?.descricao||'')}</textarea></div>
      <div class="gt-row">
        ${fieldHtml('Responsável','gtCardResp',card?.responsavel||'')}
        ${selectHtml('Prioridade','gtCardPrio',card?.prioridade||'Média',['Baixa','Média','Alta','Urgente'])}
      </div>
      ${fieldHtml('Prazo','gtCardDue',card?.prazo||'','date')}
      <div class="gt-field"><label>Etiquetas</label><div class="gt-checklist">${labels}</div></div>
      <div class="gt-field"><label>Checklist</label><div id="gtChecklist" class="gt-checklist">${checks}</div><button type="button" onclick="GT.addChecklistItem()">+ Item no checklist</button></div>
      <div class="gt-card-actions">
        ${card?`<button class="gt-danger" onclick="GT.deleteCard()">Excluir card</button>`:''}
        <button onclick="GT.closeCardModal()">Cancelar</button>
        <button class="primary" onclick="GT.saveCard()">Salvar card</button>
      </div>
    </div>`;
    $('gtCardModal').classList.add('show');
    $('gtCardModal').setAttribute('aria-hidden','false');
  },
  addChecklistItem(){
    const wrap = $('gtChecklist'); if(!wrap) return;
    const i = wrap.querySelectorAll('.gt-check').length;
    wrap.insertAdjacentHTML('beforeend', checkItemHtml('', false, i));
  },
  saveCard(){
    const board = currentBoard(); const ed = editingCard;
    if(!board || !ed || !board.columns[ed.colId]) return;
    const titulo = $('gtCardTitle').value.trim(); if(!titulo) return toast('Informe o título do card');
    const col = board.columns[ed.colId]; col.cards = col.cards || {};
    const id = ed.cardId || uid('card');
    const old = col.cards[id] || {id,criadoEm:nowISO(),order:arr(col.cards).length+1};
    const labels = Array.from(document.querySelectorAll('input[name="gtLabels"]:checked')).map(x=>x.value);
    const checklist = Array.from(document.querySelectorAll('#gtChecklist .gt-check')).map(row=>({text:row.querySelector('input[type="text"]').value.trim(),done:row.querySelector('input[type="checkbox"]').checked})).filter(x=>x.text);
    col.cards[id] = Object.assign(old,{titulo,descricao:$('gtCardDesc').value.trim(),responsavel:$('gtCardResp').value.trim(),prioridade:$('gtCardPrio').value,prazo:$('gtCardDue').value,labels,checklist,atualizadoEm:nowISO()});
    board.atualizadoEm = nowISO(); scheduleSave(); render(); this.closeCardModal(); toast('Card salvo');
  },
  deleteCard(){
    const board = currentBoard(); const ed = editingCard;
    if(!board || !ed || !confirm('Excluir este card?')) return;
    delete board.columns[ed.colId].cards[ed.cardId];
    scheduleSave(); render(); this.closeCardModal(); toast('Card excluído');
  },
  closeCardModal(){ $('gtCardModal').classList.remove('show'); $('gtCardModal').setAttribute('aria-hidden','true'); editingCard=null; },
  openThemeModal(){
    const board = currentBoard(); if(!board) return;
    const html = `<div class="gt-form"><div class="gt-themes">${THEMES.map(t=>`<button class="gt-theme ${board.theme===t.id?'active':''}" style="background:${t.css}" onclick="GT.setTheme('${t.id}')"><span>${t.nome}</span></button>`).join('')}</div>
    <div class="gt-field"><label>Imagem personalizada por URL</label><input id="gtCustomBg" placeholder="Cole aqui a URL da imagem" value="${esc(board.customBg||'')}"></div>
    <div class="gt-form-actions"><button onclick="GT.closeModal()">Fechar</button><button class="primary" onclick="GT.saveCustomTheme()">Usar imagem personalizada</button></div></div>`;
    openModal('Escolher fundo do quadro', html);
  },
  setTheme(id){
    const board = currentBoard(); if(!board) return;
    board.theme = id; board.atualizadoEm = nowISO();
    scheduleSave(); render(); this.openThemeModal(); toast('Fundo aplicado');
  },
  saveCustomTheme(){
    const board = currentBoard(); if(!board) return;
    const url = $('gtCustomBg').value.trim();
    if(!url) return toast('Cole a URL da imagem');
    board.theme = 'custom'; board.customBg = url; board.atualizadoEm = nowISO();
    scheduleSave(); render(); closeModal(); toast('Imagem aplicada');
  },
  closeModal: closeModal
};

function checkItemHtml(text, done, i){
  return `<label class="gt-check ${done?'done':''}"><input type="checkbox" ${done?'checked':''} onchange="this.parentElement.classList.toggle('done',this.checked)"><input type="text" placeholder="Item do checklist" value="${esc(text||'')}"></label>`;
}

function openModal(title, body){
  $('gtModalTitle').textContent = title;
  $('gtModalBody').innerHTML = body;
  $('gtModal').classList.add('show');
  $('gtModal').setAttribute('aria-hidden','false');
}
function closeModal(){
  $('gtModal').classList.remove('show');
  $('gtModal').setAttribute('aria-hidden','true');
}

document.addEventListener('DOMContentLoaded', ()=>window.GT.init());
document.addEventListener('keydown', ev=>{ if(ev.key==='Escape'){ closeModal(); window.GT.closeCardModal(); document.body.classList.remove('gt-menu-open'); } });
})();

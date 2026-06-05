(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const KEY='gt_trello_like_v3';
const LOCAL_ALARMS_KEY='gt_trello_local_alarms_v1';
const DEVICE_ID_KEY='gt_trello_device_id_v1';
let cloudReady=false, cloudApplying=false, cloudTimer=null;
const deviceId=(()=>{let id=localStorage.getItem(DEVICE_ID_KEY); if(!id){id='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); localStorage.setItem(DEVICE_ID_KEY,id);} return id;})();
const todayISO=()=>new Date().toISOString().slice(0,10);
const uid=p=>(p||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
const fmtDateBR=(iso)=>{if(!iso)return''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`};
const monthNames=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const bgLib=[
 {id:'coco',name:'Coco Bambu',type:'gradient',brand:true,value:'linear-gradient(135deg,#4b130d 0%,#6b1f12 34%,#2b0905 68%,#120604 100%)'},
 {id:'coco-gold',name:'Coco Bambu dourado',type:'gradient',brand:true,value:'radial-gradient(circle at 18% 20%,#f6b84a66 0 9%,transparent 10%),linear-gradient(135deg,#5c160f 0%,#8b3a17 45%,#f2a93b 100%)'},
 {id:'coco-dark',name:'Coco Bambu premium',type:'gradient',brand:true,value:'linear-gradient(135deg,#1a0b05 0%,#5c160f 42%,#c87920 100%)'},
 {id:'coco-wine',name:'Vinho Coco Bambu',type:'gradient',brand:true,value:'linear-gradient(135deg,#230704 0%,#5c160f 50%,#100604 100%)'},
 {id:'coco-clean',name:'Coco Bambu claro',type:'gradient',brand:true,value:'linear-gradient(135deg,#fff3d6 0%,#f2a93b 48%,#5c160f 100%)'},
 {id:'darkmountain',name:'Montanha escura',type:'gradient',value:'linear-gradient(135deg,#101827,#2d3748 45%,#111827 46%,#0b101c)'},
 {id:'night',name:'Noite estrelada',type:'gradient',value:'radial-gradient(circle at 35% 20%,#66708555 0 8%,transparent 9%),linear-gradient(135deg,#111827,#1f2937,#020617)'},
 {id:'orange',name:'Montanha laranja',type:'gradient',value:'linear-gradient(135deg,#7c2d12,#ea580c,#fbbf24)'},
 {id:'snow',name:'Neve e rochas',type:'gradient',value:'linear-gradient(135deg,#e5e7eb,#94a3b8,#334155)'},
 {id:'blue',name:'Azul premium',type:'gradient',value:'linear-gradient(135deg,#0747a6,#172b4d,#091e42)'},
 {id:'gold',name:'Dourado',type:'gradient',value:'linear-gradient(135deg,#875000,#c87920,#f5a742)'},
 {id:'wine',name:'Vinho escuro',type:'gradient',value:'linear-gradient(135deg,#23020c,#5c0f22,#0f172a)'},
 {id:'forest',name:'Verde',type:'gradient',value:'linear-gradient(135deg,#064e3b,#0f766e,#111827)'},
 {id:'clean',name:'Claro',type:'gradient',value:'linear-gradient(135deg,#dbeafe,#f8fafc,#e2e8f0)'}
];

function normalizeBg(bg){
 const oldMap={
  'coco-arara':'coco-gold','coco-logo':'coco','coco-app':'coco-dark','coco-cocada':'coco-wine',
  'tema-coco-bambu':'coco','app-entrega-gratis':'coco-dark','app-cocada':'coco-wine'
 };
 if(!bg) return bgLib[0];
 const id=typeof bg==='string'?bg:bg.id;
 return bgLib.find(x=>x.id===id)||bgLib.find(x=>x.id===oldMap[id])||bgLib[0];
}
const colors=['#61bd4f','#f2d600','#ff9f1a','#eb5a46','#c377e0','#0079bf','#00c2e0','#51e898','#ff78cb','#344563'];
let state, current={workspaceId:null, boardId:null, view:'board'}, calDate=new Date();
function seed(){
 const ws=uid('ws'), b1=uid('b'), b2=uid('b'), b3=uid('b');
 const l1=uid('l'),l2=uid('l'),l3=uid('l'),l4=uid('l');
 const mkCard=(title,opts={})=>({id:uid('c'),title,description:'',labels:opts.labels||[],due:opts.due||'',done:!!opts.done,recurrence:opts.recurrence||'none',checklist:opts.checklist||[],comments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 return {version:3, recent:[b1,b2,b3], workspaces:{[ws]:{id:ws,name:'Área de trabalho operacional',icon:'WD',color:'#6554c0',members:['Weslheyn Dias'],createdAt:new Date().toISOString(),boards:[b1,b2,b3]}}, boards:{
  [b1]:{id:b1,workspaceId:ws,title:'DIVISÃO DE TAREFAS',background:bgLib[0],favorite:true,members:['Weslheyn Dias'],lists:[l1,l2,l3,l4],createdAt:new Date().toISOString()},
  [b2]:{id:b2,workspaceId:ws,title:'atividades de hoje',background:bgLib[3],favorite:false,members:['Weslheyn Dias'],lists:[uid('l'),uid('l'),uid('l')],createdAt:new Date().toISOString()},
  [b3]:{id:b3,workspaceId:ws,title:'ESCALA SEMANAL',background:bgLib[2],favorite:false,members:['Weslheyn Dias'],lists:[uid('l')],createdAt:new Date().toISOString()}
 }, lists:{
  [l1]:{id:l1,boardId:b1,title:'A fazer',cards:[mkCard('CONFERIR PROGRAMAÇÃO ARTÍSTICA',{recurrence:'daily'}),mkCard('CONTROLE DE ATENDIMENTO POR SETOR',{recurrence:'daily'}),mkCard('CRIAR TREINAMENTO CONFORME O SETOR RESPONSÁVEL'),mkCard('ESQUENTA',{labels:[colors[0],colors[1]]}),mkCard('BLOQUEIOS E SUGESTÕES'),mkCard('CONFERIR ALINHAMENTO')].map(c=>{stateAddCardTemp(c);return c.id})},
  [l2]:{id:l2,boardId:b1,title:'JOSE 10:00 AS 21:20',cards:[mkCard('CONFERIR MESAS EM ABERTO FINAL DE EXPEDIENTE',{recurrence:'daily'}),mkCard('SUBIR TREINAMENTO'),mkCard('ESQUENTA DE FECHAMENTO')].map(c=>{stateAddCardTemp(c);return c.id})},
  [l3]:{id:l3,boardId:b1,title:'WANDERSOM ABERTURA',cards:[mkCard('LIMPEZA DO SALÃO EM GERAL',{recurrence:'daily'}),mkCard('REQUISIÇÃO DIÁRIA',{recurrence:'daily'}),mkCard('VALIDADE DAS PIMENTAS',{recurrence:'daily'}),mkCard('VERIFICAR AS RESERVAS',{recurrence:'daily'}),mkCard('SORTEIO DE PRAÇA',{labels:[colors[0],colors[1],colors[6],colors[8]]})].map(c=>{stateAddCardTemp(c);return c.id})},
  [l4]:{id:l4,boardId:b1,title:'CONCLUÍDO',cards:[mkCard('finalizar cancelamentos mes 10',{done:true}),mkCard('finalizar cancelamentos mes 11',{done:true})].map(c=>{stateAddCardTemp(c);return c.id})}
 }, cards: tempCards, recurringLog:{}};
}
let tempCards={}; function stateAddCardTemp(c){tempCards[c.id]=c;}
function loadLocalAlarms(){try{return JSON.parse(localStorage.getItem(LOCAL_ALARMS_KEY))||{}}catch(e){return {}}}
function saveLocalAlarms(map){localStorage.setItem(LOCAL_ALARMS_KEY,JSON.stringify(map||{}));}
function getLocalAlarm(cardId){return loadLocalAlarms()[cardId]||null;}
function setLocalAlarm(cardId,cfg){const map=loadLocalAlarms(); if(!cfg||!cfg.enabled) delete map[cardId]; else map[cardId]=Object.assign({scope:'local',deviceId,enabled:true},cfg); saveLocalAlarms(map);}
function removeLocalAlarm(cardId){const map=loadLocalAlarms(); delete map[cardId]; saveLocalAlarms(map);}
function effectiveAlarm(c){const local=getLocalAlarm(c.id); if(local&&local.enabled) return Object.assign({scope:'local'},local); if(c.sharedAlarmEnabled&&c.sharedAlarmTime) return {scope:'shared',enabled:true,time:c.sharedAlarmTime,advance:Number(c.sharedAlarmAdvance||0),vibrate:c.sharedAlarmVibrate!==false,sound:c.sharedAlarmSound!==false}; return null;}
function migrateOldPersonalAlarms(){let changed=false; Object.values(state.cards||{}).forEach(c=>{ if(c.alarmEnabled&&c.alarmTime&&!c.sharedAlarmEnabled){setLocalAlarm(c.id,{enabled:true,time:c.alarmTime,advance:Number(c.alarmAdvance||0),vibrate:c.alarmVibrate!==false,sound:c.alarmSound!==false}); delete c.alarmEnabled; delete c.alarmTime; delete c.alarmAdvance; delete c.alarmVibrate; delete c.alarmSound; changed=true;} }); return changed;}
function sanitizeStateForCloud(data){const clean=JSON.parse(JSON.stringify(data||{})); delete clean.notificationLog; if(clean.cards){Object.values(clean.cards).forEach(c=>{delete c.alarmEnabled; delete c.alarmTime; delete c.alarmAdvance; delete c.alarmVibrate; delete c.alarmSound;});} return clean;}
function saveCloudDebounced(){ if(cloudApplying||!cloudReady||!window.GerenciadorTarefasFirebase?.enabled) return; clearTimeout(cloudTimer); cloudTimer=setTimeout(()=>{window.GerenciadorTarefasFirebase.saveAll(sanitizeStateForCloud(state)).catch(e=>console.warn('GT Firebase save',e));},350);}

function normalizeLegacyFirebaseState(input){
  if(!input || typeof input!=='object') return input;
  // A base real exportada veio na estrutura antiga: workspaces/{area}/boards/{quadro}/columns/{lista}/cards/{card}
  // O módulo V3 usa estrutura normalizada: workspaces + boards + lists + cards separados.
  const looksLegacy = input.workspaces && (!input.boards || Object.values(input.workspaces||{}).some(ws => ws && ws.boards && !Array.isArray(ws.boards)));
  if(!looksLegacy && input.version>=3) return input;
  const out = {
    version: 3,
    recent: Array.isArray(input.recent) ? input.recent.slice(0,8) : [],
    activeWorkspaceId: input.activeWorkspaceId || '',
    activeBoardId: input.activeBoardId || '',
    plannerDate: input.plannerDate || '',
    plannerMonth: input.plannerMonth || '',
    view: input.view || 'board',
    workspaces: {}, boards: {}, lists: {}, cards: {}, notificationLog: input.notificationLog || {}
  };
  const themeToBg = (theme, customBg) => {
    if(customBg) return {id:'custom',name:'Personalizado',type:'image',value:customBg};
    const map = {'night':'night','dark-gold':'coco-dark','gold':'gold','coco':'coco','coco-bambu':'coco','darkmountain':'darkmountain'};
    return bgLib.find(b=>b.id===(map[theme]||theme)) || bgLib[0];
  };
  const listSort = obj => Object.entries(obj||{}).sort((a,b)=>Number((a[1]&&a[1].order)||0)-Number((b[1]&&b[1].order)||0));
  Object.entries(input.workspaces||{}).forEach(([wid,ws])=>{
    if(!ws) return;
    const newWs = {
      id: ws.id || wid,
      name: ws.name || ws.nome || 'Área de trabalho',
      icon: ws.icon || 'WD',
      color: ws.color || '#6554c0',
      members: ws.members || ['Weslheyn Dias'],
      createdAt: ws.createdAt || ws.criadoEm || new Date().toISOString(),
      boards: []
    };
    out.workspaces[newWs.id]=newWs;
    const boardsObj = ws.boards || {};
    Object.entries(boardsObj).forEach(([bid,b])=>{
      if(!b) return;
      const boardId=b.id||bid;
      const newB={
        id: boardId,
        workspaceId: newWs.id,
        title: b.title || b.nome || 'Novo quadro',
        background: normalizeBg(themeToBg(b.theme, b.customBg)),
        favorite: !!b.favorite,
        members: b.members || ['Weslheyn Dias'],
        lists: [],
        createdAt: b.createdAt || b.criadoEm || new Date().toISOString()
      };
      out.boards[boardId]=newB;
      newWs.boards.push(boardId);
      const columns=b.columns || b.lists || {};
      listSort(columns).forEach(([lid,l])=>{
        if(!l) return;
        const listId=l.id||lid;
        const newL={id:listId,boardId:boardId,title:l.title||l.nome||'Lista',cards:[]};
        out.lists[listId]=newL;
        newB.lists.push(listId);
        const cards=l.cards||{};
        const cardEntries=Array.isArray(cards) ? cards.map((x,i)=>[x&&x.id?x.id:String(i),x]) : listSort(cards);
        cardEntries.forEach(([cid,c])=>{
          if(!c) return;
          const cardId=c.id||cid;
          const newC={
            id: cardId,
            title: c.title || c.titulo || c.nome || 'Atividade',
            description: c.description || c.descricao || '',
            labels: Array.isArray(c.labels)?c.labels:[],
            due: c.due || c.prazo || '',
            done: !!(c.done || c.concluido),
            recurrence: c.recurrence || (c.recorrenciaDiaria ? 'daily' : 'none'),
            sharedAlarmEnabled: !!c.sharedAlarmEnabled,
            sharedAlarmTime: c.sharedAlarmTime || '',
            sharedAlarmAdvance: Number(c.sharedAlarmAdvance||0),
            sharedAlarmVibrate: c.sharedAlarmVibrate!==false,
            sharedAlarmSound: c.sharedAlarmSound!==false,
            checklist: Array.isArray(c.checklist)?c.checklist:[],
            comments: Array.isArray(c.comments)?c.comments:[],
            createdAt: c.createdAt || c.criadoEm || new Date().toISOString(),
            updatedAt: c.updatedAt || c.atualizadoEm || new Date().toISOString(),
            responsavel: c.responsavel || '',
            prioridade: c.prioridade || ''
          };
          out.cards[cardId]=normalizeCardForModal(newC,cardId);
          newL.cards.push(cardId);
        });
      });
      if(!newB.lists.length){ const lid=uid('l'); out.lists[lid]={id:lid,boardId:boardId,title:'A fazer',cards:[]}; newB.lists=[lid]; }
    });
  });
  if(!Object.keys(out.workspaces).length) return input;
  if(!out.activeWorkspaceId || !out.workspaces[out.activeWorkspaceId]) out.activeWorkspaceId=Object.keys(out.workspaces)[0];
  if(!out.activeBoardId || !out.boards[out.activeBoardId]) out.activeBoardId=out.workspaces[out.activeWorkspaceId].boards[0] || Object.keys(out.boards)[0] || '';
  if(!out.recent.length && out.activeBoardId) out.recent=[out.activeBoardId];
  return out;
}

async function initCloudSync(){ try{ if(!window.GerenciadorTarefasFirebase) return; const ok=await window.GerenciadorTarefasFirebase.init(); if(!ok) return; cloudReady=true; window.GerenciadorTarefasFirebase.listen(remote=>{ if(!remote||!remote.workspaces){ saveCloudDebounced(); return; } const keepCurrent=Object.assign({},current); cloudApplying=true; state=normalizeLegacyFirebaseState(remote); state.workspaces=state.workspaces||{}; state.boards=state.boards||{}; state.lists=state.lists||{}; state.cards=state.cards||{}; state.recent=state.recent||[]; state.notificationLog=JSON.parse(localStorage.getItem(KEY)||'{}').notificationLog||{}; Object.values(state.boards||{}).forEach(b=>{b.background=normalizeBg(b.background)}); repairStateLinks(); current=keepCurrent; if(!current.workspaceId||!state.workspaces[current.workspaceId]) current.workspaceId=state.activeWorkspaceId&&state.workspaces[state.activeWorkspaceId]?state.activeWorkspaceId:Object.keys(state.workspaces)[0]; if(!current.boardId||!state.boards[current.boardId]) current.boardId=(state.activeBoardId&&state.boards[state.activeBoardId]?state.activeBoardId:null)||state.workspaces[current.workspaceId]?.boards?.find(id=>state.boards[id])||Object.keys(state.boards)[0]||null; localStorage.setItem(KEY,JSON.stringify(state)); cloudApplying=false; if(current.view==='home')renderHome(); else if(current.view==='planner')renderPlanner(); else if(current.view==='inbox')renderInbox(); else renderBoard(); }); }catch(e){console.warn('GT Firebase sync indisponível',e);} }

function load(){try{state=JSON.parse(localStorage.getItem(KEY))||seed();}catch(e){state=seed()} state=normalizeLegacyFirebaseState(state)||state; if(!state.version||state.version<3){state=normalizeLegacyFirebaseState(state); if(!state.version||state.version<3) state=seed();} state.workspaces=state.workspaces||{}; state.boards=state.boards||{}; state.lists=state.lists||{}; state.cards=state.cards||{}; state.recent=state.recent||[]; state.notificationLog=state.notificationLog||{}; migrateOldPersonalAlarms(); Object.values(state.cards||{}).forEach(c=>{normalizeCardForModal(c,c&&c.id); c.sharedAlarmAdvance=Number(c.sharedAlarmAdvance||0); c.sharedAlarmVibrate=c.sharedAlarmVibrate!==false; c.sharedAlarmSound=c.sharedAlarmSound!==false;}); Object.values(state.boards||{}).forEach(b=>{b.background=normalizeBg(b.background)}); if(!Object.keys(state.workspaces).length){state=seed()} repairStateLinks(); current.workspaceId=(state.activeWorkspaceId&&state.workspaces[state.activeWorkspaceId]?state.activeWorkspaceId:Object.keys(state.workspaces)[0]); current.boardId=(state.activeBoardId&&state.boards[state.activeBoardId]?state.activeBoardId:null)||state.recent?.find(id=>state.boards[id])||state.workspaces[current.workspaceId].boards?.find(id=>state.boards[id])||null; if(!current.boardId){const wid=current.workspaceId, bid=uid('b'), lid=uid('l'); state.boards[bid]={id:bid,workspaceId:wid,title:'NOVO QUADRO',background:bgLib[0],favorite:false,members:['Weslheyn Dias'],lists:[lid],createdAt:new Date().toISOString()}; state.lists[lid]={id:lid,boardId:bid,title:'A fazer',cards:[]}; state.workspaces[wid].boards=[bid]; current.boardId=bid; state.recent=[bid];} save();}
function save(){repairStateLinks(); localStorage.setItem(KEY,JSON.stringify(state)); saveCloudDebounced();}
function board(){return state.boards[current.boardId]} function workspace(){return state.workspaces[current.workspaceId]} function setBg(el,bg){ if(!el)return; if(!bg) bg=bgLib[0]; el.style.backgroundSize=bg.contain?'contain':'cover'; el.style.backgroundRepeat=bg.contain?'no-repeat':'no-repeat'; el.style.backgroundPosition='center'; if(bg.type==='image') el.style.backgroundImage=`linear-gradient(#00000012,#00000012),url('${bg.value}')`; else el.style.backgroundImage=bg.value; }
function showView(v){current.view=v; $$('.gt-bottom-nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v)); $('#gtHome').classList.add('gt-hidden'); $('#gtBoardScreen').classList.add('gt-hidden'); $('#gtPlannerScreen').classList.add('gt-hidden'); $('#gtInboxScreen').classList.add('gt-hidden'); if(v==='board'){$('#gtBoardScreen').classList.remove('gt-hidden'); renderBoard()} if(v==='planner'){$('#gtPlannerScreen').classList.remove('gt-hidden'); renderPlanner()} if(v==='inbox'){$('#gtInboxScreen').classList.remove('gt-hidden'); renderInbox()} }
function showHome(){ current.view='home'; $('#gtHome').classList.remove('gt-hidden'); $('#gtBoardScreen').classList.add('gt-hidden'); $('#gtPlannerScreen').classList.add('gt-hidden'); $('#gtInboxScreen').classList.add('gt-hidden'); renderHome(); }
function renderHome(){repairStateLinks(); const wrap=$('#gtWorkspaceList'); wrap.innerHTML=''; Object.values(state.workspaces).forEach(ws=>{let block=document.createElement('div'); block.className='gt-workspace-block'; block.innerHTML=`<div class="gt-workspace-head"><div class="gt-workspace-name"><span class="gt-workspace-icon" style="background:${ws.color}">${ws.icon||'▣'}</span>${esc(ws.name)}</div><button class="gt-secondary" data-new-board="${ws.id}">+ Criar quadro</button></div><div class="gt-board-card-grid"></div>`; const grid=block.querySelector('.gt-board-card-grid'); (ws.boards||[]).forEach(id=>{const b=state.boards[id]; if(!b)return; grid.appendChild(boardTile(b));}); wrap.appendChild(block);}); $$('[data-new-board]').forEach(btn=>btn.onclick=()=>openBoardForm(btn.dataset.newBoard)); }
function boardTile(b){let el=document.createElement('button'); el.className='gt-board-tile'; setBg(el,b.background); el.innerHTML=`<span class="star">${b.favorite?'★':'☆'}</span><strong>${esc(b.title)}</strong>`; el.onclick=()=>openBoard(b.id); return el;}
function openBoard(id){const b=state.boards[id]; if(!b)return; current.boardId=id; current.workspaceId=b.workspaceId; state.recent=[id,...(state.recent||[]).filter(x=>x!==id)].slice(0,8); save(); showView('board');}
function renderBoard(){repairStateLinks(); const b=board(); if(!b){showHome();return;} setBg($('.gt-board-bg'),b.background); $('#gtBoardTitleBtn').textContent=b.title; $('#gtWorkspaceBtn').textContent=workspace()?.name||'Área'; $('#gtFavoriteBtn').textContent=b.favorite?'★':'☆'; const wrap=$('#gtBoardLists'); wrap.innerHTML=''; (b.lists||[]).forEach(listId=>{const l=state.lists[listId]; if(l) wrap.appendChild(renderList(l));}); const add=document.createElement('button'); add.className='gt-add-list'; add.textContent='+ Adicionar outra lista'; add.onclick=()=>openListForm(); wrap.appendChild(add); }
function renderList(l){const el=document.createElement('div'); el.className='gt-list'; el.dataset.listId=l.id; const cardIds=(l.cards||[]).filter(id=>state.cards[id]); const cards=cardIds.map(id=>normalizeCardForModal(state.cards[id],id)).filter(Boolean); el.innerHTML=`<div class="gt-list-head"><input class="gt-list-title" value="${escAttr(l.title)}"><span class="gt-list-count">${cards.length}</span><button class="gt-list-menu">•••</button></div><div class="gt-cards"></div><button class="gt-add-card">+ Adicionar um cartão</button>`; const title=el.querySelector('.gt-list-title'); title.onchange=()=>{l.title=title.value.trim()||'Lista'; save(); renderBoard()}; const cont=el.querySelector('.gt-cards'); cards.forEach(c=>cont.appendChild(renderCard(c,l.id))); el.querySelector('.gt-add-card').onclick=()=>openCardForm(l.id); el.querySelector('.gt-list-menu').onclick=()=>openListMenu(l.id); makeDrop(cont,l.id); return el;}
function renderCard(c,listId){const el=document.createElement('div'); el.className='gt-card'+(c.done?' done':''); el.draggable=true; el.dataset.cardId=c.id; el.innerHTML=`${labelsHtml(c.labels)}<div class="gt-row"><span class="gt-check-dot ${c.done?'checked':''}" title="Concluir">${c.done?'✓':''}</span><div class="gt-card-title">${esc(c.title)}</div></div><div class="gt-card-meta">${c.due?'📅 '+fmtDateBR(c.due):''}${effectiveAlarm(c)?' ⏰ '+effectiveAlarm(c).time+(effectiveAlarm(c).scope==='shared'?' 🌐':' 📱'):''}${c.recurrence&&c.recurrence!=='none'?' 🔁 '+recName(c.recurrence):''}${(c.checklist||[]).length?' ☑ '+doneCount(c)+'/'+c.checklist.length:''}</div>`; el.onclick=(e)=>{ if(e.target.classList.contains('gt-check-dot')){toggleDone(c.id); e.stopPropagation();return;} openCardModal(c.id);}; el.ondragstart=e=>{e.dataTransfer.setData('text/plain',JSON.stringify({cardId:c.id,from:listId}));}; return el;}
function makeDrop(cont,listId){cont.ondragover=e=>e.preventDefault(); cont.ondrop=e=>{e.preventDefault(); try{const d=JSON.parse(e.dataTransfer.getData('text/plain')); moveCard(d.cardId,d.from,listId);}catch(_){} };}
function moveCard(cardId,from,to){ if(from===to)return; const lf=state.lists[from], lt=state.lists[to]; if(!lf||!lt)return; lf.cards=(lf.cards||[]).filter(id=>id!==cardId); lt.cards=lt.cards||[]; lt.cards.push(cardId); state.cards[cardId].updatedAt=new Date().toISOString(); save(); renderBoard();}
function labelsHtml(labels){return labels?.length?`<div class="gt-labels">${labels.map(c=>`<span class="gt-label" style="background:${c}"></span>`).join('')}</div>`:''}
function doneCount(c){return (c.checklist||[]).filter(x=>x.done).length}
function toggleDone(cardId){const c=state.cards[cardId]; c.done=!c.done; c.completedAt=c.done?new Date().toISOString():''; save(); if(current.view==='planner')renderPlanner(); else renderBoard();}
function openCardForm(listId,preset={}){modalForm('Criar cartão',`<div class="gt-field"><label>Título</label><input id="fTitle" value="${escAttr(preset.title||'')}"></div><div class="gt-field"><label>Prazo</label><input id="fDue" type="date" value="${preset.due||''}"></div><div class="gt-field"><label>Atividade fixa/recorrente</label><select id="fRec"><option value="none">Não repetir</option><option value="daily">Diária</option><option value="weekdays">Segunda a sexta</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></div><div class="gt-field"><label>Despertador / notificação</label><div class="gt-reminder-row"><input id="fAlarmTime" type="time"><select id="fAlarmAdvance"><option value="0">Na hora</option><option value="5">5 min antes</option><option value="10">10 min antes</option><option value="15">15 min antes</option><option value="30">30 min antes</option><option value="60">1h antes</option></select></div><small>Ao informar horário, o celular pode notificar, vibrar e tocar som quando permitido.</small></div>`,()=>{const title=$('#fTitle').value.trim(); if(!title)return toast('Informe o título'); const alarmTime=$('#fAlarmTime').value; const c={id:uid('c'),title,description:'',labels:[],due:$('#fDue').value,done:false,recurrence:$('#fRec').value,sharedAlarmEnabled:false,sharedAlarmTime:'',sharedAlarmAdvance:0,sharedAlarmVibrate:true,sharedAlarmSound:true,checklist:[],comments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}; state.cards[c.id]=c; if(alarmTime){setLocalAlarm(c.id,{enabled:true,time:alarmTime,advance:Number($('#fAlarmAdvance').value||0),vibrate:true,sound:true}); requestNotifyPermission();} state.lists[listId].cards.push(c.id); save(); closeModals(); renderBoard();}); setTimeout(()=>{$('#fTitle')?.focus();},50)}
function openListForm(){modalForm('Criar lista',`<div class="gt-field"><label>Nome da lista</label><input id="fList" placeholder="Ex.: A fazer"></div>`,()=>{const title=$('#fList').value.trim(); if(!title)return; const l={id:uid('l'),boardId:current.boardId,title,cards:[]}; state.lists[l.id]=l; board().lists.push(l.id); save(); closeModals(); renderBoard();});}
function openWorkspaceForm(){modalForm('Criar área de trabalho',`<div class="gt-field"><label>Nome da área</label><input id="fWs" placeholder="Ex.: Operação Salão"></div><div class="gt-field"><label>Cor</label><input id="fColor" type="color" value="#6554c0"></div><div class="gt-field"><label>Ícone/Iniciais</label><input id="fIcon" value="WD"></div><label class="gt-check-line"><input id="fCreateBoardAfter" type="checkbox" checked> Criar um quadro nesta área depois de salvar</label>`,()=>{const name=$('#fWs').value.trim(); if(!name)return toast('Informe o nome da área de trabalho'); const id=uid('ws'); state.workspaces[id]={id,name,color:$('#fColor').value,icon:$('#fIcon').value.trim().slice(0,3)||'▣',members:['Weslheyn Dias'],createdAt:new Date().toISOString(),boards:[]}; current.workspaceId=id; save(); const createAfter=$('#fCreateBoardAfter')?.checked; closeModals(); renderHome(); toast('Área de trabalho salva'); if(createAfter) setTimeout(()=>openBoardForm(id),120);});}
function openBoardForm(wsId=current.workspaceId){modalForm('Criar quadro',`<div class="gt-field"><label>Área de trabalho</label><select id="fWsSel">${Object.values(state.workspaces).map(w=>`<option value="${w.id}" ${w.id===wsId?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div><div class="gt-field"><label>Nome do quadro</label><input id="fBoard" placeholder="Ex.: Divisão de tarefas"></div><div class="gt-field"><label>Fundo / tema</label><div class="gt-background-grid">${bgLib.map(bg=>`<button type="button" class="gt-bg-option" data-bg="${bg.id}"><span>${esc(bg.name)}</span></button>`).join('')}</div></div>`,()=>{const title=$('#fBoard').value.trim(); if(!title)return toast('Informe o nome do quadro'); const ws=$('#fWsSel').value; const id=uid('b'), l=uid('l'); const chosen=bgLib.find(x=>x.id===(window.__chosenBg||'coco'))||bgLib[0]; state.boards[id]={id,workspaceId:ws,title,background:chosen,favorite:false,members:['Weslheyn Dias'],lists:[l],createdAt:new Date().toISOString()}; state.lists[l]={id:l,boardId:id,title:'A fazer',cards:[]}; state.workspaces[ws].boards=state.workspaces[ws].boards||[]; state.workspaces[ws].boards.push(id); current.workspaceId=ws; current.boardId=id; state.recent=[id,...(state.recent||[]).filter(x=>x!==id)].slice(0,8); save(); closeModals(); showView('board'); toast('Quadro salvo');}); window.__chosenBg='coco'; $$('.gt-bg-option').forEach(btn=>{const bg=bgLib.find(x=>x.id===btn.dataset.bg); setBg(btn,bg); if(btn.dataset.bg==='coco')btn.classList.add('selected'); btn.onclick=()=>{$$('.gt-bg-option').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); window.__chosenBg=btn.dataset.bg;};});}
function modalForm(title,body,onSave){openOverlay(); const m=$('#gtFormModal'); m.innerHTML=`<button class="gt-close" data-close>×</button><h2>${title}</h2>${body}<div class="gt-form-actions"><button class="gt-secondary" data-close>Cancelar</button><button class="gt-primary" id="gtSaveForm">Salvar</button></div>`; m.classList.remove('gt-hidden'); $$('[data-close]').forEach(b=>b.onclick=closeModals); $('#gtSaveForm').onclick=onSave;}
function normalizeCardForModal(c, cardId){
  if(!c) return null;
  c.id=c.id||cardId||uid('c');
  c.title=c.title||'Sem título';
  c.description=c.description||'';
  c.labels=Array.isArray(c.labels)?c.labels:[];
  c.checklist=Array.isArray(c.checklist)?c.checklist:[];
  c.comments=Array.isArray(c.comments)?c.comments:[];
  c.recurrence=c.recurrence||'none';
  c.sharedAlarmEnabled=!!c.sharedAlarmEnabled;
  c.sharedAlarmTime=c.sharedAlarmTime||'';
  c.sharedAlarmAdvance=Number(c.sharedAlarmAdvance||0);
  c.sharedAlarmVibrate=c.sharedAlarmVibrate!==false;
  c.sharedAlarmSound=c.sharedAlarmSound!==false;
  return c;
}
function repairStateLinks(){
  if(!state) return;
  state.workspaces=state.workspaces||{};
  state.boards=state.boards||{};
  state.lists=state.lists||{};
  state.cards=state.cards||{};
  Object.entries(state.cards).forEach(([id,c])=>{ if(c) normalizeCardForModal(c,id); });
  Object.entries(state.lists).forEach(([lid,l])=>{
    if(!l) return;
    l.id=l.id||lid;
    l.cards=(l.cards||[]).map(x=> typeof x==='string'?x:(x&&x.id?x.id:null)).filter(id=>id&&state.cards[id]);
  });
  Object.entries(state.boards).forEach(([bid,b])=>{
    if(!b) return;
    b.id=b.id||bid;
    b.lists=(b.lists||[]).map(x=> typeof x==='string'?x:(x&&x.id?x.id:null)).filter(id=>id&&state.lists[id]);
    if(!b.workspaceId || !state.workspaces[b.workspaceId]){
      let firstWs=Object.keys(state.workspaces)[0];
      if(!firstWs){ firstWs=uid('ws'); state.workspaces[firstWs]={id:firstWs,name:'Área de trabalho operacional',icon:'WD',color:'#6554c0',members:['Weslheyn Dias'],boards:[]}; }
      b.workspaceId=firstWs;
    }
  });
  Object.entries(state.workspaces).forEach(([wid,ws])=>{
    if(!ws) return;
    ws.id=ws.id||wid;
    ws.boards=Object.values(state.boards).filter(b=>b.workspaceId===wid).map(b=>b.id);
  });
  Object.values(state.boards).forEach(b=>{ if(b && (!b.lists||!b.lists.length)){ const lid=uid('l'); state.lists[lid]={id:lid,boardId:b.id,title:'A fazer',cards:[]}; b.lists=[lid]; }});
  Object.values(state.workspaces).forEach(ws=>{ if(ws && (!ws.boards||!ws.boards.length)){ ws.boards=Object.values(state.boards).filter(b=>b.workspaceId===ws.id).map(b=>b.id); }});
}
function openCardModal(cardId){
  try{
    let c=normalizeCardForModal(state.cards[cardId], cardId);
    if(!c){ c=Object.values(state.cards||{}).find(x=>x&&x.id===cardId); }
    if(!c){ closeModals(); renderBoard(); toast('Atividade não encontrada. Atualize a página e tente novamente.'); return;}
    state.cards[c.id]=c;
    openOverlay();
    const m=$('#gtCardModal');
    if(!m){closeModals(); toast('Modal da atividade não encontrado.'); return;}
    const comentarios=(c.comments||[]).map(x=>`<div class="gt-comment"><strong>WD</strong><br>${esc((x&&x.text)||'')}</div>`).join('');
    m.innerHTML=`<button class="gt-close" data-close>×</button><h2 contenteditable id="cmTitle">${esc(c.title)}</h2><div class="gt-card-grid"><div><div class="gt-field"><label>Descrição</label><textarea id="cmDesc" rows="4" placeholder="Adicionar uma descrição...">${esc(c.description||'')}</textarea></div><h3>Checklist</h3><div id="cmChecklist"></div><button class="gt-secondary" id="cmAddCheck">+ Item</button><h3>Comentários</h3><div id="cmComments">${comentarios}</div><div class="gt-row"><input id="cmNewComment" placeholder="Escrever comentário..." style="flex:1;border:1px solid #d0d4dc;border-radius:6px;padding:10px"><button class="gt-primary" id="cmSendComment">Enviar</button></div></div><aside class="gt-card-sidebar"><button class="gt-sidebar-btn" id="cmToggleDone">${c.done?'Reabrir cartão':'Marcar concluído'}</button><button class="gt-sidebar-btn" id="cmLabels">Etiquetas</button><button class="gt-sidebar-btn" id="cmDates">Datas</button><button class="gt-sidebar-btn" id="cmRepeat">Repetição: ${recName(c.recurrence||'none')}</button><button class="gt-sidebar-btn" id="cmAlarm">⏰ ${alarmLabel(c)}</button><button class="gt-sidebar-btn" id="cmDelete">Excluir</button></aside></div><div class="gt-form-actions"><button class="gt-secondary" data-close>Fechar</button><button class="gt-primary" id="cmSave">Salvar</button></div>`;
    m.classList.remove('gt-hidden');
    $$('[data-close]').forEach(b=>b.onclick=closeModals);
    renderChecklist(c);
    $('#cmSave').onclick=()=>{c.title=$('#cmTitle').textContent.trim()||c.title; c.description=$('#cmDesc').value; c.updatedAt=new Date().toISOString(); save(); closeModals(); renderBoard();};
    $('#cmToggleDone').onclick=()=>{toggleDone(cardId); closeModals();};
    $('#cmDelete').onclick=()=>{deleteCard(cardId); closeModals();};
    $('#cmAddCheck').onclick=()=>{c.checklist=c.checklist||[]; c.checklist.push({text:'Novo item',done:false}); renderChecklist(c);};
    $('#cmSendComment').onclick=()=>{const t=$('#cmNewComment').value.trim(); if(t){c.comments=c.comments||[]; c.comments.push({text:t,at:new Date().toISOString()}); save(); openCardModal(cardId)}};
    $('#cmLabels').onclick=()=>chooseLabels(c);
    $('#cmDates').onclick=()=>chooseDate(c);
    $('#cmRepeat').onclick=()=>chooseRepeat(c);
    $('#cmAlarm').onclick=()=>chooseAlarm(c);
  }catch(err){
    console.error('Erro ao abrir atividade:',err);
    closeModals();
    toast('Não foi possível abrir a atividade. Corrigi a compatibilidade dos cards antigos.');
  }
}
function renderChecklist(c){const box=$('#cmChecklist'); if(!box)return; box.innerHTML=(c.checklist||[]).map((it,i)=>`<div class="gt-check-item"><input type="checkbox" ${it.done?'checked':''} data-chi="${i}"><input type="text" value="${escAttr(it.text)}" data-cht="${i}"><button data-chd="${i}">×</button></div>`).join('')||'<p style="color:#5e6c84">Nenhum item.</p>'; $$('[data-chi]').forEach(x=>x.onchange=()=>{c.checklist[+x.dataset.chi].done=x.checked; save();}); $$('[data-cht]').forEach(x=>x.onchange=()=>{c.checklist[+x.dataset.cht].text=x.value; save();}); $$('[data-chd]').forEach(x=>x.onclick=()=>{c.checklist.splice(+x.dataset.chd,1); renderChecklist(c);});}
function chooseLabels(c){let html=`<h2>Etiquetas</h2><div class="gt-background-grid">${colors.map(col=>`<button class="gt-bg-option" style="background:${col}" data-label="${col}">${c.labels.includes(col)?'✓ ':''}${col}</button>`).join('')}</div><div class="gt-form-actions"><button class="gt-primary" data-close>OK</button></div>`; $('#gtCardModal').innerHTML=html; $$('[data-label]').forEach(b=>b.onclick=()=>{let col=b.dataset.label; c.labels=c.labels||[]; c.labels.includes(col)?c.labels=c.labels.filter(x=>x!==col):c.labels.push(col); save(); chooseLabels(c);}); $$('[data-close]').forEach(b=>b.onclick=()=>{closeModals(); renderBoard();});}
function chooseDate(c){modalForm('Data do cartão',`<div class="gt-field"><label>Prazo</label><input id="fdue" type="date" value="${c.due||''}"></div>`,()=>{c.due=$('#fdue').value; save(); closeModals(); renderBoard();});}
function chooseRepeat(c){modalForm('Atividade fixa / repetição',`<div class="gt-field"><label>Repetir</label><select id="frep"><option value="none">Não repetir</option><option value="daily">Diária</option><option value="weekdays">Segunda a sexta</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></div><p>Quando marcada como concluída, ela volta a aparecer no próximo dia/período configurado.</p>`,()=>{c.recurrence=$('#frep').value; c.done=false; save(); closeModals(); renderBoard();}); setTimeout(()=>{$('#frep').value=c.recurrence||'none'},10)}
function deleteCard(cardId){Object.values(state.lists).forEach(l=>l.cards=(l.cards||[]).filter(id=>id!==cardId)); delete state.cards[cardId]; save(); renderBoard();}
function openListMenu(listId){modalForm('Lista',`<button class="gt-secondary" id="delList" style="width:100%">Excluir lista</button>`,()=>closeModals()); $('#delList').onclick=()=>{const l=state.lists[listId]; if(confirm('Excluir esta lista e seus cartões?')){(l.cards||[]).forEach(id=>delete state.cards[id]); board().lists=board().lists.filter(id=>id!==listId); delete state.lists[listId]; save(); closeModals(); renderBoard();}}}
function renderSwitch(){openOverlay(); const m=$('#gtSwitchModal'); m.classList.remove('gt-hidden'); $('#gtBoardSearch').value=''; fillSwitch(); $('#gtCloseSwitch').onclick=closeModals; $('#gtBoardSearch').oninput=fillSwitch;}
function fillSwitch(){repairStateLinks(); const q=($('#gtBoardSearch').value||'').toLowerCase(); const recent=$('#gtRecentBoards'); recent.innerHTML=''; (state.recent||[]).map(id=>state.boards[id]).filter(Boolean).filter(b=>b.title.toLowerCase().includes(q)).forEach(b=>recent.appendChild(boardTile(b))); const sw=$('#gtSwitchWorkspaces'); sw.innerHTML=''; Object.values(state.workspaces).forEach(ws=>{const boards=(ws.boards||[]).map(id=>state.boards[id]).filter(Boolean).filter(b=>b.title.toLowerCase().includes(q)); if(!boards.length)return; const row=document.createElement('div'); row.className='gt-switch-workspace-row'; row.innerHTML=`<div class="gt-switch-workspace-title">${esc(ws.name)}</div><div class="gt-board-card-grid"></div>`; boards.forEach(b=>row.querySelector('.gt-board-card-grid').appendChild(boardTile(b))); sw.appendChild(row);});}
function renderPlanner(){const b=board(); if(b) setBg($('.gt-planner-day'),b.background); $('#gtCalMonth').textContent=`${monthNames[calDate.getMonth()]} de ${calDate.getFullYear()}`; renderCalendar(); renderPlannerCards();}
function renderCalendar(){const grid=$('#gtCalendarGrid'); grid.innerHTML=''; const y=calDate.getFullYear(),m=calDate.getMonth(); const first=new Date(y,m,1); const start=new Date(y,m,1-first.getDay()); for(let i=0;i<42;i++){let d=new Date(start); d.setDate(start.getDate()+i); let iso=d.toISOString().slice(0,10); let btn=document.createElement('button'); btn.className='gt-day'+(d.getMonth()!==m?' other':'')+(iso===todayISO()?' active':'')+(cardsForDate(iso).length?' has':''); btn.textContent=d.getDate(); btn.onclick=()=>{calDate=d; renderPlanner();}; grid.appendChild(btn);} }
function renderPlannerCards(){const iso=calDate.toISOString().slice(0,10); $('#gtPlannerTitle').textContent=`Atividades de ${fmtDateBR(iso)}`; runRecurring(iso); const cards=cardsForDate(iso); const box=$('#gtPlannerCards'); box.innerHTML=cards.length?'':'<div class="gt-planner-card">Nenhuma atividade para esta data.</div>'; cards.forEach(({card,list})=>{const el=document.createElement('div'); el.className='gt-planner-card'; el.innerHTML=`<div><strong>${esc(card.title)}</strong><br><small>${esc(board().title)} • ${esc(list.title)} ${card.recurrence!=='none'?'• 🔁 '+recName(card.recurrence):''}</small></div><button class="gt-secondary">${card.done?'Reabrir':'Concluir'}</button>`; el.querySelector('button').onclick=()=>toggleDone(card.id); el.ondblclick=()=>openCardModal(card.id); box.appendChild(el);});}
function cardsForDate(iso){let arr=[]; const b=board(); if(!b)return arr; (b.lists||[]).forEach(lid=>{const l=state.lists[lid]; (l?.cards||[]).forEach(cid=>{const c=state.cards[cid]; if(!c)return; if(c.due===iso || (c.recurrence&&c.recurrence!=='none'&&shouldShowRecurring(c,iso))) arr.push({card:c,list:l});});}); return arr;}
function shouldShowRecurring(c,iso){const d=new Date(iso+'T12:00:00'); if(c.recurrence==='daily')return true; if(c.recurrence==='weekdays')return d.getDay()>0&&d.getDay()<6; if(c.recurrence==='weekly'){const base=c.createdAt?new Date(c.createdAt):new Date(); return d.getDay()===base.getDay();} if(c.recurrence==='monthly'){const base=c.createdAt?new Date(c.createdAt):new Date(); return d.getDate()===base.getDate();} return false;}
function runRecurring(iso){Object.values(state.cards).forEach(c=>{if(c.recurrence&&c.recurrence!=='none'&&shouldShowRecurring(c,iso)){ if(c.done && (c.completedAt||'').slice(0,10)<iso){ c.done=false; c.due=iso; } }}); save();}

function alarmLabel(c){const a=effectiveAlarm(c); return a?`Alarme ${a.scope==='shared'?'compartilhado':'deste aparelho'}: ${a.time}`:'Adicionar alarme'}
function chooseAlarm(c){const a=effectiveAlarm(c)||{scope:'local',enabled:false,time:'09:00',advance:0,vibrate:true,sound:true}; modalForm('Despertador / notificação',`<label class="gt-check-line"><input id="alarmEnabled" type="checkbox" ${a.enabled?'checked':''}> Ativar lembrete para este card</label><div class="gt-field"><label>Tipo de alarme</label><select id="alarmScope"><option value="local">Somente neste dispositivo</option><option value="shared">Compartilhado para todos</option></select><small>Local toca apenas no celular/computador que configurou. Compartilhado sincroniza no Firebase e toca para todos com o app aberto e permissão ativa.</small></div><div class="gt-field"><label>Data do prazo</label><input id="alarmDue" type="date" value="${c.due||todayISO()}"></div><div class="gt-field"><label>Horário do alarme</label><input id="alarmTime" type="time" value="${a.time||'09:00'}"></div><div class="gt-field"><label>Quando avisar</label><select id="alarmAdvance"><option value="0">Na hora</option><option value="5">5 minutos antes</option><option value="10">10 minutos antes</option><option value="15">15 minutos antes</option><option value="30">30 minutos antes</option><option value="60">1 hora antes</option></select></div><label class="gt-check-line"><input id="alarmVibrate" type="checkbox" ${a.vibrate!==false?'checked':''}> Vibrar no celular quando possível</label><label class="gt-check-line"><input id="alarmSound" type="checkbox" ${a.sound!==false?'checked':''}> Tocar som no navegador</label><p class="gt-muted">Para tocar/notificar, o navegador precisa permitir notificações. No iPhone, funciona melhor com o app instalado na tela inicial.</p><button type="button" class="gt-secondary" id="alarmPermission">Permitir notificações</button><button type="button" class="gt-secondary" id="alarmTest">Testar alarme agora</button>`,()=>{const enabled=$('#alarmEnabled').checked; const scope=$('#alarmScope').value; c.due=$('#alarmDue').value; const cfg={enabled,time:$('#alarmTime').value,advance:Number($('#alarmAdvance').value||0),vibrate:$('#alarmVibrate').checked,sound:$('#alarmSound').checked}; if(scope==='local'){ setLocalAlarm(c.id,cfg); c.sharedAlarmEnabled=false; c.sharedAlarmTime=''; }else{ removeLocalAlarm(c.id); c.sharedAlarmEnabled=enabled; c.sharedAlarmTime=cfg.time; c.sharedAlarmAdvance=cfg.advance; c.sharedAlarmVibrate=cfg.vibrate; c.sharedAlarmSound=cfg.sound; } c.updatedAt=new Date().toISOString(); if(enabled) requestNotifyPermission(); save(); closeModals(); renderBoard();}); setTimeout(()=>{$('#alarmScope').value=a.scope||'local'; $('#alarmAdvance').value=String(a.advance||0); $('#alarmPermission').onclick=requestNotifyPermission; $('#alarmTest').onclick=()=>fireCardAlarm(c, true);},20)}
function requestNotifyPermission(){ if(!('Notification' in window)){toast('Este navegador não suporta notificação.'); return;} if(Notification.permission==='granted'){toast('Notificações já permitidas.'); return;} Notification.requestPermission().then(p=>toast(p==='granted'?'Notificações ativadas.':'Permissão de notificação negada.')).catch(()=>toast('Não foi possível ativar notificações.')); }
function alarmDateForCard(c,iso=todayISO()){ const a=effectiveAlarm(c); if(!a||!a.enabled||!a.time)return null; let day=c.due||iso; if(c.recurrence&&c.recurrence!=='none'&&shouldShowRecurring(c,iso)) day=iso; if(!day)return null; const d=new Date(`${day}T${a.time}:00`); if(Number.isNaN(d.getTime()))return null; d.setMinutes(d.getMinutes()-Number(a.advance||0)); return d; }
function alarmKey(c,iso=todayISO()){const a=effectiveAlarm(c)||{}; return `${c.id}|${a.scope||'none'}|${iso}|${a.time||''}|${a.advance||0}`}
function beep(){try{const C=window.AudioContext||window.webkitAudioContext; const ctx=new C(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.frequency.value=880; gain.gain.value=0.09; osc.connect(gain); gain.connect(ctx.destination); osc.start(); setTimeout(()=>{osc.stop(); ctx.close();},520);}catch(e){}}
function fireCardAlarm(c,test=false){ const a=effectiveAlarm(c)||{sound:true,vibrate:true,scope:'local',time:''}; if(a.sound!==false) beep(); if(a.vibrate!==false && navigator.vibrate) navigator.vibrate([280,120,280,120,280]); const tipo=a.scope==='shared'?'Alarme compartilhado':'Alarme deste dispositivo'; const body=`${tipo} • ${a.time||''}${test?' • Teste':''}`; if('Notification' in window && Notification.permission==='granted'){try{new Notification('Gerenciador de Tarefas', {body:`${c.title}\n${body}`, icon:'icon.png', badge:'icon.png'});}catch(e){toast('⏰ '+c.title)}} else toast('⏰ '+c.title); }
function checkAlarms(){ const now=new Date(); const iso=todayISO(); Object.values(state.cards||{}).forEach(c=>{const a=effectiveAlarm(c); if(!a||!a.enabled||c.done)return; if(c.recurrence&&c.recurrence!=='none'&&!shouldShowRecurring(c,iso)&&c.due!==iso)return; const d=alarmDateForCard(c,iso); if(!d)return; const diff=now-d; const k=alarmKey(c,iso); if(diff>=0 && diff<120000 && !state.notificationLog[k]){state.notificationLog[k]=new Date().toISOString(); fireCardAlarm(c); save();}}); }
function openNotificationsPanel(){openOverlay(); const m=$('#gtFormModal'); const upcoming=Object.values(state.cards||{}).filter(c=>effectiveAlarm(c)).sort((a,b)=>(alarmDateForCard(a)?.getTime()||0)-(alarmDateForCard(b)?.getTime()||0)).slice(0,25); m.innerHTML=`<button class="gt-close" data-close>×</button><h2>Notificações e alarmes</h2><p class="gt-muted">Cards, listas e quadros sincronizam no Firebase. Alarmes locais ficam só neste dispositivo. Alarmes compartilhados sincronizam para todos.</p><button class="gt-primary" id="notifyPermissionBtn">Permitir notificações</button><h3>Próximos alarmes</h3><div class="gt-inbox-list">${upcoming.length?upcoming.map(c=>{const a=effectiveAlarm(c); return `<div class="gt-inbox-item"><strong>${esc(c.title)}</strong><br><small>⏰ ${a.time||'--:--'} ${a.advance?`• ${a.advance} min antes`:''} • ${a.scope==='shared'?'🌐 compartilhado':'📱 este dispositivo'} ${c.recurrence&&c.recurrence!=='none'?`• 🔁 ${recName(c.recurrence)}`:''}</small></div>`}).join(''):'<div class="gt-inbox-item">Nenhum alarme configurado.</div>'}</div>`; m.classList.remove('gt-hidden'); $('#notifyPermissionBtn').onclick=requestNotifyPermission; $$('[data-close]').forEach(b=>b.onclick=closeModals); }
function startAlarmLoop(){ requestAnimationFrame(()=>{checkAlarms(); setInterval(checkAlarms,30000);}); if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});} }

function renderInbox(){const box=$('#gtInboxList'); box.innerHTML=''; const all=Object.values(state.cards).filter(c=>c.due||c.recurrence!=='none').slice(0,30); if(!all.length)box.innerHTML='<div class="gt-inbox-item">Nenhuma atualização.</div>'; all.forEach(c=>{let div=document.createElement('div'); div.className='gt-inbox-item'; div.innerHTML=`<strong>${esc(c.title)}</strong><br><small>${c.due?'Prazo: '+fmtDateBR(c.due):'Atividade recorrente: '+recName(c.recurrence)}${effectiveAlarm(c)?' • ⏰ '+effectiveAlarm(c).time:''}</small>`; box.appendChild(div);});}
function openShare(){openOverlay(); const m=$('#gtShareModal'); m.innerHTML=`<button class="gt-close" data-close>×</button><h2>Compartilhar quadro</h2><div class="gt-row"><input placeholder="Endereço de e-mail ou nome" style="flex:1;border:1px solid #d0d4dc;border-radius:6px;padding:10px"><select style="border:1px solid #d0d4dc;border-radius:6px;padding:10px"><option>Membro</option><option>Observador</option><option>Administrador</option></select><button class="gt-primary">Compartilhar</button></div><p>🔗 Compartilhar este quadro com um link<br><a href="#">Criar link</a></p><h3>Membros do quadro</h3>${(board().members||[]).map(x=>`<div class="gt-row" style="justify-content:space-between;border-top:1px solid #dfe1e6;padding:12px 0"><span><b>${esc(x)}</b><br><small>Administrador da Área de trabalho</small></span><button class="gt-secondary">Administrador</button></div>`).join('')}`; m.classList.remove('gt-hidden'); $$('[data-close]').forEach(b=>b.onclick=closeModals);}
function openBackground(){openOverlay(); const m=$('#gtBackgroundModal'); m.innerHTML=`<button class="gt-close" data-close>×</button><h2>Mudar fundo</h2><p class="gt-muted">Escolha um tema para este quadro. O tema Coco Bambu foi adicionado como padrão.</p><div class="gt-background-grid">${bgLib.map(bg=>`<button class="gt-bg-option" data-bg="${bg.id}"><span>${esc(bg.name)}</span></button>`).join('')}</div><div class="gt-field"><label>Imagem personalizada por URL</label><input id="customBg" placeholder="https://..."></div><button class="gt-primary" id="saveCustomBg">Usar imagem</button>`; m.classList.remove('gt-hidden'); bgLib.forEach(bg=>{const el=m.querySelector(`[data-bg="${bg.id}"]`); setBg(el,bg); if(board().background?.id===bg.id)el.classList.add('selected'); el.onclick=()=>{board().background=bg; save(); closeModals(); renderBoard();};}); $('#saveCustomBg').onclick=()=>{const v=$('#customBg').value.trim(); if(v){board().background={id:'custom',name:'Personalizado',type:'image',value:v}; save(); closeModals(); renderBoard();}}; $$('[data-close]').forEach(b=>b.onclick=closeModals);}
function openCreate(){openOverlay(); $('#gtCreateModal').classList.remove('gt-hidden');}
function openOverlay(){closeModals(false); $('#gtOverlay').classList.remove('gt-hidden');}
function closeModals(hideOverlay=true){['#gtSwitchModal','#gtCreateModal','#gtFormModal','#gtCardModal','#gtShareModal','#gtBackgroundModal'].forEach(s=>$(s)?.classList.add('gt-hidden')); if(hideOverlay)$('#gtOverlay').classList.add('gt-hidden'); document.querySelector('.gt-menu-drawer')?.remove();}
function openDrawer(){closeModals(); const d=document.createElement('div'); d.className='gt-menu-drawer'; d.innerHTML=`<h3>Gerenciador</h3><button id="dHome">Áreas de trabalho</button><button id="dNewWs">+ Nova área de trabalho</button><button id="dSwitch">Mudar quadros</button><button onclick="location.href='index.html'">Voltar ao sistema</button><hr><h3>Áreas</h3>${Object.values(state.workspaces).map(w=>`<button data-ws="${w.id}">${esc(w.name)}</button>`).join('')}`; document.body.appendChild(d); $('#dHome').onclick=showHome; $('#dNewWs').onclick=openWorkspaceForm; $('#dSwitch').onclick=renderSwitch; $$('[data-ws]').forEach(b=>b.onclick=()=>{current.workspaceId=b.dataset.ws; showHome();});}
function toast(t){let x=document.createElement('div'); x.className='gt-toast'; x.textContent=t; document.body.appendChild(x); setTimeout(()=>x.remove(),2200)}
function recName(r){return ({none:'Não repetir',daily:'Diária',weekdays:'Segunda a sexta',weekly:'Semanal',monthly:'Mensal'}[r]||'Não repetir')}
function esc(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function escAttr(s){return esc(s).replace(/'/g,'&#39;')}
function bind(){ $('#gtHomeBtn').onclick=showHome; $('#gtMenuBtn').onclick=openDrawer; $('#gtCreateBtn').onclick=openCreate; $('#gtNewWorkspaceHome').onclick=openWorkspaceForm; $('#gtSwitchBoardsBtn').onclick=renderSwitch; $('#gtShareBtn').onclick=openShare; $('#gtBackgroundBtn').onclick=openBackground; $('#gtFavoriteBtn').onclick=()=>{board().favorite=!board().favorite; save(); renderBoard();}; $('#gtPlannerQuickBtn').onclick=()=>showView('planner'); $('#gtNewDailyTask').onclick=()=>{let firstList=board().lists[0]; openCardForm(firstList,{due:calDate.toISOString().slice(0,10)}); setTimeout(()=>{$('#fRec') && ($('#fRec').value='daily')},60)}; $('#gtPrevMonth').onclick=()=>{calDate.setMonth(calDate.getMonth()-1); renderPlanner();}; $('#gtNextMonth').onclick=()=>{calDate.setMonth(calDate.getMonth()+1); renderPlanner();}; $('#gtTodayBtn').onclick=()=>{calDate=new Date(); renderPlanner();}; $('#gtCreateWorkspaceOpt').onclick=openWorkspaceForm; $('#gtCreateBoardOpt').onclick=()=>openBoardForm(); $('#gtCreateListOpt').onclick=openListForm; $('#gtOverlay').onclick=()=>closeModals(); $$('.gt-bottom-nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view)); $('#gtSearch').oninput=()=>{const q=$('#gtSearch').value.toLowerCase(); $$('.gt-card').forEach(card=>card.style.display=card.textContent.toLowerCase().includes(q)?'':'none');}; $('#gtNotifyBtn') && ($('#gtNotifyBtn').onclick=openNotificationsPanel);}
load(); bind(); showView('board'); startAlarmLoop(); initCloudSync();
})();

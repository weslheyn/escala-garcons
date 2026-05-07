(function(){
'use strict';
const $=id=>document.getElementById(id);
const STORE='eventos_premium_v58';
const META='eventos_premium_meta_v58';
const AGENDA_STORE='eventos_agenda_comercial_v61';
const AGENDA_RESP_STORE='eventos_agenda_responsaveis_v61';
const DEVICE_STORE='eventos_device_id_v61';
const CLIENTES_STORE='eventos_clientes_cadastro_v64';
let deferredInstallPrompt=null;
const PIPELINE_STATUS=['Lead','Proposta enviada','Visita do espaço','Negociação 1','Negociação 2','Reunião de alinhamento','Contrato enviado','Assinatura cliente','Assinatura diretoria','Fechado','Realizado'];
const RECOVERY_STATUS=['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'];
const STATUS=[...PIPELINE_STATUS,...RECOVERY_STATUS];
const TABS=[['dashboard','Dashboard'],['funil','Funil'],['calendario','Calendário'],['vendas','Vendas'],['recuperacao','Recuperação'],['clientes','Clientes'],['pacotes','Pacotes'],['agenda','Agenda'],['sheets','Relatórios']];
let state={tab:'dashboard',eventos:[],pacotes:window.EVENTOS_PACOTES||[],agenda:[],agendaResponsaveis:[],agendaFiltros:{criador:'',visibilidade:'',tipo:'',status:''},clientesView:'historico',clientesCadastros:[],meta:{metaMensal:150000},cal:{year:new Date().getFullYear(),month:new Date().getMonth()+1,view:'mes',day:new Date().getDate()}};
function brl(n){return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dt(s){ const iso=parseDateAny(s); if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`;}
function dow(s){ const iso=parseDateAny(s); if(!iso) return ''; const d=new Date(iso+'T12:00:00'); return ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][d.getDay()]||'';}
function shortDate(s){ if(!s)return ''; const iso=parseDateAny(s); if(!iso)return ''; const [y,m,d]=String(iso).split('-'); return `${d}/${m}`;}
function parseDateAny(v){
  if(!v)return '';
  if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString().slice(0,10);
  const s=String(v).trim();
  if(!s)return '';
  const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(iso)return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
  const br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(br){const yy=br[3].length===2?'20'+br[3]:br[3];return `${yy}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;}
  return '';
}
function parseTimestampBR(v){
  if(!v)return 0;
  if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.getTime();
  if(typeof v==='number'&&Number.isFinite(v)) return v;
  const s=String(v).trim();
  if(!s)return 0;
  const iso=Date.parse(s);
  if(Number.isFinite(iso)) return iso;
  const br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(br){
    const y=Number(br[3].length===2?'20'+br[3]:br[3]);
    const mo=Number(br[2])-1, d=Number(br[1]);
    const h=Number(br[4]||0), mi=Number(br[5]||0), se=Number(br[6]||0);
    const t=new Date(y,mo,d,h,mi,se).getTime();
    return Number.isFinite(t)?t:0;
  }
  return 0;
}
function isGoogleFormsEvento(e){
  const origem=norm([e.origem,e.origemPlanilha,e.fonte].join(' '));
  return origem.includes('google forms')||String(e.id||'').startsWith('form_')||String(e.eventoId||'').startsWith('form_');
}
function eventoRecency(e){
  const criado=parseTimestampBR(e.movidoEm||e.movimentadoEm||e.statusAtualizadoEm||e.criadoEm||e.createdAt||e.dataCriacao||e.dataCadastro||e.formTimestamp||e.carimbo||e['Carimbo de data/hora']||e['CARIMBO DE DATA/HORA']);
  const atualizado=parseTimestampBR(e.atualizadoEm||e.updatedAt);
  const form=isGoogleFormsEvento(e);
  if(form){
    // Leads vindos do Google Forms devem ficar sempre acima dos eventos importados da planilha.
    return Math.max(criado,atualizado,0)+9000000000000000;
  }
  if(criado||atualizado) return Math.max(criado,atualizado);
  // Eventos antigos/importados sem data de criação não devem superar leads novos apenas pela data futura do evento.
  return 0;
}
function sortEventosRecentes(arr){return [...(arr||[])].sort((a,b)=>eventoRecency(b)-eventoRecency(a)||String(b.criadoEm||b.atualizadoEm||b.id||'').localeCompare(String(a.criadoEm||a.atualizadoEm||a.id||'')));}
function horario(e){
  if(e.horario) return e.horario;
  const origem=norm(e.origem||e.origemPlanilha||'');
  if(origem.includes('google forms')) return 'Horário não definido';
  const txt=String(e.observacoes||'').replace(/Enviado em:.*/gi,'');
  const m=txt.match(/(?:\b|^)([01]?\d|2[0-3])[:hH]([0-5]\d)?(?:\b|$)/);
  return m?(m[2]?`${m[1].padStart(2,'0')}:${m[2]}`:`${m[1].padStart(2,'0')}:00`):'Horário não definido';
}
function salao(e){return e.salao||e.unidade||'Salão não definido';}
function monthName(m){return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1]||'';}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function digitsOnly(s){return String(s||'').replace(/\D/g,'');}
function isGenericClienteNome(v){const n=norm(v).trim();return !n||n==='cliente nao identificado'||n==='cliente nao informado'||n==='cliente sem nome'||n==='cliente';}
function pickFilled(a,b){return (b!==undefined&&b!==null&&String(b).trim()!=='')?b:a;}
function mergePreferido(base={},novo={}){
  const out=Object.assign({},base);
  Object.keys(novo||{}).forEach(k=>{out[k]=pickFilled(out[k],novo[k]);});
  const nb=base.cliente||base.nome, nn=novo.cliente||novo.nome;
  if(isGenericClienteNome(out.cliente||out.nome)){
    const melhor=!isGenericClienteNome(nn)?nn:(!isGenericClienteNome(nb)?nb:(out.cliente||out.nome));
    if('cliente' in out) out.cliente=melhor;
    if('nome' in out) out.nome=melhor;
  }else if(!isGenericClienteNome(nb)&&isGenericClienteNome(nn)){
    if('cliente' in out) out.cliente=nb;
    if('nome' in out) out.nome=nb;
  }
  return out;
}
function toast(t){const el=$('toast'); el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500);}
function uid(){return 'ev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function agendaUid(){return 'ag_evt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function deviceId(){let id=localStorage.getItem(DEVICE_STORE); if(!id){id='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9); localStorage.setItem(DEVICE_STORE,id)} return id;}
function saveAgenda(){localStorage.setItem(AGENDA_STORE,JSON.stringify(state.agenda));localStorage.setItem(AGENDA_RESP_STORE,JSON.stringify(state.agendaResponsaveis));}
function save(){localStorage.setItem(STORE,JSON.stringify(state.eventos));localStorage.setItem(META,JSON.stringify(state.meta)); if(window.EventosFirebase&&EventosFirebase.enabled) EventosFirebase.saveAll(state.eventos).catch(()=>{});}
function saveClientes(){localStorage.setItem(CLIENTES_STORE,JSON.stringify(state.clientesCadastros||[]));}
function load(){
  const saved=localStorage.getItem(STORE);
  if(saved){try{state.eventos=dedupeEventos(JSON.parse(saved)||[])}catch(e){state.eventos=[]}}
  else{
    state.eventos=dedupeEventos((window.EVENTOS_SEED||[]).map(e=>({...e,importado:true})));
    localStorage.setItem(STORE,JSON.stringify(state.eventos));
  }
  try{state.meta=Object.assign(state.meta,JSON.parse(localStorage.getItem(META)||'{}'))}catch(e){}
  try{state.agenda=JSON.parse(localStorage.getItem(AGENDA_STORE)||'[]')||[]}catch(e){state.agenda=[]}
  try{state.agendaResponsaveis=JSON.parse(localStorage.getItem(AGENDA_RESP_STORE)||'[]')||[]}catch(e){state.agendaResponsaveis=[]}
  try{state.clientesCadastros=dedupeClientesCadastro(JSON.parse(localStorage.getItem(CLIENTES_STORE)||'[]')||[])}catch(e){state.clientesCadastros=[]}
  const nomes=[...state.agenda.map(a=>a.criador),...state.agenda.map(a=>a.responsavel),...state.agendaResponsaveis].filter(Boolean).map(x=>String(x).trim()).filter(Boolean);
  state.agendaResponsaveis=[...new Set(nomes)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  saveAgenda();
}

function filtered(){
  const q=norm($('q').value), ano=$('ano').value, st=$('status').value, turno=$('turno').value, pacote=$('pacote').value, mes=$('mes').value;
  return state.eventos.filter(e=>{
    const hay=norm([e.cliente,e.telefone,e.tipo,e.turno,e.pacote,e.status,e.observacoes,e.unidade].join(' '));
    return (!q||hay.includes(q))&&(!ano||String(e.ano||String(e.data).slice(0,4))===ano)&&(!st||e.status===st)&&(!turno||e.turno===turno)&&(!pacote||e.pacote===pacote)&&(!mes||String(Number(String(e.data).slice(5,7)))===mes);
  });
}
function statusClass(s){const n=norm(s); if(n.includes('fechado'))return's-fechado'; if(n.includes('perdido'))return's-perdido'; if(n.includes('cancel'))return's-cancelado'; if(n.includes('sem resposta')||n.includes('recupera'))return's-semresposta'; if(n.includes('contrato')||n.includes('assinatura'))return's-contrato'; if(n.includes('proposta')||n.includes('visita'))return's-proposta'; if(n.includes('reuniao'))return's-reuniao'; if(n.includes('realizado'))return's-fechado'; return's-neg';}
function eventColorClass(e){const n=norm([e.status,e.tipo,e.pacote,e.origem].join(' ')); if(n.includes('fechado')||n.includes('realizado'))return'evc-green'; if(n.includes('cancel')||n.includes('perdido'))return'evc-red'; if(n.includes('corporativo')||n.includes('empresa'))return'evc-blue'; if(n.includes('reuniao')||n.includes('alinhamento')||n.includes('contrato')||n.includes('assinatura'))return'evc-purple'; if(n.includes('proposta')||n.includes('visita')||n.includes('lead'))return'evc-yellow'; return'evc-gray';}
function moduleMeta(){const map={dashboard:['Dashboard','Visão geral comercial dos eventos.','▦'],funil:['Funil de Eventos','Acompanhe oportunidades e mova cards entre etapas.','▽'],calendario:['Calendário de Eventos','Visualize e gerencie os eventos do mês.','▣'],vendas:['Vendas','Controle de vendas, valores e orçamentos.','↗'],recuperacao:['Recuperação','Recupere clientes inativos e oportunidades perdidas.','↻'],clientes:['Clientes','Histórico e cadastro de clientes do CRM.','◌'],pacotes:['Pacotes','Pacotes, serviços e valores cadastrados.','▤'],agenda:['Agenda','Tarefas, compromissos e atividades da equipe.','☷'],sheets:['Relatórios','Exportações, integrações e indicadores.','▥']};return map[state.tab]||map.dashboard;}
function moduleHeader(extra=''){const [title,subtitle,icon]=moduleMeta();return `<div class="module-head premium-panel"><div><span class="eyebrow">${icon} ${esc(title.split(' ')[0])}</span><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${extra?`<div class="module-actions">${extra}</div>`:''}</div>`;}
function isRecuperacaoStatus(s){return ['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'].includes(s);}
function normalizeStatus(s, obs=''){
  const n=norm([s,obs].join(' '));
  if(n.includes('realizado')) return 'Realizado';
  if(n.includes('fechado') || n.includes('contrato assinado') || n.includes('evento fechado')) return 'Fechado';
  if(n.includes('assinatura diretoria') || n.includes('diretoria')) return 'Assinatura diretoria';
  if(n.includes('assinatura cliente') || n.includes('cliente assinou')) return 'Assinatura cliente';
  if(n.includes('contrato enviado') || n.includes('aguardando contrato')) return 'Contrato enviado';
  if(n.includes('reuniao')) return 'Reunião de alinhamento';
  if(n.includes('negociacao 2')) return 'Negociação 2';
  if(n.includes('negociacao') || n.includes('em negociacao')) return 'Negociação 1';
  if(n.includes('visita') || n.includes('mostrou interesse') || n.includes('interesse na data')) return 'Visita do espaço';
  if(n.includes('proposta enviada') || n.includes('proposta aprovada')) return 'Proposta enviada';
  if(n.includes('sem retorno') || n.includes('sem resposta')) return 'Sem resposta';
  if(n.includes('cancel')) return 'Cancelado';
  if(n.includes('declin') || n.includes('perdido') || n.includes('desistiu')) return 'Perdido';
  if(PIPELINE_STATUS.includes(s) || RECOVERY_STATUS.includes(s)) return s;
  return 'Lead';
}
function eventoDedupeKey(e){
  const origem=norm(e.origem||e.origemPlanilha||'');
  const phone=digitsOnly(e.telefone);
  const email=norm(e.email||'');
  const isForm=origem.includes('google forms')||String(e.id||'').startsWith('form_');
  if(isForm&&(phone||email)) return ['forms',phone,email,e.data||'',norm(e.tipo||e.tipoEvento||'')].join('|');
  return [e.data,e.cliente,e.telefone,e.pacote,e.turno,String(e.observacoes||'').slice(0,80)].map(x=>norm(x)).join('|');
}
function normalizaEvento(e={}){
  const out=Object.assign({},e);
  out.cliente=e.cliente||e.nome||e.nomeCompleto||e.clienteNome||'';
  out.data=parseDateAny(e.data||e.dataEvento||e.data_evento||e['DATA EVENTO']||e['DATA EVENTO:'])||'';
  out.ano=out.data?Number(out.data.slice(0,4)):(Number(e.ano)||new Date().getFullYear());
  out.tipo=e.tipo||e.tipoEvento||'Evento';
  out.status=normalizeStatus(e.status,e.observacoes);
  out.valorEstimado=Number(e.valorEstimado??e.valorTotal)||0;
  out.valorTotal=Number(e.valorTotal??e.valorEstimado)||0;
  out.criadoEm=e.criadoEm||e.createdAt||e.dataCriacao||e.dataCadastro||e.formTimestamp||e.carimbo||e['Carimbo de data/hora']||e['CARIMBO DE DATA/HORA']||'';
  out.movidoEm=e.movidoEm||e.movimentadoEm||e.statusAtualizadoEm||'';
  out.atualizadoEm=e.atualizadoEm||e.updatedAt||'';
  out._recency=eventoRecency(out);
  return out;
}
function dedupeEventos(arr){
  const map=new Map();
  (arr||[]).forEach(raw=>{
    if(!raw)return;
    const e=normalizaEvento(raw);
    const k=eventoDedupeKey(e)||e.id;
    const old=map.get(k);
    let merged=old?mergePreferido(old,e):e;
    if(isGenericClienteNome(merged.cliente)&&old&&!isGenericClienteNome(old.cliente)) merged.cliente=old.cliente;
    if(isGenericClienteNome(merged.cliente)&&!isGenericClienteNome(e.cliente)) merged.cliente=e.cliente;
    map.set(k,merged);
  });
  return sortEventosRecentes([...map.values()]);
}
function setupFilters(){
  $('status').innerHTML='<option value="">Todos status</option>'+STATUS.map(s=>`<option>${s}</option>`).join('');
  const packs=[...new Set([...state.eventos.map(e=>e.pacote).filter(Boolean),...state.pacotes.map(p=>p.nome.replace('Menu ',''))])].sort();
  $('pacote').innerHTML='<option value="">Todos pacotes</option>'+packs.map(p=>`<option>${p}</option>`).join('');
  $('mes').innerHTML='<option value="">Todos meses</option>'+Array.from({length:12},(_,i)=>`<option value="${i+1}">${monthName(i+1)}</option>`).join('');
  ['q','ano','status','turno','pacote','mes'].forEach(id=>$(id).addEventListener('input',render));
}
function setupTabs(){
  $('tabs').innerHTML=TABS.map(([id,l])=>`<button class="tab ${id===state.tab?'active':''}" onclick="EVENTOS.tab('${id}')">${l}</button>`).join('');
}
function calc(list=filtered()){
  const total=list.reduce((s,e)=>s+(Number(e.valorEstimado)||0),0);
  const gorjeta=list.reduce((s,e)=>s+(Number(e.gorjeta)||0),0);
  const fechados=list.filter(e=>e.status==='Fechado'||e.status==='Realizado').length;
  const recuperar=list.filter(e=>isRecuperacaoStatus(e.status)).length;
  const almoco=list.filter(e=>e.turno==='Almoço').reduce((s,e)=>s+(Number(e.valorEstimado)||0),0);
  const jantar=list.filter(e=>e.turno==='Jantar').reduce((s,e)=>s+(Number(e.valorEstimado)||0),0);
  return{total,gorjeta,fechados,recuperar,almoco,jantar,count:list.length,ticket:list.length?total/list.length:0,conv:list.length?fechados/list.length*100:0};
}
function groupBy(list,key){return list.reduce((a,e)=>{const k=typeof key==='function'?key(e):(e[key]||'A definir');a[k]=(a[k]||0)+(Number(e.valorEstimado)||1);return a;},{});}
function bars(obj,labelMoney=true){const arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,8);const max=Math.max(1,...arr.map(x=>x[1]));return arr.map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${Math.max(4,v/max*100)}%"></i></div><strong>${labelMoney?brl(v):v}</strong></div>`).join('')||'<p class="muted">Sem dados no filtro atual.</p>';}
function renderHero(){const list=filtered(),c=calc(list); const set=(id,v)=>{if($(id))$(id).textContent=v}; set('heroTotal',brl(c.total)); set('heroEventos',c.count); set('heroFechados',c.fechados); set('heroARealizar',Math.max(0,c.count-c.fechados-c.recuperar)); set('heroAlmoco',brl(c.almoco)); set('heroJantar',brl(c.jantar)); set('heroTicket',brl(c.ticket)); set('heroConv',c.conv.toFixed(1)+'%'); set('heroGorjeta',brl(c.gorjeta)); renderWeekEvents();}
function weekBounds(base=new Date()){
  const d=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  const start=new Date(d); start.setDate(d.getDate()+diff);
  const end=new Date(start); end.setDate(start.getDate()+6);
  const iso=x=>x.toISOString().slice(0,10);
  return{start:iso(start),end:iso(end),startDate:start,endDate:end};
}
function renderWeekEvents(){
  const wrap=$('weekEvents'); if(!wrap)return;
  const wb=weekBounds(new Date());
  const fmt=x=>x.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  const badge=$('weekRange'); if(badge)badge.textContent=`${fmt(wb.startDate)} a ${fmt(wb.endDate)}`;
  let list=state.eventos.filter(e=>(e.status==='Fechado'||e.status==='Realizado')&&e.data>=wb.start&&e.data<=wb.end).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  wrap.innerHTML=list.length?list.map(e=>`<div class="week-event brand-event-card" onclick="EVENTOS.view('${e.id}')"><span class="date">${dow(e.data)} • ${shortDate(e.data)} • ${horario(e)}</span><b>${esc(e.cliente||'Cliente')}</b><p>${esc(e.tipo||'Evento')} · ${e.pessoas||'-'} pessoas<br>${esc(e.pacote||'A definir')}</p><span class="place">📍 ${esc(salao(e))}</span><span class="money">${brl(e.valorEstimado)}</span></div>`).join(''):`<div class="week-empty"><b>Nenhum evento fechado nesta semana.</b><br><span>Quando um evento for marcado como Fechado, ele aparecerá aqui automaticamente.</span></div>`;
}
function salaoKey(e){const n=norm(salao(e)); if(n.includes('beira'))return 'Beira Mar'; if(n.includes('vasto'))return 'Vasto'; if(n.includes('varanda'))return 'Varanda'; if(n.includes('barra'))return 'Barra'; if(n.includes('recreio'))return 'Recreio'; return 'A definir';}
function donutLegend(obj){const arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);const total=arr.reduce((s,x)=>s+x[1],0)||1;return arr.map(([k,v],i)=>`<div class="legend-row"><span><i class="legend-dot d${i}"></i>${k}</span><b>${Math.round(v/total*100)}%</b></div>`).join('')||'<p class="muted">Sem dados</p>';}
function pipelineSummary(list){return PIPELINE_STATUS.filter(s=>s!=='Realizado').map(st=>{const arr=list.filter(e=>e.status===st);const total=arr.reduce((a,e)=>a+(Number(e.valorEstimado)||0),0);return `<div class="pipe-step"><span>${st}</span><b>${arr.length}</b><small>${brl(total)}</small></div>`}).join('<i class="pipe-arrow">›</i>');}
function renderDashboard(){const list=filtered(),c=calc(list);const byTurno=groupBy(list,'turno'),byPkg=groupBy(list,'pacote'),byStatus=groupBy(list,'status');const bySalao=groupBy(list,salaoKey);const byDow=groupBy(list,e=>{const d=new Date(e.data+'T12:00:00');return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];});const meta=Number(state.meta.metaMensal)||0;const pct=meta?Math.min(100,c.total/meta*100):0;
$('dashboard').innerHTML=`
<div class="dash-layout">
  <section class="week-card premium-block">
    <div class="section-title-row"><div><span class="eyebrow">Agenda comercial</span><h2>Eventos da semana</h2></div><button class="link-btn" onclick="EVENTOS.tab('calendario')">Ver calendário</button></div>
    <div class="week-scroll" id="weekEvents"></div>
  </section>
  <section class="panel premium-block salao-card"><div class="section-title-row"><h3>Distribuição por salão</h3></div><div class="donut-wrap"><div class="donut"><span>${c.count}<small>eventos</small></span></div><div class="legend">${donutLegend(bySalao)}</div></div></section>
  <section class="panel premium-block pipeline-card"><div class="section-title-row"><h3>Funil de negociação</h3><button class="link-btn" onclick="EVENTOS.tab('funil')">Ver funil completo</button></div><div class="pipeline-strip">${pipelineSummary(list.filter(e=>!isRecuperacaoStatus(e.status)))}</div></section>
  <section class="panel premium-block"><h3>Vendas por pacote/proposta</h3>${bars(byPkg)}</section>
  <section class="panel premium-block"><h3>Dias da semana</h3>${bars(byDow)}</section>
  <section class="panel premium-block"><h3>Turnos</h3>${bars(byTurno)}</section>
  <section class="panel premium-block"><h3>Status do funil</h3>${bars(byStatus)}</section>
  <section class="panel premium-block meta-wide"><div class="meta-icon">◎</div><div><h3>Meta mensal</h3><p>Meta: ${brl(meta)}<br>Atual: ${brl(c.total)}</p></div><div class="meta-bar"><i style="width:${pct}%"></i></div><strong>${pct.toFixed(2).replace('.',',')}%</strong></section>
</div>`;
renderWeekEvents();
}
function initials(name){return String(name||'CB').trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()||'CB';}
function card(e){return `<div class="event-card draggable-card ${eventColorClass(e)}" draggable="true" data-event-id="${e.id}" data-status="${esc(e.status||'Lead')}"><div class="card-row"><span class="client-avatar">${esc(initials(e.cliente))}</span><div class="card-main"><b>${e.cliente||'Cliente'}</b><p>${dow(e.data)} • ${shortDate(e.data)} • ${horario(e)}<br>${e.turno||'A definir'} · ${e.pessoas||'-'} pessoas · ${e.pacote||'A definir'}<br>📍 ${esc(salao(e))} · ${brl(e.valorEstimado)}</p></div></div><span class="status ${statusClass(e.status)}">${e.status||'Em negociação'}</span><div class="actions"><button onclick="EVENTOS.view('${e.id}')">Ver</button><button onclick="EVENTOS.edit('${e.id}')">Editar</button></div></div>`}
function renderFunil(){const list=sortEventosRecentes(filtered().filter(e=>!isRecuperacaoStatus(e.status)));const actions=`<button class="btn alt" onclick="EVENTOS.toggleFilters()">▽ Filtros</button><button class="btn primary" onclick="EVENTOS.openForm()">+ Novo evento</button>`;$('funil').innerHTML=moduleHeader(actions)+`<div class="kanban pipeline-kanban">${PIPELINE_STATUS.map((st,idx)=>{const col=sortEventosRecentes(list.filter(e=>e.status===st));return `<div class="col pipeline-drop-zone ${eventColorClass({status:st})}" data-status="${esc(st)}" data-index="${idx}"><h3>${st} <span>${col.length}</span></h3>${col.map(card).join('')||'<p class="muted empty-col">Sem eventos</p>'}</div>`}).join('')}</div>`;setupFunilDragDrop();}

let __pipelineDraggedId=null;
let __pipelineScrollLeft=0;

function setupFunilDragDrop(){
  const root=$('funil');
  if(!root)return;
  const kanban=root.querySelector('.pipeline-kanban');
  if(kanban&&__pipelineScrollLeft){
    requestAnimationFrame(()=>{kanban.scrollLeft=__pipelineScrollLeft||0;});
  }

  root.querySelectorAll('.draggable-card').forEach(card=>{
    card.setAttribute('draggable','false');
    setupPipelinePointerDrag(card,root);
  });
}

function pipelineZones(root){
  return [...root.querySelectorAll('.pipeline-drop-zone')];
}

function clearPipelineHighlights(root){
  root.querySelectorAll('.pipeline-drop-zone').forEach(z=>z.classList.remove('drag-over','drag-blocked'));
}

function pipelineZoneFromPoint(root,x,y){
  const zones=pipelineZones(root);
  if(!zones.length)return null;

  // Detecção real pelo ponto visível na tela. Isso evita o erro de “descalibrar”
  // quando o funil está com scroll horizontal ou quando o card fantasma cobre a área.
  const el=document.elementFromPoint(x,y);
  const direct=el&&el.closest?el.closest('.pipeline-drop-zone'):null;
  if(direct&&root.contains(direct))return direct;

  const kanban=root.querySelector('.pipeline-kanban');
  const kr=kanban?kanban.getBoundingClientRect():null;
  const yOk=!kr || (y>=kr.top-70 && y<=kr.bottom+70);

  let best=null,bestDist=Infinity;
  zones.forEach(z=>{
    const r=z.getBoundingClientRect();
    // Primeiro tenta coluna realmente sob o X do ponteiro.
    if(yOk && x>=r.left && x<=r.right){
      const dy=y<r.top ? r.top-y : y>r.bottom ? y-r.bottom : 0;
      if(dy<bestDist){bestDist=dy;best=z;}
      return;
    }
    // Se estiver entre colunas ou na borda, pega a coluna visível mais próxima.
    const cx=Math.max(r.left,Math.min(x,r.right));
    const cy=Math.max(r.top,Math.min(y,r.bottom));
    const dx=x-cx, dy=y-cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<bestDist){bestDist=dist;best=z;}
  });
  return best;
}

function setupPipelinePointerDrag(card,root){
  if(card.dataset.pointerDragReady==='1')return;
  card.dataset.pointerDragReady='1';

  let startX=0,startY=0,lastX=0,lastY=0,active=false,armed=false,timer=null,ghost=null,lastZone=null,pointerId=null,scrollTimer=null,sourceCard=null;
  const isTouchLike=ev=>ev.pointerType==='touch'||ev.pointerType==='pen';

  const clearTimers=()=>{
    if(timer){clearTimeout(timer);timer=null;}
    if(scrollTimer){clearInterval(scrollTimer);scrollTimer=null;}
  };

  const clearState=()=>{
    clearTimers();
    active=false; armed=false; pointerId=null; __pipelineDraggedId=null;
    if(sourceCard)sourceCard.classList.remove('dragging','touch-dragging');
    document.body.classList.remove('kanban-dragging','touch-drag-active');
    clearPipelineHighlights(root);
    if(ghost){ghost.remove();ghost=null;}
    lastZone=null; sourceCard=null;
  };

  const setZone=zone=>{
    if(zone===lastZone)return;
    clearPipelineHighlights(root);
    lastZone=zone;
    if(zone)zone.classList.add('drag-over');
  };

  const moveGhost=(x,y)=>{
    if(!ghost)return;
    ghost.style.left=(x+14)+'px';
    ghost.style.top=(y+14)+'px';
  };

  const autoScroll=()=>{
    const kanban=root.querySelector('.pipeline-kanban');
    if(!kanban)return;
    const r=kanban.getBoundingClientRect();
    const edge=70;
    let dir=0;
    if(lastX<r.left+edge)dir=-1;
    else if(lastX>r.right-edge)dir=1;
    if(!dir)return;
    kanban.scrollLeft+=dir*20;
    __pipelineScrollLeft=kanban.scrollLeft;
    setZone(pipelineZoneFromPoint(root,lastX,lastY));
  };

  const begin=()=>{
    if(active||!armed||!sourceCard)return;
    active=true;
    __pipelineDraggedId=sourceCard.dataset.eventId||'';
    const kanban=root.querySelector('.pipeline-kanban');
    if(kanban)__pipelineScrollLeft=kanban.scrollLeft;
    sourceCard.classList.add('dragging');
    if(sourceCard.dataset.pointerType!=='mouse')sourceCard.classList.add('touch-dragging');
    document.body.classList.add('kanban-dragging','touch-drag-active');
    if(navigator.vibrate && sourceCard.dataset.pointerType!=='mouse')try{navigator.vibrate(18)}catch(_){ }
    ghost=sourceCard.cloneNode(true);
    ghost.className='event-card drag-ghost drag-ghost-visible';
    ghost.style.position='fixed';
    ghost.style.zIndex='999999';
    ghost.style.width=Math.min(sourceCard.getBoundingClientRect().width||260,300)+'px';
    ghost.style.pointerEvents='none';
    ghost.style.margin='0';
    ghost.style.opacity='.96';
    ghost.style.transform='rotate(1deg) scale(1.02)';
    document.body.appendChild(ghost);
    moveGhost(lastX,lastY);
    setZone(pipelineZoneFromPoint(root,lastX,lastY));
    if(!scrollTimer)scrollTimer=setInterval(autoScroll,24);
  };

  card.addEventListener('dragstart',ev=>ev.preventDefault());

  card.addEventListener('pointerdown',ev=>{
    if(ev.target.closest('button,a,input,select,textarea'))return;
    // Botão direito não deve iniciar arraste.
    if(ev.pointerType==='mouse' && ev.button!==0)return;
    startX=lastX=ev.clientX; startY=lastY=ev.clientY; pointerId=ev.pointerId; armed=true; active=false; sourceCard=card;
    sourceCard.dataset.pointerType=ev.pointerType||'mouse';
    clearTimers();
    try{card.setPointerCapture(ev.pointerId);}catch(_){ }
    // No desktop começa com pequeno movimento. No mobile, só com toque longo para preservar a rolagem.
    if(isTouchLike(ev)) timer=setTimeout(begin,430);
  },{passive:true});

  window.addEventListener('pointermove',ev=>{
    if(!armed||pointerId!==ev.pointerId)return;
    lastX=ev.clientX; lastY=ev.clientY;
    const dx=Math.abs(lastX-startX),dy=Math.abs(lastY-startY);

    if(!active){
      if(isTouchLike(ev)){
        // Se o usuário só está rolando no celular, cancela o modo mover.
        if(dx>12||dy>12)clearState();
        return;
      }
      if(dx<4&&dy<4)return;
      begin();
    }
    if(!active)return;
    ev.preventDefault();
    moveGhost(lastX,lastY);
    setZone(pipelineZoneFromPoint(root,lastX,lastY));
  },{passive:false});

  window.addEventListener('pointerup',ev=>{
    if(!armed||pointerId!==ev.pointerId)return;
    const id=sourceCard&&sourceCard.dataset?sourceCard.dataset.eventId:'';
    const zone=active?pipelineZoneFromPoint(root,ev.clientX,ev.clientY):null;
    const status=zone&&zone.dataset?zone.dataset.status:'';
    const kanban=root.querySelector('.pipeline-kanban');
    if(kanban)__pipelineScrollLeft=kanban.scrollLeft;
    clearState();
    if(id&&status)EVENTOS.movePipeline(id,status);
  });

  window.addEventListener('pointercancel',ev=>{if(armed&&pointerId===ev.pointerId)clearState();});
}

function canMovePipeline(from,to){
  return !!to && PIPELINE_STATUS.includes(to);
}

function renderVendas(){const list=filtered().sort((a,b)=>String(a.data).localeCompare(String(b.data)));$('vendas').innerHTML=moduleHeader(`<button class="btn alt" onclick="EVENTOS.toggleFilters()">▽ Filtros</button><button class="btn primary" onclick="EVENTOS.openForm()">+ Novo evento</button>`)+`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Status</th><th>Turno</th><th>Pessoas</th><th>Pacote</th><th>Valor total</th><th>Gorjeta</th><th>Ações</th></tr></thead><tbody>${list.map(e=>`<tr><td>${dt(e.data)}</td><td>${horario(e)}</td><td><b>${e.cliente}</b><br><span class="muted">${e.telefone||''}</span></td><td><span class="status ${statusClass(e.status)}">${e.status}</span></td><td>${e.turno}</td><td>${e.pessoas||''}</td><td>${e.pacote}</td><td>${brl(e.valorEstimado)}</td><td>${brl(e.gorjeta)}</td><td><button class="btn alt" onclick="EVENTOS.view('${e.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`;}
function recoveryCard(e){
  return `<div class="event-card recovery-card"><b>${e.cliente||'Cliente'}</b><p>${dow(e.data)} • ${shortDate(e.data)} • ${horario(e)}<br>${e.turno||'A definir'} · ${e.pessoas||'-'} pessoas · ${e.pacote||'A definir'}<br>📍 ${esc(salao(e))} · ${brl(e.valorEstimado)}</p><span class="status ${statusClass(e.status)}">${e.status||'Em recuperação'}</span><div class="actions recovery-actions"><button onclick="EVENTOS.view('${e.id}')">Ver</button><button onclick="EVENTOS.edit('${e.id}')">Editar</button><button onclick="EVENTOS.whats('${e.id}')">WhatsApp</button><button onclick="EVENTOS.markRecuperado('${e.id}')">Recuperado</button></div></div>`;
}
function renderRecuperacao(){
  const list=sortEventosRecentes(filtered().filter(e=>isRecuperacaoStatus(e.status)));
  const cols=RECOVERY_STATUS;
  $('recuperacao').innerHTML=moduleHeader(`<button class="btn alt" onclick="EVENTOS.toggleFilters()">▽ Filtros</button>`)+`<div class="kanban recuperacao-kanban">${cols.map(st=>`<div class="col"><h3>${st} · ${list.filter(e=>e.status===st).length}</h3>${list.filter(e=>e.status===st).map(recoveryCard).join('')||'<p class="muted">Sem clientes</p>'}</div>`).join('')}</div>`;
}
function clienteKey(c){
  const origem=norm(c.origem||'');
  const phone=digitsOnly(c.telefone);
  const email=norm(c.email||'');
  if(phone||email) return ['contato',phone,email].join('|');
  return norm([c.nome||c.cliente,c.razaoSocial,c.cpfCnpj].join('|'));
}
function normalizaClienteCadastro(c={},id){
  return {id:c.id||id||('cli_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),nome:c.nome||c.nomeCompleto||c.clienteNome||c.cliente||'',telefone:c.telefone||'',email:c.email||'',cpfCnpj:c.cpfCnpj||c.cpf_cnpj||'',razaoSocial:c.razaoSocial||c.razao_social||'',instagram:c.instagram||'',origem:c.origem||'Manual',tipoEvento:c.tipoEvento||c.tipo||'',dataEvento:c.dataEvento||c.data||'',horario:c.horario||c.turno||'',pessoas:c.pessoas||c.convidados||'',tags:Array.isArray(c.tags)?c.tags:(c.tags?String(c.tags).split(',').map(x=>x.trim()).filter(Boolean):[]),observacoes:c.observacoes||c.observacao||'',eventoId:c.eventoId||'',criadoEm:c.criadoEm||c.createdAt||new Date().toISOString(),atualizadoEm:c.atualizadoEm||new Date().toISOString()};
}
function dedupeClientesCadastro(arr){
  const map=new Map();
  (arr||[]).forEach(raw=>{
    const c=normalizaClienteCadastro(raw,raw&&raw.id);
    const k=clienteKey(c)||c.id;
    const old=map.get(k);
    const merged=old?mergePreferido(old,c):c;
    if(isGenericClienteNome(merged.nome)&&old&&!isGenericClienteNome(old.nome)) merged.nome=old.nome;
    if(isGenericClienteNome(merged.nome)&&!isGenericClienteNome(c.nome)) merged.nome=c.nome;
    map.set(k,merged);
  });
  return [...map.values()].sort((a,b)=>String(b.criadoEm||b.atualizadoEm||'').localeCompare(String(a.criadoEm||a.atualizadoEm||'')));
}
function renderClientes(){
  if(state.clientesView==='cadastro') return renderClientesCadastro();
  const map={}; filtered().forEach(e=>{const k=e.cliente||'Cliente'; if(!map[k])map[k]={q:0,total:0,last:e.data,tel:e.telefone}; map[k].q++; map[k].total+=Number(e.valorEstimado)||0; if(e.data>map[k].last)map[k].last=e.data; if(e.telefone)map[k].tel=e.telefone;});
  const arr=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  $('clientes').innerHTML=moduleHeader(`<button class="btn primary" onclick="EVENTOS.openClienteForm()">+ Novo cliente</button>`)+`${clientesTabs()}<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Eventos</th><th>Total estimado</th><th>Último evento</th></tr></thead><tbody>${arr.map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td>${esc(v.tel||'')}</td><td>${v.q}</td><td>${brl(v.total)}</td><td>${dt(v.last)}</td></tr>`).join('')}</tbody></table></div>`;
}
function clientesTabs(){return `<div class="clientes-top"><div class="clientes-tabs"><button class="chip ${state.clientesView!=='cadastro'?'active':''}" onclick="EVENTOS.clientesTab('historico')">Histórico de Clientes</button><button class="chip ${state.clientesView==='cadastro'?'active':''}" onclick="EVENTOS.clientesTab('cadastro')">Cadastro de Clientes</button></div>${state.clientesView==='cadastro'?`<button class="btn primary" onclick="EVENTOS.openClienteForm()">+ Novo cliente</button>`:''}</div>`;}
function renderClientesCadastro(){
  const arr=dedupeClientesCadastro(state.clientesCadastros||[]); state.clientesCadastros=arr; saveClientes();
  $('clientes').innerHTML=moduleHeader(`<button class="btn primary" onclick="EVENTOS.openClienteForm()">+ Novo cliente</button>`)+`${clientesTabs()}<div class="clientes-toolbar premium-block"><input class="field" id="cliBusca" placeholder="Buscar nome, telefone, e-mail, CPF/CNPJ, origem ou tag..." oninput="EVENTOS.renderClientesCadastroFiltrado()"><select class="field" id="cliOrigem" onchange="EVENTOS.renderClientesCadastroFiltrado()"><option value="">Todas as origens</option>${[...new Set(arr.map(c=>c.origem).filter(Boolean))].sort().map(o=>`<option>${esc(o)}</option>`).join('')}</select></div><div id="clientesCadastroLista"></div>`;
  renderClientesCadastroFiltrado();
}
function renderClientesCadastroFiltrado(){
  const q=norm($('cliBusca')?.value||''), origem=$('cliOrigem')?.value||'';
  const arr=dedupeClientesCadastro(state.clientesCadastros||[]).filter(c=>{
    const hay=norm([c.nome,c.telefone,c.email,c.cpfCnpj,c.razaoSocial,c.instagram,c.origem,c.tipoEvento,c.dataEvento,c.horario,c.pessoas,(c.tags||[]).join(' '),c.observacoes].join(' '));
    return (!q||hay.includes(q))&&(!origem||c.origem===origem);
  });
  const el=$('clientesCadastroLista'); if(!el)return;
  el.innerHTML=`<div class="table-wrap clientes-cadastro-table"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Evento desejado</th><th>Origem</th><th>Dados fiscais</th><th>Tags</th><th>Ações</th></tr></thead><tbody>${arr.map(c=>`<tr><td><b>${esc(c.nome||'Cliente sem nome')}</b><br><span class="muted">Criado em ${new Date(c.criadoEm||Date.now()).toLocaleDateString('pt-BR')}</span></td><td>${esc(c.telefone||'')}<br><span class="muted">${esc(c.email||'')}</span></td><td>${esc(c.tipoEvento||'Evento')}<br><span class="muted">${dt(c.dataEvento)||'Data a definir'} · ${esc(c.horario||'Horário a definir')} · ${esc(c.pessoas||'-')} pessoas</span></td><td><span class="status s-proposta">${esc(c.origem||'Manual')}</span></td><td>${esc(c.cpfCnpj||'CPF/CNPJ pendente')}<br><span class="muted">${esc(c.razaoSocial||'Razão social pendente')}</span></td><td>${(c.tags||[]).map(t=>`<span class="client-tag">${esc(t)}</span>`).join('')||'<span class="muted">Sem tags</span>'}</td><td><button class="btn alt" onclick="EVENTOS.editCliente('${c.id}')">Editar</button>${c.eventoId?`<button class="btn alt" onclick="EVENTOS.view('${c.eventoId}')">Ver lead</button>`:''}</td></tr>`).join('')}</tbody></table></div>${!arr.length?'<div class="week-empty"><b>Nenhum cadastro encontrado.</b><br><span>Clientes vindos do Google Forms e cadastros manuais aparecerão aqui.</span></div>':''}`;
}
function clienteFormHtml(c={}){
  const tags=Array.isArray(c.tags)?c.tags.join(', '):(c.tags||'');
  return `<div class="form-grid"><div><label>Nome completo</label><input class="field" id="cli_nome" value="${esc(c.nome||'')}"></div><div><label>Telefone</label><input class="field" id="cli_telefone" value="${esc(c.telefone||'')}"></div><div><label>E-mail</label><input class="field" id="cli_email" value="${esc(c.email||'')}"></div><div><label>Origem</label><select class="field" id="cli_origem">${['Manual','Google Forms','WhatsApp','Instagram','Indicação','Site','Telefone','Presencial'].map(o=>`<option ${o===(c.origem||'Manual')?'selected':''}>${o}</option>`).join('')}</select></div><div><label>CPF/CNPJ</label><input class="field" id="cli_cpf" value="${esc(c.cpfCnpj||'')}"></div><div><label>Razão social</label><input class="field" id="cli_razao" value="${esc(c.razaoSocial||'')}"></div><div><label>Instagram</label><input class="field" id="cli_instagram" value="${esc(c.instagram||'')}"></div><div><label>Tags</label><input class="field" id="cli_tags" placeholder="VIP, Corporativo, Noiva..." value="${esc(tags)}"></div><div><label>Data desejada</label><input class="field" type="date" id="cli_data" value="${esc(c.dataEvento||'')}"></div><div><label>Horário / turno</label><input class="field" id="cli_horario" value="${esc(c.horario||'')}"></div><div><label>Tipo de evento</label><input class="field" id="cli_tipo" value="${esc(c.tipoEvento||'')}"></div><div><label>Número de convidados</label><input class="field" type="number" id="cli_pessoas" value="${esc(c.pessoas||'')}"></div><div class="span4"><label>Observações internas</label><textarea class="field" id="cli_obs">${esc(c.observacoes||'')}</textarea></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveClienteForm('${c.id||''}')">Salvar cliente</button>`;
}
function collectClienteCadastro(id){
  const atual=(state.clientesCadastros||[]).find(c=>c.id===id)||{};
  return normalizaClienteCadastro({id:id||('cli_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),nome:($('cli_nome')?.value||'').trim(),telefone:($('cli_telefone')?.value||'').trim(),email:($('cli_email')?.value||'').trim(),origem:$('cli_origem')?.value||'Manual',cpfCnpj:($('cli_cpf')?.value||'').trim(),razaoSocial:($('cli_razao')?.value||'').trim(),instagram:($('cli_instagram')?.value||'').trim(),tags:($('cli_tags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),dataEvento:$('cli_data')?.value||'',horario:($('cli_horario')?.value||'').trim(),tipoEvento:($('cli_tipo')?.value||'').trim(),pessoas:($('cli_pessoas')?.value||'').trim(),observacoes:($('cli_obs')?.value||'').trim(),eventoId:atual.eventoId||'',criadoEm:atual.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString()});
}

function renderPacotes(){$('pacotes').innerHTML=moduleHeader()+`<div class="package-grid">${state.pacotes.map(p=>`<div class="package"><h3>${p.nome}</h3><div class="price">${brl(p.valorSemana)} / ${brl(p.valorFimSemana)}</div><p><b>${p.categoria}</b> · ${p.servico} · ${p.duracao}<br>Mínimo: ${p.minPessoas} pessoas · Taxa: ${p.taxaServicoPct}%</p><p>${p.resumo}</p></div>`).join('')}</div>`;}
function renderSheets(){ $('sheets').innerHTML=moduleHeader()+`<div class="grid-2"><div class="panel"><h3>Integração Google Sheets</h3><p class="muted">Esta versão inclui o arquivo <b>AppsScript_Eventos_Isolado.gs</b>. Cole esse script na planilha para receber os dados exportados do módulo Eventos.</p><button class="btn" onclick="EVENTOS.exportCSV()">Baixar CSV agora</button><div class="divider"></div><p class="muted">Abas sugeridas: Eventos, Clientes, Pacotes, Vendas, Recuperação, Dashboard e Configurações.</p></div><div class="panel"><h3>Segurança da integração</h3><p class="muted">O módulo salva no caminho isolado <b>/eventos_premium</b> no Firebase e usa localStorage como fallback. Nenhum caminho antigo de frequência, escala, mapa ou freelance é alterado.</p><button class="btn alt" onclick="EVENTOS.firebaseSync()">Tentar sincronizar Firebase</button></div></div>`; }

function agendaVisibleItems(){
  const f=state.agendaFiltros||{}; const dev=deviceId();
  return (state.agenda||[]).filter(a=>{
    const vis=a.visibilidade||'compartilhado';
    const podeVer=vis==='compartilhado'||a.deviceId===dev;
    return podeVer&&(!f.criador||a.criador===f.criador)&&(!f.visibilidade||vis===f.visibilidade)&&(!f.tipo||a.tipo===f.tipo)&&(!f.status||a.status===f.status);
  }).sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))||String(a.hora||'').localeCompare(String(b.hora||'')));
}
function agendaTipos(){return ['Ligação','Visita','Proposta','Follow-up','Reunião','Contrato','Evento','Outro'];}
function agendaStatuses(){return ['Pendente','Concluída','Atrasada'];}
function agendaCounts(list=agendaVisibleItems()){
  const hoje=new Date().toISOString().slice(0,10);
  return {total:list.length,pendentes:list.filter(a=>(a.status||'Pendente')==='Pendente').length,concluidas:list.filter(a=>a.status==='Concluída').length,hoje:list.filter(a=>a.data===hoje).length};
}
function renderAgenda(){
  const list=agendaVisibleItems(); const c=agendaCounts(list); const f=state.agendaFiltros||{};
  const optsResp=['<option value="">Todos</option>'].concat((state.agendaResponsaveis||[]).map(n=>`<option ${f.criador===n?'selected':''}>${esc(n)}</option>`)).join('');
  const optsTipo=['<option value="">Todos os tipos</option>'].concat(agendaTipos().map(t=>`<option ${f.tipo===t?'selected':''}>${t}</option>`)).join('');
  const optsStatus=['<option value="">Todos os status</option>'].concat(agendaStatuses().map(t=>`<option ${f.status===t?'selected':''}>${t}</option>`)).join('');
  $('agenda').innerHTML=`<div class="agenda-shell">
    <div class="agenda-head premium-block">
      <div><span class="eyebrow">Agenda comercial</span><h2>Agenda de atividades</h2><p class="muted">Controle atividades pessoais e compartilhadas, com identificação de quem criou.</p></div>
      <button class="btn primary" onclick="EVENTOS.openAgendaForm()">+ Nova atividade</button>
    </div>
    <div class="agenda-kpis">
      <div class="mini"><span>Hoje</span><b>${c.hoje}</b><small>atividades</small></div>
      <div class="mini"><span>Pendentes</span><b>${c.pendentes}</b><small>em aberto</small></div>
      <div class="mini green"><span>Concluídas</span><b>${c.concluidas}</b><small>finalizadas</small></div>
      <div class="mini purple"><span>Total</span><b>${c.total}</b><small>no filtro atual</small></div>
    </div>
    <div class="agenda-toolbar premium-block">
      <div class="agenda-chips">
        <button class="chip ${!f.visibilidade?'active':''}" onclick="EVENTOS.agendaFiltro('visibilidade','')">Todos</button>
        <button class="chip ${f.visibilidade==='pessoal'?'active':''}" onclick="EVENTOS.agendaFiltro('visibilidade','pessoal')">Pessoal</button>
        <button class="chip ${f.visibilidade==='compartilhado'?'active':''}" onclick="EVENTOS.agendaFiltro('visibilidade','compartilhado')">Compartilhado</button>
      </div>
      <select class="field" onchange="EVENTOS.agendaFiltro('criador',this.value)">${optsResp}</select>
      <select class="field" onchange="EVENTOS.agendaFiltro('tipo',this.value)">${optsTipo}</select>
      <select class="field" onchange="EVENTOS.agendaFiltro('status',this.value)">${optsStatus}</select>
      <button class="btn alt" onclick="EVENTOS.openResponsavelForm()">Cadastrar responsável</button>
    </div>
    <div class="agenda-list premium-block">
      ${list.length?list.map(agendaCard).join(''):`<div class="week-empty"><b>Nenhuma atividade encontrada.</b><br><span>Crie uma nova atividade ou ajuste os filtros.</span></div>`}
    </div>
  </div>`;
}
function agendaCard(a){
  const vis=a.visibilidade==='pessoal'?'🔒 Pessoal':'🌐 Compartilhada';
  const cls=a.status==='Concluída'?'done':(a.status==='Atrasada'?'late':'');
  return `<div class="agenda-card ${cls}">
    <div class="agenda-time"><b>${a.hora||'--:--'}</b><small>${dt(a.data)||'Sem data'}</small></div>
    <div class="agenda-main"><h3>${esc(a.titulo||'Atividade')}</h3><p>${esc(a.obs||'')}</p><div class="agenda-meta"><span>👤 ${esc(a.criador||'Sem responsável')}</span><span>${esc(a.tipo||'Outro')}</span><span>${vis}</span></div></div>
    <div class="agenda-actions"><span class="status ${a.status==='Concluída'?'s-fechado':a.status==='Atrasada'?'s-cancelado':'s-neg'}">${a.status||'Pendente'}</span><button onclick="EVENTOS.editAgenda('${a.id}')">Editar</button><button onclick="EVENTOS.toggleAgendaDone('${a.id}')">${a.status==='Concluída'?'Reabrir':'Concluir'}</button></div>
  </div>`;
}
function agendaFormHtml(a={}){
  const responsaveis=[...new Set([...(state.agendaResponsaveis||[]),a.criador,a.responsavel].filter(Boolean))];
  const respOpts=['<option value="">Selecione ou cadastre</option>'].concat(responsaveis.map(n=>`<option ${n===(a.criador||a.responsavel)?'selected':''}>${esc(n)}</option>`)).join('');
  const tipoOpts=agendaTipos().map(t=>`<option ${t===(a.tipo||'Follow-up')?'selected':''}>${t}</option>`).join('');
  const statusOpts=agendaStatuses().map(t=>`<option ${t===(a.status||'Pendente')?'selected':''}>${t}</option>`).join('');
  return `<div class="form-grid agenda-form"><div class="span2"><label>Título</label><input class="field" id="ag_titulo" value="${esc(a.titulo||'')}"></div><div><label>Data</label><input class="field" type="date" id="ag_data" value="${a.data||new Date().toISOString().slice(0,10)}"></div><div><label>Hora</label><input class="field" type="time" id="ag_hora" value="${a.hora||''}"></div><div><label>Responsável / criado por</label><select class="field" id="ag_criador">${respOpts}</select></div><div><label>Novo responsável</label><input class="field" id="ag_novo_resp" placeholder="Digite para cadastrar"></div><div><label>Tipo</label><select class="field" id="ag_tipo">${tipoOpts}</select></div><div><label>Status</label><select class="field" id="ag_status">${statusOpts}</select></div><div class="span2"><label>Visibilidade</label><div class="visibility-pick"><label><input type="radio" name="ag_vis" value="pessoal" ${(a.visibilidade||'compartilhado')==='pessoal'?'checked':''}> 🔒 Pessoal</label><label><input type="radio" name="ag_vis" value="compartilhado" ${(a.visibilidade||'compartilhado')==='compartilhado'?'checked':''}> 🌐 Compartilhada</label></div></div><div class="span4"><label>Observação</label><textarea class="field" id="ag_obs">${esc(a.obs||'')}</textarea></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveAgendaForm('${a.id||''}')">Salvar atividade</button>`;
}
function openAgendaModal(a={}){ $('modalTitle').textContent=a.id?'Editar atividade':'Nova atividade'; $('modalBody').innerHTML=agendaFormHtml(a); $('modal').classList.add('open');}
function responsavelFormHtml(){return `<div class="panel"><h3>Cadastrar responsável</h3><p class="muted">Os nomes cadastrados aparecerão nos filtros e no formulário de atividades.</p><input class="field" id="resp_nome" placeholder="Nome do responsável"><div class="divider"></div><button class="btn" onclick="EVENTOS.saveResponsavel()">Cadastrar</button></div><div class="agenda-resp-list">${(state.agendaResponsaveis||[]).map(n=>`<span>${esc(n)}</span>`).join('')||'<p class="muted">Nenhum responsável cadastrado.</p>'}</div>`;}

function renderCalendar(){
  const year=state.cal.year, month=state.cal.month, view=state.cal.view||'mes';
  const list=filtered();
  const first=new Date(year,month-1,1), last=new Date(year,month,0);
  const years=[...new Set([...state.eventos.map(e=>Number(e.ano||String(e.data).slice(0,4))).filter(Boolean),2026,2027,new Date().getFullYear()])].sort();
  const actions=`<select class="field compact" onchange="EVENTOS.setCalendar(this.value,null)">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${month===i+1?'selected':''}>${monthName(i+1)}</option>`).join('')}</select><select class="field compact" onchange="EVENTOS.setCalendar(null,this.value)">${years.map(y=>`<option ${year===y?'selected':''}>${y}</option>`).join('')}</select><button class="btn alt" onclick="EVENTOS.setCalendar(new Date().getMonth()+1,new Date().getFullYear(),new Date().getDate())">Hoje</button><button class="btn alt" onclick="EVENTOS.toggleFilters()">▽ Filtros</button><button class="btn primary" onclick="EVENTOS.openForm()">+ Novo Evento</button>`;
  const legend=`<div class="cal-legend"><span class="evc-yellow">Orçamento/Lead</span><span class="evc-green">Fechado</span><span class="evc-red">Atenção</span><span class="evc-blue">Corporativo</span><span class="evc-purple">Contrato/Alinhamento</span></div>`;
  const pills=`<div class="view-pills"><button class="${view==='mes'?'active':''}" onclick="EVENTOS.setCalendarView('mes')">Mês</button><button class="${view==='semana'?'active':''}" onclick="EVENTOS.setCalendarView('semana')">Semana</button><button class="${view==='dia'?'active':''}" onclick="EVENTOS.setCalendarView('dia')">Dia</button></div>`;
  function evHtml(e){return `<div class="ev ${statusClass(e.status)} ${eventColorClass(e)}" onclick="EVENTOS.view('${e.id}')"><span class="ev-dot"></span><strong>${esc(e.cliente||'Cliente')}</strong><small>${horario(e)} · ${esc(e.turno||'A definir')} · ${e.pessoas||'-'}p</small></div>`;}
  function dayBox(date,empty=false){
    const iso=date.toISOString().slice(0,10);
    const evs=list.filter(e=>parseDateAny(e.data)===iso);
    return `<div class="day ${empty?'empty':''} ${evs.length?'has-events':''}"><b>${date.getDate()} <span>${['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][date.getDay()]}</span></b>${evs.map(evHtml).join('')}</div>`;
  }
  let body='';
  let weekdays=`<div class="calendar-weekdays"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div>`;
  if(view==='mes'){
    const days=[];
    const offset=(first.getDay()+6)%7;
    for(let i=0;i<offset;i++)days.push('<div class="day empty"></div>');
    for(let i=1;i<=last.getDate();i++) days.push(dayBox(new Date(year,month-1,i)));
    body=`${weekdays}<div class="calendar-grid visual-calendar">${days.join('')}</div>`;
  }else if(view==='semana'){
    const day=Math.min(state.cal.day||new Date().getDate(), last.getDate());
    const base=new Date(year,month-1,day);
    const startWeek=new Date(base); startWeek.setDate(base.getDate()-((base.getDay()+6)%7));
    const days=[]; for(let i=0;i<7;i++){const d=new Date(startWeek);d.setDate(startWeek.getDate()+i);days.push(dayBox(d,d.getMonth()!==month-1));}
    body=`${weekdays}<div class="calendar-grid visual-calendar week-view">${days.join('')}</div>`;
  }else{
    const day=Math.min(state.cal.day||new Date().getDate(), last.getDate());
    const d=new Date(year,month-1,day);
    const evs=list.filter(e=>parseDateAny(e.data)===d.toISOString().slice(0,10));
    body=`<div class="calendar-day-view premium-block"><div class="day-view-head"><button class="btn alt" onclick="EVENTOS.shiftCalendarDay(-1)">‹</button><h3>${dow(d.toISOString().slice(0,10))} · ${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}</h3><button class="btn alt" onclick="EVENTOS.shiftCalendarDay(1)">›</button></div><div class="day-view-events">${evs.map(evHtml).join('')||'<p class="muted">Nenhum evento neste dia.</p>'}</div></div>`;
  }
  $('calendario').innerHTML=moduleHeader(actions)+`<div class="calendar-toolbar">${pills}${legend}</div>${body}`;
}
function render(){document.body.dataset.tab=state.tab;setupTabs();document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$(state.tab).classList.add('active');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));renderHero();({dashboard:renderDashboard,funil:renderFunil,calendario:renderCalendar,vendas:renderVendas,recuperacao:renderRecuperacao,clientes:renderClientes,pacotes:renderPacotes,agenda:renderAgenda,sheets:renderSheets}[state.tab]||renderDashboard)();}

function parseNum(v){
  if(v===null||v===undefined)return 0;
  if(typeof v==='number')return Number.isFinite(v)?v:0;
  let t=String(v).trim();
  if(t.includes(',')) t=t.replace(/\./g,'').replace(',', '.');
  t=t.replace(/[^0-9.\-]/g,'');
  const n=Number(t);
  return Number.isFinite(n)?n:0;
}
function calcEventFinancialsFromFields(){
  const pessoas=parseNum($('f_pessoas')?.value);
  const valorPessoa=parseNum($('f_valorPessoa')?.value);
  const taxa=parseNum($('f_taxa')?.value);
  const base=pessoas*valorPessoa;
  const gorjeta=base*(taxa/100);
  const total=base+gorjeta;
  if($('f_gorjeta')) $('f_gorjeta').value=gorjeta?gorjeta.toFixed(2):'0.00';
  if($('f_valorEstimado')) $('f_valorEstimado').value=total?total.toFixed(2):'0.00';
}
function setupEventFinancials(){
  ['f_pessoas','f_valorPessoa','f_taxa'].forEach(id=>{
    const el=$(id); if(!el)return;
    el.addEventListener('input',calcEventFinancialsFromFields);
    el.addEventListener('change',calcEventFinancialsFromFields);
  });
  calcEventFinancialsFromFields();
}
function formHtml(e={}){const packs=['A definir',...new Set(state.pacotes.map(p=>p.nome.replace('Menu ','')))];return `<div class="form-grid"><div><label>Cliente</label><input class="field" id="f_cliente" value="${esc(e.cliente||'')}"></div><div><label>Telefone</label><input class="field" id="f_telefone" value="${esc(e.telefone||'')}"></div><div><label>Data</label><input class="field" type="date" id="f_data" value="${e.data||''}"></div><div><label>Horário</label><input class="field" type="time" id="f_horario" value="${e.horario||''}"></div><div><label>Status</label><select class="field" id="f_status">${STATUS.map(s=>`<option ${s===(e.status||'Lead')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Origem</label><select class="field" id="f_origem"><option>${e.origem||'WhatsApp'}</option><option>Instagram</option><option>Telefone</option><option>Anúncio</option><option>Indicação</option><option>Presencial</option></select></div><div><label>Tipo</label><input class="field" id="f_tipo" value="${esc(e.tipo||'Evento')}"></div><div><label>Turno</label><select class="field" id="f_turno">${['Almoço','Jantar','Ambos','A definir'].map(s=>`<option ${s===(e.turno||'A definir')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Pessoas</label><input class="field" type="number" id="f_pessoas" value="${e.pessoas||''}"></div><div><label>Pacote</label><select class="field" id="f_pacote">${packs.map(p=>`<option ${p===(e.pacote||'A definir')?'selected':''}>${p}</option>`).join('')}</select></div><div><label>Valor por pessoa</label><input class="field" type="text" inputmode="decimal" id="f_valorPessoa" value="${String(e.valorPessoa||0).replace('.',',')}"></div><div><label>Taxa serviço %</label><input class="field" type="text" inputmode="decimal" id="f_taxa" value="${String(e.taxaServicoPct??13).replace('.',',')}"></div><div><label>Gorjeta</label><input class="field" type="text" inputmode="decimal" id="f_gorjeta" value="${e.gorjeta||0}" readonly></div><div class="span2"><label>Salão</label><select class="field" id="f_unidade">${['Salão Vasto','Salão Barra','Salão Beira Mar','Varanda','Salão Barra + Beira Mar + Varanda','A definir'].map(s=>`<option ${s===(e.unidade||'A definir')?'selected':''}>${s}</option>`).join('')}</select></div><div class="span2"><label>Valor total</label><input class="field" type="text" inputmode="decimal" id="f_valorEstimado" value="${e.valorTotal||e.valorEstimado||0}" readonly></div><div class="span4"><label>Observações / andamento</label><textarea class="field" id="f_obs">${esc(e.observacoes||'')}</textarea></div><div class="span4 directors-box"><label>Assinatura da diretoria</label>${[0,1,2].map(i=>{const d=(e.diretores||[])[i]||{};return `<div class="director-row"><input class="field" id="f_dir_nome_${i}" placeholder="Nome do diretor" value="${esc(d.nome||'')}"><span>Assinou?</span><input type="checkbox" id="f_dir_ok_${i}" ${d.assinado?'checked':''}></div>`}).join('')}<p class="muted" style="margin:8px 0 0;font-size:11px">Marque cada diretor que assinou. Quando todos estiverem OK, o evento pode avançar para Fechado.</p></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveForm('${e.id||''}')">Salvar evento</button>`}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function collect(id){const data=$('f_data').value;calcEventFinancialsFromFields();const pessoas=parseNum($('f_pessoas').value)||null;const valorPessoa=parseNum($('f_valorPessoa').value);const taxaServicoPct=parseNum($('f_taxa').value);const gorjeta=parseNum($('f_gorjeta').value);const valorTotal=parseNum($('f_valorEstimado').value);return{id:id||uid(),ano:data?Number(data.slice(0,4)):new Date().getFullYear(),data:data||new Date().toISOString().slice(0,10),horario:$('f_horario')?$('f_horario').value:'',cliente:$('f_cliente').value.trim()||'Cliente não informado',telefone:$('f_telefone').value.trim(),origem:$('f_origem').value,unidade:$('f_unidade').value,tipo:$('f_tipo').value,turno:$('f_turno').value,pessoas,pacote:$('f_pacote').value,status:$('f_status').value,valorPessoa,taxaServicoPct,gorjeta,valorEstimado:valorTotal,valorTotal,observacoes:$('f_obs').value.trim(),diretores:[0,1,2].map(i=>({nome:($('f_dir_nome_'+i)?.value||'').trim(),assinado:!!$('f_dir_ok_'+i)?.checked})).filter(d=>d.nome),atualizadoEm:new Date().toISOString()};}
window.EVENTOS={
  tab(id){state.tab=id;document.body.classList.remove('menu-open');render()},
  clientesTab(v){state.clientesView=v;renderClientes();},
  renderClientesCadastroFiltrado(){renderClientesCadastroFiltrado();},
  openClienteForm(){ $('modalTitle').textContent='Novo cliente'; $('modalBody').innerHTML=clienteFormHtml(); $('modal').classList.add('open');},
  editCliente(id){const c=(state.clientesCadastros||[]).find(x=>x.id===id); if(!c)return toast('Cliente não encontrado'); $('modalTitle').textContent='Editar cliente'; $('modalBody').innerHTML=clienteFormHtml(c); $('modal').classList.add('open');},
  saveClienteForm(id){const c=collectClienteCadastro(id); if(!c.nome)return toast('Informe o nome do cliente'); const idx=state.clientesCadastros.findIndex(x=>x.id===c.id); if(idx>=0)state.clientesCadastros[idx]=Object.assign({},state.clientesCadastros[idx],c); else state.clientesCadastros.unshift(c); state.clientesCadastros=dedupeClientesCadastro(state.clientesCadastros); saveClientes(); if(window.EventosFirebase&&EventosFirebase.enabled&&EventosFirebase.saveClienteCadastro) EventosFirebase.saveClienteCadastro(c).catch(()=>{}); $('modal').classList.remove('open'); toast('Cliente salvo'); if(state.tab==='clientes')renderClientes();},
  agendaFiltro(k,v){state.agendaFiltros=state.agendaFiltros||{};state.agendaFiltros[k]=v;renderAgenda();},
  openAgendaForm(){openAgendaModal();},
  editAgenda(id){const a=(state.agenda||[]).find(x=>x.id===id); if(a)openAgendaModal(a);},
  saveAgendaForm(id){const novo=($('ag_novo_resp')?.value||'').trim(); const sel=($('ag_criador')?.value||'').trim(); const criador=novo||sel; if(!criador)return toast('Cadastre ou selecione o responsável'); if(novo&&!state.agendaResponsaveis.includes(novo))state.agendaResponsaveis.push(novo); state.agendaResponsaveis=[...new Set(state.agendaResponsaveis.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')); const vis=document.querySelector('input[name="ag_vis"]:checked')?.value||'compartilhado'; const item={id:id||agendaUid(),titulo:($('ag_titulo').value||'Atividade').trim(),data:$('ag_data').value,hora:$('ag_hora').value,criador,responsavel:criador,tipo:$('ag_tipo').value,status:$('ag_status').value,visibilidade:vis,deviceId:id?((state.agenda||[]).find(x=>x.id===id)?.deviceId||deviceId()):deviceId(),obs:($('ag_obs').value||'').trim(),atualizadoEm:new Date().toISOString(),criadoEm:id?((state.agenda||[]).find(x=>x.id===id)?.criadoEm||new Date().toISOString()):new Date().toISOString()}; const idx=state.agenda.findIndex(x=>x.id===item.id); if(idx>=0)state.agenda[idx]=Object.assign({},state.agenda[idx],item); else state.agenda.unshift(item); saveAgenda(); $('modal').classList.remove('open'); toast('Atividade salva'); if(state.tab==='agenda')renderAgenda();},
  toggleAgendaDone(id){const a=(state.agenda||[]).find(x=>x.id===id); if(!a)return; a.status=a.status==='Concluída'?'Pendente':'Concluída'; a.atualizadoEm=new Date().toISOString(); saveAgenda(); renderAgenda();},
  openResponsavelForm(){ $('modalTitle').textContent='Responsáveis da agenda'; $('modalBody').innerHTML=responsavelFormHtml(); $('modal').classList.add('open');},
  saveResponsavel(){const n=($('resp_nome')?.value||'').trim(); if(!n)return toast('Digite o nome do responsável'); if(!state.agendaResponsaveis.includes(n))state.agendaResponsaveis.push(n); state.agendaResponsaveis.sort((a,b)=>a.localeCompare(b,'pt-BR')); saveAgenda(); $('modalBody').innerHTML=responsavelFormHtml(); if(state.tab==='agenda')renderAgenda(); toast('Responsável cadastrado');},
  setCalendar(month,year,day){if(month)state.cal.month=Number(month); if(year)state.cal.year=Number(year); if(day)state.cal.day=Number(day); renderCalendar();},
  setCalendarView(v){state.cal.view=v||'mes'; renderCalendar();},
  shiftCalendarDay(delta){const max=new Date(state.cal.year,state.cal.month,0).getDate(); const d=new Date(state.cal.year,state.cal.month-1,Math.min(state.cal.day||1,max)); d.setDate(d.getDate()+Number(delta||0)); state.cal.year=d.getFullYear(); state.cal.month=d.getMonth()+1; state.cal.day=d.getDate(); renderCalendar();},
  toggleFilters(force){const p=$('filtersPanel'); if(!p)return; p.classList.toggle('open', typeof force==='boolean'?force:!p.classList.contains('open'));},
  toggleConfig(force){const p=$('configPanel'); if(!p)return; p.classList.toggle('open', typeof force==='boolean'?force:!p.classList.contains('open'));},
  showInstallHelp(){
    $('modalTitle').textContent='Instalar Gestão Coco Bambu';
    $('modalBody').innerHTML=`<div class="panel"><h3>Como instalar como app</h3><p><b>Android/Chrome:</b> toque em Instalar quando aparecer o aviso, ou abra o menu do navegador e escolha <b>Instalar app</b>.</p><p><b>iPhone/Safari:</b> toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>. No iPhone, a Apple não permite disparar instalação automática como no Android, mas o app abre em tela cheia quando instalado como PWA.</p><p class="muted">Para funcionar como app de verdade, o site precisa estar publicado em HTTPS, como GitHub Pages ou Firebase Hosting.</p></div>`;
    $('modal').classList.add('open');
  },
  async installApp(){
    const banner=$('installBanner');
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(()=>{});
      deferredInstallPrompt=null;
      if(banner)banner.classList.remove('show');
    }else{EVENTOS.showInstallHelp();}
  },
  dismissInstall(){localStorage.setItem('gestao_cb_install_dismissed','1'); const b=$('installBanner'); if(b)b.classList.remove('show');},
  setMeta(v){state.meta.metaMensal=Number(v)||0;save();render()},
  openForm(){ $('modalTitle').textContent='Novo Evento'; $('modalBody').innerHTML=formHtml(); $('modal').classList.add('open'); setupEventFinancials();},
  edit(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; $('modalTitle').textContent='Editar Evento'; $('modalBody').innerHTML=formHtml(e); $('modal').classList.add('open'); setupEventFinancials();},
  saveForm(id){const e=collect(id); const idx=state.eventos.findIndex(x=>x.id===e.id); if(idx>=0)state.eventos[idx]=Object.assign({},state.eventos[idx],e); else state.eventos.unshift(e); save(); $('modal').classList.remove('open'); toast('Evento salvo'); render();},
  view(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; const wa=e.telefone?`<a class="whats" target="_blank" href="https://wa.me/${String(e.telefone).replace(/\D/g,'')}">Abrir WhatsApp</a>`:''; $('modalTitle').textContent=e.cliente; $('modalBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><div class="label">Data</div><div class="value">${dow(e.data)} ${shortDate(e.data)}<br><span style="font-size:16px;color:var(--sub)">${horario(e)}</span></div></div><div class="kpi"><div class="label">Valor total</div><div class="value">${brl(e.valorEstimado)}</div></div><div class="kpi"><div class="label">Pessoas</div><div class="value">${e.pessoas||'-'}</div></div><div class="kpi"><div class="label">Status</div><div class="value" style="font-size:20px">${e.status}</div></div></div><div class="panel" style="margin-top:14px"><p><b>Telefone:</b> ${e.telefone||'-'} ${wa}</p><p><b>Tipo:</b> ${e.tipo} · <b>Turno:</b> ${e.turno} · <b>Pacote:</b> ${e.pacote}</p><p><b>Unidade/Salão:</b> ${e.unidade||'-'}</p><p><b>Origem:</b> ${e.origem||e.origemPlanilha||'-'}</p><p><b>Diretoria:</b> ${(e.diretores&&e.diretores.length)?e.diretores.map(d=>`${esc(d.nome)} ${d.assinado?'✅':'⏳'}`).join(' · '):'Não cadastrada'}</p><div class="divider"></div><p style="white-space:pre-wrap">${esc(e.observacoes||'')}</p></div><br><button class="btn" onclick="EVENTOS.edit('${e.id}')">Editar</button>`; $('modal').classList.add('open');},
  closeModal(){ $('modal').classList.remove('open');},
  movePipeline(id,status){const e=state.eventos.find(x=>String(x.id)===String(id)); if(!e)return toast('Evento não encontrado'); if(!canMovePipeline(e.status,status))return toast('Etapa inválida'); if(e.status===status)return toast('Card já está nesta etapa'); const kanban=document.querySelector('#funil .pipeline-kanban'); if(kanban)__pipelineScrollLeft=kanban.scrollLeft; const antigo=e.status; const agora=new Date().toISOString(); e.status=status; e.movidoEm=agora; e.statusAtualizadoEm=agora; e.atualizadoEm=agora; e.criadoEm=e.criadoEm||agora; e.observacoes=(e.observacoes||'')+`\n\n[FUNIL] Movido de ${antigo||'Sem status'} para ${status} em ${new Date().toLocaleString('pt-BR')}`; localStorage.setItem(STORE,JSON.stringify(state.eventos)); if(window.EventosFirebase&&EventosFirebase.enabled){try{EventosFirebase.saveAll(state.eventos).catch(()=>{});}catch(_){}} toast(`Movido para ${status}`); render(); requestAnimationFrame(()=>{const k=document.querySelector('#funil .pipeline-kanban');if(k)k.scrollLeft=__pipelineScrollLeft||0;});},
  markRecuperado(id){const e=state.eventos.find(x=>x.id===id); if(e){e.status='Proposta enviada';e.movidoEm=new Date().toISOString();e.statusAtualizadoEm=e.movidoEm;e.observacoes=(e.observacoes||'')+'\n\n[RECUPERAÇÃO] Cliente reativado em '+new Date().toLocaleDateString('pt-BR');save();toast('Cliente movido para proposta');render();}},
  whats(id){const e=state.eventos.find(x=>x.id===id); if(!e||!e.telefone)return toast('Telefone não cadastrado'); window.open(`https://wa.me/${String(e.telefone).replace(/\D/g,'')}?text=${encodeURIComponent('Olá, tudo bem? Estou entrando em contato sobre sua proposta de evento no Coco Bambu.')}`,'_blank');},
  seedReset(){if(confirm('Recarregar a base importada da planilha? Eventos cadastrados manualmente serão mantidos.')){const manual=state.eventos.filter(e=>!e.importado);state.eventos=dedupeEventos([...(window.EVENTOS_SEED||[]).map(e=>({...e,importado:true})),...manual]);save();toast('Base 2026/2027 recarregada');setupFilters();render();}},
  exportCSV(){const cols=['data','horario','cliente','telefone','unidade','tipo','turno','pessoas','pacote','status','valorPessoa','taxaServicoPct','valorEstimado','gorjeta','origemPlanilha','observacoes'];const csv=[cols.join(';')].concat(state.eventos.map(e=>cols.map(c=>'"'+String(e[c]??'').replace(/"/g,'""').replace(/\n/g,' | ')+'"').join(';'))).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='eventos_premium_export.csv';a.click();URL.revokeObjectURL(a.href);},
  async firebaseSync(){if(!window.EventosFirebase)return toast('Firebase não carregado'); const ok=await EventosFirebase.init(); if(!ok)return toast('Firebase indisponível nesta abertura'); await EventosFirebase.saveAll(state.eventos); toast('Eventos enviados para /eventos_premium');},
};
function boot(){
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;if(!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),1200);}});
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(!standalone&&!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),2200);}
  document.addEventListener('click',ev=>{
  if(!document.body.classList.contains('menu-open'))return;
  if(ev.target.closest('.desktop-sidebar')||ev.target.closest('.mobile-menu'))return;
  document.body.classList.remove('menu-open');
});
load();setupTabs();setupFilters();render(); if(window.EventosFirebase){EventosFirebase.init().then(ok=>{if(ok){EventosFirebase.listen(arr=>{if(Array.isArray(arr)&&arr.length){const map=new Map((state.eventos||[]).map(e=>[e.id,e]));arr.forEach(e=>{if(e&&e.id)map.set(e.id,Object.assign({},map.get(e.id)||{},e));});state.eventos=dedupeEventos([...map.values()]);localStorage.setItem(STORE,JSON.stringify(state.eventos));setupFilters();render();}}); if(EventosFirebase.listenClientes) EventosFirebase.listenClientes(arr=>{state.clientesCadastros=dedupeClientesCadastro([...(state.clientesCadastros||[]),...(arr||[])]);saveClientes(); if(state.tab==='clientes')renderClientes();});}});}}
document.addEventListener('DOMContentLoaded',boot);
})();

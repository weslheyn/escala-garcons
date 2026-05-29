(function(){
'use strict';
const $=id=>document.getElementById(id);
const APP_DATA_VERSION='v101-eventos-sem-calendario-planilha';
const STORE='eventos_premium_v101';
const META='eventos_premium_meta_v100';
const AGENDA_STORE='eventos_agenda_comercial_v61';
const AGENDA_RESP_STORE='eventos_agenda_responsaveis_v61';
const DEVICE_STORE='eventos_device_id_v61';
const CLIENTES_STORE='eventos_clientes_cadastro_v101';
let deferredInstallPrompt=null;
const PIPELINE_STATUS=['Lead','Proposta enviada','Visita do espaço','Negociação 1','Negociação 2','Reunião de alinhamento','Contrato enviado','Assinatura cliente','Assinatura diretoria','Fechado','Realizado'];
const RECOVERY_STATUS=['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'];
const STATUS=[...PIPELINE_STATUS,...RECOVERY_STATUS];
const TABS=[['dashboard','Dashboard'],['funil','Funil'],['calendario','Calendário'],['vendas','Vendas'],['recuperacao','Recuperação'],['clientes','Clientes'],['pacotes','Pacotes'],['agenda','Agenda'],['sheets','Relatórios']];
let state={tab:'dashboard',eventos:[],pacotes:window.EVENTOS_PACOTES||[],agenda:[],agendaResponsaveis:[],agendaFiltros:{criador:'',visibilidade:'',tipo:'',status:''},clientesView:'historico',clientesCadastros:[],meta:{metaMensal:150000},cal:{year:new Date().getFullYear(),month:new Date().getMonth()+1,view:'mes',day:new Date().getDate()}};
function ensureFreshAppVersion(){
  try{
    const key='gestao_cb_eventos_app_version';
    if(localStorage.getItem(key)!==APP_DATA_VERSION){
      ['eventos_premium_v58','eventos_premium_meta_v58','eventos_clientes_cadastro_v64','eventos_premium_v95','eventos_premium_v96','eventos_premium_v97','eventos_premium_v100','dashboard_cache','dashboard','stats','metricas'].forEach(k=>localStorage.removeItem(k));
      localStorage.setItem(key,APP_DATA_VERSION);
    }
  }catch(e){}
}
ensureFreshAppVersion();
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
    // Leads vindos do Google Forms devem ficar sempre acima dos demais eventos.
    return Math.max(criado,atualizado,0)+9000000000000000;
  }
  if(criado||atualizado) return Math.max(criado,atualizado);
  // Eventos sem data de criação não devem superar leads novos apenas pela data futura do evento.
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
function save(){localStorage.setItem(STORE,JSON.stringify(state.eventos));localStorage.setItem(META,JSON.stringify(state.meta));}
function saveClientes(){localStorage.setItem(CLIENTES_STORE,JSON.stringify(state.clientesCadastros||[]));}
function clienteCadastroMatch(nome,telefone){
  const n=norm(nome||''), tel=String(telefone||'').replace(/\D/g,'');
  return (state.clientesCadastros||[]).find(c=>{
    const cn=norm(c.nome||c.cliente||''), ct=String(c.telefone||'').replace(/\D/g,'');
    return (n&&cn&&cn===n)||(tel&&ct&&ct===tel);
  })||null;
}
function clientesDatalistHtml(){
  const arr=dedupeClientesCadastro(state.clientesCadastros||[]);
  return `<datalist id="clientesCadastroOptions">${arr.map(c=>`<option value="${esc(c.nome||'')}" label="${esc([c.telefone,c.email].filter(Boolean).join(' • '))}"></option>`).join('')}</datalist>`;
}
function applyClienteCadastroToEvento(){
  const nome=($('f_cliente')?.value||'').trim(), tel=($('f_telefone')?.value||'').trim();
  const c=clienteCadastroMatch(nome,tel);
  if(!c)return null;
  if($('f_cliente')&&!$('f_cliente').value.trim()) $('f_cliente').value=c.nome||'';
  if($('f_telefone')&&!$('f_telefone').value.trim()) $('f_telefone').value=c.telefone||'';
  if($('f_tipo')&&!$('f_tipo').value.trim()) $('f_tipo').value=c.tipoEvento||'Evento';
  if($('f_data')&&!$('f_data').value&&c.dataEvento) $('f_data').value=c.dataEvento;
  if($('f_pessoas')&&!$('f_pessoas').value&&c.pessoas) $('f_pessoas').value=c.pessoas;
  return c;
}
function load(){
  const saved=localStorage.getItem(STORE);
  if(saved){
    try{state.eventos=dedupeEventos(JSON.parse(saved)||[])}catch(e){state.eventos=[]}
  }else{
    // v97: não carrega mais a base demonstrativa automaticamente.
    // Isso permite começar o CRM do zero sem o eventos-seed.js repovoar a tela.
    state.eventos=[];
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
  const raw=String(s||'').trim();
  const rawNorm=norm(raw);
  const allStatus=[...PIPELINE_STATUS,...RECOVERY_STATUS];
  const exact=allStatus.find(st=>norm(st)===rawNorm);
  // Regra crítica do funil: quando o campo STATUS já vem preenchido com uma etapa válida,
  // ele deve ser a verdade. Não podemos reclassificar usando observações antigas, porque o
  // histórico pode conter frases como “Movido de Proposta enviada para Lead” e isso fazia
  // o card voltar para a etapa anterior.
  if(exact) return exact;

  // Se o status veio vazio/sem status, aí sim usamos observações/texto importado para sugerir etapa.
  const n=norm([raw,obs].join(' '));
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
  out.extras=Number(e.extras??e.valorExtras??e.valorExtra)||0;
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
let __pipelineGlobalDropReady=false;
const __pendingEventoWrites=new Map();

function setupFunilDragDrop(){
  const root=$('funil');
  if(!root)return;
  setupPipelineGlobalDrop(root);
  const kanban=root.querySelector('.pipeline-kanban');
  if(kanban&&__pipelineScrollLeft){
    requestAnimationFrame(()=>{kanban.scrollLeft=__pipelineScrollLeft||0;});
  }

  // Desktop usa Drag & Drop nativo do navegador. É mais estável para funil horizontal
  // e permite mover para esquerda e direita sem descalibrar o ponto de soltar.
  root.querySelectorAll('.draggable-card').forEach(card=>{
    card.setAttribute('draggable','true');
    setupPipelineNativeDrag(card,root);
    setupPipelinePointerDrag(card,root); // usado só em touch/pen com toque longo
  });

  root.querySelectorAll('.pipeline-drop-zone').forEach(zone=>{
    if(zone.dataset.nativeDropReady==='1')return;
    zone.dataset.nativeDropReady='1';
    zone.addEventListener('dragenter',ev=>{
      if(!__pipelineDraggedId)return;
      ev.preventDefault();
      clearPipelineHighlights(root);
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragover',ev=>{
      if(!__pipelineDraggedId)return;
      ev.preventDefault();
      if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
      clearPipelineHighlights(root);
      zone.classList.add('drag-over');
      const k=root.querySelector('.pipeline-kanban');
      if(k)__pipelineScrollLeft=k.scrollLeft;
    });
    zone.addEventListener('drop',ev=>{
      if(!__pipelineDraggedId)return;
      ev.preventDefault();
      const id=(ev.dataTransfer&&ev.dataTransfer.getData('text/plain'))||__pipelineDraggedId;
      const status=zone.dataset.status||'';
      const k=root.querySelector('.pipeline-kanban');
      if(k)__pipelineScrollLeft=k.scrollLeft;
      clearPipelineHighlights(root);
      document.body.classList.remove('kanban-dragging');
      root.querySelectorAll('.draggable-card.dragging').forEach(c=>c.classList.remove('dragging'));
      __pipelineDraggedId=null;
      if(id&&status)EVENTOS.movePipeline(id,status);
    });
  });
}


function setupPipelineGlobalDrop(root){
  if(__pipelineGlobalDropReady)return;
  __pipelineGlobalDropReady=true;

  const activeRoot=()=>document.getElementById('funil');
  const activeKanban=()=>activeRoot()?.querySelector('.pipeline-kanban');

  window.addEventListener('dragover',ev=>{
    if(!__pipelineDraggedId)return;
    const rootNow=activeRoot();
    if(!rootNow)return;
    const kanban=activeKanban();
    if(!kanban)return;
    ev.preventDefault();
    if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
    const z=pipelineZoneFromPoint(rootNow,ev.clientX,ev.clientY);
    clearPipelineHighlights(rootNow);
    if(z)z.classList.add('drag-over');
    __pipelineScrollLeft=kanban.scrollLeft;
  },{passive:false});

  window.addEventListener('drop',ev=>{
    if(!__pipelineDraggedId)return;
    const rootNow=activeRoot();
    if(!rootNow)return;
    ev.preventDefault();
    const id=(ev.dataTransfer&&ev.dataTransfer.getData('text/plain'))||__pipelineDraggedId;
    const z=pipelineZoneFromPoint(rootNow,ev.clientX,ev.clientY);
    const status=z&&z.dataset?z.dataset.status:'';
    const kanban=activeKanban();
    if(kanban)__pipelineScrollLeft=kanban.scrollLeft;
    clearPipelineHighlights(rootNow);
    rootNow.querySelectorAll('.draggable-card.dragging').forEach(c=>c.classList.remove('dragging'));
    document.body.classList.remove('kanban-dragging');
    __pipelineDraggedId=null;
    if(id&&status)EVENTOS.movePipeline(id,status);
  },{passive:false});
}

function setupPipelineNativeDrag(card,root){
  if(card.dataset.nativeDragReady==='1')return;
  card.dataset.nativeDragReady='1';
  card.addEventListener('dragstart',ev=>{
    // Mouse/trackpad: arraste nativo. Touch é tratado no pointer/long press.
    const id=card.dataset.eventId||'';
    __pipelineDraggedId=id;
    const k=root.querySelector('.pipeline-kanban');
    if(k)__pipelineScrollLeft=k.scrollLeft;
    card.classList.add('dragging');
    document.body.classList.add('kanban-dragging');
    if(ev.dataTransfer){
      ev.dataTransfer.effectAllowed='move';
      ev.dataTransfer.setData('text/plain',id);
      try{ev.dataTransfer.setDragImage(card, Math.min(40,card.offsetWidth/2), 24);}catch(_){ }
    }
  });
  card.addEventListener('dragend',()=>{
    card.classList.remove('dragging');
    document.body.classList.remove('kanban-dragging');
    clearPipelineHighlights(root);
    __pipelineDraggedId=null;
    const k=root.querySelector('.pipeline-kanban');
    if(k)__pipelineScrollLeft=k.scrollLeft;
  });
}

function pipelineZones(root){
  return [...root.querySelectorAll('.pipeline-drop-zone')];
}

function clearPipelineHighlights(root){
  root.querySelectorAll('.pipeline-drop-zone').forEach(z=>z.classList.remove('drag-over','drag-blocked'));
}

function pipelineZoneFromPoint(root,x,y){
  const zones=pipelineZones(root).filter(z=>z.offsetParent!==null);
  if(!zones.length)return null;

  // 1) Primeiro tenta o elemento real sob o cursor.
  const el=document.elementFromPoint(x,y);
  const direct=el&&el.closest?el.closest('.pipeline-drop-zone'):null;
  if(direct&&root.contains(direct))return direct;

  // 2) Depois usa as coordenadas visíveis de cada coluna. Isso permite voltar para a esquerda
  // mesmo quando o card/ghost está por cima ou quando o funil está com scroll horizontal.
  let candidate=null;
  for(const z of zones){
    const r=z.getBoundingClientRect();
    if(x>=r.left && x<=r.right){candidate=z;break;}
  }
  if(candidate)return candidate;

  // 3) Se estiver exatamente no vão entre colunas, usa a coluna mais próxima pelo centro.
  let best=null,bestDist=Infinity;
  for(const z of zones){
    const r=z.getBoundingClientRect();
    const cx=r.left+(r.width/2);
    const dist=Math.abs(x-cx);
    if(dist<bestDist){bestDist=dist;best=z;}
  }
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
    kanban.scrollLeft+=dir*34;
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

  card.addEventListener('pointerdown',ev=>{
    if(ev.target.closest('button,a,input,select,textarea'))return;
    // Desktop usa Drag & Drop nativo. Pointer drag fica reservado ao mobile/tablet.
    if(!isTouchLike(ev))return;
    startX=lastX=ev.clientX; startY=lastY=ev.clientY; pointerId=ev.pointerId; armed=true; active=false; sourceCard=card;
    sourceCard.dataset.pointerType=ev.pointerType||'touch';
    clearTimers();
    try{card.setPointerCapture(ev.pointerId);}catch(_){ }
    timer=setTimeout(begin,430);
  },{passive:true});

  window.addEventListener('pointermove',ev=>{
    if(!armed||pointerId!==ev.pointerId)return;
    lastX=ev.clientX; lastY=ev.clientY;
    const dx=Math.abs(lastX-startX),dy=Math.abs(lastY-startY);

    if(!active){
      if(isTouchLike(ev)){
        // Se o usuário só está rolando no celular, cancela o modo mover.
        if(dx>28||dy>28)clearState();
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
  el.innerHTML=`<div class="table-wrap clientes-cadastro-table"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Evento desejado</th><th>Origem</th><th>Dados fiscais</th><th>Tags</th><th>Ações</th></tr></thead><tbody>${arr.map(c=>`<tr><td><b>${esc(c.nome||'Cliente sem nome')}</b><br><span class="muted">Criado em ${new Date(c.criadoEm||Date.now()).toLocaleDateString('pt-BR')}</span></td><td>${esc(c.telefone||'')}<br><span class="muted">${esc(c.email||'')}</span></td><td>${esc(c.tipoEvento||'Evento')}<br><span class="muted">${dt(c.dataEvento)||'Data a definir'} · ${esc(c.horario||'Horário a definir')} · ${esc(c.pessoas||'-')} pessoas</span></td><td><span class="status s-proposta">${esc(c.origem||'Manual')}</span></td><td>${esc(c.cpfCnpj||'CPF/CNPJ pendente')}<br><span class="muted">${esc(c.razaoSocial||'Razão social pendente')}</span></td><td>${(c.tags||[]).map(t=>`<span class="client-tag">${esc(t)}</span>`).join('')||'<span class="muted">Sem tags</span>'}</td><td><button class="btn alt" onclick="EVENTOS.editCliente('${c.id}')">Editar</button>${c.eventoId?`<button class="btn alt" onclick="EVENTOS.view('${c.eventoId}')">Ver lead</button>`:''}<button class="btn danger" onclick="EVENTOS.deleteCliente('${c.id}')">Excluir</button></td></tr>`).join('')}</tbody></table></div>${!arr.length?'<div class="week-empty"><b>Nenhum cadastro encontrado.</b><br><span>Clientes vindos do Google Forms e cadastros manuais aparecerão aqui.</span></div>':''}`;
}
function clienteFormHtml(c={}){
  const tags=Array.isArray(c.tags)?c.tags.join(', '):(c.tags||'');
  return `<div class="form-grid"><div><label>Nome completo</label><input class="field" id="cli_nome" value="${esc(c.nome||'')}"></div><div><label>Telefone</label><input class="field" id="cli_telefone" value="${esc(c.telefone||'')}"></div><div><label>E-mail</label><input class="field" id="cli_email" value="${esc(c.email||'')}"></div><div><label>Origem</label><select class="field" id="cli_origem">${['Manual','Google Forms','WhatsApp','Instagram','Indicação','Site','Telefone','Presencial'].map(o=>`<option ${o===(c.origem||'Manual')?'selected':''}>${o}</option>`).join('')}</select></div><div><label>CPF/CNPJ</label><input class="field" id="cli_cpf" value="${esc(c.cpfCnpj||'')}"></div><div><label>Razão social</label><input class="field" id="cli_razao" value="${esc(c.razaoSocial||'')}"></div><div><label>Instagram</label><input class="field" id="cli_instagram" value="${esc(c.instagram||'')}"></div><div><label>Tags</label><input class="field" id="cli_tags" placeholder="VIP, Corporativo, Noiva..." value="${esc(tags)}"></div><div><label>Data desejada</label><input class="field" type="date" id="cli_data" value="${esc(c.dataEvento||'')}"></div><div><label>Horário / turno</label><input class="field" id="cli_horario" value="${esc(c.horario||'')}"></div><div><label>Tipo de evento</label><input class="field" id="cli_tipo" value="${esc(c.tipoEvento||'')}"></div><div><label>Número de convidados</label><input class="field" type="number" id="cli_pessoas" value="${esc(c.pessoas||'')}"></div><div class="span4"><label>Observações internas</label><textarea class="field" id="cli_obs">${esc(c.observacoes||'')}</textarea></div></div><div class="divider"></div><div class="modal-actions-row"><button class="btn" onclick="EVENTOS.saveClienteForm('${c.id||''}')">Salvar cliente</button>${c.id?`<button class="btn danger" onclick="EVENTOS.deleteCliente('${c.id}')">Excluir cadastro</button>`:''}</div>`;
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
  function evHtml(e){return `<div class="ev ${statusClass(e.status)} ${eventColorClass(e)}" onclick="EVENTOS.view('${e.id}')"><span class="ev-dot"></span><strong>${esc(e.cliente||'Cliente')}</strong><small>${horario(e)} · ${esc(e.turno||'A definir')} · ${e.pessoas||'-'}p<br>📍 ${esc(salao(e)||'Salão a definir')}</small></div>`;}
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
function fmtMoney(n){
  const v=Number(n)||0;
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function moneyInputValue(n){
  const v=Number(n)||0;
  return v ? String(v).replace('.',',') : '';
}
function eventFinancialValuesFromFields(){
  const pessoas=parseNum($('f_pessoas')?.value);
  const valorPessoa=parseNum($('f_valorPessoa')?.value);
  const taxa=parseNum($('f_taxa')?.value);
  const baseA=pessoas*valorPessoa;
  const servicoA=baseA*(taxa/100);
  const totalA=baseA+servicoA;

  const extraInputs=Array.from(document.querySelectorAll('.extra-consumo-input'));
  const extrasItens=extraInputs.map(el=>parseNum(el.value));
  const extra1=extrasItens[0]||0;
  const extra2=extrasItens[1]||0;
  const extra3=extrasItens[2]||0;
  const taxaExtras=parseNum($('f_taxaExtras')?.value || $('f_taxa')?.value || 13);
  const baseB=extrasItens.reduce((sum,v)=>sum+(Number(v)||0),0);
  const servicoB=baseB*(taxaExtras/100);
  const totalB=baseB+servicoB;

  const pessoasExcedentes=parseNum($('f_pessoasExcedentes')?.value);
  const valorPessoaExcedente=parseNum($('f_valorPessoaExcedente')?.value);
  const taxaExcedente=parseNum($('f_taxaExcedente')?.value || $('f_taxa')?.value);
  const baseC=pessoasExcedentes*valorPessoaExcedente;
  const servicoC=baseC*(taxaExcedente/100);
  const totalC=baseC+servicoC;

  const gorjeta=servicoA+servicoB+servicoC;
  const valorTotal=totalA+totalB+totalC;
  return {pessoas,valorPessoa,taxa,baseA,servicoA,totalA,extra1,extra2,extra3,extrasItens,taxaExtras,baseB,servicoB,totalB,pessoasExcedentes,valorPessoaExcedente,taxaExcedente,baseC,servicoC,totalC,gorjeta,valorTotal};
}
function setText(id,value){const el=$(id); if(el)el.textContent=value;}
function setVal(id,value){const el=$(id); if(el)el.value=value;}
function calcEventFinancialsFromFields(){
  const f=eventFinancialValuesFromFields();
  setText('fin_baseA',fmtMoney(f.baseA));
  setText('fin_servicoA',fmtMoney(f.servicoA));
  setText('fin_totalA',fmtMoney(f.totalA));
  setText('fin_extra1',fmtMoney(f.extra1));
  setText('fin_extra2',fmtMoney(f.extra2));
  setText('fin_extra3',fmtMoney(f.extra3));
  setText('fin_baseB',fmtMoney(f.baseB));
  setText('fin_servicoB',fmtMoney(f.servicoB));
  setText('fin_totalB',fmtMoney(f.totalB));
  setText('fin_baseC',fmtMoney(f.baseC));
  setText('fin_servicoC',fmtMoney(f.servicoC));
  setText('fin_totalC',fmtMoney(f.totalC));
  setText('fin_grand',fmtMoney(f.valorTotal));
  setText('fin_resumo_totalA',fmtMoney(f.totalA));
  setText('fin_resumo_totalB',fmtMoney(f.totalB));
  setText('fin_resumo_totalC',fmtMoney(f.totalC));
  setText('fin_resumo_servicoA',fmtMoney(f.servicoA));
  setText('fin_resumo_servicoB',fmtMoney(f.servicoB));
  setText('fin_resumo_servicoC',fmtMoney(f.servicoC));
  setVal('f_gorjeta',f.gorjeta?f.gorjeta.toFixed(2):'0.00');
  setVal('f_valorEstimado',f.valorTotal?f.valorTotal.toFixed(2):'0.00');
}
function setupEventFinancials(){
  ['f_pessoas','f_valorPessoa','f_taxa','f_taxaExtras','f_pessoasExcedentes','f_valorPessoaExcedente','f_taxaExcedente'].forEach(id=>{
    const el=$(id); if(!el)return;
    el.addEventListener('input',calcEventFinancialsFromFields);
    el.addEventListener('change',calcEventFinancialsFromFields);
  });
  document.querySelectorAll('.extra-consumo-input').forEach(el=>{
    el.addEventListener('input',calcEventFinancialsFromFields);
    el.addEventListener('change',calcEventFinancialsFromFields);
  });
  calcEventFinancialsFromFields();
}
function refreshExtraLabels(){
  const wrap=$('extrasRows');
  if(!wrap)return;
  Array.from(wrap.querySelectorAll('.extra-row')).forEach((row,i)=>{
    const label=row.querySelector('.extra-label');
    if(label)label.textContent='Consumo extra '+(i+1);
  });
}
function createExtraRow(valor=''){
  const row=document.createElement('div');
  row.className='extra-row';
  row.innerHTML=`<label class="extra-label">Consumo extra</label><input class="field extra-consumo-input" type="text" inputmode="decimal" value="${esc(moneyInputValue(parseNum(valor)))}"><button type="button" class="btn-remove-extra" title="Remover consumo" onclick="EVENTOS.removeExtraConsumo(this)">×</button>`;
  const input=row.querySelector('.extra-consumo-input');
  input.addEventListener('input',calcEventFinancialsFromFields);
  input.addEventListener('change',calcEventFinancialsFromFields);
  return row;
}
function addExtraConsumo(valor=''){
  const wrap=$('extrasRows');
  if(!wrap)return;
  const row=createExtraRow(valor);
  wrap.appendChild(row);
  refreshExtraLabels();
  calcEventFinancialsFromFields();
  row.querySelector('.extra-consumo-input')?.focus();
}
function removeExtraConsumo(btn){
  const row=btn?.closest?.('.extra-row');
  if(row)row.remove();
  refreshExtraLabels();
  calcEventFinancialsFromFields();
}
function financialHtml(e={}){
  const extrasOrigem=Array.isArray(e.extrasItens)?e.extrasItens:Array.isArray(e.consumosExtras)?e.consumosExtras:null;
  const ex1=e.extra1??e.consumoExtra1??e.extras1??e.extras??0;
  const ex2=e.extra2??e.consumoExtra2??e.extras2??0;
  const ex3=e.extra3??e.consumoExtra3??e.extras3??0;
  let extrasLista=(extrasOrigem&&extrasOrigem.length?extrasOrigem:[ex1,ex2,ex3]).map(v=>Number(v)||0);
  while(extrasLista.length<2)extrasLista.push(0);
  while(extrasLista.length>2 && !extrasLista[extrasLista.length-1])extrasLista.pop();
  const qtdExc=e.pessoasExcedentes??e.qtdExcedente??e.quantidadeExcedente??0;
  const valExc=e.valorPessoaExcedente??e.valorExcedente??0;
  const taxaExc=e.taxaExcedentePct??e.taxaExcedente??e.taxaServicoPct??13;
  const taxaExtras=e.taxaExtrasPct??e.taxaExtras??e.taxaServicoExtrasPct??e.taxaServicoPct??13;
  return `<div class="finance-layout span4">
    <div class="finance-left">
      <section class="finance-card finance-card-premium">
        <h3><span class="finance-badge">A</span> CONTRATO (VALORES BASE)</h3>
        <div class="finance-table">
          <label>Quantidade de pessoas</label><input class="field" type="text" inputmode="numeric" id="f_pessoas" value="${e.pessoas||''}">
          <label>Valor por pessoa - sem taxa</label><input class="field" type="text" inputmode="decimal" id="f_valorPessoa" value="${moneyInputValue(e.valorPessoa||0)}">
          <label>Taxa de serviço (%)</label><input class="field" type="text" inputmode="decimal" id="f_taxa" value="${String(e.taxaServicoPct??13).replace('.',',')}">
          <label>Total contrato (A)</label><strong id="fin_totalA">R$ 0,00</strong>
        </div>
      </section>
      <section class="finance-card finance-card-premium">
        <h3><span class="finance-badge">B</span> PESSOAS EXCEDENTES</h3>
        <div class="finance-table">
          <label>Quantidade de pessoas excedentes</label><input class="field" type="text" inputmode="numeric" id="f_pessoasExcedentes" value="${qtdExc||''}">
          <label>Valor por pessoa excedente - sem taxa</label><input class="field" type="text" inputmode="decimal" id="f_valorPessoaExcedente" value="${moneyInputValue(valExc)}">
          <label>Taxa de serviço (%)</label><input class="field" type="text" inputmode="decimal" id="f_taxaExcedente" value="${String(taxaExc).replace('.',',')}">
          <label>Total excedentes (B)</label><strong id="fin_totalC">R$ 0,00</strong>
        </div>
      </section>
      <section class="finance-card finance-card-premium finance-card-extras">
        <h3><span class="finance-badge">C</span> EXTRAS (MESA EXTRA / CONSUMOS)</h3>
        <div class="finance-table finance-table-extras">
          <div id="extrasRows" class="extras-rows">${extrasLista.map((valor,i)=>`<div class="extra-row"><label class="extra-label">Consumo extra ${i+1}</label><input class="field extra-consumo-input" type="text" inputmode="decimal" value="${moneyInputValue(valor)}"><button type="button" class="btn-remove-extra" title="Remover consumo" onclick="EVENTOS.removeExtraConsumo(this)">×</button></div>`).join('')}</div>
          <label>Taxa de serviço (%)</label><input class="field" type="text" inputmode="decimal" id="f_taxaExtras" value="${String(taxaExtras).replace('.',',')}">
          <label>Total extras (C)</label><strong id="fin_totalB">R$ 0,00</strong>
        </div>
        <button type="button" class="btn-add-extra-icon" title="Adicionar consumo" onclick="EVENTOS.addExtraConsumo()">+</button>
      </section>
    </div>
    <aside class="finance-summary">
      <h3>RESUMO FINANCEIRO</h3>
      <div class="finance-summary-block"><h4><span class="finance-badge">A</span> CONTRATO</h4><p><span>Total sem taxa</span><strong id="fin_baseA">R$ 0,00</strong></p><p><span>Taxa de serviço</span><strong id="fin_resumo_servicoA">R$ 0,00</strong></p><div class="finance-line"></div><p class="finance-total"><span>Total contrato (A)</span><strong id="fin_resumo_totalA">R$ 0,00</strong></p></div>
      <div class="finance-summary-block"><h4><span class="finance-badge">B</span> EXCEDENTES</h4><p><span>Total sem taxa</span><strong id="fin_baseC">R$ 0,00</strong></p><p><span>Taxa de serviço</span><strong id="fin_resumo_servicoC">R$ 0,00</strong></p><div class="finance-line"></div><p class="finance-total"><span>Total excedentes (B)</span><strong id="fin_resumo_totalC">R$ 0,00</strong></p></div>
      <div class="finance-summary-block"><h4><span class="finance-badge">C</span> EXTRAS</h4><p><span>Subtotal extras</span><strong id="fin_baseB">R$ 0,00</strong></p><p><span>Taxa de serviço</span><strong id="fin_resumo_servicoB">R$ 0,00</strong></p><div class="finance-line"></div><p class="finance-total"><span>Total extras (C)</span><strong id="fin_resumo_totalB">R$ 0,00</strong></p></div>
      <div class="finance-grand"><span>TOTAL GERAL (A + B + C)</span><strong id="fin_grand">R$ 0,00</strong></div>
      <input type="hidden" id="f_gorjeta" value="${e.gorjeta||0}">
      <input type="hidden" id="f_valorEstimado" value="${e.valorTotal||e.valorEstimado||0}">
    </aside>
  </div>`;
}
function formHtml(e={}){
  const packs=['A definir',...new Set(state.pacotes.map(p=>p.nome.replace('Menu ','')))];
  const clienteOptions=clientesDatalistHtml();
  return `${clienteOptions}<div class="form-grid event-form-premium"><div><label>Cliente</label><input class="field" id="f_cliente" list="clientesCadastroOptions" value="${esc(e.cliente||'')}" oninput="EVENTOS.applyClienteLookup()" onchange="EVENTOS.applyClienteLookup()"><small class="muted">Digite e selecione um cliente já cadastrado.</small></div><div><label>Telefone</label><input class="field" id="f_telefone" value="${esc(e.telefone||'')}" onchange="EVENTOS.applyClienteLookup()"></div><div><label>Data</label><input class="field" type="date" id="f_data" value="${e.data||''}"></div><div><label>Horário</label><input class="field" type="time" id="f_horario" value="${e.horario||''}"></div><div><label>Status</label><select class="field" id="f_status">${STATUS.map(st=>`<option ${st===(e.status||'Lead')?'selected':''}>${st}</option>`).join('')}</select></div><div><label>Origem</label><select class="field" id="f_origem"><option>${e.origem||'WhatsApp'}</option><option>Instagram</option><option>Telefone</option><option>Anúncio</option><option>Indicação</option><option>Presencial</option><option>Google Forms</option></select></div><div><label>Tipo</label><input class="field" id="f_tipo" value="${esc(e.tipo||'Evento')}"></div><div><label>Turno</label><select class="field" id="f_turno">${['Almoço','Jantar','Ambos','A definir'].map(st=>`<option ${st===(e.turno||'A definir')?'selected':''}>${st}</option>`).join('')}</select></div><div><label>Pacote</label><select class="field" id="f_pacote">${packs.map(p=>`<option ${p===(e.pacote||'A definir')?'selected':''}>${p}</option>`).join('')}</select></div><div class="span2"><label>Salão</label><select class="field" id="f_unidade">${['Salão Vasto','Salão Barra','Salão Beira Mar','Varanda','Salão Barra + Beira Mar + Varanda','A definir'].map(st=>`<option ${st===(e.unidade||'A definir')?'selected':''}>${st}</option>`).join('')}</select></div><div class="span4"><label>Observações / andamento</label><textarea class="field" id="f_obs">${esc(e.observacoes||'')}</textarea></div>${financialHtml(e)}<div class="span4 directors-box"><label>Assinatura da diretoria</label>${[0,1,2].map(i=>{const d=(e.diretores||[])[i]||{};return `<div class="director-row"><input class="field" id="f_dir_nome_${i}" placeholder="Nome do diretor" value="${esc(d.nome||'')}"><span>Assinou?</span><input type="checkbox" id="f_dir_ok_${i}" ${d.assinado?'checked':''}></div>`}).join('')}<p class="muted" style="margin:8px 0 0;font-size:11px">Marque cada diretor que assinou. Quando todos estiverem OK, o evento pode avançar para Fechado.</p></div></div><div class="divider"></div><div class="modal-actions modal-actions-evento"><div class="modal-actions-left">${e.id?`<button class="btn danger btn-delete-evento" onclick="EVENTOS.deleteEvento('${e.id}')">Excluir evento</button>`:''}</div><div class="modal-actions-right"><button class="btn alt" onclick="EVENTOS.closeModal&&EVENTOS.closeModal()">Cancelar</button><button class="btn" onclick="EVENTOS.saveForm('${e.id||''}')">Salvar alterações</button></div></div>`
}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function collect(id){
  const data=$('f_data').value;
  calcEventFinancialsFromFields();
  const f=eventFinancialValuesFromFields();
  const pessoas=f.pessoas||null;
  const valorTotal=f.valorTotal;
  return{
    id:id||uid(),
    ano:data?Number(data.slice(0,4)):new Date().getFullYear(),
    data:data||new Date().toISOString().slice(0,10),
    horario:$('f_horario')?$('f_horario').value:'',
    cliente:$('f_cliente').value.trim()||'Cliente não informado',
    telefone:$('f_telefone').value.trim(),
    origem:$('f_origem').value,
    unidade:$('f_unidade').value,
    tipo:$('f_tipo').value,
    turno:$('f_turno').value,
    pessoas,
    pacote:$('f_pacote').value,
    status:$('f_status').value,
    valorPessoa:f.valorPessoa,
    taxaServicoPct:f.taxa,
    contratoBase:f.baseA,
    contratoServico:f.servicoA,
    contratoTotal:f.totalA,
    extra1:f.extra1,
    extra2:f.extra2,
    extra3:f.extra3,
    extrasItens:f.extrasItens||[],
    consumosExtras:f.extrasItens||[],
    consumoExtra1:f.extra1,
    consumoExtra2:f.extra2,
    consumoExtra3:f.extra3,
    taxaExtrasPct:f.taxaExtras,
    extrasBase:f.baseB,
    extrasServico:f.servicoB,
    extras:f.totalB,
    totalExtras:f.totalB,
    pessoasExcedentes:f.pessoasExcedentes,
    valorPessoaExcedente:f.valorPessoaExcedente,
    taxaExcedentePct:f.taxaExcedente,
    excedenteBase:f.baseC,
    excedenteServico:f.servicoC,
    excedenteTotal:f.totalC,
    gorjeta:f.gorjeta,
    valorEstimado:valorTotal,
    valorTotal,
    observacoes:$('f_obs').value.trim(),
    diretores:[0,1,2].map(i=>({nome:($('f_dir_nome_'+i)?.value||'').trim(),assinado:!!$('f_dir_ok_'+i)?.checked})).filter(d=>d.nome),
    atualizadoEm:new Date().toISOString()
  };
}

function eventoFreshMs(e){return Math.max(parseTimestampBR(e&&e.atualizadoEm),parseTimestampBR(e&&e.movidoEm),parseTimestampBR(e&&e.statusAtualizadoEm),parseTimestampBR(e&&e.criadoEm));}
function markPendingEvento(e){
  if(!e||!e.id)return;
  __pendingEventoWrites.set(String(e.id),{status:e.status||'',ms:eventoFreshMs(e)||Date.now()});
  setTimeout(()=>__pendingEventoWrites.delete(String(e.id)),15000);
}
function persistEvento(e){
  localStorage.setItem(STORE,JSON.stringify(state.eventos));
  markPendingEvento(e);
  if(window.EventosFirebase&&EventosFirebase.enabled){
    try{
      if(EventosFirebase.saveEvento) return EventosFirebase.saveEvento(e).catch(()=>EventosFirebase.saveAll(state.eventos).catch(()=>{}));
      return EventosFirebase.saveAll(state.eventos).catch(()=>{});
    }catch(_){ }
  }
}
function persistDeleteEvento(id){
  if(!id)return;
  id=String(id);
  __pendingEventoWrites.delete(id);
  localStorage.setItem(STORE,JSON.stringify(state.eventos));
  try{
    (state.clientesCadastros||[]).forEach(c=>{
      if(c&&String(c.eventoId||'')===id){
        delete c.eventoId;
        c.atualizadoEm=new Date().toISOString();
        if(window.EventosFirebase&&EventosFirebase.enabled&&EventosFirebase.saveClienteCadastro){
          EventosFirebase.saveClienteCadastro(c).catch(()=>{});
        }
      }
    });
    saveClientes();
  }catch(_){ }
  if(window.EventosFirebase&&EventosFirebase.enabled&&EventosFirebase.deleteEvento){
    return EventosFirebase.deleteEvento(id).catch(()=>{});
  }
}
function mergeRemoteEventos(arr){
  const map=new Map((state.eventos||[]).map(e=>[String(e.id),e]));
  (arr||[]).forEach(remote=>{
    if(!remote||!remote.id)return;
    const id=String(remote.id);
    const local=map.get(id);
    const pending=__pendingEventoWrites.get(id);
    const rMs=eventoFreshMs(remote);
    const lMs=eventoFreshMs(local);
    if(pending){
      // Se o Firebase ainda devolveu a versão antiga, não deixa sobrescrever a alteração local.
      if((remote.status||'')!==pending.status && rMs<=pending.ms){return;}
      if((remote.status||'')===pending.status) __pendingEventoWrites.delete(id);
    }
    if(local && lMs>rMs){return;}
    map.set(id,Object.assign({},local||{},remote));
  });
  state.eventos=dedupeEventos([...map.values()]);
  localStorage.setItem(STORE,JSON.stringify(state.eventos));
}

window.EVENTOS={
  closeModal(){ $('modal').classList.remove('open'); },
  tab(id){state.tab=id;document.body.classList.remove('menu-open');render()},
  clientesTab(v){state.clientesView=v;renderClientes();},
  renderClientesCadastroFiltrado(){renderClientesCadastroFiltrado();},
  openClienteForm(){ $('modalTitle').textContent='Novo cliente'; $('modalBody').innerHTML=clienteFormHtml(); $('modal').classList.add('open');},
  editCliente(id){const c=(state.clientesCadastros||[]).find(x=>x.id===id); if(!c)return toast('Cliente não encontrado'); $('modalTitle').textContent='Editar cliente'; $('modalBody').innerHTML=clienteFormHtml(c); $('modal').classList.add('open');},
  deleteCliente(id){const c=(state.clientesCadastros||[]).find(x=>x.id===id); if(!c)return toast('Cliente não encontrado'); if(!confirm('Excluir este cadastro de cliente?'))return; state.clientesCadastros=(state.clientesCadastros||[]).filter(x=>x.id!==id); saveClientes(); if(window.EventosFirebase&&EventosFirebase.enabled&&EventosFirebase.deleteClienteCadastro) EventosFirebase.deleteClienteCadastro(id).catch(()=>{}); $('modal').classList.remove('open'); toast('Cadastro excluído'); if(state.tab==='clientes')renderClientes();},
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
  applyClienteLookup(){applyClienteCadastroToEvento();},
  edit(id){const e=state.eventos.find(x=>String(x.id)===String(id)); if(!e)return; $('modalTitle').textContent='Editar Evento'; $('modalBody').innerHTML=formHtml(e); $('modal').classList.add('open'); setupEventFinancials();},
  deleteEvento(id){const e=state.eventos.find(x=>String(x.id)===String(id)); if(!e)return toast('Evento não encontrado'); const nome=e.cliente||'este evento'; if(!confirm('Excluir definitivamente o evento de '+nome+'?\n\nIsso remove do funil, calendário e dashboard do módulo Eventos.'))return; state.eventos=state.eventos.filter(x=>String(x.id)!==String(id)); persistDeleteEvento(id); $('modal').classList.remove('open'); toast('Evento excluído'); render();},
  saveForm(id){if(!id&&!clienteCadastroMatch($('f_cliente')?.value,$('f_telefone')?.value)){toast('Cliente não cadastrado. Cadastre o cliente antes de criar o evento.');return;} const e=collect(id); const idx=state.eventos.findIndex(x=>String(x.id)===String(e.id)); const antigo=idx>=0?state.eventos[idx]:null; const agora=new Date().toISOString(); if(antigo){e.criadoEm=antigo.criadoEm||e.criadoEm||agora; if((antigo.status||'')!==(e.status||'')){e.movidoEm=agora;e.statusAtualizadoEm=agora;e.observacoes=(e.observacoes||'')+`\n\n[FUNIL] Status alterado manualmente de ${antigo.status||'Sem status'} para ${e.status} em ${new Date().toLocaleString('pt-BR')}`;} state.eventos[idx]=Object.assign({},antigo,e,{atualizadoEm:agora});} else {state.eventos.unshift(Object.assign({},e,{criadoEm:agora,atualizadoEm:agora}));} persistEvento(state.eventos[idx>=0?idx:0]); $('modal').classList.remove('open'); toast('Evento salvo'); render();},
  view(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; const wa=e.telefone?`<a class="whats" target="_blank" href="https://wa.me/${String(e.telefone).replace(/\D/g,'')}">Abrir WhatsApp</a>`:''; $('modalTitle').textContent=e.cliente; $('modalBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><div class="label">Data</div><div class="value">${dow(e.data)} ${shortDate(e.data)}<br><span style="font-size:16px;color:var(--sub)">${horario(e)}</span></div></div><div class="kpi"><div class="label">Valor total</div><div class="value">${brl(e.valorEstimado)}</div></div><div class="kpi"><div class="label">Pessoas</div><div class="value">${e.pessoas||'-'}</div></div><div class="kpi"><div class="label">Status</div><div class="value" style="font-size:20px">${e.status}</div></div></div><div class="panel" style="margin-top:14px"><p><b>Telefone:</b> ${e.telefone||'-'} ${wa}</p><p><b>Tipo:</b> ${e.tipo} · <b>Turno:</b> ${e.turno} · <b>Pacote:</b> ${e.pacote}</p><p><b>Unidade/Salão:</b> ${e.unidade||'-'}</p><p><b>Origem:</b> ${e.origem||'-'}</p><p><b>Diretoria:</b> ${(e.diretores&&e.diretores.length)?e.diretores.map(d=>`${esc(d.nome)} ${d.assinado?'✅':'⏳'}`).join(' · '):'Não cadastrada'}</p><div class="divider"></div><p style="white-space:pre-wrap">${esc(e.observacoes||'')}</p></div><br><button class="btn" onclick="EVENTOS.edit('${e.id}')">Editar</button>`; $('modal').classList.add('open');},
  closeModal(){ $('modal').classList.remove('open');},
  movePipeline(id,status){const e=state.eventos.find(x=>String(x.id)===String(id)); if(!e)return toast('Evento não encontrado'); if(!canMovePipeline(e.status,status))return toast('Etapa inválida'); if(e.status===status)return toast('Card já está nesta etapa'); const kanban=document.querySelector('#funil .pipeline-kanban'); if(kanban)__pipelineScrollLeft=kanban.scrollLeft; const antigo=e.status; const agora=new Date().toISOString(); e.status=status; e.movidoEm=agora; e.statusAtualizadoEm=agora; e.atualizadoEm=agora; e.criadoEm=e.criadoEm||agora; e.observacoes=(e.observacoes||'')+`\n\n[FUNIL] Movido de ${antigo||'Sem status'} para ${status} em ${new Date().toLocaleString('pt-BR')}`; persistEvento(e); toast(`Movido para ${status}`); render(); requestAnimationFrame(()=>{const k=document.querySelector('#funil .pipeline-kanban');if(k)k.scrollLeft=__pipelineScrollLeft||0;});},
  markRecuperado(id){const e=state.eventos.find(x=>x.id===id); if(e){e.status='Proposta enviada';e.movidoEm=new Date().toISOString();e.statusAtualizadoEm=e.movidoEm;e.observacoes=(e.observacoes||'')+'\n\n[RECUPERAÇÃO] Cliente reativado em '+new Date().toLocaleDateString('pt-BR');save();toast('Cliente movido para proposta');render();}},
  whats(id){const e=state.eventos.find(x=>x.id===id); if(!e||!e.telefone)return toast('Telefone não cadastrado'); window.open(`https://wa.me/${String(e.telefone).replace(/\D/g,'')}?text=${encodeURIComponent('Olá, tudo bem? Estou entrando em contato sobre sua proposta de evento no Coco Bambu.')}`,'_blank');},
  seedReset(){toast('Importação da planilha 2026/2027 foi removida. Use cadastro no app ou Google Forms.');},
  addExtraConsumo,
  removeExtraConsumo,
  exportCSV(){const cols=['data','horario','cliente','telefone','unidade','tipo','turno','pessoas','pacote','status','valorPessoa','extras','taxaServicoPct','valorEstimado','gorjeta','origem','observacoes'];const csv=[cols.join(';')].concat(state.eventos.map(e=>cols.map(c=>'"'+String(e[c]??'').replace(/"/g,'""').replace(/\n/g,' | ')+'"').join(';'))).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='eventos_premium_export.csv';a.click();URL.revokeObjectURL(a.href);},
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
load();setupTabs();setupFilters();render(); if(window.EventosFirebase){EventosFirebase.init().then(ok=>{if(ok){EventosFirebase.listen(arr=>{if(Array.isArray(arr)){if(arr.length){mergeRemoteEventos(arr);}else{state.eventos=[];localStorage.setItem(STORE,JSON.stringify(state.eventos));}setupFilters();render();}}); if(EventosFirebase.listenClientes) EventosFirebase.listenClientes(arr=>{state.clientesCadastros=dedupeClientesCadastro(arr||[]);saveClientes(); if(state.tab==='clientes')renderClientes();});}});}}
document.addEventListener('DOMContentLoaded',boot);
})();



/* =========================================================
   CLIENTES - EDITAR / EXCLUIR SEM ALTERAR ESTRUTURA EXISTENTE
   Patch isolado APP 101
========================================================= */
(function(){
  if(window.__clientesEditPatch101) return;
  window.__clientesEditPatch101 = true;

  function normalizeText(v){
    return String(v || '').trim();
  }

  function findClienteFromRow(row){
    if(!row) return null;

    const cells = Array.from(row.children || []);
    const text = normalizeText(row.innerText);

    // Tenta pegar por células da tabela visual
    const nome = normalizeText(cells[0]?.innerText || '');
    const telefone = normalizeText(cells[1]?.innerText || '');

    return {
      nome: nome || text.split('\n')[0] || '',
      telefone: telefone || '',
      row: row
    };
  }

  function buildClienteModal(){
    let modal = document.getElementById('clienteEditorModal101');
    if(modal) return modal;

    modal = document.createElement('div');
    modal.id = 'clienteEditorModal101';
    modal.className = 'cliente-editor-overlay-101';
    modal.innerHTML = `
      <div class="cliente-editor-box-101">
        <div class="cliente-editor-header-101">
          <div>
            <div class="cliente-editor-kicker-101">CLIENTE</div>
            <h2>Cadastro do Cliente</h2>
            <p>Edite as informações do cadastro ou exclua o cliente.</p>
          </div>
          <button type="button" class="cliente-editor-close-101" onclick="fecharCadastroCliente101()">×</button>
        </div>

        <div class="cliente-editor-grid-101">
          <label>
            <span>Nome do cliente</span>
            <input id="clienteEditNome101" type="text">
          </label>
          <label>
            <span>Telefone</span>
            <input id="clienteEditTelefone101" type="text">
          </label>
          <label>
            <span>Total estimado</span>
            <input id="clienteEditTotal101" type="text">
          </label>
          <label>
            <span>Último evento</span>
            <input id="clienteEditUltimo101" type="text">
          </label>
          <label class="full">
            <span>Observações</span>
            <textarea id="clienteEditObs101" rows="4" placeholder="Observações internas do cliente..."></textarea>
          </label>
        </div>

        <div class="cliente-editor-actions-101">
          <button type="button" class="btn-danger-101" onclick="excluirCadastroCliente101()">🗑 Excluir cadastro</button>
          <div>
            <button type="button" class="btn-cancel-101" onclick="fecharCadastroCliente101()">Cancelar</button>
            <button type="button" class="btn-save-101" onclick="salvarCadastroCliente101()">💾 Salvar alterações</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  window.abrirCadastroCliente101 = function(row){
    const data = findClienteFromRow(row);
    if(!data || !data.nome) return;

    const cells = Array.from(row.children || []);
    window.__clienteEditRow101 = row;
    window.__clienteEditOriginalNome101 = data.nome;

    const modal = buildClienteModal();
    modal.style.display = 'flex';

    document.getElementById('clienteEditNome101').value = data.nome || '';
    document.getElementById('clienteEditTelefone101').value = normalizeText(cells[1]?.innerText || '');
    document.getElementById('clienteEditTotal101').value = normalizeText(cells[3]?.innerText || '');
    document.getElementById('clienteEditUltimo101').value = normalizeText(cells[4]?.innerText || '');
    document.getElementById('clienteEditObs101').value = '';

    setTimeout(()=>document.getElementById('clienteEditNome101')?.focus(),80);
  };

  window.fecharCadastroCliente101 = function(){
    const modal = document.getElementById('clienteEditorModal101');
    if(modal) modal.style.display = 'none';
  };

  window.salvarCadastroCliente101 = function(){
    const row = window.__clienteEditRow101;
    if(!row) return fecharCadastroCliente101();

    const cells = Array.from(row.children || []);
    const nome = normalizeText(document.getElementById('clienteEditNome101')?.value);
    const telefone = normalizeText(document.getElementById('clienteEditTelefone101')?.value);
    const total = normalizeText(document.getElementById('clienteEditTotal101')?.value);
    const ultimo = normalizeText(document.getElementById('clienteEditUltimo101')?.value);

    if(!nome){
      alert('Informe o nome do cliente.');
      return;
    }

    if(cells[0]) cells[0].textContent = nome;
    if(cells[1]) cells[1].textContent = telefone;
    if(cells[3]) cells[3].textContent = total;
    if(cells[4]) cells[4].textContent = ultimo;

    try{
      const historico = JSON.parse(localStorage.getItem('eventos_clientes_editados_101') || '[]');
      historico.push({
        acao:'editar',
        original: window.__clienteEditOriginalNome101 || '',
        nome,
        telefone,
        total,
        ultimo,
        data: new Date().toISOString()
      });
      localStorage.setItem('eventos_clientes_editados_101', JSON.stringify(historico));
    }catch(e){}

    fecharCadastroCliente101();
    if(typeof showToast === 'function') showToast('✅ Cliente atualizado');
  };

  window.excluirCadastroCliente101 = function(){
    const row = window.__clienteEditRow101;
    if(!row) return fecharCadastroCliente101();

    const nome = normalizeText(document.getElementById('clienteEditNome101')?.value || window.__clienteEditOriginalNome101);
    if(!confirm('Deseja excluir o cadastro de ' + nome + '?')) return;

    try{
      const historico = JSON.parse(localStorage.getItem('eventos_clientes_editados_101') || '[]');
      historico.push({
        acao:'excluir',
        nome,
        data: new Date().toISOString()
      });
      localStorage.setItem('eventos_clientes_editados_101', JSON.stringify(historico));
    }catch(e){}

    row.remove();
    fecharCadastroCliente101();
    if(typeof showToast === 'function') showToast('🗑 Cliente excluído');
  };

  // Delegação: funciona mesmo que a tabela seja renderizada depois.
  document.addEventListener('click', function(ev){
    const target = ev.target;
    if(!target) return;

    // Não interceptar botões/menus/sidebar
    if(target.closest('button,a,input,select,textarea')) return;

    const row = target.closest('tr, .cliente-row, .client-row, .crm-row, .table-row, [data-cliente], [data-client]');
    if(!row) return;

    const txt = normalizeText(row.innerText);
    if(!txt) return;

    // Detecta área de clientes pelo conteúdo/cabeçalho/tela atual
    const inClientes =
      document.body.innerText.includes('Histórico de Clientes') ||
      document.body.innerText.includes('Cadastro de Clientes') ||
      document.body.innerText.includes('CLIENTE') && document.body.innerText.includes('ÚLTIMO EVENTO');

    if(!inClientes) return;

    const firstCell = row.children && row.children[0];
    if(!firstCell || !firstCell.innerText || firstCell.innerText.toUpperCase().includes('CLIENTE')) return;

    ev.preventDefault();
    ev.stopPropagation();
    abrirCadastroCliente101(row);
  }, true);

})();

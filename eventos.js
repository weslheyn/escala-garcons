(function(){
'use strict';
const $=id=>document.getElementById(id);
const STORE='eventos_premium_v58';
const META='eventos_premium_meta_v58';
const AGENDA_STORE='eventos_agenda_comercial_v1';
const DEVICE_STORE='eventos_device_id_v1';
let deferredInstallPrompt=null;
const PIPELINE_STATUS=['Lead','Proposta enviada','Visita do espaço','Negociação 1','Negociação 2','Reunião de alinhamento','Contrato enviado','Assinatura cliente','Assinatura diretoria','Fechado','Realizado'];
const RECOVERY_STATUS=['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'];
const STATUS=[...PIPELINE_STATUS,...RECOVERY_STATUS];
const TABS=[['dashboard','Dashboard'],['funil','Funil'],['calendario','Calendário'],['vendas','Vendas'],['recuperacao','Recuperação'],['clientes','Clientes'],['pacotes','Pacotes'],['agenda','Agenda'],['sheets','Relatórios']];
let state={tab:'dashboard',eventos:[],agenda:[],agendaFilter:{pessoa:'todos',tipo:'todos',status:'todos'},pacotes:window.EVENTOS_PACOTES||[],meta:{metaMensal:150000},cal:{year:new Date().getFullYear(),month:new Date().getMonth()+1}};
function deviceId(){let id=localStorage.getItem(DEVICE_STORE); if(!id){id='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); localStorage.setItem(DEVICE_STORE,id);} return id;}
function currentUser(){return localStorage.getItem('eventos_usuario_nome')||'Weslheyn';}
function brl(n){return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dt(s){ if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`;}
function dow(s){ if(!s) return ''; const d=new Date(s+'T12:00:00'); return ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][d.getDay()]||'';}
function shortDate(s){ if(!s)return ''; const [y,m,d]=String(s).split('-'); return `${d}/${m}`;}
function horario(e){ if(e.horario) return e.horario; const txt=String(e.observacoes||''); const m=txt.match(/(?:\b|^)([01]?\d|2[0-3])[:hH]([0-5]\d)?(?:\b|$)/); return m?(m[2]?`${m[1].padStart(2,'0')}:${m[2]}`:`${m[1].padStart(2,'0')}:00`):'Horário não definido';}
function salao(e){return e.salao||e.unidade||'Salão não definido';}
function monthName(m){return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1]||'';}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function toast(t){const el=$('toast'); el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500);}
function uid(){return 'ev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function agUid(){return 'ag_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function save(){localStorage.setItem(STORE,JSON.stringify(state.eventos));localStorage.setItem(META,JSON.stringify(state.meta)); if(window.EventosFirebase&&EventosFirebase.enabled) EventosFirebase.saveAll(state.eventos).catch(()=>{});}
function saveAgenda(){localStorage.setItem(AGENDA_STORE,JSON.stringify(state.agenda)); if(window.EventosFirebase&&EventosFirebase.enabled&&EventosFirebase.saveAgenda) EventosFirebase.saveAgenda(state.agenda).catch(()=>{});}
function load(){
  const saved=localStorage.getItem(STORE);
  if(saved){try{state.eventos=dedupeEventos(JSON.parse(saved)||[])}catch(e){state.eventos=[]}}
  else{
    state.eventos=dedupeEventos((window.EVENTOS_SEED||[]).map(e=>({...e,importado:true})));
    localStorage.setItem(STORE,JSON.stringify(state.eventos));
  }
  try{state.meta=Object.assign(state.meta,JSON.parse(localStorage.getItem(META)||'{}'))}catch(e){}
  try{state.agenda=JSON.parse(localStorage.getItem(AGENDA_STORE)||'[]')||[]}catch(e){state.agenda=[]}
}
function agendaVisibleList(){const dev=deviceId();return (state.agenda||[]).filter(a=>a.visibilidade==='compartilhada'||a.deviceId===dev);}
function agendaPessoas(){return [...new Set(['Weslheyn','Bruna','Mateus',...agendaVisibleList().map(a=>a.criador).filter(Boolean)])];}
function filtered(){
  const q=norm($('q').value), ano=$('ano').value, st=$('status').value, turno=$('turno').value, pacote=$('pacote').value, mes=$('mes').value;
  return state.eventos.filter(e=>{
    const hay=norm([e.cliente,e.telefone,e.tipo,e.turno,e.pacote,e.status,e.observacoes,e.unidade].join(' '));
    return (!q||hay.includes(q))&&(!ano||String(e.ano||String(e.data).slice(0,4))===ano)&&(!st||e.status===st)&&(!turno||e.turno===turno)&&(!pacote||e.pacote===pacote)&&(!mes||String(Number(String(e.data).slice(5,7)))===mes);
  });
}
function statusClass(s){const n=norm(s); if(n.includes('fechado'))return's-fechado'; if(n.includes('perdido'))return's-perdido'; if(n.includes('cancel'))return's-cancelado'; if(n.includes('sem resposta')||n.includes('recupera'))return's-semresposta'; if(n.includes('contrato')||n.includes('assinatura'))return's-contrato'; if(n.includes('proposta')||n.includes('visita'))return's-proposta'; if(n.includes('reuniao'))return's-reuniao'; if(n.includes('realizado'))return's-fechado'; return's-neg';}
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
function dedupeEventos(arr){
  const seen=new Set();
  return (arr||[]).filter(e=>{
    if(!e)return false;
    e.status=normalizeStatus(e.status,e.observacoes);
    const key=[e.data,e.cliente,e.telefone,e.pacote,e.turno,String(e.observacoes||'').slice(0,80)].map(x=>norm(x)).join('|');
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
function card(e){return `<div class="event-card"><b>${e.cliente||'Cliente'}</b><p>${dow(e.data)} • ${shortDate(e.data)} • ${horario(e)}<br>${e.turno||'A definir'} · ${e.pessoas||'-'} pessoas · ${e.pacote||'A definir'}<br>📍 ${esc(salao(e))} · ${brl(e.valorEstimado)}</p><span class="status ${statusClass(e.status)}">${e.status||'Em negociação'}</span><div class="actions"><button onclick="EVENTOS.view('${e.id}')">Ver</button><button onclick="EVENTOS.edit('${e.id}')">Editar</button></div></div>`}
function renderFunil(){const list=filtered().filter(e=>!isRecuperacaoStatus(e.status));$('funil').innerHTML=`<div class="kanban pipeline-kanban">${PIPELINE_STATUS.map(st=>`<div class="col"><h3>${st} · ${list.filter(e=>e.status===st).length}</h3>${list.filter(e=>e.status===st).map(card).join('')||'<p class="muted">Sem eventos</p>'}</div>`).join('')}</div>`;}
function renderVendas(){const list=filtered().sort((a,b)=>String(a.data).localeCompare(String(b.data)));$('vendas').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Status</th><th>Turno</th><th>Pessoas</th><th>Pacote</th><th>Valor estimado</th><th>Gorjeta</th><th>Ações</th></tr></thead><tbody>${list.map(e=>`<tr><td>${dt(e.data)}</td><td>${horario(e)}</td><td><b>${e.cliente}</b><br><span class="muted">${e.telefone||''}</span></td><td><span class="status ${statusClass(e.status)}">${e.status}</span></td><td>${e.turno}</td><td>${e.pessoas||''}</td><td>${e.pacote}</td><td>${brl(e.valorEstimado)}</td><td>${brl(e.gorjeta)}</td><td><button class="btn alt" onclick="EVENTOS.view('${e.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`;}
function renderRecuperacao(){const list=filtered().filter(e=>isRecuperacaoStatus(e.status));const cols=RECOVERY_STATUS;$('recuperacao').innerHTML=`<div class="kanban recuperacao-kanban" style="grid-template-columns:repeat(5,minmax(260px,1fr))">${cols.map(st=>`<div class="col"><h3>${st} · ${list.filter(e=>e.status===st).length}</h3>${list.filter(e=>e.status===st).map(e=>card(e).replace('</div>','<div class="actions"><button onclick="EVENTOS.whats(\''+e.id+'\')">WhatsApp</button><button onclick="EVENTOS.markRecuperado(\''+e.id+'\')">Recuperado</button></div></div>')).join('')||'<p class="muted">Sem clientes</p>'}</div>`).join('')}</div>`;}
function renderClientes(){const map={}; filtered().forEach(e=>{const k=e.cliente||'Cliente'; if(!map[k])map[k]={q:0,total:0,last:e.data,tel:e.telefone}; map[k].q++; map[k].total+=Number(e.valorEstimado)||0; if(e.data>map[k].last)map[k].last=e.data; if(e.telefone)map[k].tel=e.telefone;});const arr=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);$('clientes').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Eventos</th><th>Total estimado</th><th>Último evento</th></tr></thead><tbody>${arr.map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v.tel||''}</td><td>${v.q}</td><td>${brl(v.total)}</td><td>${dt(v.last)}</td></tr>`).join('')}</tbody></table></div>`;}
function renderPacotes(){$('pacotes').innerHTML=`<div class="package-grid">${state.pacotes.map(p=>`<div class="package"><h3>${p.nome}</h3><div class="price">${brl(p.valorSemana)} / ${brl(p.valorFimSemana)}</div><p><b>${p.categoria}</b> · ${p.servico} · ${p.duracao}<br>Mínimo: ${p.minPessoas} pessoas · Taxa: ${p.taxaServicoPct}%</p><p>${p.resumo}</p></div>`).join('')}</div>`;}
function agendaFiltered(){
  const f=state.agendaFilter||{};
  return agendaVisibleList().filter(a=>{
    return (f.pessoa==='todos'||!f.pessoa||a.criador===f.pessoa||(f.pessoa==='minhas'&&a.deviceId===deviceId()))&&
      (f.tipo==='todos'||!f.tipo||a.tipo===f.tipo)&&
      (f.status==='todos'||!f.status||a.status===f.status);
  }).sort((a,b)=>String(a.data+' '+a.hora).localeCompare(String(b.data+' '+b.hora)));
}
function agendaStatus(a){
  if(a.status==='concluida') return 'Concluída';
  const now=new Date(); const d=new Date((a.data||'2099-01-01')+'T'+(a.hora||'23:59'));
  return d<now?'Atrasada':'Pendente';
}
function renderAgenda(){
  const list=agendaFiltered();
  const all=agendaVisibleList();
  const pessoas=agendaPessoas();
  const hoje=new Date().toISOString().slice(0,10);
  const todayCount=all.filter(a=>a.data===hoje&&a.status!=='concluida').length;
  const pend=all.filter(a=>a.status!=='concluida').length;
  const comp=all.filter(a=>a.visibilidade==='compartilhada').length;
  const done=all.filter(a=>a.status==='concluida').length;
  $('agenda').innerHTML=`
    <div class="agenda-page">
      <div class="agenda-head premium-block">
        <div><span class="eyebrow">Novo módulo</span><h2>Agenda Comercial</h2><p>Atividades pessoais e compartilhadas da equipe de eventos.</p></div>
        <button class="btn primary" onclick="EVENTOS.openAgendaForm()">+ Nova Atividade</button>
      </div>
      <div class="agenda-kpis">
        <div class="kpi compact"><div class="label">Hoje</div><div class="value">${todayCount}</div><div class="hint">atividades</div></div>
        <div class="kpi compact"><div class="label">Pendentes</div><div class="value">${pend}</div><div class="hint">em aberto</div></div>
        <div class="kpi compact"><div class="label">Compartilhadas</div><div class="value">${comp}</div><div class="hint">para todos</div></div>
        <div class="kpi compact"><div class="label">Concluídas</div><div class="value">${done}</div><div class="hint">finalizadas</div></div>
      </div>
      <div class="agenda-filters premium-block">
        <button class="chip ${state.agendaFilter.pessoa==='todos'?'active':''}" onclick="EVENTOS.agendaFilter('pessoa','todos')">Todos</button>
        <button class="chip ${state.agendaFilter.pessoa==='minhas'?'active':''}" onclick="EVENTOS.agendaFilter('pessoa','minhas')">Minhas</button>
        ${pessoas.map(p=>`<button class="chip ${state.agendaFilter.pessoa===p?'active':''}" data-pessoa="${esc(p)}" onclick="EVENTOS.agendaFilter('pessoa',this.dataset.pessoa)">${esc(p)}</button>`).join('')}
        <select class="field agenda-select" onchange="EVENTOS.agendaFilter('tipo',this.value)"><option value="todos">Todos os tipos</option>${['Ligação','Visita','Proposta','Follow-up','Reunião','Evento','Outros'].map(t=>`<option ${state.agendaFilter.tipo===t?'selected':''}>${t}</option>`).join('')}</select>
        <select class="field agenda-select" onchange="EVENTOS.agendaFilter('status',this.value)"><option value="todos">Todos status</option><option value="pendente" ${state.agendaFilter.status==='pendente'?'selected':''}>Pendentes</option><option value="concluida" ${state.agendaFilter.status==='concluida'?'selected':''}>Concluídas</option></select>
      </div>
      <div class="agenda-list premium-block">
        ${list.length?list.map(a=>agendaCard(a)).join(''):'<div class="week-empty"><b>Nenhuma atividade encontrada.</b><br><span>Use o botão Nova Atividade para organizar a agenda da equipe.</span></div>'}
      </div>
    </div>`;
}
function agendaCard(a){
  const st=agendaStatus(a);
  const isPriv=a.visibilidade!=='compartilhada';
  return `<div class="agenda-item ${a.status==='concluida'?'done':''} ${st==='Atrasada'?'late':''}" onclick="EVENTOS.viewAgenda('${a.id}')">
    <div class="agenda-time"><b>${a.hora||'--:--'}</b><span>${shortDate(a.data)}</span></div>
    <div class="agenda-main"><b>${esc(a.titulo)}</b><p>${esc(a.descricao||'')}</p><small>👤 ${esc(a.criador||'Equipe')} · ${esc(a.tipo||'Atividade')}</small></div>
    <div class="agenda-tags"><span class="visibility ${isPriv?'private':'shared'}">${isPriv?'🔒 Pessoal':'🌐 Compartilhada'}</span><span class="status-dot ${st.toLowerCase()}">${st}</span></div>
    <button class="agenda-more" onclick="event.stopPropagation();EVENTOS.viewAgenda('${a.id}')">⋮</button>
  </div>`;
}
function agendaFormHtml(a={}){
  const pessoas=agendaPessoas();
  const user=a.criador||currentUser();
  return `<div class="form-grid agenda-form"><div class="span2"><label>Título da atividade</label><input class="field" id="ag_titulo" value="${esc(a.titulo||'')}" placeholder="Ex: Ligar para cliente"></div><div><label>Data</label><input class="field" type="date" id="ag_data" value="${a.data||new Date().toISOString().slice(0,10)}"></div><div><label>Horário</label><input class="field" type="time" id="ag_hora" value="${a.hora||'09:00'}"></div><div><label>Tipo</label><select class="field" id="ag_tipo">${['Ligação','Visita','Proposta','Follow-up','Reunião','Evento','Outros'].map(t=>`<option ${t===(a.tipo||'Follow-up')?'selected':''}>${t}</option>`).join('')}</select></div><div><label>Responsável / Criado por</label><select class="field" id="ag_criador">${pessoas.map(p=>`<option ${p===user?'selected':''}>${esc(p)}</option>`).join('')}</select></div><div class="span2"><label>Visibilidade</label><div class="visibility-choice"><button type="button" class="vis-btn ${a.visibilidade!=='compartilhada'?'active':''}" onclick="EVENTOS.setAgendaVisibility('privada')">🔒<b>Pessoal</b><span>Apenas neste dispositivo</span></button><button type="button" class="vis-btn ${a.visibilidade==='compartilhada'?'active':''}" onclick="EVENTOS.setAgendaVisibility('compartilhada')">🌐<b>Compartilhada</b><span>Todos podem ver</span></button></div><input type="hidden" id="ag_visibilidade" value="${a.visibilidade||'privada'}"></div><div class="span2"><label>Status</label><select class="field" id="ag_status"><option value="pendente" ${a.status!=='concluida'?'selected':''}>Pendente</option><option value="concluida" ${a.status==='concluida'?'selected':''}>Concluída</option></select></div><div class="span4"><label>Descrição / observação</label><textarea class="field" id="ag_desc" placeholder="Detalhes da atividade...">${esc(a.descricao||'')}</textarea></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveAgendaForm('${a.id||''}')">Salvar atividade</button>`;
}
function collectAgenda(id){return {id:id||agUid(),titulo:($('ag_titulo').value||'Atividade sem título').trim(),data:$('ag_data').value||new Date().toISOString().slice(0,10),hora:$('ag_hora').value||'',tipo:$('ag_tipo').value,criador:$('ag_criador').value||currentUser(),visibilidade:$('ag_visibilidade').value||'privada',status:$('ag_status').value||'pendente',descricao:$('ag_desc').value.trim(),deviceId:id?(state.agenda.find(a=>a.id===id)?.deviceId||deviceId()):deviceId(),criadoEm:id?(state.agenda.find(a=>a.id===id)?.criadoEm||new Date().toISOString()):new Date().toISOString(),atualizadoEm:new Date().toISOString()};}

function renderSheets(){ $('sheets').innerHTML=`<div class="grid-2"><div class="panel"><h3>Integração Google Sheets</h3><p class="muted">Esta versão inclui o arquivo <b>AppsScript_Eventos_Isolado.gs</b>. Cole esse script na planilha para receber os dados exportados do módulo Eventos.</p><button class="btn" onclick="EVENTOS.exportCSV()">Baixar CSV agora</button><div class="divider"></div><p class="muted">Abas sugeridas: Eventos, Clientes, Pacotes, Vendas, Recuperação, Dashboard e Configurações.</p></div><div class="panel"><h3>Segurança da integração</h3><p class="muted">O módulo salva no caminho isolado <b>/eventos_premium</b> no Firebase e usa localStorage como fallback. Nenhum caminho antigo de frequência, escala, mapa ou freelance é alterado.</p><button class="btn alt" onclick="EVENTOS.firebaseSync()">Tentar sincronizar Firebase</button></div></div>`; }
function renderCalendar(){
  const now=new Date();
  const year=Number(state.cal.year)||Number($('ano').value)||now.getFullYear();
  const month=Number(state.cal.month)||Number($('mes').value)||now.getMonth()+1;
  state.cal={year,month};
  const list=filtered().filter(e=>String(e.data||'').slice(0,7)===`${year}-${String(month).padStart(2,'0')}`).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  const first=new Date(year,month-1,1);const last=new Date(year,month,0);
  const blanks=(first.getDay()+6)%7;
  const days=[];
  for(let b=0;b<blanks;b++)days.push(`<div class="day empty"></div>`);
  for(let i=1;i<=last.getDate();i++){
    const iso=`${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const evs=list.filter(e=>e.data===iso);
    days.push(`<div class="day ${evs.length?'has-events':''}"><b>${i} <span>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(iso+'T12:00').getDay()]}</span></b>${evs.map(e=>`<div class="ev ${statusClass(e.status)}" onclick="EVENTOS.view('${e.id}')">${e.cliente}<br>${horario(e)} · ${e.turno} · ${e.pessoas||'-'}p</div>`).join('')}</div>`);
  }
  const years=[...new Set([...state.eventos.map(e=>Number(e.ano||String(e.data).slice(0,4))).filter(Boolean),2026,2027,new Date().getFullYear()])].sort();
  $('calendario').innerHTML=`<div class="calendar-head premium-panel">
    <div><span class="eyebrow">Agenda visual</span><h3>Calendário de eventos</h3></div>
    <div class="calendar-controls">
      <select class="field" onchange="EVENTOS.setCalendar(this.value,null)">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${month===i+1?'selected':''}>${monthName(i+1)}</option>`).join('')}</select>
      <select class="field" onchange="EVENTOS.setCalendar(null,this.value)">${years.map(y=>`<option ${year===y?'selected':''}>${y}</option>`).join('')}</select>
    </div>
  </div>
  <div class="calendar-weekdays"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
  <div class="calendar-grid visual-calendar">${days.join('')}</div>`;
}
function render(){document.body.dataset.tab=state.tab;setupTabs();document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$(state.tab).classList.add('active');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));renderHero();({dashboard:renderDashboard,funil:renderFunil,calendario:renderCalendar,vendas:renderVendas,recuperacao:renderRecuperacao,clientes:renderClientes,pacotes:renderPacotes,agenda:renderAgenda,sheets:renderSheets}[state.tab]||renderDashboard)();}
function formHtml(e={}){const packs=['A definir',...new Set(state.pacotes.map(p=>p.nome.replace('Menu ','')))];return `<div class="form-grid"><div><label>Cliente</label><input class="field" id="f_cliente" value="${esc(e.cliente||'')}"></div><div><label>Telefone</label><input class="field" id="f_telefone" value="${esc(e.telefone||'')}"></div><div><label>Data</label><input class="field" type="date" id="f_data" value="${e.data||''}"></div><div><label>Horário</label><input class="field" type="time" id="f_horario" value="${e.horario||''}"></div><div><label>Status</label><select class="field" id="f_status">${STATUS.map(s=>`<option ${s===(e.status||'Lead')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Origem</label><select class="field" id="f_origem"><option>${e.origem||'WhatsApp'}</option><option>Instagram</option><option>Telefone</option><option>Anúncio</option><option>Indicação</option><option>Presencial</option></select></div><div><label>Tipo</label><input class="field" id="f_tipo" value="${esc(e.tipo||'Evento')}"></div><div><label>Turno</label><select class="field" id="f_turno">${['Almoço','Jantar','Ambos','A definir'].map(s=>`<option ${s===(e.turno||'A definir')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Pessoas</label><input class="field" type="number" id="f_pessoas" value="${e.pessoas||''}"></div><div><label>Pacote</label><select class="field" id="f_pacote">${packs.map(p=>`<option ${p===(e.pacote||'A definir')?'selected':''}>${p}</option>`).join('')}</select></div><div><label>Valor por pessoa</label><input class="field" type="number" step="0.01" id="f_valorPessoa" value="${e.valorPessoa||0}"></div><div><label>Taxa serviço %</label><input class="field" type="number" step="0.01" id="f_taxa" value="${e.taxaServicoPct??13}"></div><div><label>Gorjeta</label><input class="field" type="number" step="0.01" id="f_gorjeta" value="${e.gorjeta||0}"></div><div class="span2"><label>Salão</label><select class="field" id="f_unidade">${['Salão Vasto','Salão Barra','Salão Beira Mar','Varanda','Salão Barra + Beira Mar + Varanda','A definir'].map(s=>`<option ${s===(e.unidade||'A definir')?'selected':''}>${s}</option>`).join('')}</select></div><div class="span2"><label>Valor estimado</label><input class="field" type="number" step="0.01" id="f_valorEstimado" value="${e.valorEstimado||0}"></div><div class="span4"><label>Observações / andamento</label><textarea class="field" id="f_obs">${esc(e.observacoes||'')}</textarea></div><div class="span4 directors-box"><label>Assinatura da diretoria</label>${[0,1,2].map(i=>{const d=(e.diretores||[])[i]||{};return `<div class="director-row"><input class="field" id="f_dir_nome_${i}" placeholder="Nome do diretor" value="${esc(d.nome||'')}"><span>Assinou?</span><input type="checkbox" id="f_dir_ok_${i}" ${d.assinado?'checked':''}></div>`}).join('')}<p class="muted" style="margin:8px 0 0;font-size:11px">Marque cada diretor que assinou. Quando todos estiverem OK, o evento pode avançar para Fechado.</p></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveForm('${e.id||''}')">Salvar evento</button>`}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function collect(id){const data=$('f_data').value;return{id:id||uid(),ano:data?Number(data.slice(0,4)):new Date().getFullYear(),data:data||new Date().toISOString().slice(0,10),horario:$('f_horario')?$('f_horario').value:'',cliente:$('f_cliente').value.trim()||'Cliente não informado',telefone:$('f_telefone').value.trim(),origem:$('f_origem').value,unidade:$('f_unidade').value,tipo:$('f_tipo').value,turno:$('f_turno').value,pessoas:Number($('f_pessoas').value)||null,pacote:$('f_pacote').value,status:$('f_status').value,valorPessoa:Number($('f_valorPessoa').value)||0,taxaServicoPct:Number($('f_taxa').value)||0,gorjeta:Number($('f_gorjeta').value)||0,valorEstimado:Number($('f_valorEstimado').value)||0,observacoes:$('f_obs').value.trim(),diretores:[0,1,2].map(i=>({nome:($('f_dir_nome_'+i)?.value||'').trim(),assinado:!!$('f_dir_ok_'+i)?.checked})).filter(d=>d.nome),atualizadoEm:new Date().toISOString()};}
window.EVENTOS={
  tab(id){state.tab=id;document.body.classList.remove('menu-open');render()},
  setCalendar(month,year){if(month)state.cal.month=Number(month); if(year)state.cal.year=Number(year); renderCalendar();},
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
  agendaFilter(k,v){state.agendaFilter[k]=v;renderAgenda();},
  openAgendaForm(){ $('modalTitle').textContent='Nova Atividade'; $('modalBody').innerHTML=agendaFormHtml(); $('modal').classList.add('open');},
  editAgenda(id){const a=state.agenda.find(x=>x.id===id); if(!a)return; $('modalTitle').textContent='Editar Atividade'; $('modalBody').innerHTML=agendaFormHtml(a); $('modal').classList.add('open');},
  setAgendaVisibility(v){const input=$('ag_visibilidade'); if(input)input.value=v; document.querySelectorAll('.vis-btn').forEach(b=>b.classList.remove('active')); const buttons=document.querySelectorAll('.vis-btn'); if(v==='compartilhada'&&buttons[1])buttons[1].classList.add('active'); if(v!=='compartilhada'&&buttons[0])buttons[0].classList.add('active');},
  saveAgendaForm(id){const a=collectAgenda(id); const idx=state.agenda.findIndex(x=>x.id===a.id); if(idx>=0)state.agenda[idx]=Object.assign({},state.agenda[idx],a); else state.agenda.unshift(a); localStorage.setItem('eventos_usuario_nome',a.criador); saveAgenda(); $('modal').classList.remove('open'); toast('Atividade salva'); render();},
  viewAgenda(id){const a=state.agenda.find(x=>x.id===id); if(!a)return; const st=agendaStatus(a); $('modalTitle').textContent=a.titulo; $('modalBody').innerHTML=`<div class="agenda-detail"><div class="kpi-grid"><div class="kpi"><div class="label">Data</div><div class="value">${dow(a.data)} ${shortDate(a.data)}<br><span style="font-size:16px;color:var(--sub)">${a.hora||'--:--'}</span></div></div><div class="kpi"><div class="label">Status</div><div class="value" style="font-size:20px">${st}</div></div><div class="kpi"><div class="label">Responsável</div><div class="value" style="font-size:20px">${esc(a.criador||'-')}</div></div><div class="kpi"><div class="label">Visibilidade</div><div class="value" style="font-size:18px">${a.visibilidade==='compartilhada'?'🌐 Compartilhada':'🔒 Pessoal'}</div></div></div><div class="panel" style="margin-top:14px"><p><b>Tipo:</b> ${esc(a.tipo||'-')}</p><p><b>Criado em:</b> ${new Date(a.criadoEm||Date.now()).toLocaleString('pt-BR')}</p><div class="divider"></div><p style="white-space:pre-wrap">${esc(a.descricao||'Sem observação')}</p></div><br><button class="btn" onclick="EVENTOS.editAgenda('${a.id}')">Editar</button> <button class="btn alt" onclick="EVENTOS.toggleAgendaDone('${a.id}')">${a.status==='concluida'?'Reabrir':'Marcar como concluída'}</button></div>`; $('modal').classList.add('open');},
  toggleAgendaDone(id){const a=state.agenda.find(x=>x.id===id); if(!a)return; a.status=a.status==='concluida'?'pendente':'concluida'; a.atualizadoEm=new Date().toISOString(); saveAgenda(); $('modal').classList.remove('open'); toast('Agenda atualizada'); render();},
  openForm(){ $('modalTitle').textContent='Novo Evento'; $('modalBody').innerHTML=formHtml(); $('modal').classList.add('open');},
  edit(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; $('modalTitle').textContent='Editar Evento'; $('modalBody').innerHTML=formHtml(e); $('modal').classList.add('open');},
  saveForm(id){const e=collect(id); const idx=state.eventos.findIndex(x=>x.id===e.id); if(idx>=0)state.eventos[idx]=Object.assign({},state.eventos[idx],e); else state.eventos.unshift(e); save(); $('modal').classList.remove('open'); toast('Evento salvo'); render();},
  view(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; const wa=e.telefone?`<a class="whats" target="_blank" href="https://wa.me/${String(e.telefone).replace(/\D/g,'')}">Abrir WhatsApp</a>`:''; $('modalTitle').textContent=e.cliente; $('modalBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><div class="label">Data</div><div class="value">${dow(e.data)} ${shortDate(e.data)}<br><span style="font-size:16px;color:var(--sub)">${horario(e)}</span></div></div><div class="kpi"><div class="label">Valor estimado</div><div class="value">${brl(e.valorEstimado)}</div></div><div class="kpi"><div class="label">Pessoas</div><div class="value">${e.pessoas||'-'}</div></div><div class="kpi"><div class="label">Status</div><div class="value" style="font-size:20px">${e.status}</div></div></div><div class="panel" style="margin-top:14px"><p><b>Telefone:</b> ${e.telefone||'-'} ${wa}</p><p><b>Tipo:</b> ${e.tipo} · <b>Turno:</b> ${e.turno} · <b>Pacote:</b> ${e.pacote}</p><p><b>Unidade/Salão:</b> ${e.unidade||'-'}</p><p><b>Origem:</b> ${e.origem||e.origemPlanilha||'-'}</p><p><b>Diretoria:</b> ${(e.diretores&&e.diretores.length)?e.diretores.map(d=>`${esc(d.nome)} ${d.assinado?'✅':'⏳'}`).join(' · '):'Não cadastrada'}</p><div class="divider"></div><p style="white-space:pre-wrap">${esc(e.observacoes||'')}</p></div><br><button class="btn" onclick="EVENTOS.edit('${e.id}')">Editar</button>`; $('modal').classList.add('open');},
  closeModal(){ $('modal').classList.remove('open');},
  markRecuperado(id){const e=state.eventos.find(x=>x.id===id); if(e){e.status='Proposta enviada';e.observacoes=(e.observacoes||'')+'\n\n[RECUPERAÇÃO] Cliente reativado em '+new Date().toLocaleDateString('pt-BR');save();toast('Cliente movido para proposta');render();}},
  whats(id){const e=state.eventos.find(x=>x.id===id); if(!e||!e.telefone)return toast('Telefone não cadastrado'); window.open(`https://wa.me/${String(e.telefone).replace(/\D/g,'')}?text=${encodeURIComponent('Olá, tudo bem? Estou entrando em contato sobre sua proposta de evento no Coco Bambu.')}`,'_blank');},
  seedReset(){if(confirm('Recarregar a base importada da planilha? Eventos cadastrados manualmente serão mantidos.')){const manual=state.eventos.filter(e=>!e.importado);state.eventos=dedupeEventos([...(window.EVENTOS_SEED||[]).map(e=>({...e,importado:true})),...manual]);save();toast('Base 2026/2027 recarregada');setupFilters();render();}},
  exportCSV(){const cols=['data','horario','cliente','telefone','unidade','tipo','turno','pessoas','pacote','status','valorPessoa','taxaServicoPct','valorEstimado','gorjeta','origemPlanilha','observacoes'];const csv=[cols.join(';')].concat(state.eventos.map(e=>cols.map(c=>'"'+String(e[c]??'').replace(/"/g,'""').replace(/\n/g,' | ')+'"').join(';'))).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='eventos_premium_export.csv';a.click();URL.revokeObjectURL(a.href);},
  async firebaseSync(){if(!window.EventosFirebase)return toast('Firebase não carregado'); const ok=await EventosFirebase.init(); if(!ok)return toast('Firebase indisponível nesta abertura'); await EventosFirebase.saveAll(state.eventos); toast('Eventos enviados para /eventos_premium');},
};
function boot(){
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;if(!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),1200);}});
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(!standalone&&!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),2200);}
  load();setupTabs();setupFilters();render(); if(window.EventosFirebase){EventosFirebase.init().then(ok=>{if(ok){EventosFirebase.listen(arr=>{if(Array.isArray(arr)&&arr.length){state.eventos=arr;localStorage.setItem(STORE,JSON.stringify(arr));setupFilters();render();}}); if(EventosFirebase.listenAgenda)EventosFirebase.listenAgenda(arr=>{if(Array.isArray(arr)){state.agenda=arr;localStorage.setItem(AGENDA_STORE,JSON.stringify(arr));render();}});}});}}
document.addEventListener('DOMContentLoaded',boot);
})();

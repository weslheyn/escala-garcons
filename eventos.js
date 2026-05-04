(function(){
'use strict';
const $=id=>document.getElementById(id);
const STORE='eventos_premium_v54';
const META='eventos_premium_meta_v54';
let deferredInstallPrompt=null;
const STATUS=['Lead','Proposta enviada','Negociação 1','Negociação 2','Reunião de alinhamento','Contrato enviado','Assinatura cliente','Assinatura diretoria','Fechado','Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'];
const TABS=[['dashboard','Dashboard'],['funil','Funil'],['calendario','Calendário'],['vendas','Vendas'],['recuperacao','Recuperação'],['clientes','Clientes'],['pacotes','Pacotes'],['sheets','Google Sheets']];
let state={tab:'dashboard',eventos:[],pacotes:window.EVENTOS_PACOTES||[],meta:{metaMensal:150000}};
function brl(n){return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dt(s){ if(!s) return ''; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`;}
function monthName(m){return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1]||'';}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function toast(t){const el=$('toast'); el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500);}
function uid(){return 'ev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function save(){localStorage.setItem(STORE,JSON.stringify(state.eventos));localStorage.setItem(META,JSON.stringify(state.meta)); if(window.EventosFirebase&&EventosFirebase.enabled) EventosFirebase.saveAll(state.eventos).catch(()=>{});}
function load(){
  const saved=localStorage.getItem(STORE);
  if(saved){try{state.eventos=JSON.parse(saved)||[]}catch(e){state.eventos=[]}}
  else{state.eventos=(window.EVENTOS_SEED||[]).map(e=>({...e,importado:true}));localStorage.setItem(STORE,JSON.stringify(state.eventos));}
  try{state.meta=Object.assign(state.meta,JSON.parse(localStorage.getItem(META)||'{}'))}catch(e){}
}
function filtered(){
  const q=norm($('q').value), ano=$('ano').value, st=$('status').value, turno=$('turno').value, pacote=$('pacote').value, mes=$('mes').value;
  return state.eventos.filter(e=>{
    const hay=norm([e.cliente,e.telefone,e.tipo,e.turno,e.pacote,e.status,e.observacoes,e.unidade].join(' '));
    return (!q||hay.includes(q))&&(!ano||String(e.ano||String(e.data).slice(0,4))===ano)&&(!st||e.status===st)&&(!turno||e.turno===turno)&&(!pacote||e.pacote===pacote)&&(!mes||String(Number(String(e.data).slice(5,7)))===mes);
  });
}
function statusClass(s){const n=norm(s); if(n.includes('fechado'))return's-fechado'; if(n.includes('perdido'))return's-perdido'; if(n.includes('cancel'))return's-cancelado'; if(n.includes('sem resposta')||n.includes('recupera'))return's-semresposta'; if(n.includes('contrato')||n.includes('assinatura'))return's-contrato'; if(n.includes('proposta'))return's-proposta'; if(n.includes('reuniao'))return's-reuniao'; return's-neg';}
function isRecuperacaoStatus(s){return ['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'].includes(s);}
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
  const fechados=list.filter(e=>e.status==='Fechado').length;
  const recuperar=list.filter(e=>isRecuperacaoStatus(e.status)).length;
  const almoco=list.filter(e=>e.turno==='Almoço').reduce((s,e)=>s+(Number(e.valorEstimado)||0),0);
  const jantar=list.filter(e=>e.turno==='Jantar').reduce((s,e)=>s+(Number(e.valorEstimado)||0),0);
  return{total,gorjeta,fechados,recuperar,almoco,jantar,count:list.length,ticket:list.length?total/list.length:0,conv:list.length?fechados/list.length*100:0};
}
function groupBy(list,key){return list.reduce((a,e)=>{const k=typeof key==='function'?key(e):(e[key]||'A definir');a[k]=(a[k]||0)+(Number(e.valorEstimado)||1);return a;},{});}
function bars(obj,labelMoney=true){const arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,8);const max=Math.max(1,...arr.map(x=>x[1]));return arr.map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${Math.max(4,v/max*100)}%"></i></div><strong>${labelMoney?brl(v):v}</strong></div>`).join('')||'<p class="muted">Sem dados no filtro atual.</p>';}
function renderHero(){const c=calc(state.eventos);$('heroTotal').textContent=brl(c.total);$('heroEventos').textContent=c.count;$('heroFechados').textContent=c.fechados;$('heroRecuperar').textContent=c.recuperar;renderWeekEvents();}
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
  let list=state.eventos.filter(e=>e.status==='Fechado'&&e.data>=wb.start&&e.data<=wb.end).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  let title='';
  if(!list.length){
    list=state.eventos.filter(e=>e.status==='Fechado').sort((a,b)=>String(a.data).localeCompare(String(b.data))).slice(0,8);
    title='Últimos fechados cadastrados';
  }
  wrap.innerHTML=list.length?list.map(e=>`<div class="week-event" onclick="EVENTOS.view('${e.id}')"><span class="date">${title||dt(e.data)} · ${e.turno||'A definir'}</span><b>${esc(e.cliente||'Cliente')}</b><p>${esc(e.tipo||'Evento')} · ${e.pessoas||'-'} pessoas<br>${esc(e.pacote||'A definir')}</p><span class="money">${brl(e.valorEstimado)}</span></div>`).join(''):`<div class="week-empty"><b>Nenhum evento fechado nesta semana.</b><br><span>Quando um evento for marcado como Fechado, ele aparecerá aqui automaticamente.</span></div>`;
}
function renderDashboard(){const list=filtered(),c=calc(list);const byTurno=groupBy(list,'turno'),byPkg=groupBy(list,'pacote'),byStatus=groupBy(list,'status');const byDow=groupBy(list,e=>{const d=new Date(e.data+'T12:00:00');return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];});const meta=Number(state.meta.metaMensal)||0;const pct=meta?Math.min(100,c.total/meta*100):0;
$('dashboard').innerHTML=`<div class="kpi-grid"><div class="kpi"><div class="label">Total estimado</div><div class="value">${brl(c.total)}</div><div class="hint">Planilha + novos eventos</div></div><div class="kpi"><div class="label">Almoço</div><div class="value">${brl(c.almoco)}</div><div class="hint">Vendas/eventos almoço</div></div><div class="kpi"><div class="label">Jantar</div><div class="value">${brl(c.jantar)}</div><div class="hint">Vendas/eventos jantar</div></div><div class="kpi"><div class="label">Gorjeta</div><div class="value">${brl(c.gorjeta)}</div><div class="hint">Campo editável por evento</div></div><div class="kpi"><div class="label">Eventos</div><div class="value">${c.count}</div><div class="hint">${c.fechados} fechados</div></div><div class="kpi"><div class="label">Ticket médio</div><div class="value">${brl(c.ticket)}</div><div class="hint">Estimativa por evento</div></div><div class="kpi"><div class="label">Conversão</div><div class="value">${c.conv.toFixed(1)}%</div><div class="hint">Fechados / total</div></div><div class="kpi"><div class="label">Meta mensal</div><div class="value">${pct.toFixed(0)}%</div><div class="hint"><input class="field" style="margin-top:6px;width:100%" type="number" value="${meta}" onchange="EVENTOS.setMeta(this.value)"></div></div></div><div class="grid-2"><div class="panel"><h3>Vendas por pacote/proposta</h3>${bars(byPkg)}</div><div class="panel"><h3>Dias da semana</h3>${bars(byDow)}</div><div class="panel"><h3>Turnos</h3>${bars(byTurno)}</div><div class="panel"><h3>Status do funil</h3>${bars(byStatus)}</div></div>`;
}
function card(e){return `<div class="event-card"><b>${e.cliente||'Cliente'}</b><p>${dt(e.data)} · ${e.turno||'A definir'} · ${e.pessoas||'-'} pessoas<br>${e.tipo||'Evento'} · ${e.pacote||'A definir'} · ${brl(e.valorEstimado)}</p><span class="status ${statusClass(e.status)}">${e.status||'Em negociação'}</span><div class="small">${e.unidade||''}</div><div class="actions"><button onclick="EVENTOS.view('${e.id}')">Ver</button><button onclick="EVENTOS.edit('${e.id}')">Editar</button></div></div>`}
function renderFunil(){const list=filtered();$('funil').innerHTML=`<div class="kanban">${STATUS.map(st=>`<div class="col"><h3>${st} · ${list.filter(e=>e.status===st).length}</h3>${list.filter(e=>e.status===st).map(card).join('')||'<p class="muted">Sem eventos</p>'}</div>`).join('')}</div>`;}
function renderVendas(){const list=filtered().sort((a,b)=>String(a.data).localeCompare(String(b.data)));$('vendas').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Status</th><th>Turno</th><th>Pessoas</th><th>Pacote</th><th>Valor estimado</th><th>Gorjeta</th><th>Ações</th></tr></thead><tbody>${list.map(e=>`<tr><td>${dt(e.data)}</td><td><b>${e.cliente}</b><br><span class="muted">${e.telefone||''}</span></td><td><span class="status ${statusClass(e.status)}">${e.status}</span></td><td>${e.turno}</td><td>${e.pessoas||''}</td><td>${e.pacote}</td><td>${brl(e.valorEstimado)}</td><td>${brl(e.gorjeta)}</td><td><button class="btn alt" onclick="EVENTOS.view('${e.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`;}
function renderRecuperacao(){const list=filtered().filter(e=>isRecuperacaoStatus(e.status));const cols=['Recuperação','Sem resposta','Cancelado','Perdido','Perdido/Cancelado'];$('recuperacao').innerHTML=`<div class="panel"><h3>Clientes para recuperar</h3><p class="muted">Use essa lista para recontato de propostas paradas, canceladas, perdidas ou sem resposta.</p></div><br><div class="kanban recuperacao-kanban" style="grid-template-columns:repeat(5,minmax(260px,1fr))">${cols.map(st=>`<div class="col"><h3>${st} · ${list.filter(e=>e.status===st).length}</h3>${list.filter(e=>e.status===st).map(e=>card(e).replace('</div>','<div class="actions"><button onclick="EVENTOS.whats(\''+e.id+'\')">WhatsApp</button><button onclick="EVENTOS.markRecuperado(\''+e.id+'\')">Recuperado</button></div></div>')).join('')||'<p class="muted">Sem clientes</p>'}</div>`).join('')}</div>`;}
function renderClientes(){const map={}; filtered().forEach(e=>{const k=e.cliente||'Cliente'; if(!map[k])map[k]={q:0,total:0,last:e.data,tel:e.telefone}; map[k].q++; map[k].total+=Number(e.valorEstimado)||0; if(e.data>map[k].last)map[k].last=e.data; if(e.telefone)map[k].tel=e.telefone;});const arr=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);$('clientes').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Eventos</th><th>Total estimado</th><th>Último evento</th></tr></thead><tbody>${arr.map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v.tel||''}</td><td>${v.q}</td><td>${brl(v.total)}</td><td>${dt(v.last)}</td></tr>`).join('')}</tbody></table></div>`;}
function renderPacotes(){$('pacotes').innerHTML=`<div class="package-grid">${state.pacotes.map(p=>`<div class="package"><h3>${p.nome}</h3><div class="price">${brl(p.valorSemana)} / ${brl(p.valorFimSemana)}</div><p><b>${p.categoria}</b> · ${p.servico} · ${p.duracao}<br>Mínimo: ${p.minPessoas} pessoas · Taxa: ${p.taxaServicoPct}%</p><p>${p.resumo}</p></div>`).join('')}</div>`;}
function renderSheets(){ $('sheets').innerHTML=`<div class="grid-2"><div class="panel"><h3>Integração Google Sheets</h3><p class="muted">Esta versão inclui o arquivo <b>AppsScript_Eventos_Isolado.gs</b>. Cole esse script na planilha para receber os dados exportados do módulo Eventos.</p><button class="btn" onclick="EVENTOS.exportCSV()">Baixar CSV agora</button><div class="divider"></div><p class="muted">Abas sugeridas: Eventos, Clientes, Pacotes, Vendas, Recuperação, Dashboard e Configurações.</p></div><div class="panel"><h3>Segurança da integração</h3><p class="muted">O módulo salva no caminho isolado <b>/eventos_premium</b> no Firebase e usa localStorage como fallback. Nenhum caminho antigo de frequência, escala, mapa ou freelance é alterado.</p><button class="btn alt" onclick="EVENTOS.firebaseSync()">Tentar sincronizar Firebase</button></div></div>`; }
function renderCalendar(){const list=filtered().sort((a,b)=>String(a.data).localeCompare(String(b.data)));const now=new Date();const year=Number($('ano').value)||now.getFullYear();const month=Number($('mes').value)||now.getMonth()+1;const first=new Date(year,month-1,1);const last=new Date(year,month,0);const days=[];for(let i=1;i<=last.getDate();i++){const iso=`${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;const evs=list.filter(e=>e.data===iso);days.push(`<div class="day"><b>${i} · ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(iso+'T12:00').getDay()]}</b>${evs.map(e=>`<div class="ev" onclick="EVENTOS.view('${e.id}')">${e.cliente}<br>${e.turno} · ${e.pessoas||'-'}p</div>`).join('')}</div>`)}$('calendario').innerHTML=`<div class="panel"><h3>Calendário ${monthName(month)}/${year}</h3><p class="muted">Use os filtros de ano e mês acima para navegar em 2026 e 2027.</p></div><br><div class="calendar-grid">${days.join('')}</div>`;}
function render(){setupTabs();document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$(state.tab).classList.add('active');renderHero();({dashboard:renderDashboard,funil:renderFunil,calendario:renderCalendar,vendas:renderVendas,recuperacao:renderRecuperacao,clientes:renderClientes,pacotes:renderPacotes,sheets:renderSheets}[state.tab]||renderDashboard)();}
function formHtml(e={}){const packs=['A definir',...new Set(state.pacotes.map(p=>p.nome.replace('Menu ','')))];return `<div class="form-grid"><div><label>Cliente</label><input class="field" id="f_cliente" value="${esc(e.cliente||'')}"></div><div><label>Telefone</label><input class="field" id="f_telefone" value="${esc(e.telefone||'')}"></div><div><label>Data</label><input class="field" type="date" id="f_data" value="${e.data||''}"></div><div><label>Status</label><select class="field" id="f_status">${STATUS.map(s=>`<option ${s===(e.status||'Lead')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Origem</label><select class="field" id="f_origem"><option>${e.origem||'WhatsApp'}</option><option>Instagram</option><option>Telefone</option><option>Anúncio</option><option>Indicação</option><option>Presencial</option></select></div><div><label>Tipo</label><input class="field" id="f_tipo" value="${esc(e.tipo||'Evento')}"></div><div><label>Turno</label><select class="field" id="f_turno">${['Almoço','Jantar','Ambos','A definir'].map(s=>`<option ${s===(e.turno||'A definir')?'selected':''}>${s}</option>`).join('')}</select></div><div><label>Pessoas</label><input class="field" type="number" id="f_pessoas" value="${e.pessoas||''}"></div><div><label>Pacote</label><select class="field" id="f_pacote">${packs.map(p=>`<option ${p===(e.pacote||'A definir')?'selected':''}>${p}</option>`).join('')}</select></div><div><label>Valor por pessoa</label><input class="field" type="number" step="0.01" id="f_valorPessoa" value="${e.valorPessoa||0}"></div><div><label>Taxa serviço %</label><input class="field" type="number" step="0.01" id="f_taxa" value="${e.taxaServicoPct??13}"></div><div><label>Gorjeta</label><input class="field" type="number" step="0.01" id="f_gorjeta" value="${e.gorjeta||0}"></div><div class="span2"><label>Salão / Unidade</label><input class="field" id="f_unidade" value="${esc(e.unidade||'Coco Bambu Barra')}"></div><div class="span2"><label>Valor estimado</label><input class="field" type="number" step="0.01" id="f_valorEstimado" value="${e.valorEstimado||0}"></div><div class="span4"><label>Observações / andamento</label><textarea class="field" id="f_obs">${esc(e.observacoes||'')}</textarea></div></div><div class="divider"></div><button class="btn" onclick="EVENTOS.saveForm('${e.id||''}')">Salvar evento</button>`}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function collect(id){const data=$('f_data').value;return{id:id||uid(),ano:data?Number(data.slice(0,4)):new Date().getFullYear(),data:data||new Date().toISOString().slice(0,10),cliente:$('f_cliente').value.trim()||'Cliente não informado',telefone:$('f_telefone').value.trim(),origem:$('f_origem').value,unidade:$('f_unidade').value,tipo:$('f_tipo').value,turno:$('f_turno').value,pessoas:Number($('f_pessoas').value)||null,pacote:$('f_pacote').value,status:$('f_status').value,valorPessoa:Number($('f_valorPessoa').value)||0,taxaServicoPct:Number($('f_taxa').value)||0,gorjeta:Number($('f_gorjeta').value)||0,valorEstimado:Number($('f_valorEstimado').value)||0,observacoes:$('f_obs').value.trim(),atualizadoEm:new Date().toISOString()};}
window.EVENTOS={
  tab(id){state.tab=id;render()},
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
  openForm(){ $('modalTitle').textContent='Novo Evento'; $('modalBody').innerHTML=formHtml(); $('modal').classList.add('open');},
  edit(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; $('modalTitle').textContent='Editar Evento'; $('modalBody').innerHTML=formHtml(e); $('modal').classList.add('open');},
  saveForm(id){const e=collect(id); const idx=state.eventos.findIndex(x=>x.id===e.id); if(idx>=0)state.eventos[idx]=Object.assign({},state.eventos[idx],e); else state.eventos.unshift(e); save(); $('modal').classList.remove('open'); toast('Evento salvo'); render();},
  view(id){const e=state.eventos.find(x=>x.id===id); if(!e)return; const wa=e.telefone?`<a class="whats" target="_blank" href="https://wa.me/${String(e.telefone).replace(/\D/g,'')}">Abrir WhatsApp</a>`:''; $('modalTitle').textContent=e.cliente; $('modalBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><div class="label">Data</div><div class="value">${dt(e.data)}</div></div><div class="kpi"><div class="label">Valor estimado</div><div class="value">${brl(e.valorEstimado)}</div></div><div class="kpi"><div class="label">Pessoas</div><div class="value">${e.pessoas||'-'}</div></div><div class="kpi"><div class="label">Status</div><div class="value" style="font-size:20px">${e.status}</div></div></div><div class="panel" style="margin-top:14px"><p><b>Telefone:</b> ${e.telefone||'-'} ${wa}</p><p><b>Tipo:</b> ${e.tipo} · <b>Turno:</b> ${e.turno} · <b>Pacote:</b> ${e.pacote}</p><p><b>Unidade/Salão:</b> ${e.unidade||'-'}</p><p><b>Origem:</b> ${e.origem||e.origemPlanilha||'-'}</p><div class="divider"></div><p style="white-space:pre-wrap">${esc(e.observacoes||'')}</p></div><br><button class="btn" onclick="EVENTOS.edit('${e.id}')">Editar</button>`; $('modal').classList.add('open');},
  closeModal(){ $('modal').classList.remove('open');},
  markRecuperado(id){const e=state.eventos.find(x=>x.id===id); if(e){e.status='Proposta enviada';e.observacoes=(e.observacoes||'')+'\n\n[RECUPERAÇÃO] Cliente reativado em '+new Date().toLocaleDateString('pt-BR');save();toast('Cliente movido para proposta');render();}},
  whats(id){const e=state.eventos.find(x=>x.id===id); if(!e||!e.telefone)return toast('Telefone não cadastrado'); window.open(`https://wa.me/${String(e.telefone).replace(/\D/g,'')}?text=${encodeURIComponent('Olá, tudo bem? Estou entrando em contato sobre sua proposta de evento no Coco Bambu.')}`,'_blank');},
  seedReset(){if(confirm('Recarregar a base importada da planilha? Eventos cadastrados manualmente serão mantidos.')){const manual=state.eventos.filter(e=>!e.importado);state.eventos=[...(window.EVENTOS_SEED||[]).map(e=>({...e,importado:true})),...manual];save();toast('Base 2026/2027 recarregada');setupFilters();render();}},
  exportCSV(){const cols=['data','cliente','telefone','unidade','tipo','turno','pessoas','pacote','status','valorPessoa','taxaServicoPct','valorEstimado','gorjeta','origemPlanilha','observacoes'];const csv=[cols.join(';')].concat(state.eventos.map(e=>cols.map(c=>'"'+String(e[c]??'').replace(/"/g,'""').replace(/\n/g,' | ')+'"').join(';'))).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='eventos_premium_export.csv';a.click();URL.revokeObjectURL(a.href);},
  async firebaseSync(){if(!window.EventosFirebase)return toast('Firebase não carregado'); const ok=await EventosFirebase.init(); if(!ok)return toast('Firebase indisponível nesta abertura'); await EventosFirebase.saveAll(state.eventos); toast('Eventos enviados para /eventos_premium');},
};
function boot(){
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;if(!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),1200);}});
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(!standalone&&!localStorage.getItem('gestao_cb_install_dismissed')){const b=$('installBanner');if(b)setTimeout(()=>b.classList.add('show'),2200);}
  load();setupTabs();setupFilters();render(); if(window.EventosFirebase){EventosFirebase.init().then(ok=>{if(ok)EventosFirebase.listen(arr=>{if(Array.isArray(arr)&&arr.length){state.eventos=arr;localStorage.setItem(STORE,JSON.stringify(arr));setupFilters();render();}});});}}
document.addEventListener('DOMContentLoaded',boot);
})();

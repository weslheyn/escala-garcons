// Calendário de Eventos — módulo premium isolado v33
// Firebase path: calendario_eventos/eventos
// Mantém o core do app intacto: só lê/escreve no nó calendario_eventos.
let _eventosCache = {};
let _eventosListenerStarted = false;
let _eventosView = 'mes';
let _eventosSelectedISO = '';
let _eventosCurrentMonth = null;
let _eventosUnidadeFiltro = '';
let _eventosStatusFiltro = '';

(function eventosInjectPremiumCss(){
  if(document.getElementById('eventosPremiumCss')) return;
  const st = document.createElement('style');
  st.id = 'eventosPremiumCss';
  st.textContent = `
  #eventosPanel{background:linear-gradient(180deg,#080b12 0%,#0c1019 42%,#080a10 100%)}
  #eventosPanel .panel-header{border-bottom:1px solid #d6a300aa;background:#111522;box-shadow:0 8px 22px #0006;position:sticky;top:0;z-index:8}
  .ev-premium-wrap{padding:12px 14px 92px;background:radial-gradient(circle at top right,#d6a30016,transparent 32%),radial-gradient(circle at bottom left,#006d7718,transparent 35%)}
  .ev-hero{background:linear-gradient(145deg,#151926,#0b0e16);border:1px solid #ffffff12;border-radius:22px;padding:15px;box-shadow:0 14px 32px #0008;margin-bottom:12px;position:relative;overflow:hidden}
  .ev-hero:before{content:'';position:absolute;inset:-60px -80px auto auto;width:170px;height:170px;background:#d6a30018;border-radius:50%;filter:blur(8px)}
  .ev-hero-title{font-size:13px;color:#9aa6c6;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.ev-hero-main{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-top:4px}.ev-hero-main b{font-family:'Barlow Condensed',sans-serif;font-size:28px;color:#fff;line-height:1;text-transform:uppercase}.ev-hero-main span{color:#f5c842;font-size:12px;font-weight:900}
  .ev-tabs{display:flex;gap:8px;overflow-x:auto;margin:10px 0 12px}.ev-tabs button{border:1px solid #27314a;background:#111624;color:#8fa0c7;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:900;white-space:nowrap}.ev-tabs button.active{background:#f5c842;color:#171000;border-color:#f5c842;box-shadow:0 0 0 3px #f5c84222}
  .ev-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.ev-controls select,.ev-controls input{background:#151a28;color:#fff;border:1px solid #29344f;border-radius:14px;padding:12px 11px;font-size:12px;font-weight:900;outline:none}.ev-controls .wide{grid-column:1 / -1}
  .ev-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.ev-kpi{background:linear-gradient(145deg,#161b29,#0d111b);border:1px solid #d6a30044;border-radius:18px;padding:11px;min-height:58px}.ev-kpi b{display:block;color:#f5c842;font-size:21px;line-height:1}.ev-kpi span{display:block;color:#93a0bf;font-size:8px;text-transform:uppercase;font-weight:900;margin-top:5px;line-height:1.1}
  .ev-month-card{background:#0f1420;border:1px solid #232d45;border-radius:22px;padding:13px;margin-bottom:12px;box-shadow:0 12px 30px #0007}.ev-month-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.ev-month-head button{background:#151b2b;border:1px solid #2b3654;color:#f5c842;border-radius:12px;padding:8px 10px;font-weight:900}.ev-month-title{font-weight:900;color:#fff;text-align:center}.ev-month-title span{display:block;color:#f5c842;font-size:12px;margin-top:2px}.ev-weekdays,.ev-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.ev-weekdays div{text-align:center;font-size:10px;color:#8fa0c7;font-weight:900;padding:5px 0}.ev-day{min-height:52px;border-radius:15px;background:#101624;border:1px solid #202a42;padding:6px;position:relative;cursor:pointer}.ev-day.muted{opacity:.35}.ev-day.active{border-color:#f5c842;background:#f5c84218;box-shadow:0 0 0 2px #f5c84222}.ev-day.today .ev-num{background:#f5c842;color:#111;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px}.ev-num{font-size:13px;font-weight:900;color:#fff}.ev-dots{position:absolute;left:6px;right:6px;bottom:6px;display:flex;gap:3px;flex-wrap:wrap}.ev-dot{width:6px;height:6px;border-radius:50%}.ev-more{font-size:8px;color:#d8dff7;font-weight:900;line-height:6px}
  .ev-section-title{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 9px;color:#fff;font-weight:900}.ev-section-title small{color:#8fa0c7;font-size:11px}.ev-list{display:flex;flex-direction:column;gap:10px}.ev-card{background:linear-gradient(145deg,#151a27,#0d111a);border:1px solid #26324d;border-left:4px solid #f5c842;border-radius:18px;padding:13px;box-shadow:0 10px 26px #0007}.ev-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.ev-time{color:#fff;font-weight:900;font-size:16px;min-width:49px}.ev-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;line-height:.98;color:#fff;text-transform:uppercase}.ev-sub{font-size:11px;color:#aab6d8;line-height:1.55;margin-top:7px}.ev-status{border-radius:999px;padding:6px 8px;font-size:9px;font-weight:900;white-space:nowrap;border:1px solid}.ev-obs{font-size:11px;color:#dce2f6;background:#090d15;border:1px solid #ffffff10;border-radius:12px;padding:9px;margin-top:10px;white-space:pre-wrap;max-height:94px;overflow:auto}.ev-card-actions{display:flex;gap:8px;margin-top:10px}.ev-card-actions button{flex:1;border:1px solid #2b3654;background:#111725;color:#d8e2ff;border-radius:11px;padding:9px;font-size:11px;font-weight:900}.ev-card-actions button.danger{border-color:#ff3b3055;color:#ff8b84;background:#ff3b3011}.ev-empty{background:#121724;border:1px dashed #303a58;border-radius:20px;padding:22px;text-align:center;color:#92a0c0;font-size:12px;line-height:1.5;margin-top:12px}.ev-floating{position:sticky;bottom:78px;margin-left:auto;display:flex;gap:8px;justify-content:flex-end;z-index:7}.ev-floating button{border:none;border-radius:16px;padding:12px 14px;font-weight:900;box-shadow:0 10px 25px #0008}.ev-floating .sync{background:#16334a;color:#8fd0ff}.ev-floating .new{background:#f5c842;color:#111}
  .ev-modal-overlay{position:fixed;inset:0;background:#000b;display:none;align-items:flex-end;justify-content:center;z-index:9999}.ev-modal-overlay.show{display:flex}.ev-modal{width:min(520px,100%);max-height:92vh;overflow:auto;background:#0d111b;border:1px solid #2a3551;border-radius:24px 24px 0 0;padding:16px;box-shadow:0 -18px 50px #000}.ev-modal h2{font-family:'Barlow Condensed',sans-serif;font-size:25px;margin:0 0 12px;color:#fff}.ev-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ev-field{display:flex;flex-direction:column;gap:5px}.ev-field.wide{grid-column:1/-1}.ev-field label{font-size:10px;color:#9aa6c6;font-weight:900;text-transform:uppercase}.ev-field input,.ev-field select,.ev-field textarea{background:#151a28;color:#fff;border:1px solid #2b3654;border-radius:12px;padding:11px;font-size:13px;outline:none}.ev-field textarea{min-height:78px}.ev-modal-actions{display:flex;gap:9px;margin-top:14px}.ev-modal-actions button{flex:1;border:none;border-radius:12px;padding:12px;font-weight:900}.ev-modal-actions .cancel{background:#20283b;color:#d8e2ff}.ev-modal-actions .save{background:#f5c842;color:#111}.ev-modal-actions .delete{background:#3a1618;color:#ff8b84;border:1px solid #ff3b3055}
  @media(max-width:380px){.ev-kpis{grid-template-columns:repeat(2,1fr)}.ev-controls{grid-template-columns:1fr}.ev-day{min-height:47px}.ev-title{font-size:19px}}
  `;
  document.head.appendChild(st);
})();

function eventosHojeISO(){ const d=new Date(); return eventosDateToISO(d); }
function eventosDateToISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function eventosParseDate(v){
  if(!v) return null; const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){const [y,m,d]=s.slice(0,10).split('-').map(Number);return new Date(y,m-1,d)}
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const [d,m,y]=s.split('/').map(Number);return new Date(y,m-1,d)}
  if(/^\d{2}\/\d{2}$/.test(s)){const [d,m]=s.split('/').map(Number);return new Date(new Date().getFullYear(),m-1,d)}
  const dt=new Date(s); return isNaN(dt)?null:dt;
}
function eventosISO(v){ const d=eventosParseDate(v); return d?eventosDateToISO(d):''; }
function eventosFmtData(v,full){ const d=eventosParseDate(v); if(!d) return v||''; return d.toLocaleDateString('pt-BR', full?{weekday:'long',day:'2-digit',month:'long',year:'numeric'}:{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.',''); }
function eventosMesNome(d){ return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase()); }
function eventosSafe(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function eventosTitleCase(nome){
  const keep=['de','da','do','das','dos','e','em','no','na','para'];
  return String(nome||'').toLowerCase().split(/\s+/).map((p,i)=> keep.includes(p)&&i? p : p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
}
function eventosCor(st, raw){
  const s=(st||'').toUpperCase();
  if(s.includes('DECLIN')||s.includes('CANCEL')||s.includes('PERD')||s.includes('SEM RETORNO')) return '#ff3b30';
  if(s.includes('FECHADO')||s.includes('CONTRATO ASSINADO')||s.includes('CONFIRM')||s.includes('DOCUMENTAÇÃO COMPLETA')) return '#34c759';
  if(s.includes('APROV')||s.includes('AGUARDANDO')||s.includes('CONTRATO ENVIADO')) return '#2f80ed';
  if(s.includes('INTERESSE')) return '#ff9800';
  if(s.includes('PROPOSTA')) return '#f5c842';
  const c=String(raw?.corOrigem||'').toLowerCase();
  if(c.includes('ff0000')) return '#ff3b30'; if(c.includes('92d050')||c.includes('00ff00')||c.includes('6aa84f')||c.includes('79b142')) return '#34c759'; if(c.includes('00b0f0')||c.includes('0000ff')) return '#2f80ed'; if(c.includes('ff9900')) return '#ff9800'; if(c.includes('ffff00')) return '#f5c842';
  return '#f5c842';
}
function eventosStatusLabel(st){ return st || 'Sem status'; }
function eventosNormalizaItem(raw,id){
  raw=raw||{}; const texto=String(raw.textoOriginal||raw.observacao||'');
  let ev={ id:id||raw.id||'', data:raw.data||'', dia:raw.dia||'', mes:raw.mes||'', ano:raw.ano||'', unidade:raw.unidade||'', cliente:raw.cliente||'', telefone:raw.telefone||'', tipoEvento:raw.tipoEvento||raw.titulo||'', horario:raw.horario||raw.hora||'', pessoas:raw.pessoas||raw.quantidadePessoas||'', cardapio:raw.cardapio||raw.menu||'', status:raw.status||raw.statusNegociacao||'', observacao:raw.observacao||'', textoOriginal:raw.textoOriginal||'', responsavel:raw.responsavel||raw.responsavelInterno||'', formaPagamento:raw.formaPagamento||'', valorTotal:raw.valorTotal||'', valorSinal:raw.valorSinal||'', valorRestante:raw.valorRestante||'', corOrigem:raw.corOrigem||'', origemAba:raw.origemAba||'' };
  if(!ev.cliente){ const m=texto.match(/cliente\s*:?\s*([^\n]+)/i); if(m) ev.cliente=m[1].trim(); }
  if(!ev.telefone){ const m=texto.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/); if(m) ev.telefone=m[0].trim(); }
  if(!ev.pessoas){ const m=texto.match(/(\d{1,4})\s*(?:pessoas|convidados|adultos)/i); if(m) ev.pessoas=m[1]; }
  if(!ev.horario){ const m=texto.match(/\b\d{1,2}(?::\d{2}|h\d{0,2})\b(?:\s*(?:às|as|-|a)\s*\d{1,2}(?::\d{2}|h\d{0,2})\b)?/i); if(m) ev.horario=m[0]; }
  if(!ev.cardapio){ const m=texto.match(/\b(P[ÉE]ROLA|BRONZE|SILVER|GOLD|PREMIUM|BUFFET|EXECUTIVO)\b/i); if(m) ev.cardapio=m[1]; }
  if(!ev.tipoEvento){ const m=texto.match(/\b(almoço|jantar|casamento|corporativo|anivers[aá]rio|bodas|batizado|coquetel|formatura|coffee)\b[^\n]*/i); if(m) ev.tipoEvento=m[0]; }
  if(!ev.unidade){ const m=texto.match(/UNIDADE\s+([^\n]+)/i); if(m) ev.unidade=m[1].trim(); }
  if(!ev.status){ ev.status='Sem status'; }
  if(!ev.data && ev.ano && ev.mes && ev.dia){ ev.data=`${ev.ano}-${String(ev.mes).padStart(2,'0')}-${String(ev.dia).padStart(2,'0')}`; }
  return ev;
}
function eventosArray(){ return Object.entries(_eventosCache||{}).map(([id,v])=>eventosNormalizaItem(v,id)).filter(e=>eventosISO(e.data)); }
function eventosDbRef(){
  if(typeof fbDb!=='undefined' && fbDb) return fbDb.ref('calendario_eventos/eventos');
  try{
    if(window.firebase && firebase.database) return firebase.database().ref('calendario_eventos/eventos');
  }catch(e){}
  return null;
}
function openCalendarioEventos(){
  try{ showAppFromDashboard(); }catch(e){}
  _eventosSelectedISO = _eventosSelectedISO || eventosHojeISO();
  _eventosCurrentMonth = _eventosCurrentMonth || eventosParseDate(_eventosSelectedISO) || new Date();
  openPanel('eventosPanel'); eventosStartFirebase(); eventosRender();
}
function eventosStartFirebase(force){
  const ref=eventosDbRef();
  if(!ref){
    eventosRender();
    try{ showToast('⚠️ Firebase ainda não conectado'); }catch(e){}
    return;
  }
  if(_eventosListenerStarted && !force) return;
  _eventosListenerStarted=true;
  try{
    ref.off();
    ref.on('value',snap=>{
      _eventosCache=snap.val()||{};
      eventosRender();
      eventosUpdateBadge();
    });
    if(force){
      ref.once('value').then(snap=>{
        _eventosCache=snap.val()||{};
        eventosRender();
        eventosUpdateBadge();
        const total=Object.keys(_eventosCache||{}).length;
        try{ showToast('🔄 Eventos atualizados: '+total); }catch(e){}
      });
    }
  }catch(e){
    console.warn('eventosStartFirebase',e);
    try{ showToast('Erro ao atualizar eventos'); }catch(_){}
  }
}
function eventosAtualizarManual(){
  eventosStartFirebase(true);
}
function eventosSetView(v){ _eventosView=v; document.querySelectorAll('[data-evtab]').forEach(b=>b.classList.toggle('active',b.dataset.evtab===v)); eventosRender(); }
function eventosSetDate(iso){ _eventosSelectedISO=iso; const d=eventosParseDate(iso); if(d) _eventosCurrentMonth=new Date(d.getFullYear(),d.getMonth(),1); const inp=document.getElementById('evDatePicker'); if(inp) inp.value=iso; eventosRender(); }
function eventosMoveMonth(delta){ const d=_eventosCurrentMonth||new Date(); _eventosCurrentMonth=new Date(d.getFullYear(),d.getMonth()+delta,1); _eventosSelectedISO=eventosDateToISO(new Date(_eventosCurrentMonth.getFullYear(),_eventosCurrentMonth.getMonth(),1)); const inp=document.getElementById('evDatePicker'); if(inp) inp.value=_eventosSelectedISO; eventosRender(); }
function eventosApplyFilters(){ _eventosUnidadeFiltro=document.getElementById('evUnidadeFiltro')?.value||''; _eventosStatusFiltro=document.getElementById('evStatusFiltro')?.value||''; const dt=document.getElementById('evDatePicker')?.value; if(dt) eventosSetDate(dt); else eventosRender(); }
function eventosFiltradosBase(){
  let arr=eventosArray(); const uni=_eventosUnidadeFiltro.toUpperCase(); const st=_eventosStatusFiltro.toUpperCase();
  arr=arr.filter(e=>{ if(uni && !String(e.unidade||'').toUpperCase().includes(uni)) return false; if(st && !String(e.status||'').toUpperCase().includes(st)) return false; return true; });
  arr.sort((a,b)=>(eventosISO(a.data)+String(a.horario||'')).localeCompare(eventosISO(b.data)+String(b.horario||'')));
  return arr;
}
function eventosFiltradosView(){
  const arr=eventosFiltradosBase(); const sel=eventosParseDate(_eventosSelectedISO||eventosHojeISO())||new Date();
  const iniSemana=new Date(sel); iniSemana.setDate(sel.getDate()-sel.getDay()); iniSemana.setHours(0,0,0,0); const fimSemana=new Date(iniSemana); fimSemana.setDate(iniSemana.getDate()+6); fimSemana.setHours(23,59,59,999);
  if(_eventosView==='hoje') return arr.filter(e=>eventosISO(e.data)===eventosISO(sel));
  if(_eventosView==='semana') return arr.filter(e=>{const d=eventosParseDate(e.data); return d>=iniSemana&&d<=fimSemana});
  if(_eventosView==='mes') return arr.filter(e=>{const d=eventosParseDate(e.data); return d&&d.getMonth()===sel.getMonth()&&d.getFullYear()===sel.getFullYear()});
  return arr;
}
function eventosRender(){
  const p=document.getElementById('eventosContent'); if(!p) return;
  _eventosSelectedISO=_eventosSelectedISO||eventosHojeISO(); _eventosCurrentMonth=_eventosCurrentMonth||eventosParseDate(_eventosSelectedISO)||new Date();
  p.innerHTML=`<div class="ev-premium-wrap">
    <div class="ev-hero"><div class="ev-hero-title">Agenda comercial e operacional</div><div class="ev-hero-main"><div><b>Calendário de Eventos</b><span id="evSubMonth">${eventosMesNome(_eventosCurrentMonth)}</span></div><span id="evSyncInfo">Tempo real</span></div></div>
    <div class="ev-tabs"><button data-evtab="hoje" onclick="eventosSetView('hoje')">Hoje</button><button data-evtab="semana" onclick="eventosSetView('semana')">Semana</button><button data-evtab="mes" onclick="eventosSetView('mes')">Mês</button><button data-evtab="todos" onclick="eventosSetView('todos')">Todos</button></div>
    <div class="ev-controls"><input type="date" id="evDatePicker" value="${_eventosSelectedISO}" onchange="eventosApplyFilters()"><select id="evUnidadeFiltro" onchange="eventosApplyFilters()"><option value="">Todas as unidades</option><option ${_eventosUnidadeFiltro==='Barra'?'selected':''}>Barra</option><option ${_eventosUnidadeFiltro==='Recreio'?'selected':''}>Recreio</option><option ${_eventosUnidadeFiltro==='Vasto'?'selected':''}>Vasto</option></select><select class="wide" id="evStatusFiltro" onchange="eventosApplyFilters()"><option value="">Todos os status</option>${eventosStatusOptions()}</select></div>
    <div class="ev-kpis">${eventosKpisHtml()}</div>${eventosCalendarioHtml()}<div class="ev-section-title"><span>${eventosTituloLista()}</span><small>${eventosFiltradosView().length} evento(s)</small></div><div class="ev-list">${eventosListaHtml(eventosFiltradosView())}</div><div class="ev-floating"><button class="sync" onclick="eventosMostrarAjuda()">⚙️ Sheets</button><button class="sync" onclick="eventosAtualizarManual()">🔄 Atualizar</button><button class="new" onclick="eventosOpenModal()">＋ Novo</button></div></div>`;
  document.querySelectorAll('[data-evtab]').forEach(b=>b.classList.toggle('active',b.dataset.evtab===_eventosView));
}
function eventosStatusOptions(){ const opts=['Declinou proposta','Proposta enviada','Evento fechado com contrato','Proposta aprovada - aguardando contrato','Mostrou interesse na data','Contrato enviado','Contrato assinado cliente','Contrato assinado diretoria','Documentação completa','Sem status']; return opts.map(o=>`<option ${_eventosStatusFiltro===o?'selected':''}>${o}</option>`).join(''); }
function eventosKpisHtml(){
  const arr=eventosArray(), hoje=eventosHojeISO(), now=new Date(), mes=(_eventosCurrentMonth||now);
  const h=arr.filter(e=>eventosISO(e.data)===hoje).length;
  const m=arr.filter(e=>{const d=eventosParseDate(e.data);return d&&d.getMonth()===mes.getMonth()&&d.getFullYear()===mes.getFullYear()}).length;
  const conf=arr.filter(e=>/FECHADO|CONFIRM|CONTRATO ASSINADO|DOCUMENTAÇÃO COMPLETA/i.test(e.status||'')).length;
  const prop=arr.filter(e=>/PROPOSTA|INTERESSE|AGUARDANDO/i.test(e.status||'')).length;
  return `<div class="ev-kpi"><b>${h}</b><span>Hoje</span></div><div class="ev-kpi"><b>${m}</b><span>No mês</span></div><div class="ev-kpi"><b>${conf}</b><span>Confirmados</span></div><div class="ev-kpi"><b>${prop}</b><span>Negociação</span></div>`;
}
function eventosCalendarioHtml(){
  const base=_eventosCurrentMonth||new Date(); const y=base.getFullYear(), m=base.getMonth(); const first=new Date(y,m,1); const start=new Date(first); start.setDate(1-first.getDay()); const today=eventosHojeISO(); const arr=eventosFiltradosBase();
  const by={}; arr.forEach(e=>{const iso=eventosISO(e.data); (by[iso]||(by[iso]=[])).push(e)});
  let days=''; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const iso=eventosDateToISO(d); const evs=by[iso]||[]; const dots=evs.slice(0,4).map(e=>`<span class="ev-dot" style="background:${eventosCor(e.status,e)}"></span>`).join('')+(evs.length>4?`<span class="ev-more">+${evs.length-4}</span>`:''); days+=`<div class="ev-day ${d.getMonth()!==m?'muted':''} ${iso===today?'today':''} ${iso===_eventosSelectedISO?'active':''}" onclick="eventosSetDate('${iso}')"><span class="ev-num">${d.getDate()}</span><div class="ev-dots">${dots}</div></div>`; }
  return `<div class="ev-month-card"><div class="ev-month-head"><button onclick="eventosMoveMonth(-1)">‹</button><div class="ev-month-title">${eventosMesNome(base)}<span>${Object.values(by).reduce((s,l)=>s+l.filter(e=>{const d=eventosParseDate(e.data);return d&&d.getMonth()===m&&d.getFullYear()===y}).length,0)} eventos</span></div><button onclick="eventosMoveMonth(1)">›</button></div><div class="ev-weekdays"><div>DOM</div><div>SEG</div><div>TER</div><div>QUA</div><div>QUI</div><div>SEX</div><div>SÁB</div></div><div class="ev-days">${days}</div></div>`;
}
function eventosTituloLista(){ if(_eventosView==='hoje') return 'Eventos do dia'; if(_eventosView==='semana') return 'Eventos da semana'; if(_eventosView==='mes') return 'Eventos do mês'; return 'Todos os eventos'; }
function eventosListaHtml(lista){
  if(!lista.length) return `<div class="ev-empty">Nenhum evento encontrado para o filtro selecionado.<br>Quando a planilha sincronizar com o Firebase, os eventos aparecerão aqui automaticamente.</div>`;
  return lista.map(e=>{ const cor=eventosCor(e.status,e); const titulo=eventosSafe(eventosTitleCase(e.cliente||e.tipoEvento||'Evento sem cliente')); const meta=[]; if(e.data) meta.push('📅 '+eventosFmtData(e.data,true)); if(e.unidade) meta.push('📍 '+eventosSafe(e.unidade)); if(e.pessoas) meta.push('👥 '+eventosSafe(e.pessoas)+' pessoas'); if(e.cardapio) meta.push('🍽️ '+eventosSafe(e.cardapio)); if(e.telefone) meta.push('📞 '+eventosSafe(e.telefone)); if(e.formaPagamento) meta.push('💳 '+eventosSafe(e.formaPagamento));
    return `<div class="ev-card" style="border-left-color:${cor}"><div class="ev-card-top"><div class="ev-time">${eventosSafe(e.horario||'—')}</div><div style="flex:1"><div class="ev-title">${titulo}</div><div class="ev-sub">${meta.join('<br>')}</div></div><div class="ev-status" style="color:${cor};background:${cor}18;border-color:${cor}55">${eventosSafe(eventosStatusLabel(e.status))}</div></div>${(e.observacao||e.textoOriginal)?`<div class="ev-obs">${eventosSafe(e.observacao||e.textoOriginal)}</div>`:''}<div class="ev-card-actions"><button onclick="eventosOpenModal('${eventosSafe(e.id)}')">✏️ Editar</button><button onclick="eventosCopiarEvento('${eventosSafe(e.id)}')">📋 Copiar</button></div></div>`; }).join('');
}
function eventosUpdateBadge(){ const b=document.getElementById('dashEventosBadge'); if(!b) return; const n=eventosArray().filter(e=>eventosISO(e.data)===eventosHojeISO()).length; b.textContent=n?`${n} hoje`:'Eventos'; }
function eventosTextoEvento(e){ return `${e.horario?e.horario+' – ':''}${eventosTitleCase(e.cliente||e.tipoEvento||'Evento')}\n${e.unidade?'Unidade: '+e.unidade+'\n':''}${e.pessoas?'Pessoas: '+e.pessoas+'\n':''}${e.cardapio?'Cardápio: '+e.cardapio+'\n':''}${e.status?'Status: '+e.status+'\n':''}${e.telefone?'Telefone: '+e.telefone+'\n':''}`.trim(); }
function eventosTextoAgendaHoje(){ const ref=_eventosSelectedISO||eventosHojeISO(); const lista=eventosArray().filter(e=>eventosISO(e.data)===ref).sort((a,b)=>String(a.horario||'').localeCompare(String(b.horario||''))); let txt=`📅 Agenda de Eventos – ${eventosFmtData(ref,true)}\n\n`; if(!lista.length) return txt+'Nenhum evento cadastrado para esta data.'; lista.forEach(e=>{txt+=eventosTextoEvento(e)+'\n\n'}); return txt.trim(); }
function eventosCopiarAgendaHoje(){ const txt=eventosTextoAgendaHoje(); if(navigator.clipboard?.writeText){navigator.clipboard.writeText(txt).then(()=>showToast('📋 Agenda copiada'))}else prompt('Copie a agenda:',txt); }
function eventosCopiarEvento(id){ const e=eventosArray().find(x=>x.id===id); if(!e) return; const txt=eventosTextoEvento(e); if(navigator.clipboard?.writeText){navigator.clipboard.writeText(txt).then(()=>showToast('📋 Evento copiado'))}else prompt('Copie o evento:',txt); }
function eventosOpenModal(id){
  const e=id?eventosArray().find(x=>x.id===id):null; eventosEnsureModal();
  document.getElementById('evFormId').value=e?.id||''; document.getElementById('evFormData').value=e?eventosISO(e.data):(_eventosSelectedISO||eventosHojeISO()); document.getElementById('evFormHora').value=e?.horario||''; document.getElementById('evFormCliente').value=e?.cliente||''; document.getElementById('evFormUnidade').value=e?.unidade||'Barra'; document.getElementById('evFormTipo').value=e?.tipoEvento||''; document.getElementById('evFormPessoas').value=e?.pessoas||''; document.getElementById('evFormCardapio').value=e?.cardapio||''; document.getElementById('evFormTelefone').value=e?.telefone||''; document.getElementById('evFormStatus').value=e?.status||'Proposta enviada'; document.getElementById('evFormPagamento').value=e?.formaPagamento||''; document.getElementById('evFormObs').value=e?.observacao||e?.textoOriginal||''; document.getElementById('evDeleteBtn').style.display=e?'block':'none'; document.getElementById('evModalTitle').textContent=e?'Editar Evento':'Novo Evento'; document.getElementById('evModal').classList.add('show');
}
function eventosEnsureModal(){ if(document.getElementById('evModal')) return; const d=document.createElement('div'); d.id='evModal'; d.className='ev-modal-overlay'; d.onclick=(ev)=>{if(ev.target===d)eventosCloseModal()}; d.innerHTML=`<div class="ev-modal"><h2 id="evModalTitle">Novo Evento</h2><input type="hidden" id="evFormId"><div class="ev-form-grid"><div class="ev-field"><label>Data</label><input type="date" id="evFormData"></div><div class="ev-field"><label>Horário</label><input id="evFormHora" placeholder="Ex: 19h30"></div><div class="ev-field wide"><label>Cliente / Evento</label><input id="evFormCliente" placeholder="Nome do cliente ou evento"></div><div class="ev-field"><label>Unidade</label><select id="evFormUnidade"><option>Barra</option><option>Recreio</option><option>Vasto</option><option>Barra/Recreio</option></select></div><div class="ev-field"><label>Tipo</label><input id="evFormTipo" placeholder="Casamento, corporativo..."></div><div class="ev-field"><label>Pessoas</label><input id="evFormPessoas" placeholder="Ex: 50"></div><div class="ev-field"><label>Cardápio</label><input id="evFormCardapio" placeholder="Pérola, Bronze..."></div><div class="ev-field wide"><label>Telefone</label><input id="evFormTelefone" placeholder="WhatsApp do cliente"></div><div class="ev-field wide"><label>Status</label><select id="evFormStatus"><option>Mostrou interesse na data</option><option>Proposta enviada</option><option>Proposta aprovada - aguardando contrato</option><option>Evento fechado com contrato</option><option>Contrato enviado</option><option>Contrato assinado cliente</option><option>Contrato assinado diretoria</option><option>Documentação completa</option><option>Declinou proposta</option><option>Cancelado</option><option>Sem status</option></select></div><div class="ev-field wide"><label>Forma de pagamento</label><select id="evFormPagamento"><option></option><option>Sinal + restante no evento</option><option>Pagamento total antecipado</option><option>Pagamento total no ato</option><option>Pagamento parcelado</option><option>Pagamento faturado</option><option>Pix</option><option>Cartão de crédito</option></select></div><div class="ev-field wide"><label>Observações</label><textarea id="evFormObs" placeholder="Detalhes da negociação, proposta, contrato, documentação..."></textarea></div></div><div class="ev-modal-actions"><button class="cancel" onclick="eventosCloseModal()">Cancelar</button><button class="delete" id="evDeleteBtn" onclick="eventosExcluirAtual()">Excluir</button><button class="save" onclick="eventosSalvarModal()">Salvar</button></div></div>`; document.body.appendChild(d); }
function eventosCloseModal(){ document.getElementById('evModal')?.classList.remove('show'); }
function eventosSalvarModal(){
  const id=document.getElementById('evFormId').value || ('ev_app_'+Date.now()); const data=document.getElementById('evFormData').value||eventosHojeISO(); const dt=eventosParseDate(data)||new Date();
  const item={id,data,ano:dt.getFullYear(),mes:dt.getMonth()+1,dia:dt.getDate(),horario:document.getElementById('evFormHora').value,cliente:document.getElementById('evFormCliente').value,unidade:document.getElementById('evFormUnidade').value,tipoEvento:document.getElementById('evFormTipo').value,pessoas:document.getElementById('evFormPessoas').value,cardapio:document.getElementById('evFormCardapio').value,telefone:document.getElementById('evFormTelefone').value,status:document.getElementById('evFormStatus').value,formaPagamento:document.getElementById('evFormPagamento').value,observacao:document.getElementById('evFormObs').value,origemAba:'App',atualizadoEm:new Date().toISOString()};
  const ref=eventosDbRef(); if(!ref){ showToast('Firebase indisponível'); return; } ref.child(id).set(item).then(()=>{showToast('✅ Evento salvo'); eventosCloseModal();}).catch(e=>alert('Erro ao salvar evento: '+e.message));
}
function eventosExcluirAtual(){ const id=document.getElementById('evFormId').value; if(!id||!confirm('Excluir este evento?')) return; const ref=eventosDbRef(); if(!ref) return; ref.child(id).remove().then(()=>{showToast('🗑️ Evento excluído'); eventosCloseModal();}); }
function eventosMostrarAjuda(){ alert('Integração Google Planilhas → Firebase:\n\n1. Abra a planilha de eventos.\n2. Extensões > Apps Script.\n3. Cole o arquivo AppsScript_Calendario_Eventos_Isolado.gs deste ZIP.\n4. Configure a URL do Firebase, se necessário.\n5. Execute sincronizarCalendarioEventosVisual().\n6. Crie gatilho instalável onEdit ou sincronização a cada 1 minuto.\n\nO app lê calendario_eventos/eventos em tempo real.'); }

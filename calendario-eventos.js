/* =========================================================
   MÓDULO ISOLADO — CALENDÁRIO DE EVENTOS
   Base limpa: não altera o core de frequência/escala.
   Lê Firebase em: calendario_eventos/eventos
   ========================================================= */
(function(){
  'use strict';

  const EVENTOS_PATH = 'calendario_eventos/eventos';
  let eventosCache = [];
  let filtroAtual = 'mes';
  let lojaAtual = 'todas';
  let statusAtual = 'todos';
  let listenerAtivo = false;

  const STATUS_COLOR = {
    'DECLINOU PROPOSTA':'#e53935',
    'PROPOSTA ENVIADA':'#f5c842',
    'EVENTO FECHADO COM CONTRATO':'#8bd450',
    'PROPOSTA APROVADA - AGUARDANDO CONTRATO':'#3f80ff',
    'PROPOSTA APROVADA/AGUARDANDO CONTRATO':'#3f80ff',
    'MOSTROU INTERESSE NA DATA':'#ff9f1a',
    'CONFIRMADO':'#8bd450',
    'PENDENTE':'#f5c842',
    'CANCELADO':'#e53935',
    'CONTRATO':'#3f80ff'
  };

  function norm(v){return String(v||'').trim();}
  function upper(v){return norm(v).toUpperCase();}
  function money(v){
    if(v===undefined||v===null||v==='') return '';
    const n = Number(String(v).replace(/[^0-9,.-]/g,'').replace('.','').replace(',','.'));
    if(!isNaN(n)) return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    return String(v);
  }
  function fmtDateISO(iso){
    if(!iso) return '';
    const [y,m,d] = String(iso).slice(0,10).split('-');
    if(!y||!m||!d) return iso;
    return `${d}/${m}/${y}`;
  }
  function parseDate(iso){
    if(!iso) return null;
    const [y,m,d]=String(iso).slice(0,10).split('-').map(Number);
    if(!y||!m||!d) return null;
    return new Date(y,m-1,d);
  }
  function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
  function weekStart(d){const x=new Date(d); const dow=x.getDay(); const diff=dow===0?-6:1-dow; x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x;}
  function isThisWeek(d){const now=new Date(); const a=weekStart(now); const b=weekStart(d); return a.getTime()===b.getTime();}
  function isThisMonth(d){const now=new Date(); return d&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}

  function nomeCurto(nome){
    nome = norm(nome).toLowerCase();
    if(!nome) return '';
    const keep = ['da','de','do','das','dos','e'];
    return nome.split(/\s+/).map(p=> keep.includes(p) ? p : p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
  }
  function statusColor(st){
    const s=upper(st);
    if(STATUS_COLOR[s]) return STATUS_COLOR[s];
    if(s.includes('DECLIN')) return '#e53935';
    if(s.includes('FECHADO')||s.includes('CONTRATO ASSINADO')||s.includes('CONFIRM')) return '#8bd450';
    if(s.includes('APROV')) return '#3f80ff';
    if(s.includes('INTERESSE')) return '#ff9f1a';
    if(s.includes('PROPOSTA')) return '#f5c842';
    return '#8d96b8';
  }

  function ensureStyle(){
    if(document.getElementById('eventosModuleStyle')) return;
    const css = `
      .eventos-card{background:linear-gradient(145deg,#151827,#11131e 55%,#23170a)!important;border-color:#f5c84266!important}
      .eventos-panel-body{padding:12px 12px 28px;color:#fff}.eventos-top{display:flex;gap:8px;overflow:auto;scrollbar-width:none;margin-bottom:10px}.eventos-top::-webkit-scrollbar{display:none}
      .eventos-chip{border:1px solid #30364a;background:#121622;color:#8d96b8;border-radius:999px;padding:8px 13px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.eventos-chip.active{background:#f5c842;color:#1a1200;border-color:#f5c842}
      .eventos-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.eventos-kpi{background:#171b2a;border:1px solid #252b3d;border-radius:14px;padding:10px}.eventos-kpi b{display:block;color:#f5c842;font-size:20px;line-height:1}.eventos-kpi span{font-size:9px;color:#9aa3c2;text-transform:uppercase;font-weight:800}
      .eventos-list{display:flex;flex-direction:column;gap:10px}.evento-card{background:linear-gradient(145deg,#171b2a,#10131d);border:1px solid #273047;border-radius:16px;padding:12px;box-shadow:0 8px 22px #0004;position:relative;overflow:hidden}.evento-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--evcor,#f5c842)}
      .evento-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.evento-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:.3px;color:#fff;text-transform:uppercase;line-height:1.05}.evento-date{font-size:11px;color:#f5c842;font-weight:900;white-space:nowrap}.evento-meta{font-size:11px;color:#aeb7d6;line-height:1.45;margin-top:7px}.evento-status{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;text-transform:uppercase;background:var(--evcor,#f5c842)22;color:var(--evcor,#f5c842);border:1px solid var(--evcor,#f5c842)66}.evento-actions{display:flex;gap:7px;margin-top:10px}.evento-btn{flex:1;border:1px solid #31384e;background:#121622;color:#f5c842;border-radius:10px;padding:9px;font-size:11px;font-weight:900;cursor:pointer}
      .eventos-empty{padding:24px;text-align:center;color:#8d96b8;background:#131722;border:1px dashed #30364a;border-radius:16px}.eventos-sync{font-size:10px;color:#8d96b8;margin:8px 0 10px;line-height:1.4}.eventos-section-title{color:#f5c842;font-size:12px;font-weight:900;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.5px}
      .eventos-calendar{background:#111520;border:1px solid #252b3d;border-radius:16px;overflow:hidden;margin-bottom:12px}.eventos-cal-head{display:grid;grid-template-columns:repeat(7,1fr);background:#1a2030}.eventos-cal-head div{padding:8px 2px;text-align:center;color:#f5c842;font-size:9px;font-weight:900}.eventos-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}.eventos-day{min-height:58px;border-right:1px solid #202638;border-top:1px solid #202638;padding:4px;font-size:10px;color:#fff}.eventos-day:nth-child(7n){border-right:none}.eventos-day.muted{color:#4e566d}.eventos-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin:2px 1px 0 0}.eventos-daynum{font-weight:900;margin-bottom:2px}
    `;
    const st=document.createElement('style'); st.id='eventosModuleStyle'; st.textContent=css; document.head.appendChild(st);
  }

  function ensurePanel(){
    if(document.getElementById('eventosPanel')) return;
    const panel=document.createElement('div');
    panel.className='slide-panel';
    panel.id='eventosPanel';
    panel.innerHTML = `
      <div class="panel-header">
        <button class="panel-back" onclick="closePanel('eventosPanel')">←</button>
        <div class="panel-title">📅 Calendário de Eventos</div>
        <button class="panel-add" onclick="window.eventosCopiarAgendaDia && window.eventosCopiarAgendaDia()">📋</button>
      </div>
      <div class="eventos-panel-body">
        <div class="eventos-sync" id="eventosSyncInfo">Módulo isolado. Aguardando dados do Firebase...</div>
        <div class="eventos-top" id="eventosPeriodoBar"></div>
        <div class="eventos-top" id="eventosLojaBar"></div>
        <div class="eventos-top" id="eventosStatusBar"></div>
        <div class="eventos-kpis" id="eventosKpis"></div>
        <div class="eventos-section-title">Calendário do mês</div>
        <div id="eventosCalendarioMini"></div>
        <div class="eventos-section-title">Eventos</div>
        <div class="eventos-list" id="eventosLista"></div>
      </div>`;
    document.body.appendChild(panel);
  }

  function ensureDashboardCard(){
    const grid=document.querySelector('.dashboard-grid');
    if(!grid || document.getElementById('dashEventosCard')) return;
    const card=document.createElement('div');
    card.id='dashEventosCard';
    card.className='dash-card c-orange eventos-card';
    card.setAttribute('onclick',"openDashboardModule('eventos')");
    card.innerHTML=`<span class="dash-badge" id="dashEventosBadge">Sheets</span><div><div class="ic">📅</div><h3>Calendário<br>de Eventos</h3><p>Eventos, propostas e contratos em tempo real.</p></div><div class="go">Acessar ›</div>`;
    const agenda=[...grid.children].find(x=>/Agenda/i.test(x.textContent||''));
    if(agenda && agenda.nextSibling) grid.insertBefore(card, agenda.nextSibling); else grid.appendChild(card);
  }

  function wrapDashboardOpen(){
    if(window.__eventosOpenWrapped) return;
    const tentar=()=>{
      if(typeof window.openDashboardModule !== 'function') return false;
      const old=window.openDashboardModule;
      window.openDashboardModule=function(mod){
        if(mod==='eventos') return window.openEventosCalendario && window.openEventosCalendario();
        return old.apply(this,arguments);
      };
      window.__eventosOpenWrapped=true;
      return true;
    };
    if(!tentar()) setTimeout(tentar,800);
  }

  function getDb(){
    try{ if(typeof fbDb !== 'undefined' && fbDb) return fbDb; }catch(e){}
    try{ if(window.firebase && firebase.database) return firebase.database(); }catch(e){}
    return null;
  }

  function normalizarEvento(id, v){
    v = v || {};
    const data = v.data || v.dataEvento || v.DATA_EVENTO || v.DATA || '';
    return {
      id:id,
      data:String(data).slice(0,10),
      unidade:v.unidade||v.loja||v.UNIDADE||v.LOJA||'',
      cliente:v.cliente||v.nomeCliente||v.NOME_CLIENTE||v.CLIENTE||v.titulo||'Evento sem cliente',
      telefone:v.telefone||v.TELEFONE||'',
      tipoEvento:v.tipoEvento||v.tipo||v.TIPO_EVENTO||'',
      horario:v.horario||v.horarioInicio||v.HORARIO||v['HORÁRIO']||'',
      qtdPessoas:v.quantidadePessoas||v.qtdPessoas||v.QTD_PESSOAS||v.pessoas||'',
      status:v.statusNegociacao||v.status||v.STATUS_NEGOCIACAO||v.STATUS||'',
      cardapio:v.cardapio||v.tipoCardapio||v.menu||v.CARDAPIO||v.MENU||'',
      formaPagamento:v.formaPagamento||v.FORMA_PAGAMENTO||'',
      valorTotal:v.valorTotal||v.VALOR_TOTAL||'',
      valorPago:v.valorPago||v.valorSinal||v.VALOR_SINAL||'',
      valorRestante:v.valorRestante||v.VALOR_RESTANTE||'',
      responsavel:v.responsavel||v.RESPONSAVEL||'',
      observacao:v.observacao||v.obs||v.OBSERVACAO||v.OBS||'',
      atualizadoEm:v.atualizadoEm||''
    };
  }

  function iniciarListener(){
    if(listenerAtivo) return;
    const db=getDb();
    if(!db){
      const info=document.getElementById('eventosSyncInfo');
      if(info) info.textContent='Aguardando conexão com Firebase...';
      setTimeout(iniciarListener,1200);
      return;
    }
    listenerAtivo=true;
    db.ref(EVENTOS_PATH).on('value', snap=>{
      const val=snap.val()||{};
      eventosCache=Object.keys(val).map(k=>normalizarEvento(k,val[k])).filter(e=>e.data).sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario));
      atualizarBadge(); renderEventos();
    }, err=>{
      listenerAtivo=false;
      const info=document.getElementById('eventosSyncInfo');
      if(info) info.textContent='Erro ao ler eventos: '+(err&&err.message?err.message:err);
    });
  }

  function filtrarEventos(){
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    return eventosCache.filter(ev=>{
      const d=parseDate(ev.data); if(!d) return false;
      if(filtroAtual==='hoje' && !sameDay(d,hoje)) return false;
      if(filtroAtual==='semana' && !isThisWeek(d)) return false;
      if(filtroAtual==='mes' && !isThisMonth(d)) return false;
      const lj=upper(ev.unidade);
      if(lojaAtual!=='todas' && !lj.includes(upper(lojaAtual))) return false;
      if(statusAtual!=='todos' && upper(ev.status)!==upper(statusAtual)) return false;
      return true;
    });
  }

  function renderChips(){
    const periodo=document.getElementById('eventosPeriodoBar');
    const loja=document.getElementById('eventosLojaBar');
    const status=document.getElementById('eventosStatusBar');
    if(periodo) periodo.innerHTML=['hoje','semana','mes','todos'].map(x=>`<button class="eventos-chip ${filtroAtual===x?'active':''}" onclick="eventosSetFiltro('periodo','${x}')">${x==='mes'?'Mês':x.charAt(0).toUpperCase()+x.slice(1)}</button>`).join('');
    const lojas=['todas','Barra','Recreio'];
    if(loja) loja.innerHTML=lojas.map(x=>`<button class="eventos-chip ${lojaAtual===x?'active':''}" onclick="eventosSetFiltro('loja','${x}')">${x==='todas'?'Todas':x}</button>`).join('');
    const sts=['todos',...Array.from(new Set(eventosCache.map(e=>e.status).filter(Boolean))).slice(0,8)];
    if(status) status.innerHTML=sts.map(x=>`<button class="eventos-chip ${statusAtual===x?'active':''}" onclick="eventosSetFiltro('status','${String(x).replace(/'/g,"\\'")}')">${x==='todos'?'Todos':x}</button>`).join('');
  }

  function renderKpis(lista){
    const el=document.getElementById('eventosKpis'); if(!el) return;
    const confirmados=eventosCache.filter(e=>/FECHADO|CONFIRM|CONTRATO/i.test(e.status)).length;
    const propostas=eventosCache.filter(e=>/PROPOSTA/i.test(e.status)).length;
    const totalValor=eventosCache.reduce((s,e)=>{const n=Number(String(e.valorTotal||'').replace(/[^0-9,.-]/g,'').replace('.','').replace(',','.')); return s+(isNaN(n)?0:n);},0);
    el.innerHTML=`<div class="eventos-kpi"><b>${eventosCache.length}</b><span>Eventos</span></div><div class="eventos-kpi"><b>${confirmados}</b><span>Contratos</span></div><div class="eventos-kpi"><b>${money(totalValor)||'R$ 0'}</b><span>Previsto</span></div>`;
  }

  function renderMiniCalendario(){
    const el=document.getElementById('eventosCalendarioMini'); if(!el) return;
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
    const first=new Date(y,m,1); const start=new Date(first); start.setDate(first.getDate()-((first.getDay()+6)%7));
    let html='<div class="eventos-calendar"><div class="eventos-cal-head"><div>SEG</div><div>TER</div><div>QUA</div><div>QUI</div><div>SEX</div><div>SÁB</div><div>DOM</div></div><div class="eventos-cal-grid">';
    for(let i=0;i<42;i++){
      const d=new Date(start); d.setDate(start.getDate()+i);
      const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const evs=eventosCache.filter(e=>e.data===iso).slice(0,4);
      html+=`<div class="eventos-day ${d.getMonth()!==m?'muted':''}"><div class="eventos-daynum">${d.getDate()}</div>${evs.map(e=>`<span class="eventos-dot" style="background:${statusColor(e.status)}"></span>`).join('')}</div>`;
    }
    html+='</div></div>'; el.innerHTML=html;
  }

  function renderEventos(){
    ensureStyle(); ensurePanel(); renderChips();
    const lista=filtrarEventos();
    const info=document.getElementById('eventosSyncInfo');
    if(info) info.textContent=`Sincronizado com Firebase • ${eventosCache.length} eventos recebidos da planilha`;
    renderKpis(lista); renderMiniCalendario();
    const el=document.getElementById('eventosLista'); if(!el) return;
    if(!lista.length){el.innerHTML='<div class="eventos-empty">Nenhum evento encontrado para este filtro.<br><small>Edite a planilha e rode o script de sincronização para atualizar.</small></div>'; return;}
    el.innerHTML=lista.map(ev=>{
      const cor=statusColor(ev.status);
      return `<div class="evento-card" style="--evcor:${cor}">
        <div class="evento-head"><div><div class="evento-title">${nomeCurto(ev.cliente)}</div><div class="evento-meta">${ev.tipoEvento||'Evento'}${ev.qtdPessoas?' • '+ev.qtdPessoas+' pessoas':''}</div></div><div class="evento-date">${fmtDateISO(ev.data)}<br>${ev.horario||''}</div></div>
        <div class="evento-meta">📍 ${ev.unidade||'Unidade não informada'}${ev.telefone?' • ☎️ '+ev.telefone:''}<br>🍽️ ${ev.cardapio||'Cardápio não informado'}${ev.formaPagamento?'<br>💳 '+ev.formaPagamento:''}${ev.valorTotal?'<br>💰 '+money(ev.valorTotal):''}${ev.observacao?'<br>📝 '+ev.observacao:''}</div>
        <div class="evento-status">${ev.status||'Sem status'}</div>
        <div class="evento-actions"><button class="evento-btn" onclick="eventosCopiarEvento('${ev.id}')">Copiar</button></div>
      </div>`;
    }).join('');
  }

  function atualizarBadge(){
    const badge=document.getElementById('dashEventosBadge');
    if(!badge) return;
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const hojeQtd=eventosCache.filter(e=>sameDay(parseDate(e.data),hoje)).length;
    badge.textContent = hojeQtd ? `${hojeQtd} hoje` : `${eventosCache.length} eventos`;
  }

  window.eventosSetFiltro=function(tipo, valor){
    if(tipo==='periodo') filtroAtual=valor;
    if(tipo==='loja') lojaAtual=valor;
    if(tipo==='status') statusAtual=valor;
    renderEventos();
  };

  window.openEventosCalendario=function(){
    ensureStyle(); ensurePanel();
    if(typeof showAppFromDashboard==='function') showAppFromDashboard();
    if(typeof _premiumNavActive==='function') _premiumNavActive('navInicio');
    if(typeof openPanel==='function') openPanel('eventosPanel');
    else document.getElementById('eventosPanel').classList.add('open');
    iniciarListener(); renderEventos();
  };

  window.eventosCopiarEvento=function(id){
    const ev=eventosCache.find(e=>e.id===id); if(!ev) return;
    const txt=`📅 Evento — ${fmtDateISO(ev.data)}\n\nCliente: ${nomeCurto(ev.cliente)}\nUnidade: ${ev.unidade||''}\nHorário: ${ev.horario||''}\nPessoas: ${ev.qtdPessoas||''}\nStatus: ${ev.status||''}\nCardápio: ${ev.cardapio||''}\nTelefone: ${ev.telefone||''}\n\n${ev.observacao||''}`.trim();
    navigator.clipboard.writeText(txt).then(()=>{if(typeof showToast==='function')showToast('📋 Evento copiado');}).catch(()=>alert(txt));
  };

  window.eventosCopiarAgendaDia=function(){
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const lista=eventosCache.filter(e=>sameDay(parseDate(e.data),hoje));
    const titulo=`📅 Agenda de Eventos — ${hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}`;
    let txt=titulo+'\n\n';
    if(!lista.length) txt+='Nenhum evento para hoje.';
    lista.forEach(e=>{txt+=`• ${e.horario||''} — ${nomeCurto(e.cliente)}\n  ${e.unidade||''} | ${e.qtdPessoas||''} pessoas | ${e.status||''}\n\n`;});
    navigator.clipboard.writeText(txt).then(()=>{if(typeof showToast==='function')showToast('📋 Agenda do dia copiada');}).catch(()=>alert(txt));
  };

  document.addEventListener('DOMContentLoaded',()=>{
    ensureStyle(); ensureDashboardCard(); ensurePanel(); wrapDashboardOpen();
    setTimeout(()=>{ensureDashboardCard(); iniciarListener();},1600);
  });
})();

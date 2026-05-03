/* =====================================================
   MÓDULO PRAÇAS DIÁRIAS E SORTEIO — v35
   Isolado, integrado ao mapa/frequência e Firebase.
   Não altera a lógica principal do app.
===================================================== */
(function(){
  'use strict';

  const PRACAS_PADRAO = [
    {id:'p01', numero:1, area:'SALÃO BARRA', mesas:'01, 02 e 03', tipo:'F'},
    {id:'p02', numero:2, area:'SALÃO BARRA', mesas:'10, 11 e 12', tipo:'NORMAL'},
    {id:'p03', numero:3, area:'SALÃO BARRA', mesas:'04, 05, 06 e 93', tipo:'F'},
    {id:'p04', numero:4, area:'SALÃO BARRA', mesas:'07, 08 e 09', tipo:'NORMAL'},
    {id:'p05', numero:5, area:'SALÃO BARRA', mesas:'13, 14, 15, 16 e 17', tipo:'CF'},
    {id:'p06', numero:6, area:'LATERAL MÚSICO', mesas:'18, 19, 20 e 21', tipo:'NORMAL'},
    {id:'p07', numero:7, area:'LATERAL MÚSICO', mesas:'22, 23 e 24', tipo:'NORMAL'},
    {id:'p08', numero:8, area:'BEIRA MAR', mesas:'31, 32 e 33', tipo:'NORMAL'},
    {id:'p09', numero:9, area:'BEIRA MAR', mesas:'34, 35 e 36', tipo:'NORMAL'},
    {id:'p10', numero:10, area:'BEIRA MAR', mesas:'37, 38 e 39', tipo:'F'},
    {id:'p11', numero:11, area:'BEIRA MAR', mesas:'40, 41 e 42', tipo:'NORMAL'},
    {id:'p12', numero:12, area:'BEIRA MAR', mesas:'43, 44 e 45', tipo:'CF'},
    {id:'p13', numero:13, area:'BEIRA MAR', mesas:'46, 47 e 48', tipo:'F'},
    {id:'p14', numero:14, area:'ÁREA PET', mesas:'300, 301, 302 e 304', tipo:'NORMAL'},
    {id:'p15', numero:15, area:'ÁREA PET', mesas:'305, 306, 307 e 308', tipo:'NORMAL'},
    {id:'p16', numero:16, area:'VARANDA', mesas:'400, 401, 412 e 413', tipo:'NORMAL'},
    {id:'p17', numero:17, area:'VARANDA', mesas:'403, 404, 414 e 415', tipo:'NORMAL'},
    {id:'p18', numero:18, area:'VARANDA', mesas:'404, 405, 416 e 417', tipo:'NORMAL'},
    {id:'p19', numero:19, area:'VARANDA', mesas:'406, 407, 418 e 419', tipo:'NORMAL'},
    {id:'p20', numero:20, area:'VARANDA', mesas:'408, 409, 420 e 421', tipo:'NORMAL'}
  ];

  const st = {
    turno:'almoco',
    grupo:'garcons',
    pracaFiltro:'todas',
    data:'',
    pracaLocks:{},
    selected:{garcons:{}, cf:{}, fechamento:{}},
    resultado:null,
    historico:[],
    carregou:false
  };

  function norm(v){
    try{return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();}
    catch(e){return String(v||'').toUpperCase().trim();}
  }
  function pretty(nome){
    if(typeof window._nomeZapMapa === 'function') return window._nomeZapMapa(nome);
    const small = new Set(['de','da','do','dos','das','e']);
    return String(nome||'').toLowerCase().split(/\s+/).map((w,i)=>small.has(w)&&i? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  }
  function todayISO(){
    let d; try{ d = (WEEK_DATES && WEEK_DATES[curDay]) ? WEEK_DATES[curDay] : new Date(); }catch(e){ d = new Date(); }
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function fmtBR(iso){
    const [y,m,d]=String(iso||'').split('-');
    return d&&m ? `${d}/${m}/${y}` : iso;
  }
  function diAtual(){ try{ return Number.isFinite(curDay) ? curDay : (new Date().getDay()+6)%7; }catch(e){ return (new Date().getDay()+6)%7; } }
  function toast(msg){ if(typeof window.showToast==='function') window.showToast(msg); else alert(msg); }
  function firebaseOk(){ return !!(window.fbDb && window.fbConnected); }
  function pathTurno(){ return `pracas_diarias/sorteios/${st.data}/${st.turno}`; }

  function injectStyle(){
    if(document.getElementById('pracasDiariasStyle')) return;
    const css = `
    .pracas-panel{position:fixed;inset:0;z-index:9995;background:#070b13;color:#fff;display:none;overflow:auto;font-family:Inter,Arial,sans-serif;padding-bottom:92px}.pracas-panel.open{display:block}
    .pracas-head{position:sticky;top:0;z-index:20;background:#0c101a;border-bottom:2px solid #f5c842;display:flex;align-items:center;gap:10px;padding:14px 14px}.pracas-back{background:none;border:0;color:#f5c842;font-size:24px}.pracas-title{font-family:'Barlow Condensed',Inter,sans-serif;font-size:24px;font-weight:900;text-transform:uppercase;line-height:.95}.pracas-help{margin-left:auto;border:1px solid #ffffff28;background:#121827;color:#e8edf7;border-radius:14px;padding:9px 12px;font-weight:900}.pracas-wrap{max-width:620px;margin:0 auto;padding:12px}
    .pracas-seg{display:grid;grid-template-columns:1fr 1fr;gap:0;border:2px solid #222b3d;border-radius:18px;overflow:hidden;background:#080d16;margin-bottom:12px}.pracas-seg button{border:0;background:#080d16;color:#aab3cc;padding:14px;font-weight:900;text-transform:uppercase}.pracas-seg button.active{background:linear-gradient(135deg,#f5c842,#f6b813);color:#111;box-shadow:0 0 18px #f5c84255}
    .pracas-info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.pracas-card{background:linear-gradient(145deg,#151b29,#0b101a);border:1px solid #28344c;border-radius:16px;padding:13px;box-shadow:0 8px 22px #0005}.pracas-label{font-size:10px;text-transform:uppercase;color:#95a3c8;font-weight:900;margin-bottom:6px}.pracas-input{width:100%;background:#0a0f19;border:1px solid #28344c;border-radius:11px;color:#fff;padding:10px;font-weight:900}.pracas-status{color:#28d66f;font-weight:900;display:flex;gap:8px;align-items:center}.pracas-status:before{content:'';width:12px;height:12px;background:#28d66f;border-radius:50%;box-shadow:0 0 10px #28d66f}
    .pracas-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #263149;border-radius:14px;overflow:hidden;margin:8px 0 12px}.pracas-tabs button{background:#111827;color:#9ca9c7;border:0;border-right:1px solid #263149;padding:12px 6px;font-weight:900;text-transform:uppercase;font-size:11px}.pracas-tabs button.active{background:#f5c842;color:#111}.pracas-section-title{display:flex;align-items:center;justify-content:space-between;color:#f5c842;font-weight:900;text-transform:uppercase;margin:18px 0 8px;font-size:13px}.pracas-count{color:#b8c2dd;font-size:11px;text-transform:none}
    .pracas-list{background:#0d1320;border:1px solid #22304a;border-radius:16px;overflow:hidden}.pracas-person,.pracas-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #ffffff10}.pracas-person:last-child,.pracas-row:last-child{border-bottom:0}.pracas-check{width:24px;height:24px;border-radius:7px;background:#f5c842;color:#111;display:flex;align-items:center;justify-content:center;font-weight:900}.pracas-check.off{background:#1b2434;color:#58637a}.pracas-name{font-weight:900;color:#fff}.pracas-sub{font-size:11px;color:#93a1c2;margin-top:2px}.pracas-pill{border:1px solid #33415e;background:#172033;color:#bfc8df;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;text-transform:uppercase}.pracas-pill.cf{border-color:#8e44ad88;color:#d49bff;background:#8e44ad22}.pracas-pill.f{border-color:#2980b988;color:#77c7ff;background:#2980b922}.pracas-pill.lock{border-color:#f5c84288;color:#f5c842;background:#f5c84218}
    .pracas-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}.pracas-btn{border:0;border-radius:16px;padding:14px;font-weight:900;text-transform:uppercase;background:#17283b;color:#d7e7ff}.pracas-btn.primary{grid-column:span 2;background:linear-gradient(135deg,#f5c842,#f7b816);color:#111;font-size:16px;box-shadow:0 10px 25px #f5c84230}.pracas-btn.green{background:#11351f;color:#38e27a}.pracas-btn.red{background:#35191c;color:#ff6868}.pracas-btn.purple{background:#25193a;color:#d5a8ff}
    .pracas-success{display:none;background:linear-gradient(90deg,#092f19,#102716);border:1px solid #28d66f88;border-radius:18px;padding:13px;margin:12px 0;color:#4af086;font-weight:900}.pracas-success.show{display:flex;align-items:center;justify-content:space-between;gap:10px}.pracas-result-card{background:#0d1320;border:1px solid #28364f;border-radius:16px;margin-bottom:8px;padding:11px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center}.pracas-num{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#23642e;color:#fff;font-weight:900}.pracas-assigned{font-size:15px;font-weight:900;color:#fff;text-align:right}.pracas-empty{border:1px dashed #33415e;background:#101828;border-radius:16px;padding:18px;text-align:center;color:#93a1c2;font-size:12px}.pracas-bottom{position:fixed;left:0;right:0;bottom:0;z-index:25;background:#070b13ee;backdrop-filter:blur(10px);border-top:1px solid #25324a;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.pracas-bottom button{border:0;border-radius:13px;padding:12px 8px;font-weight:900;color:#fff;background:#111827}.pracas-bottom .zap{background:#11351f;color:#35e477}.pracas-bottom .save{background:#132d46;color:#79c8ff}.pracas-bottom .share{background:#f5c842;color:#111}
    .pracas-mini-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px}.pracas-mini-nav button{background:#111827;border:1px solid #263149;color:#9ca9c7;border-radius:14px;padding:10px 6px;font-weight:900;font-size:11px}.pracas-mini-nav button.active{background:#f5c842;color:#111;border-color:#f5c842}.pracas-hidden{display:none!important}
    @media(max-width:420px){.pracas-title{font-size:22px}.pracas-info{grid-template-columns:1fr}.pracas-result-card{grid-template-columns:36px 1fr}.pracas-assigned{text-align:left;grid-column:2}.pracas-bottom{grid-template-columns:1fr 1fr}.pracas-bottom .share{grid-column:span 2}.pracas-wrap{padding:10px}.pracas-card{padding:11px}}
    `;
    const style=document.createElement('style'); style.id='pracasDiariasStyle'; style.textContent=css; document.head.appendChild(style);
  }

  function ensurePanel(){
    injectStyle();
    let panel=document.getElementById('pracasDiariasPanel');
    if(panel) return panel;
    panel=document.createElement('section');
    panel.id='pracasDiariasPanel'; panel.className='pracas-panel';
    panel.innerHTML=`
      <div class="pracas-head">
        <button class="pracas-back" onclick="closePracasDiarias()">‹</button>
        <div style="font-size:26px">🍽️</div>
        <div class="pracas-title">Praças Diárias e Sorteio</div>
        <button class="pracas-help" onclick="pracasAjuda()">?</button>
      </div>
      <div class="pracas-wrap">
        <div class="pracas-seg">
          <button id="prTurnoAlmoco" onclick="setPracasTurno('almoco')">☀️ Almoço</button>
          <button id="prTurnoJantar" onclick="setPracasTurno('jantar')">🌙 Jantar</button>
        </div>
        <div class="pracas-info">
          <div class="pracas-card"><div class="pracas-label">Data</div><input id="pracasData" type="date" class="pracas-input" onchange="setPracasData(this.value)"></div>
          <div class="pracas-card"><div class="pracas-label">Status do dia</div><div class="pracas-status" id="pracasStatusDia">Mapa conectado</div></div>
        </div>
        <div class="pracas-mini-nav">
          <button id="prNavEquipe" onclick="setPracasView('equipe')">Equipe</button>
          <button id="prNavPracas" onclick="setPracasView('pracas')">Praças</button>
          <button id="prNavResultado" onclick="setPracasView('resultado')">Resultado</button>
          <button id="prNavHistorico" onclick="setPracasView('historico')">Histórico</button>
        </div>
        <div id="pracasViewEquipe"></div>
        <div id="pracasViewPracas" class="pracas-hidden"></div>
        <div id="pracasViewResultado" class="pracas-hidden"></div>
        <div id="pracasViewHistorico" class="pracas-hidden"></div>
      </div>
      <div class="pracas-bottom">
        <button class="zap" onclick="copiarPracasWhatsApp()">🟢 WhatsApp</button>
        <button class="save" onclick="salvarPracasSorteio()">💾 Salvar</button>
        <button class="share" onclick="sortearPracasDiarias()">🎲 Sortear</button>
      </div>`;
    document.body.appendChild(panel);
    return panel;
  }

  function equipeDoMapa(){
    const di = diAtual();
    const out = {garcons:[], cf:[], fechamento:[], removidos:[]};
    let eq=[]; try{ eq = Array.isArray(EQUIPE) ? EQUIPE : []; }catch(e){ eq=[]; }
    eq.forEach(f=>{
      let trabalha=true;
      try{
        if(typeof window._mapaTrabalhaDia === 'function') trabalha = !!window._mapaTrabalhaDia(f, di).trabalha;
      }catch(e){}
      const setor = (typeof window._setorOperacionalLabel === 'function') ? window._setorOperacionalLabel(f) : '';
      const turno = (typeof window._turnoOperacional === 'function') ? window._turnoOperacional(f) : String(f.turno||'').toUpperCase();
      const cat = norm(f.categoria || f.funcao || '');
      const nome = pretty(f.nome||'');
      if(!nome) return;
      const item = {id:norm(f.nome), nome, nomeOriginal:f.nome, setor, turno, funcao:f.categoria||f.funcao||'', area:f.grupoEscala||f.grupo||f.setor||''};
      if(!trabalha){ out.removidos.push(item); return; }
      if(setor==='CHEFE DE FILA' || cat.includes('CHEFE DE FILA')) out.cf.push(item);
      else if(setor==='GARÇONS' && turno==='FECHAMENTO') out.fechamento.push(item);
      else if(setor==='GARÇONS') out.garcons.push(item);
    });
    ['garcons','cf','fechamento','removidos'].forEach(k=>{
      const seen = new Set();
      out[k] = out[k].filter(x=>{ if(seen.has(x.id)) return false; seen.add(x.id); return true; }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    });
    return out;
  }

  function ensureSelected(){
    const eq=equipeDoMapa();
    ['garcons','cf','fechamento'].forEach(g=>{
      eq[g].forEach(p=>{ if(st.selected[g][p.id] === undefined) st.selected[g][p.id] = true; });
      Object.keys(st.selected[g]).forEach(id=>{ if(!eq[g].some(p=>p.id===id)) delete st.selected[g][id]; });
    });
  }

  function tipoLabel(t){ return t==='CF'?'CF':(t==='F'?'F/':'Normal'); }
  function tipoClass(t){ return t==='CF'?'cf':(t==='F'?'f':''); }
  function pracaGrupo(p){ return p.tipo==='CF'?'cf':(p.tipo==='F'?'fechamento':'garcons'); }

  function getPracas(){ return PRACAS_PADRAO.slice().sort((a,b)=>a.numero-b.numero); }
  function filteredPracas(){
    let arr=getPracas();
    if(st.turno==='almoco') arr=arr.filter(p=>p.tipo!=='F');
    if(st.pracaFiltro!=='todas') arr=arr.filter(p=>p.tipo===st.pracaFiltro);
    return arr;
  }

  function renderEquipe(){
    ensureSelected();
    const eq=equipeDoMapa();
    const total = eq.garcons.length + eq.cf.length + eq.fechamento.length;
    const el=document.getElementById('pracasViewEquipe'); if(!el) return;
    el.innerHTML = `
      <div class="pracas-section-title"><span>Equipe presente <small style="color:#9ca9c7">(mapa do dia)</small></span><span class="pracas-count">${total} pessoas</span></div>
      <div class="pracas-tabs">
        <button id="prGrupoGarcons" onclick="setPracasGrupo('garcons')">Garçons (${eq.garcons.length})</button>
        <button id="prGrupoCf" onclick="setPracasGrupo('cf')">CF (${eq.cf.length})</button>
        <button id="prGrupoFechamento" onclick="setPracasGrupo('fechamento')">Fechamento (${eq.fechamento.length})</button>
      </div>
      <div class="pracas-list">${renderPessoasLista(eq[st.grupo]||[], st.grupo)}</div>
      <div class="pracas-section-title"><span>Removidos automaticamente</span><span class="pracas-count">folga/falta/atestado</span></div>
      <div class="pracas-list">${eq.removidos.slice(0,8).map(p=>`<div class="pracas-person"><div class="pracas-check off">×</div><div><div class="pracas-name">${p.nome}</div><div class="pracas-sub">${p.funcao||p.setor||''}</div></div><span class="pracas-pill">Fora</span></div>`).join('') || '<div class="pracas-empty">Nenhum colaborador removido pelo mapa.</div>'}</div>
    `;
    setActiveGrupo();
  }
  function renderPessoasLista(lista, grupo){
    if(!lista.length) return '<div class="pracas-empty">Nenhuma pessoa elegível neste grupo.</div>';
    return lista.map(p=>{
      const on = !!st.selected[grupo][p.id];
      return `<div class="pracas-person" onclick="togglePracasPessoa('${grupo}','${encodeURIComponent(p.id)}')">
        <div class="pracas-check ${on?'':'off'}">${on?'✓':'+'}</div>
        <div><div class="pracas-name">${p.nome}</div><div class="pracas-sub">${p.funcao||p.setor||''} • ${p.turno||''}</div></div>
        <span class="pracas-pill ${grupo==='cf'?'cf':(grupo==='fechamento'?'f':'')}">${grupo==='cf'?'CF':(grupo==='fechamento'?'F/':'Garçom')}</span>
      </div>`;
    }).join('');
  }
  function setActiveGrupo(){
    [['garcons','prGrupoGarcons'],['cf','prGrupoCf'],['fechamento','prGrupoFechamento']].forEach(([g,id])=>{const el=document.getElementById(id); if(el) el.classList.toggle('active',st.grupo===g);});
  }

  function renderPracas(){
    const el=document.getElementById('pracasViewPracas'); if(!el) return;
    const prs=filteredPracas();
    const counts={NORMAL:getPracas().filter(p=>p.tipo==='NORMAL').length, CF:getPracas().filter(p=>p.tipo==='CF').length, F:getPracas().filter(p=>p.tipo==='F').length};
    el.innerHTML=`
      <div class="pracas-section-title"><span>Praças disponíveis para sorteio</span><span class="pracas-count">${prs.length} praças</span></div>
      <div class="pracas-tabs">
        <button class="${st.pracaFiltro==='todas'?'active':''}" onclick="setPracasFiltro('todas')">Todas</button>
        <button class="${st.pracaFiltro==='NORMAL'?'active':''}" onclick="setPracasFiltro('NORMAL')">Normal (${counts.NORMAL})</button>
        <button class="${st.pracaFiltro==='CF'?'active':''}" onclick="setPracasFiltro('CF')">CF (${counts.CF})</button>
      </div>
      <div class="pracas-list">${prs.map(p=>renderPracaRow(p)).join('')}</div>
      <div class="pracas-actions"><button class="pracas-btn purple" onclick="limparTravasPracas()">🔓 Limpar travas</button><button class="pracas-btn" onclick="setPracasView('equipe')">👥 Ver equipe</button></div>
    `;
  }
  function renderPracaRow(p){
    const lock=st.pracaLocks[p.id];
    return `<div class="pracas-row">
      <div class="pracas-num">${p.numero}</div>
      <div><div class="pracas-name">Praça ${p.numero}</div><div class="pracas-sub">Mesas: ${p.mesas}<br>${p.area}</div>${lock?`<div class="pracas-sub" style="color:#f5c842">Travada para: ${lock.nome}</div>`:''}</div>
      <button class="pracas-pill ${tipoClass(p.tipo)} ${lock?'lock':''}" onclick="editarTravaPraca('${p.id}')">${lock?'🔒 '+lock.nome:tipoLabel(p.tipo)}</button>
    </div>`;
  }

  function selectedList(grupo){
    const eq=equipeDoMapa()[grupo]||[];
    return eq.filter(p=>st.selected[grupo][p.id]);
  }
  function shuffle(arr){
    const a=arr.slice();
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function atribuir(pracas, pessoas, grupo){
    const res=[]; const sobraram=[]; const usedP=new Set();
    const pool=shuffle(pessoas);
    const livres=[];
    pracas.forEach(p=>{
      const lock=st.pracaLocks[p.id];
      if(lock && lock.grupo===grupo){
        res.push({praca:p, pessoa:{nome:lock.nome, id:lock.id||norm(lock.nome)}, travada:true});
        usedP.add(lock.id||norm(lock.nome));
      } else livres.push(p);
    });
    const pool2=pool.filter(p=>!usedP.has(p.id));
    livres.forEach((p,idx)=>{ if(pool2[idx]) res.push({praca:p,pessoa:pool2[idx],travada:false}); });
    if(pool2.length>livres.length) sobraram.push(...pool2.slice(livres.length));
    return {res,sobraram};
  }

  function fazerSorteio(){
    ensureSelected();
    const prs=getPracas();
    const normalPracas=prs.filter(p=>p.tipo==='NORMAL');
    const cfPracas=prs.filter(p=>p.tipo==='CF');
    const fPracas=st.turno==='jantar' ? prs.filter(p=>p.tipo==='F') : [];
    const r1=atribuir(normalPracas, selectedList('garcons'), 'garcons');
    const r2=atribuir(cfPracas, selectedList('cf'), 'cf');
    const r3=atribuir(fPracas, selectedList('fechamento'), 'fechamento');
    st.resultado={
      id:'pr_'+Date.now(), data:st.data, turno:st.turno, criadoEm:new Date().toISOString(),
      normal:r1.res, cf:r2.res, fechamento:r3.res,
      sobraram:{garcons:r1.sobraram, cf:r2.sobraram, fechamento:r3.sobraram},
      resumo:{garcons:selectedList('garcons').length, cf:selectedList('cf').length, fechamento:selectedList('fechamento').length}
    };
    renderResultado();
    setPracasView('resultado');
    const suc=document.getElementById('pracasSuccess'); if(suc) suc.classList.add('show');
    toast('🎲 Sorteio realizado com sucesso');
  }

  function renderResultado(){
    const el=document.getElementById('pracasViewResultado'); if(!el) return;
    if(!st.resultado){
      el.innerHTML='<div class="pracas-empty">Nenhum sorteio realizado ainda. Selecione a equipe e toque em Sortear.</div>';
      return;
    }
    const r=st.resultado;
    el.innerHTML=`
      <div id="pracasSuccess" class="pracas-success show"><span>✅ Sorteio realizado com sucesso!<br><small>${fmtBR(r.data)} • ${st.turno==='almoco'?'Almoço':'Jantar'}</small></span><button class="pracas-pill" onclick="sortearPracasDiarias()">Refazer</button></div>
      <div class="pracas-section-title"><span>Resultado do sorteio</span><span class="pracas-count">${(r.normal||[]).length} praças</span></div>
      ${(r.normal||[]).map(x=>resultCard(x,'garcons')).join('') || '<div class="pracas-empty">Nenhuma praça normal atribuída.</div>'}
      <div class="pracas-section-title" style="color:#d49bff"><span>👑 Chefe de fila (CF)</span><span class="pracas-count">${(r.cf||[]).length}</span></div>
      ${(r.cf||[]).map(x=>resultCard(x,'cf')).join('') || '<div class="pracas-empty">Nenhum CF atribuído.</div>'}
      <div class="pracas-section-title" style="color:#77c7ff"><span>🔒 Fechamento (F/)</span><span class="pracas-count">${(r.fechamento||[]).length}</span></div>
      ${(r.fechamento||[]).map(x=>resultCard(x,'fechamento')).join('') || '<div class="pracas-empty">Sem praças F/ neste turno.</div>'}
      ${renderSobraram(r)}
    `;
  }
  function resultCard(x,grupo){
    const p=x.praca, pessoa=x.pessoa||{};
    return `<div class="pracas-result-card">
      <div class="pracas-num">${p.numero}</div>
      <div><div class="pracas-name">Praça ${p.numero}</div><div class="pracas-sub">Mesas: ${p.mesas}<br>${p.area}</div></div>
      <div class="pracas-assigned">${pessoa.nome||'—'}<div class="pracas-sub" style="text-align:right;color:${grupo==='cf'?'#d49bff':(grupo==='fechamento'?'#77c7ff':'#35e477')}">${grupo==='cf'?'Chefe de fila':(grupo==='fechamento'?'Fechamento':'Garçom')}${x.travada?' • 🔒':''}</div></div>
    </div>`;
  }
  function renderSobraram(r){
    const parts=[];
    Object.entries(r.sobraram||{}).forEach(([g,arr])=>{ if(arr&&arr.length) parts.push(`${g}: ${arr.map(p=>p.nome).join(', ')}`); });
    if(!parts.length) return '';
    return `<div class="pracas-section-title"><span>Sem praça / banco</span></div><div class="pracas-empty">${parts.join('<br>')}</div>`;
  }

  function payloadResultado(){
    const conv = arr => (arr||[]).map(x=>({
      pracaId:x.praca.id, praca:x.praca.numero, mesas:x.praca.mesas, area:x.praca.area, tipo:x.praca.tipo,
      pessoa:x.pessoa?.nome||'', pessoaId:x.pessoa?.id||'', travada:!!x.travada
    }));
    const r=st.resultado || {normal:[],cf:[],fechamento:[],sobraram:{}};
    return {id:r.id||('pr_'+Date.now()), data:st.data, turno:st.turno, atualizadoEm:new Date().toISOString(), origem:'app_mapa',
      normal:conv(r.normal), cf:conv(r.cf), fechamento:conv(r.fechamento), sobraram:r.sobraram||{}, travas:st.pracaLocks, resumo:r.resumo||{} };
  }
  async function salvar(){
    if(!st.resultado){ toast('⚠️ Faça o sorteio antes de salvar'); return; }
    if(!firebaseOk()){ toast('⚠️ Firebase offline. Resultado fica só na tela.'); return; }
    await window.fbDb.ref(pathTurno()).set(payloadResultado());
    await window.fbDb.ref(`pracas_diarias/historico/${st.data}/${Date.now()}`).set(payloadResultado());
    toast('💾 Sorteio salvo no Firebase');
    carregarHistorico();
  }
  async function carregarSorteioSalvo(){
    if(!firebaseOk()) return;
    try{
      const s=await window.fbDb.ref(pathTurno()).once('value');
      const v=s.val(); if(!v) return;
      const byId={}; getPracas().forEach(p=>byId[p.id]=p);
      const deconv = arr => (arr||[]).map(x=>({praca:byId[x.pracaId]||{id:x.pracaId,numero:x.praca,mesas:x.mesas,area:x.area,tipo:x.tipo}, pessoa:{nome:x.pessoa,id:x.pessoaId}, travada:!!x.travada}));
      st.pracaLocks = v.travas || {};
      st.resultado={id:v.id, data:v.data, turno:v.turno, criadoEm:v.atualizadoEm, normal:deconv(v.normal), cf:deconv(v.cf), fechamento:deconv(v.fechamento), sobraram:v.sobraram||{}, resumo:v.resumo||{}};
      renderAll();
    }catch(e){ console.warn('carregar sorteio', e); }
  }
  async function carregarHistorico(){
    if(!firebaseOk()) { renderHistorico(); return; }
    try{
      const s=await window.fbDb.ref('pracas_diarias/historico').limitToLast(25).once('value');
      const val=s.val()||{}; const arr=[];
      Object.keys(val).forEach(data=>Object.keys(val[data]||{}).forEach(k=>arr.push(val[data][k])));
      arr.sort((a,b)=>String(b.atualizadoEm||'').localeCompare(String(a.atualizadoEm||'')));
      st.historico=arr.slice(0,20);
      renderHistorico();
    }catch(e){ console.warn('histórico praças', e); }
  }
  function renderHistorico(){
    const el=document.getElementById('pracasViewHistorico'); if(!el) return;
    if(!st.historico.length){ el.innerHTML='<div class="pracas-empty">Histórico vazio. Salve um sorteio para aparecer aqui.</div>'; return; }
    el.innerHTML=`<div class="pracas-section-title"><span>Últimos sorteios salvos</span><span class="pracas-count">Firebase</span></div><div class="pracas-list">${st.historico.map(h=>{
      const qtd=(h.normal||[]).length+(h.cf||[]).length+(h.fechamento||[]).length;
      return `<div class="pracas-person"><div class="pracas-num">${qtd}</div><div><div class="pracas-name">${fmtBR(h.data)} • ${h.turno==='almoco'?'Almoço':'Jantar'}</div><div class="pracas-sub">${h.atualizadoEm?new Date(h.atualizadoEm).toLocaleString('pt-BR'):''}</div></div><button class="pracas-pill" onclick="abrirHistoricoPracas('${h.data}','${h.turno}')">Abrir</button></div>`;
    }).join('')}</div>`;
  }

  function textoWhats(){
    const r=st.resultado; if(!r) return 'Nenhum sorteio realizado.';
    const turno = st.turno==='almoco'?'ALMOÇO':'JANTAR';
    const linhas=[`📍 PRAÇAS DO DIA — ${fmtBR(st.data)}`,'',`🍽️ ${turno}`,''];
    function addTitulo(t){ linhas.push(t); }
    function addArr(arr){ (arr||[]).forEach(x=>linhas.push(`Praça ${x.praca.numero} — ${x.pessoa?.nome||'—'}\nMesas: ${x.praca.mesas}`)); }
    addTitulo('GARÇONS:'); addArr(r.normal); linhas.push('');
    addTitulo('CHEFE DE FILA (CF):'); addArr(r.cf); linhas.push('');
    if(st.turno==='jantar'){ addTitulo('FECHAMENTO (F/):'); addArr(r.fechamento); linhas.push(''); }
    const sob=[]; Object.entries(r.sobraram||{}).forEach(([g,a])=>{ if(a&&a.length) sob.push(`${g}: ${a.map(p=>p.nome).join(', ')}`); });
    if(sob.length){ linhas.push('BANCO / SEM PRAÇA:'); linhas.push(...sob); }
    return linhas.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function copiar(){
    const txt=textoWhats();
    const ok=()=>toast('📋 Praças copiadas para WhatsApp');
    if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok).catch(()=>fallbackCopy(txt,ok));
    else fallbackCopy(txt,ok);
  }
  function fallbackCopy(txt,cb){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');cb&&cb();}catch(e){alert(txt);}document.body.removeChild(ta); }

  function renderAll(){ renderEquipe(); renderPracas(); renderResultado(); renderHistorico(); updateTop(); }
  function updateTop(){
    const a=document.getElementById('prTurnoAlmoco'), j=document.getElementById('prTurnoJantar'); if(a) a.classList.toggle('active',st.turno==='almoco'); if(j) j.classList.toggle('active',st.turno==='jantar');
    const d=document.getElementById('pracasData'); if(d && d.value!==st.data) d.value=st.data;
  }
  function setView(v){
    ['Equipe','Pracas','Resultado','Historico'].forEach(name=>{const el=document.getElementById('pracasView'+name); if(el) el.classList.add('pracas-hidden');});
    const map={equipe:'Equipe',pracas:'Pracas',resultado:'Resultado',historico:'Historico'};
    const el=document.getElementById('pracasView'+map[v]); if(el) el.classList.remove('pracas-hidden');
    [['equipe','prNavEquipe'],['pracas','prNavPracas'],['resultado','prNavResultado'],['historico','prNavHistorico']].forEach(([x,id])=>{const b=document.getElementById(id); if(b) b.classList.toggle('active',x===v);});
    if(v==='historico') carregarHistorico();
  }

  window.openPracasDiarias = async function(){
    ensurePanel();
    st.data = st.data || todayISO();
    document.getElementById('pracasDiariasPanel').classList.add('open');
    try{ document.body.classList.remove('home-active'); }catch(e){}
    ensureSelected(); renderAll(); setView('equipe');
    await carregarSorteioSalvo();
    carregarHistorico();
  };
  window.closePracasDiarias = function(){ const p=document.getElementById('pracasDiariasPanel'); if(p) p.classList.remove('open'); };
  window.setPracasTurno = function(t){ st.turno=t; st.resultado=null; renderAll(); carregarSorteioSalvo(); };
  window.setPracasData = function(v){ st.data=v||todayISO(); st.resultado=null; renderAll(); carregarSorteioSalvo(); };
  window.setPracasGrupo = function(g){ st.grupo=g; renderEquipe(); };
  window.togglePracasPessoa = function(g,encodedId){ const id=decodeURIComponent(encodedId); st.selected[g][id]=!st.selected[g][id]; renderEquipe(); };
  window.setPracasFiltro = function(f){ st.pracaFiltro=f; renderPracas(); };
  window.setPracasView = setView;
  window.sortearPracasDiarias = fazerSorteio;
  window.salvarPracasSorteio = salvar;
  window.copiarPracasWhatsApp = copiar;
  window.limparTravasPracas = function(){ if(confirm('Limpar todas as travas manuais?')){st.pracaLocks={}; renderPracas(); toast('🔓 Travas removidas');} };
  window.editarTravaPraca = function(pracaId){
    const p=getPracas().find(x=>x.id===pracaId); if(!p) return;
    const grupo=pracaGrupo(p); const lista=selectedList(grupo);
    const nomes=lista.map(x=>x.nome).join(', ');
    const atual=st.pracaLocks[pracaId]?.nome||'';
    const nome=prompt(`Travar Praça ${p.numero} para qual pessoa?\nGrupo: ${grupo}\nElegíveis: ${nomes}\n\nDeixe vazio para remover trava.`, atual);
    if(nome===null) return;
    if(!nome.trim()) delete st.pracaLocks[pracaId];
    else st.pracaLocks[pracaId]={nome:pretty(nome), id:norm(nome), grupo};
    renderPracas(); renderResultado();
  };
  window.abrirHistoricoPracas = async function(data,turno){ st.data=data; st.turno=turno||'almoco'; await carregarSorteioSalvo(); setView('resultado'); };
  window.pracasAjuda = function(){ alert('Praças Diárias e Sorteio\n\n• Puxa automaticamente a equipe presente no mapa do dia.\n• Remove quem está de folga, falta, atestado ou troca de folga.\n• Sorteia garçons, CF e fechamento separadamente.\n• Permite travar praça manualmente.\n• Salva histórico no Firebase.\n• Copia o resultado para WhatsApp.'); };

  // Badge opcional no dashboard
  window.updatePracasDashboardBadge = function(){
    const el=document.getElementById('dashPracasBadge'); if(!el) return;
    const eq=equipeDoMapa(); el.textContent=(eq.garcons.length+eq.cf.length+eq.fechamento.length)+' elegíveis';
  };
  setInterval(()=>{ try{ window.updatePracasDashboardBadge(); }catch(e){} }, 4000);
})();

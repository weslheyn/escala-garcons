/* =====================================================
   MÓDULO PRAÇAS DIÁRIAS E SORTEIO — v106
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
    resultadosTurnos:{almoco:null,jantar:null},
    tipoSorteio:'geral',
    incluirFechamentoNoAlmoco:false,
    saloesAtivos:{'SALÃO BARRA':true,'LATERAL MÚSICO':true,'BEIRA MAR':true,'ÁREA PET':true,'VARANDA':true},
    pracasBloqueadas:{},
    historico:[],
    pracasCustom:null,
    pracasExtras:[],
    pracasRemovidas:{},
    saloesRemovidos:{},
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
    .pracas-mini-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0 4px}.pracas-mini-nav button{background:#111827;border:1px solid #263149;color:#9ca9c7;border-radius:14px;padding:10px 6px;font-weight:900;font-size:11px}.pracas-mini-nav button.active{background:#f5c842;color:#111;border-color:#f5c842}.pracas-hidden{display:none!important}

    .pracas-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.pracas-config-option{border:1px solid #28364f;background:#0d1320;color:#dbe7ff;border-radius:16px;padding:14px;text-align:left;font-weight:900}.pracas-config-option.active{background:linear-gradient(135deg,#f5c842,#f7b816);color:#111;border-color:#f5c842}.pracas-print-box{background:#fff;color:#111;border-radius:12px;margin:14px 0;padding:10px;overflow:visible;width:100%;box-sizing:border-box}.pracas-print-title{background:#202020;color:#fff;text-align:center;font-weight:900;padding:6px;font-size:15px;letter-spacing:.5px}.pracas-meta-table,.pracas-escala-table{width:100%;max-width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;table-layout:fixed}.pracas-meta-table td{border:1px solid #cfcfcf;padding:4px;word-break:break-word}.pracas-escala-table th,.pracas-escala-table td{border:1px solid #111;padding:3px 2px;text-align:center;vertical-align:middle;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.12}.pracas-escala-table th{background:#f4f4f4}.pracas-area-row td{background:#242424!important;color:#fff!important;font-weight:900;text-align:center;padding:4px}.pracas-flag{background:#202020;color:#fff;font-weight:900;width:26px}.pracas-prnum{font-weight:900;width:30px}.pracas-mesas{font-weight:900}.pracas-print-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.pracas-escala-table col.pr-col-num{width:34px}.pracas-escala-table col.pr-col-flag{width:30px}.pracas-escala-table col.pr-col-mesa{width:34%}.pracas-escala-table col.pr-col-turno{width:26%}.pracas-spinner-card{background:linear-gradient(145deg,#151b29,#0b101a);border:1px solid #f5c84277;border-radius:18px;padding:16px;text-align:center;margin:12px 0}.pracas-spinner-num{font-size:58px;font-weight:900;color:#f5c842;text-shadow:0 0 18px #f5c84255}.pracas-ind-person{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-bottom:1px solid #ffffff10;padding:10px 0}.pracas-ind-person:last-child{border-bottom:0}.pracas-small-btn{border:0;border-radius:12px;padding:10px 12px;font-weight:900;background:#f5c842;color:#111}.pracas-small-btn:disabled{opacity:.45;background:#344056;color:#94a3b8}
    @media print{body>*:not(#pracasPrintArea){display:none!important}#pracasPrintArea{display:block!important;position:static!important;background:#fff!important;color:#000!important}.no-print{display:none!important}.pracas-print-box{border-radius:0;margin:0;padding:0}.pracas-print-title{font-size:16px}.pracas-meta-table,.pracas-escala-table{font-size:11px}}
    @media(max-width:420px){.pracas-title{font-size:22px}.pracas-info{grid-template-columns:1fr}.pracas-result-card{grid-template-columns:36px 1fr}.pracas-assigned{text-align:left;grid-column:2}.pracas-bottom{grid-template-columns:1fr 1fr}.pracas-bottom .share{grid-column:span 2}.pracas-wrap{padding:10px}.pracas-card{padding:11px}.pracas-print-box{padding:6px;border-radius:10px}.pracas-print-title{font-size:12px;padding:5px}.pracas-meta-table,.pracas-escala-table{font-size:8px}.pracas-meta-table td{padding:2px}.pracas-escala-table th,.pracas-escala-table td{padding:2px 1px}.pracas-escala-table col.pr-col-num{width:26px}.pracas-escala-table col.pr-col-flag{width:24px}.pracas-escala-table col.pr-col-mesa{width:30%}.pracas-escala-table col.pr-col-turno{width:27%}}
    .pracas-modal-back{position:fixed;inset:0;background:#000a;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.pracas-modal{width:min(520px,96vw);max-height:88vh;overflow:auto;background:#0d1320;border:1px solid #33415e;border-radius:20px;padding:16px;color:#fff;box-shadow:0 20px 60px #000}.pracas-modal h3{margin:0 0 12px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:24px;text-transform:uppercase}.pracas-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.pracas-select,.pracas-text{width:100%;background:#090e18;border:1px solid #33415e;border-radius:12px;color:#fff;padding:11px;font-weight:800;margin:6px 0 10px}.pracas-textarea{min-height:70px}.pracas-danger{color:#ff7777}.pracas-gold{color:#f5c842}

    /* v103 - Sorteio compacto com escala completa sem arrastar */
    .pracas-panel{padding-bottom:18px!important;overflow:auto!important}
    .pracas-head{padding:8px 12px!important;min-height:38px!important;border-bottom:1px solid #263149!important}
    .pracas-head>div:nth-child(2){display:none!important}.pracas-help{display:none!important}
    .pracas-title{font-size:20px!important;letter-spacing:.3px!important}.pracas-wrap{max-width:100%!important;width:100%!important;padding:8px 14px!important;box-sizing:border-box!important}
    .pracas-seg{display:none!important}.pracas-info{grid-template-columns:220px 240px!important;gap:10px!important;margin:0 0 8px!important}.pracas-card{padding:8px 10px!important;border-radius:12px!important}.pracas-input{padding:7px 9px!important}.pracas-mini-nav{grid-template-columns:repeat(5,minmax(110px,1fr))!important;margin:6px 0 8px!important;gap:8px!important}.pracas-mini-nav button{padding:9px 6px!important;border-radius:12px!important}
    #pracasViewSorteio{height:calc(100vh - 128px);min-height:620px;overflow:hidden!important}.pracas-sorteio-layout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:10px;height:100%;min-height:0}.pracas-sorteio-left,.pracas-sorteio-scale{min-height:0;background:#0d1320;border:1px solid #22304a;border-radius:14px;overflow:hidden}.pracas-sorteio-left{display:flex;flex-direction:column}.pracas-sorteio-left .pracas-section-title{margin:0;padding:10px 10px 6px}.pracas-live-list{overflow:hidden;flex:1;padding:0 8px 8px}.pracas-live-person{display:grid;grid-template-columns:36px 1fr 88px;gap:8px;align-items:center;border-bottom:1px solid #ffffff10;padding:7px 0}.pracas-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2b3760,#17314e);font-weight:900;color:#fff}.pracas-live-person .pracas-name{font-size:13px;line-height:1.1;white-space:normal;overflow:visible;text-overflow:unset}.pracas-live-person .pracas-sub{font-size:9px;line-height:1.05}.pracas-live-person .pracas-small-btn{padding:8px 9px;border-radius:10px;font-size:11px}.pracas-sorteio-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;border-top:1px solid #ffffff10}.pracas-sorteio-actions .pracas-btn{padding:10px;border-radius:12px;font-size:12px}.pracas-sorteio-scale{padding:8px;display:flex;flex-direction:column}.pracas-sorteio-scale-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.pracas-sorteio-scale-title{font-size:18px;text-transform:uppercase;font-weight:900}.pracas-live-dot{color:#35e477;font-weight:900;font-size:11px;white-space:nowrap}
    .pracas-print-box.pracas-fit{border-radius:6px!important;margin:0!important;padding:0!important;overflow:hidden!important;flex:1;min-height:0}.pracas-print-box.pracas-fit .pracas-print-title{font-size:14px!important;padding:4px!important}.pracas-print-box.pracas-fit .pracas-meta-table{font-size:9px!important}.pracas-print-box.pracas-fit .pracas-meta-table td{padding:2px 5px!important;height:16px!important}.pracas-print-box.pracas-fit .pracas-escala-table{font-size:9px!important;line-height:1!important}.pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{padding:1px 2px!important;height:17px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;word-break:normal!important}.pracas-print-box.pracas-fit .pracas-area-row td{padding:2px!important;height:16px!important}.pracas-print-box.pracas-fit .pracas-mesas{font-size:9px!important}.pracas-print-box.pracas-fit col.pr-col-num{width:34px!important}.pracas-print-box.pracas-fit col.pr-col-flag{width:38px!important}.pracas-print-box.pracas-fit col.pr-col-mesa{width:30%!important}.pracas-print-box.pracas-fit col.pr-col-turno{width:22%!important}.pracas-fit-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px 0;font-size:12px;font-weight:900}.pracas-fit-footer span{padding:5px 9px;border:1px solid #263149;border-radius:10px;background:#0b111d}.pracas-fit-footer b{color:#f5c842}.pracas-print-actions{display:none!important}
    .pracas-sorteio-modal{position:fixed;inset:0;background:#000b;z-index:10020;display:flex;align-items:center;justify-content:center;padding:18px}.pracas-sorteio-box{width:min(420px,94vw);background:#0d1320;border:1px solid #f5c84277;border-radius:22px;padding:20px;text-align:center;box-shadow:0 24px 80px #000}.pracas-sorteio-box h3{margin:0 0 8px;font-size:22px}.pracas-sorteio-roll{display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0}.pracas-roll-num{width:86px;height:86px;border-radius:20px;background:#111827;border:1px solid #33415e;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:900;color:#f5c842}.pracas-roll-final{background:#155d27!important;color:#fff!important;border-color:#34d26c!important;box-shadow:0 0 25px #22c55e55}.pracas-sorteio-final{font-size:15px;color:#dbe7ff;font-weight:800;min-height:42px}.pracas-sorteio-final b{color:#f5c842}
    @media(max-width:900px){.pracas-wrap{padding:8px!important}.pracas-info,.pracas-mini-nav{display:none!important}#pracasViewSorteio{height:calc(100vh - 48px);min-height:0}.pracas-sorteio-layout{grid-template-columns:1fr;grid-template-rows:260px 1fr;gap:8px}.pracas-live-list{overflow:hidden}.pracas-sorteio-scale{padding:6px}.pracas-sorteio-scale-title{font-size:13px}.pracas-live-dot{font-size:9px}.pracas-print-box.pracas-fit .pracas-print-title{font-size:10px!important;padding:3px!important}.pracas-print-box.pracas-fit .pracas-meta-table{font-size:6px!important}.pracas-print-box.pracas-fit .pracas-meta-table td{padding:1px 2px!important;height:10px!important}.pracas-print-box.pracas-fit .pracas-escala-table{font-size:5.8px!important}.pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{padding:0 1px!important;height:10px!important}.pracas-print-box.pracas-fit .pracas-area-row td{height:9px!important;padding:0!important}.pracas-print-box.pracas-fit .pracas-mesas{font-size:5.8px!important}.pracas-fit-footer{font-size:9px;padding-top:4px}.pracas-fit-footer span{padding:3px 5px}.pracas-bottom{display:none!important}.pracas-head{padding:6px 8px!important}.pracas-title{font-size:17px!important}.pracas-back{font-size:22px!important}.pracas-live-person{grid-template-columns:28px 1fr 76px;padding:4px 0}.pracas-avatar{width:26px;height:26px;font-size:11px}.pracas-live-person .pracas-name{font-size:11px}.pracas-live-person .pracas-sub{font-size:8px}.pracas-live-person .pracas-small-btn{font-size:9px;padding:6px}.pracas-sorteio-actions{padding:6px}.pracas-sorteio-actions .pracas-btn{padding:8px;font-size:10px}}


    /* v104 - Escala original miniaturizada: tudo visível sem arrastar */
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)){max-width:none!important;width:100%!important;margin:0!important;padding:6px 8px 4px!important;box-sizing:border-box!important;height:calc(100vh - 40px)!important;overflow:hidden!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-info{display:none!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-bottom{display:none!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav{margin:4px 0 6px!important;gap:7px!important;grid-template-columns:repeat(5,1fr)!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav button{padding:8px 6px!important;border-radius:10px!important;font-size:10px!important}
    #pracasViewSorteio{height:calc(100vh - 92px)!important;min-height:0!important;overflow:hidden!important}
    .pracas-sorteio-layout{height:100%!important;display:grid!important;grid-template-columns:minmax(250px,300px) minmax(0,1fr)!important;gap:8px!important;min-height:0!important;overflow:hidden!important}
    .pracas-sorteio-left,.pracas-sorteio-scale{min-height:0!important;overflow:hidden!important;border-radius:10px!important}
    .pracas-sorteio-left{padding:8px!important;display:flex!important;flex-direction:column!important}
    .pracas-live-list{flex:1!important;min-height:0!important;overflow:auto!important;padding-right:2px!important}
    .pracas-sorteio-scale{padding:8px!important;display:flex!important;flex-direction:column!important}
    .pracas-sorteio-scale-head{padding:0 0 5px!important;margin:0!important}
    .pracas-sorteio-scale-title{font-size:19px!important;line-height:1!important;margin:0!important}
    .pracas-live-dot{font-size:10px!important;line-height:1!important}
    .pracas-live-person{grid-template-columns:32px minmax(0,1fr) 82px!important;gap:7px!important;padding:5px 0!important}
    .pracas-avatar{width:30px!important;height:30px!important;font-size:12px!important;flex:none!important}
    .pracas-live-person .pracas-name{font-size:12px!important;line-height:1.05!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;word-break:normal!important}
    .pracas-live-person .pracas-sub{font-size:8px!important;line-height:1!important}
    .pracas-live-person .pracas-small-btn{padding:7px 8px!important;border-radius:10px!important;font-size:10px!important}
    .pracas-sorteio-actions{padding:6px 0 0!important;gap:6px!important}.pracas-sorteio-actions .pracas-btn{padding:8px!important;border-radius:10px!important;font-size:10px!important}

    .pracas-print-box.pracas-fit{flex:1!important;min-height:0!important;margin:0!important;padding:0!important;border-radius:4px!important;overflow:hidden!important;background:#fff!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important}
    .pracas-print-box.pracas-fit .pracas-print-title{font-size:13px!important;line-height:1!important;padding:3px!important;letter-spacing:.3px!important;flex:0 0 auto!important}
    .pracas-print-box.pracas-fit .pracas-meta-table{font-size:7.6px!important;line-height:1!important;flex:0 0 auto!important}
    .pracas-print-box.pracas-fit .pracas-meta-table td{padding:1px 4px!important;height:13px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;word-break:normal!important}
    .pracas-print-box.pracas-fit .pracas-escala-table{font-size:7.6px!important;line-height:1!important;table-layout:fixed!important;flex:1 1 auto!important;height:auto!important}
    .pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{padding:0 2px!important;height:11px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;word-break:normal!important;overflow-wrap:normal!important;vertical-align:middle!important}
    .pracas-print-box.pracas-fit .pracas-area-row td{height:10px!important;line-height:1!important;padding:1px!important;font-size:7.7px!important;background:#242424!important;color:#fff!important}
    .pracas-print-box.pracas-fit .pracas-mesas{font-size:7.6px!important;font-weight:900!important}
    .pracas-print-box.pracas-fit .pracas-prnum{font-size:7.6px!important;font-weight:900!important}
    .pracas-print-box.pracas-fit .pracas-flag{font-size:7.6px!important;font-weight:900!important}
    .pracas-print-box.pracas-fit col.pr-col-num{width:24px!important}
    .pracas-print-box.pracas-fit col.pr-col-flag{width:28px!important}
    .pracas-print-box.pracas-fit col.pr-col-mesa{width:35%!important}
    .pracas-print-box.pracas-fit col.pr-col-turno{width:21%!important}
    .pracas-fit-footer{flex:0 0 auto!important;padding:4px 0 0!important;font-size:11px!important;line-height:1!important}
    .pracas-fit-footer span{padding:4px 7px!important;border-radius:8px!important}
    .pracas-print-actions{display:none!important}

    @media(max-width:900px){
      .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)){height:calc(100vh - 38px)!important;padding:5px!important}
      #pracasViewSorteio{height:calc(100vh - 82px)!important}
      .pracas-sorteio-layout{grid-template-columns:1fr!important;grid-template-rows:210px minmax(0,1fr)!important;gap:6px!important}
      .pracas-sorteio-left{padding:6px!important}.pracas-sorteio-scale{padding:5px!important}
      .pracas-live-person{grid-template-columns:26px minmax(0,1fr) 70px!important;padding:3px 0!important;gap:5px!important}
      .pracas-avatar{width:24px!important;height:24px!important;font-size:10px!important}.pracas-live-person .pracas-name{font-size:10px!important}.pracas-live-person .pracas-sub{font-size:7px!important}.pracas-live-person .pracas-small-btn{font-size:8px!important;padding:5px!important}
      .pracas-sorteio-scale-title{font-size:12px!important}.pracas-live-dot{font-size:8px!important}.pracas-sorteio-scale-head .pracas-pill{display:none!important}
      .pracas-print-box.pracas-fit .pracas-print-title{font-size:8px!important;padding:2px!important}
      .pracas-print-box.pracas-fit .pracas-meta-table{font-size:4.9px!important}
      .pracas-print-box.pracas-fit .pracas-meta-table td{height:7px!important;padding:0 1px!important}
      .pracas-print-box.pracas-fit .pracas-escala-table{font-size:4.8px!important}
      .pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{height:7px!important;padding:0!important}
      .pracas-print-box.pracas-fit .pracas-area-row td{height:6px!important;font-size:4.8px!important;padding:0!important}
      .pracas-print-box.pracas-fit .pracas-mesas,.pracas-print-box.pracas-fit .pracas-prnum,.pracas-print-box.pracas-fit .pracas-flag{font-size:4.8px!important}
      .pracas-print-box.pracas-fit col.pr-col-num{width:14px!important}.pracas-print-box.pracas-fit col.pr-col-flag{width:16px!important}.pracas-print-box.pracas-fit col.pr-col-mesa{width:34%!important}.pracas-print-box.pracas-fit col.pr-col-turno{width:22%!important}
      .pracas-fit-footer{font-size:8px!important;padding-top:2px!important}.pracas-fit-footer span{padding:2px 4px!important}
    }



    /* V105 - Sorteio: folha original compacta, sem scroll para visualizar a escala */
    .pracas-panel:has(#pracasViewSorteio:not(.pracas-hidden)){
      padding-bottom:0!important;
      overflow:hidden!important;
    }
    .pracas-panel:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-bottom{
      display:none!important;
    }
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)){
      max-width:none!important;
      width:100%!important;
      height:calc(100vh - 42px)!important;
      padding:6px 8px!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
    }
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-info{
      display:none!important;
    }
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav{
      margin:0 0 6px!important;
      gap:7px!important;
      height:30px!important;
    }
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav button{
      padding:6px 4px!important;
      min-height:30px!important;
      border-radius:9px!important;
      font-size:10px!important;
    }
    #pracasViewSorteio{
      height:calc(100vh - 84px)!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .pracas-sorteio-layout{
      height:100%!important;
      display:grid!important;
      grid-template-columns:300px minmax(0,1fr)!important;
      gap:8px!important;
      overflow:hidden!important;
      min-height:0!important;
    }
    .pracas-sorteio-left{
      min-height:0!important;
      height:100%!important;
      overflow:hidden!important;
      padding:8px!important;
      border-radius:10px!important;
      display:flex!important;
      flex-direction:column!important;
    }
    .pracas-live-list{
      flex:1!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .pracas-live-person{
      grid-template-columns:30px minmax(0,1fr) 76px!important;
      gap:6px!important;
      padding:4px 0!important;
    }
    .pracas-avatar{width:28px!important;height:28px!important;font-size:11px!important}
    .pracas-live-person .pracas-name{
      font-size:11px!important;
      line-height:1.03!important;
      white-space:normal!important;
      overflow:visible!important;
      text-overflow:clip!important;
      word-break:normal!important;
    }
    .pracas-live-person .pracas-sub{font-size:7.5px!important;line-height:1!important}
    .pracas-live-person .pracas-small-btn{font-size:9px!important;padding:6px!important;border-radius:9px!important}
    .pracas-sorteio-actions{display:none!important}
    .pracas-sorteio-scale{
      min-height:0!important;
      height:100%!important;
      overflow:hidden!important;
      padding:7px!important;
      border-radius:10px!important;
      display:flex!important;
      flex-direction:column!important;
    }
    .pracas-sorteio-scale-head{
      flex:0 0 auto!important;
      padding:0 0 4px!important;
      margin:0!important;
      align-items:center!important;
    }
    .pracas-sorteio-scale-title{font-size:18px!important;line-height:1!important;margin:0!important}
    .pracas-live-dot{font-size:9px!important;line-height:1!important}

    /* Folha original da escala: mesma ordem de colunas e proporção de impressão */
    .pracas-print-box.pracas-fit{
      flex:1 1 auto!important;
      min-height:0!important;
      height:100%!important;
      margin:0!important;
      padding:0!important;
      border-radius:2px!important;
      overflow:hidden!important;
      background:#fff!important;
      color:#000!important;
      display:flex!important;
      flex-direction:column!important;
      box-sizing:border-box!important;
      border:1px solid #1b1b1b!important;
    }
    .pracas-print-box.pracas-fit .pracas-print-title{
      flex:0 0 auto!important;
      background:#202020!important;
      color:#fff!important;
      font-size:12px!important;
      line-height:1!important;
      padding:3px!important;
      letter-spacing:.2px!important;
      text-align:center!important;
    }
    .pracas-print-box.pracas-fit .pracas-meta-table{
      flex:0 0 auto!important;
      font-size:7.2px!important;
      line-height:1!important;
      table-layout:fixed!important;
      width:100%!important;
    }
    .pracas-print-box.pracas-fit .pracas-meta-table td{
      padding:1px 3px!important;
      height:10px!important;
      line-height:1!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:clip!important;
      border:1px solid #222!important;
    }
    .pracas-print-box.pracas-fit .pracas-logo-cell{
      width:82px!important;
      background:#5b140f!important;
      color:#f5c842!important;
      font-weight:900!important;
      text-align:center!important;
      font-size:9px!important;
      line-height:1.05!important;
    }
    .pracas-print-box.pracas-fit .pracas-escala-table{
      flex:1 1 auto!important;
      height:100%!important;
      width:100%!important;
      table-layout:fixed!important;
      border-collapse:collapse!important;
      font-size:7.15px!important;
      line-height:1!important;
    }
    .pracas-print-box.pracas-fit .pracas-escala-table th,
    .pracas-print-box.pracas-fit .pracas-escala-table td{
      border:1px solid #111!important;
      padding:0 1px!important;
      height:9.6px!important;
      max-height:9.6px!important;
      line-height:1!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:clip!important;
      word-break:normal!important;
      overflow-wrap:normal!important;
      vertical-align:middle!important;
      text-align:center!important;
    }
    .pracas-print-box.pracas-fit .pracas-escala-table th{
      background:#f4f4f4!important;
      color:#000!important;
      font-weight:900!important;
    }
    .pracas-print-box.pracas-fit .pracas-area-row td{
      height:9.6px!important;
      max-height:9.6px!important;
      padding:0!important;
      background:#242424!important;
      color:#fff!important;
      font-size:7px!important;
      font-weight:900!important;
      text-align:center!important;
    }
    .pracas-print-box.pracas-fit .pracas-prnum{width:auto!important;font-size:7.1px!important;font-weight:900!important;background:#fff!important;color:#000!important}
    .pracas-print-box.pracas-fit .pracas-flag{width:auto!important;font-size:7.1px!important;font-weight:900!important;background:#202020!important;color:#fff!important}
    .pracas-print-box.pracas-fit .pracas-mesas{font-size:7.1px!important;font-weight:900!important;color:#000!important}
    .pracas-print-box.pracas-fit col.pr-col-num{width:28px!important}
    .pracas-print-box.pracas-fit col.pr-col-flag{width:28px!important}
    .pracas-print-box.pracas-fit col.pr-col-almoco{width:13%!important}
    .pracas-print-box.pracas-fit col.pr-col-mesa{width:44%!important}
    .pracas-print-box.pracas-fit col.pr-col-jantar{width:19%!important}
    .pracas-fit-footer{
      flex:0 0 auto!important;
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:8px!important;
      padding:3px 0 0!important;
      font-size:10px!important;
      line-height:1!important;
    }
    .pracas-fit-footer span{padding:3px 6px!important;border-radius:7px!important}

    @media(max-width:900px){
      .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)){height:calc(100vh - 36px)!important;padding:4px!important}
      #pracasViewSorteio{height:calc(100vh - 76px)!important}
      .pracas-sorteio-layout{grid-template-columns:1fr!important;grid-template-rows:170px minmax(0,1fr)!important;gap:5px!important}
      .pracas-live-list{overflow:hidden!important}
      .pracas-live-person{grid-template-columns:24px minmax(0,1fr) 62px!important;padding:2px 0!important;gap:4px!important}
      .pracas-avatar{width:22px!important;height:22px!important;font-size:9px!important}
      .pracas-live-person .pracas-name{font-size:9px!important;line-height:1!important}
      .pracas-live-person .pracas-sub{font-size:6px!important}
      .pracas-live-person .pracas-small-btn{font-size:7px!important;padding:4px!important}
      .pracas-sorteio-scale-title{font-size:11px!important}.pracas-live-dot{font-size:7px!important}.pracas-sorteio-scale-head .pracas-pill{display:none!important}
      .pracas-print-box.pracas-fit .pracas-print-title{font-size:7px!important;padding:2px!important}
      .pracas-print-box.pracas-fit .pracas-meta-table{font-size:4.4px!important}
      .pracas-print-box.pracas-fit .pracas-meta-table td{height:6px!important;padding:0 1px!important}
      .pracas-print-box.pracas-fit .pracas-logo-cell{width:34px!important;font-size:5px!important}
      .pracas-print-box.pracas-fit .pracas-escala-table{font-size:4.25px!important}
      .pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{height:5.8px!important;max-height:5.8px!important;padding:0!important}
      .pracas-print-box.pracas-fit .pracas-area-row td{height:5.8px!important;font-size:4.25px!important}
      .pracas-print-box.pracas-fit .pracas-mesas,.pracas-print-box.pracas-fit .pracas-prnum,.pracas-print-box.pracas-fit .pracas-flag{font-size:4.25px!important}
      .pracas-print-box.pracas-fit col.pr-col-num{width:13px!important}.pracas-print-box.pracas-fit col.pr-col-flag{width:13px!important}.pracas-print-box.pracas-fit col.pr-col-almoco{width:13%!important}.pracas-print-box.pracas-fit col.pr-col-mesa{width:43%!important}.pracas-print-box.pracas-fit col.pr-col-jantar{width:19%!important}
      .pracas-fit-footer{font-size:7px!important;padding-top:1px!important}.pracas-fit-footer span{padding:2px 3px!important}
    }
    `;

    /* V106 - eventos v100 preservado + escala original proporcional menor */
    .pracas-panel:has(#pracasViewSorteio:not(.pracas-hidden)){overflow:hidden!important;padding-bottom:0!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)){height:calc(100vh - 42px)!important;overflow:hidden!important;padding:5px 8px!important;max-width:none!important;width:100%!important;box-sizing:border-box!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-info,.pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-bottom{display:none!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav{height:28px!important;margin:0 0 5px!important;gap:7px!important}
    .pracas-wrap:has(#pracasViewSorteio:not(.pracas-hidden)) .pracas-mini-nav button{min-height:28px!important;padding:5px!important;font-size:10px!important;border-radius:9px!important}
    #pracasViewSorteio{height:calc(100vh - 78px)!important;overflow:hidden!important;min-height:0!important}
    .pracas-sorteio-layout{grid-template-columns:300px minmax(0,1fr)!important;gap:8px!important;height:100%!important;overflow:hidden!important;min-height:0!important}
    .pracas-sorteio-left{height:100%!important;overflow:hidden!important;padding:8px!important;border-radius:10px!important;display:flex!important;flex-direction:column!important;min-height:0!important}
    .pracas-sorteio-scale{padding:7px!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;min-height:0!important}
    .pracas-sorteio-scale-head{width:100%!important;flex:0 0 auto!important;margin:0 0 4px!important}.pracas-sorteio-scale-title{font-size:18px!important;line-height:1!important}
    .pracas-print-box.pracas-fit{width:min(760px,100%)!important;max-width:760px!important;min-width:0!important;align-self:flex-start!important;flex:0 0 auto!important;height:auto!important;max-height:calc(100vh - 128px)!important;margin:0!important;padding:0!important;overflow:hidden!important;border-radius:3px!important;background:#fff!important;color:#000!important;box-sizing:border-box!important;display:block!important}
    .pracas-print-box.pracas-fit .pracas-print-title{font-size:12px!important;line-height:1!important;padding:3px 2px!important;letter-spacing:.2px!important}
    .pracas-print-box.pracas-fit .pracas-meta-table,.pracas-print-box.pracas-fit .pracas-escala-table{width:100%!important;max-width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;font-family:Arial,sans-serif!important;color:#000!important}
    .pracas-print-box.pracas-fit .pracas-meta-table{font-size:6.5px!important;line-height:1!important}.pracas-print-box.pracas-fit .pracas-meta-table td{height:9px!important;max-height:9px!important;padding:0 3px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;border:1px solid #999!important}
    .pracas-print-box.pracas-fit .pracas-logo-cell{width:56px!important;min-width:56px!important;max-width:56px!important;background:#5b130f!important;color:#d5a64d!important;font-size:6.5px!important;line-height:1.05!important;font-weight:900!important;text-align:center!important}
    .pracas-print-box.pracas-fit .pracas-escala-table{font-size:6.7px!important;line-height:1!important}.pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{height:9px!important;max-height:9px!important;padding:0 1px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;word-break:normal!important;overflow-wrap:normal!important;vertical-align:middle!important;border:1px solid #111!important}
    .pracas-print-box.pracas-fit .pracas-area-row td{height:10px!important;max-height:10px!important;padding:0!important;font-size:6.8px!important;line-height:1!important;background:#242424!important;color:#fff!important;font-weight:900!important;text-align:center!important}
    .pracas-print-box.pracas-fit .pracas-prnum,.pracas-print-box.pracas-fit .pracas-flag,.pracas-print-box.pracas-fit .pracas-mesas{font-size:6.7px!important;line-height:1!important;font-weight:900!important}.pracas-print-box.pracas-fit .pracas-prnum{background:#fff!important;color:#000!important}.pracas-print-box.pracas-fit .pracas-flag{background:#202020!important;color:#fff!important}
    .pracas-print-box.pracas-fit col.pr-col-num{width:24px!important}.pracas-print-box.pracas-fit col.pr-col-flag{width:28px!important}.pracas-print-box.pracas-fit col.pr-col-almoco{width:100px!important}.pracas-print-box.pracas-fit col.pr-col-mesa{width:235px!important}.pracas-print-box.pracas-fit col.pr-col-jantar{width:100px!important}
    .pracas-fit-footer{width:min(760px,100%)!important;max-width:760px!important;flex:0 0 auto!important;display:flex!important;justify-content:space-between!important;padding:3px 0 0!important;font-size:10px!important;line-height:1!important}.pracas-fit-footer span{padding:3px 6px!important;border-radius:7px!important}
    .pracas-live-list{overflow:auto!important;flex:1!important;min-height:0!important}.pracas-live-person{grid-template-columns:30px minmax(0,1fr) 76px!important;gap:6px!important;padding:4px 0!important}.pracas-avatar{width:28px!important;height:28px!important;font-size:11px!important}.pracas-live-person .pracas-name{font-size:11px!important;line-height:1.02!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.pracas-live-person .pracas-sub{font-size:7.5px!important;line-height:1!important}.pracas-live-person .pracas-small-btn{font-size:9px!important;padding:6px!important;border-radius:9px!important}
    @media(max-width:900px){#pracasViewSorteio{height:calc(100vh - 70px)!important}.pracas-sorteio-layout{grid-template-columns:1fr!important;grid-template-rows:210px minmax(0,1fr)!important;gap:6px!important}.pracas-sorteio-scale{align-items:center!important;padding:4px!important}.pracas-print-box.pracas-fit{width:100%!important;max-width:520px!important;max-height:calc(100vh - 292px)!important}.pracas-print-box.pracas-fit .pracas-print-title{font-size:7px!important;padding:2px!important}.pracas-print-box.pracas-fit .pracas-meta-table{font-size:4.4px!important}.pracas-print-box.pracas-fit .pracas-meta-table td{height:6px!important;padding:0 1px!important}.pracas-print-box.pracas-fit .pracas-logo-cell{width:34px!important;font-size:4.6px!important}.pracas-print-box.pracas-fit .pracas-escala-table{font-size:4.25px!important}.pracas-print-box.pracas-fit .pracas-escala-table th,.pracas-print-box.pracas-fit .pracas-escala-table td{height:5.7px!important;max-height:5.7px!important;padding:0!important}.pracas-print-box.pracas-fit .pracas-area-row td{height:5.8px!important;font-size:4.25px!important}.pracas-print-box.pracas-fit .pracas-prnum,.pracas-print-box.pracas-fit .pracas-flag,.pracas-print-box.pracas-fit .pracas-mesas{font-size:4.25px!important}.pracas-print-box.pracas-fit col.pr-col-num{width:14px!important}.pracas-print-box.pracas-fit col.pr-col-flag{width:16px!important}.pracas-print-box.pracas-fit col.pr-col-almoco{width:21%!important}.pracas-print-box.pracas-fit col.pr-col-mesa{width:40%!important}.pracas-print-box.pracas-fit col.pr-col-jantar{width:21%!important}.pracas-fit-footer{width:100%!important;max-width:520px!important;font-size:8px!important;padding-top:2px!important}.pracas-fit-footer span{padding:2px 4px!important}}

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
          <button id="prNavSorteio" onclick="setPracasView('sorteio')">Sorteio</button>
          <button id="prNavResultado" onclick="setPracasView('resultado')">Resultado</button>
          <button id="prNavHistorico" onclick="setPracasView('historico')">Histórico</button>
          <button id="prNavConfig" onclick="setPracasView('config')">Config.</button>
        </div>
        <div id="pracasViewEquipe"></div>
        <div id="pracasViewPracas" class="pracas-hidden"></div>
        <div id="pracasViewSorteio" class="pracas-hidden"></div>
        <div id="pracasViewResultado" class="pracas-hidden"></div>
        <div id="pracasViewHistorico" class="pracas-hidden"></div>
        <div id="pracasViewConfig" class="pracas-hidden"></div>
      </div>
      <div class="pracas-bottom">
        <button class="zap" onclick="sortearPracasDiarias()">🎲 Sortear</button>
        <button class="save" onclick="salvarPracasSorteio()">💾 Salvar sorteio</button>
        <button class="share" onclick="refazerPracasDiarias()">🔄 Refazer sorteio</button>
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

  function getPracas(){
    const custom = st.pracasCustom || JSON.parse(localStorage.getItem('pracas_config_custom')||'null') || {};
    const removidas = st.pracasRemovidas || {};
    const saloesRemovidos = st.saloesRemovidos || {};
    const extras = Array.isArray(st.pracasExtras) ? st.pracasExtras : [];
    return [...PRACAS_PADRAO, ...extras]
      .filter(p=>p && !removidas[p.id] && !saloesRemovidos[p.area])
      .map(p=>Object.assign({}, p, custom[p.id]||{}))
      .filter(p=>!saloesRemovidos[p.area])
      .sort((a,b)=>(Number(a.numero)||0)-(Number(b.numero)||0));
  }
  function salvarConfigLocal(){
    try{
      localStorage.setItem('pracas_config_custom', JSON.stringify(st.pracasCustom||{}));
      localStorage.setItem('pracas_config_extras', JSON.stringify(st.pracasExtras||[]));
      localStorage.setItem('pracas_config_removidas', JSON.stringify(st.pracasRemovidas||{}));
      localStorage.setItem('pracas_config_saloes_removidos', JSON.stringify(st.saloesRemovidos||{}));
      localStorage.setItem('pracas_config_saloes', JSON.stringify(st.saloesAtivos||{}));
      localStorage.setItem('pracas_config_bloqueadas', JSON.stringify(st.pracasBloqueadas||{}));
      localStorage.setItem('pracas_config_tipo', st.tipoSorteio||'geral');
      localStorage.setItem('pracas_config_f_almoco', st.incluirFechamentoNoAlmoco?'1':'0');
    }catch(e){}
  }
  function carregarConfigLocal(){
    try{
      st.pracasCustom = JSON.parse(localStorage.getItem('pracas_config_custom')||'{}') || {};
      st.pracasExtras = JSON.parse(localStorage.getItem('pracas_config_extras')||'[]') || [];
      st.pracasRemovidas = JSON.parse(localStorage.getItem('pracas_config_removidas')||'{}') || {};
      st.saloesRemovidos = JSON.parse(localStorage.getItem('pracas_config_saloes_removidos')||'{}') || {};
      st.saloesAtivos = Object.assign(st.saloesAtivos||{}, JSON.parse(localStorage.getItem('pracas_config_saloes')||'{}')||{});
      st.pracasBloqueadas = Object.assign(st.pracasBloqueadas||{}, JSON.parse(localStorage.getItem('pracas_config_bloqueadas')||'{}')||{});
      st.tipoSorteio = localStorage.getItem('pracas_config_tipo') || st.tipoSorteio || 'geral';
      st.incluirFechamentoNoAlmoco = localStorage.getItem('pracas_config_f_almoco')==='1' || st.incluirFechamentoNoAlmoco;
    }catch(e){}
  }
  function isSalaoAtivo(area){
    if(!st.saloesAtivos) st.saloesAtivos={};
    if(st.saloesRemovidos && st.saloesRemovidos[area]) return false;
    return st.saloesAtivos[area] !== false;
  }
  function isPracaDisponivelTurno(p){
    if(!isSalaoAtivo(p.area)) return false;
    if(st.pracasBloqueadas[p.id]) return false;
    if(st.turno==='almoco' && p.tipo==='F' && !st.incluirFechamentoNoAlmoco) return false;
    return true;
  }
  function filteredPracas(){
    let arr=getPracas().filter(isPracaDisponivelTurno);
    if(st.pracaFiltro!=='todas') arr=arr.filter(p=>p.tipo===st.pracaFiltro);
    return arr;
  }

  function equipeUnificada(eq){
    const ordemTurno = v => {
      const n=norm(v);
      if(n.includes('ABERTURA')) return 1;
      if(n.includes('INTERCALADO')) return 2;
      if(n.includes('FECHAMENTO')) return 3;
      return 4;
    };
    return [
      ...(eq.garcons||[]).map(p=>Object.assign({},p,{grupoPracas:'garcons'})),
      ...(eq.cf||[]).map(p=>Object.assign({},p,{grupoPracas:'cf'})),
      ...(eq.fechamento||[]).map(p=>Object.assign({},p,{grupoPracas:'fechamento'}))
    ].sort((a,b)=>ordemTurno(a.turno)-ordemTurno(b.turno) || String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  }

  function renderEquipe(){
    ensureSelected();
    const eq=equipeDoMapa();
    const lista=equipeUnificada(eq);
    const total = lista.length;
    const el=document.getElementById('pracasViewEquipe'); if(!el) return;
    el.innerHTML = `
      <div class="pracas-section-title"><span>Equipe presente <small style="color:#9ca9c7">(mapa do dia)</small></span><span class="pracas-count">${total} pessoas</span></div>
      <div class="pracas-list">${renderPessoasLista(lista)}</div>
    `;
  }
  function renderPessoasLista(lista){
    if(!lista.length) return '<div class="pracas-empty">Nenhuma pessoa elegível para o sorteio.</div>';
    return lista.map(p=>{
      const grupo = p.grupoPracas || 'garcons';
      const on = !!(st.selected[grupo] && st.selected[grupo][p.id]);
      return `<div class="pracas-person" onclick="togglePracasPessoa('${grupo}','${encodeURIComponent(p.id)}')">
        <div class="pracas-check ${on?'':'off'}">${on?'✓':'+'}</div>
        <div><div class="pracas-name">${p.nome}</div><div class="pracas-sub">${p.funcao||p.setor||''} • ${p.turno||''}</div></div>
        <span class="pracas-pill ${grupo==='cf'?'cf':(grupo==='fechamento'?'f':'')}">${grupo==='cf'?'CF':(grupo==='fechamento'?'F/':'Garçom')}</span>
      </div>`;
    }).join('');
  }
  function setActiveGrupo(){}

  function renderPracas(){
    const el=document.getElementById('pracasViewPracas'); if(!el) return;
    const prs=filteredPracas();
    const counts={NORMAL:getPracas().filter(p=>isSalaoAtivo(p.area)&&p.tipo==='NORMAL').length, CF:getPracas().filter(p=>isSalaoAtivo(p.area)&&p.tipo==='CF').length, F:getPracas().filter(p=>isSalaoAtivo(p.area)&&p.tipo==='F').length};
    el.innerHTML=`
      <div class="pracas-section-title"><span>Praças disponíveis para sorteio</span><span class="pracas-count">${prs.length} praças</span></div>
      <div class="pracas-tabs">
        <button class="${st.pracaFiltro==='todas'?'active':''}" onclick="setPracasFiltro('todas')">Todas</button>
        <button class="${st.pracaFiltro==='NORMAL'?'active':''}" onclick="setPracasFiltro('NORMAL')">Normal (${counts.NORMAL})</button>
        <button class="${st.pracaFiltro==='CF'?'active':''}" onclick="setPracasFiltro('CF')">CF (${counts.CF})</button>
        <button class="${st.pracaFiltro==='F'?'active':''}" onclick="setPracasFiltro('F')">F/ (${counts.F})</button>
      </div>
      <div class="pracas-list">${prs.map(p=>renderPracaRow(p)).join('')}</div>
      <div class="pracas-actions"><button class="pracas-btn purple" onclick="limparTravasPracas()">🔓 Limpar travas</button><button class="pracas-btn" onclick="setPracasView('equipe')">👥 Ver equipe</button></div>
    `;
  }
  function renderPracaRow(p){
    const lock=st.pracaLocks[p.id];
    const blocked=!!st.pracasBloqueadas[p.id];
    return `<div class="pracas-row" style="opacity:${blocked?'.45':'1'}">
      <div class="pracas-num">${p.numero}</div>
      <div><div class="pracas-name">Praça ${p.numero}</div><div class="pracas-sub">Mesas: ${p.mesas}<br>${p.area}</div>${lock?`<div class="pracas-sub" style="color:#f5c842">Travada para: ${lock.nome}</div>`:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="pracas-pill ${tipoClass(p.tipo)} ${lock?'lock':''}" onclick="editarTravaPraca('${p.id}')">${lock?'🔒 '+lock.nome:tipoLabel(p.tipo)}</button><button class="pracas-pill ${blocked?'lock':''}" onclick="toggleBloqueioPraca('${p.id}')">${blocked?'🚫 Fora':'Sortear'}</button></div>
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
    if(st.tipoSorteio==='individual'){
      st.resultado={id:'pr_'+Date.now(), data:st.data, turno:st.turno, criadoEm:new Date().toISOString(), normal:[], cf:[], fechamento:[], sobraram:{}, resumo:{modo:'individual'}};
      st.resultadosTurnos[st.turno]=st.resultado;
      renderSorteio();
      renderResultado();
      setPracasView('sorteio');
      toast('🎲 Sorteio individual iniciado');
      return;
    }
    const prs=getPracas().filter(isPracaDisponivelTurno);
    const normalPracas=prs.filter(p=>p.tipo==='NORMAL');
    const cfPracas=prs.filter(p=>p.tipo==='CF');
    const fPracas=(st.turno==='jantar' || st.incluirFechamentoNoAlmoco) ? prs.filter(p=>p.tipo==='F') : [];
    const r1=atribuir(normalPracas, selectedList('garcons'), 'garcons');
    const r2=atribuir(cfPracas, selectedList('cf'), 'cf');
    const r3=atribuir(fPracas, selectedList('fechamento'), 'fechamento');
    st.resultado={
      id:'pr_'+Date.now(), data:st.data, turno:st.turno, criadoEm:new Date().toISOString(),
      normal:r1.res, cf:r2.res, fechamento:r3.res,
      sobraram:{garcons:r1.sobraram, cf:r2.sobraram, fechamento:r3.sobraram},
      resumo:{garcons:selectedList('garcons').length, cf:selectedList('cf').length, fechamento:selectedList('fechamento').length, modo:'geral'}
    };
    st.resultadosTurnos[st.turno]=st.resultado;
    mostrarAnimacaoSorteio(st.resultado);
    renderSorteio();
    renderResultado();
    setPracasView('sorteio');
    const suc=document.getElementById('pracasSuccess'); if(suc) suc.classList.add('show');
    toast('🎲 Sorteio realizado com sucesso');
  }

  function refazerSorteio(){
    if(!st.resultado){ fazerSorteio(); return; }
    if(confirm('Refazer o sorteio deste turno? O resultado atual será substituído.')) fazerSorteio();
  }

  function pessoasPorGrupoParaSorteio(){
    return {
      garcons: selectedList('garcons'),
      cf: selectedList('cf'),
      fechamento: selectedList('fechamento')
    };
  }
  function totalPracasDisponiveisAgora(){
    return getPracas().filter(isPracaDisponivelTurno).length;
  }

  function renderResultado(){
    const el=document.getElementById('pracasViewResultado'); if(!el) return;
    el.innerHTML=`
      <div class="pracas-section-title"><span>Escala de praças dos garçons</span><span class="pracas-count">visão completa sem arrastar</span></div>
      ${renderEscalaPracas(true, 'resultado')}
    `;
  }

  function sorteioPessoasDisponiveis(){
    const usadas=new Set();
    if(st.resultado){ resultadoArrayFrom(st.resultado).forEach(x=>{ if(x.pessoa&&x.pessoa.id) usadas.add(x.pessoa.id); }); }
    const todos=[...selectedList('garcons'),...selectedList('cf'),...selectedList('fechamento')];
    const seen=new Set();
    return todos.filter(p=>{ if(!p||!p.id||seen.has(p.id)||usadas.has(p.id)) return false; seen.add(p.id); return true; });
  }

  function initials(nome){
    return String(nome||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || '—';
  }

  function renderListaSorteioCompacta(){
    const pessoas=sorteioPessoasDisponiveis();
    const html=pessoas.map(p=>{
      const grupo = selectedList('cf').some(x=>x.id===p.id) ? 'cf' : (selectedList('fechamento').some(x=>x.id===p.id) ? 'fechamento' : 'garcons');
      return `<div class="pracas-live-person"><div class="pracas-avatar">${initials(p.nome)}</div><div><div class="pracas-name">${p.nome}</div><div class="pracas-sub">${grupo==='cf'?'CHEFE DE FILA':'GARÇOM'}</div></div><button class="pracas-small-btn" onclick="sortearPracaIndividual('${grupo}','${encodeURIComponent(p.id)}')">🎲 Sortear</button></div>`;
    }).join('') || '<div class="pracas-empty">Todos já foram sorteados ou não há equipe disponível.</div>';
    return `<div class="pracas-sorteio-left"><div class="pracas-section-title"><span>Sorteio de praças</span><span class="pracas-count">${pessoas.length} disponíveis</span></div><div class="pracas-live-list">${html}</div><div class="pracas-sorteio-actions"><button class="pracas-btn purple" onclick="setPracasView('equipe')">👥 Equipe</button><button class="pracas-btn" onclick="setPracasView('config')">⚙️ Configurar</button></div></div>`;
  }

  function renderSorteio(){
    const el=document.getElementById('pracasViewSorteio'); if(!el) return;
    const disponiveis=sorteioPessoasDisponiveis().length;
    const preenchidas=st.resultado ? resultadoArrayFrom(st.resultado).filter(x=>x.pessoa&&x.pessoa.nome).length : 0;
    const total=getPracas().filter(isPracaDisponivelTurno).length;
    el.innerHTML=`
      <div class="pracas-sorteio-layout">
        ${renderListaSorteioCompacta()}
        <div class="pracas-sorteio-scale">
          <div class="pracas-sorteio-scale-head"><div><div class="pracas-sorteio-scale-title">Escala de praças dos garçons</div><div class="pracas-live-dot">● atualizado ao vivo conforme o sorteio</div></div><button class="pracas-pill" onclick="imprimirEscalaPracas()">🖨️ Imprimir</button></div>
          ${renderEscalaPracas(false, 'sorteio')}
          <div class="pracas-fit-footer"><span>Disponíveis: <b>${disponiveis}</b></span><span>Total de praças: <b>${total}</b></span><span>Preenchidas: <b>${preenchidas}</b></span></div>
        </div>
      </div>`;
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
      normal:conv(r.normal), cf:conv(r.cf), fechamento:conv(r.fechamento), sobraram:r.sobraram||{}, travas:st.pracaLocks, pracasBloqueadas:st.pracasBloqueadas, tipoSorteio:st.tipoSorteio, incluirFechamentoNoAlmoco:!!st.incluirFechamentoNoAlmoco, saloesAtivos:st.saloesAtivos||{}, resumo:r.resumo||{} };
  }
  async function salvar(){
    if(!st.resultado){ toast('⚠️ Faça o sorteio antes de salvar'); return; }
    const payload = payloadResultado();
    const localKey = `pracas_sorteio_${st.data}_${st.turno}`;
    if(localStorage.getItem(localKey) && !confirm('Já existe sorteio salvo para esta data/turno. Deseja sobrescrever?')) return;
    try{ localStorage.setItem(localKey, JSON.stringify(payload)); }catch(e){}
    if(window.fbDb){
      try{
        await window.fbDb.ref(pathTurno()).set(payload);
        await window.fbDb.ref(`pracas_diarias/historico/${st.data}/${Date.now()}`).set(payload);
        toast('💾 Sorteio do dia salvo no Firebase');
        carregarHistorico();
        return;
      }catch(e){ console.warn('salvar sorteio Firebase', e); }
    }
    toast('💾 Sorteio salvo neste aparelho. Firebase não confirmou conexão.');
  }
  async function carregarSorteioSalvo(){
    let v=null;
    try{
      if(window.fbDb){ const s=await window.fbDb.ref(pathTurno()).once('value'); v=s.val(); }
      if(!v){ try{ v=JSON.parse(localStorage.getItem(`pracas_sorteio_${st.data}_${st.turno}`)||'null'); }catch(e){} }
      if(!v) return;
      const byId={}; getPracas().forEach(p=>byId[p.id]=p);
      const deconv = arr => (arr||[]).map(x=>({praca:byId[x.pracaId]||{id:x.pracaId,numero:x.praca,mesas:x.mesas,area:x.area,tipo:x.tipo}, pessoa:{nome:x.pessoa,id:x.pessoaId}, travada:!!x.travada}));
      st.pracaLocks = v.travas || {};
      st.pracasBloqueadas = v.pracasBloqueadas || st.pracasBloqueadas || {};
      st.tipoSorteio = v.tipoSorteio || st.tipoSorteio || 'geral';
      st.incluirFechamentoNoAlmoco = !!v.incluirFechamentoNoAlmoco;
      st.saloesAtivos = Object.assign(st.saloesAtivos||{}, v.saloesAtivos||{});
      st.resultado={id:v.id, data:v.data, turno:v.turno, criadoEm:v.atualizadoEm, normal:deconv(v.normal), cf:deconv(v.cf), fechamento:deconv(v.fechamento), sobraram:v.sobraram||{}, resumo:v.resumo||{}};
      st.resultadosTurnos[st.turno]=st.resultado;
      renderAll();
    }catch(e){ console.warn('carregar sorteio', e); }
  }
  async function carregarAmbosTurnos(){
    if(!firebaseOk()) return;
    const turnoAtual=st.turno;
    for(const t of ['almoco','jantar']){
      st.turno=t;
      try{ await carregarSorteioSalvo(); }catch(e){}
    }
    st.turno=turnoAtual;
    st.resultado=st.resultadosTurnos[turnoAtual]||null;
    renderAll();
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
    if(st.turno==='jantar' || st.incluirFechamentoNoAlmoco){ addTitulo('FECHAMENTO (F/):'); addArr(r.fechamento); linhas.push(''); }
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

  function estatisticasPracasConfig(){
    const todas=getPracas();
    const saloes=[...new Set([...todas.map(p=>p.area), ...Object.keys(st.saloesAtivos||{}).filter(a=>!(st.saloesRemovidos||{})[a])])];
    const ativas=todas.filter(p=>isSalaoAtivo(p.area) && !st.pracasBloqueadas[p.id]);
    const normais=ativas.filter(p=>p.tipo==='NORMAL').length;
    const cf=ativas.filter(p=>p.tipo==='CF').length;
    const f=ativas.filter(p=>p.tipo==='F').length;
    const turnoDisponiveis=todas.filter(isPracaDisponivelTurno).length;
    return {total:todas.length, disponiveis:ativas.length, turnoDisponiveis, normais, cf, f, saloes:saloes.length, saloesAtivos:saloes.filter(a=>isSalaoAtivo(a)).length};
  }

  function renderConfig(){
    const el=document.getElementById('pracasViewConfig'); if(!el) return;
    const totalBloq=Object.keys(st.pracasBloqueadas||{}).length;
    const stats=estatisticasPracasConfig();
    const areas=[...new Set([...getPracas().map(p=>p.area), ...Object.keys(st.saloesAtivos||{}).filter(a=>!(st.saloesRemovidos||{})[a])])].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    const totalSaloesAtivos=areas.filter(a=>isSalaoAtivo(a)).length;
    el.innerHTML=`
      <div class="pracas-section-title"><span>Configuração do sorteio</span><span class="pracas-count">${stats.turnoDisponiveis} praças disponíveis</span></div>
      <div class="pracas-config-grid">
        <button class="pracas-config-option ${st.tipoSorteio==='geral'?'active':''}" onclick="setTipoSorteioPracas('geral')">🎲 Sorteio automático geral<br><small>Sorteia todos ao mesmo tempo.</small></button>
        <button class="pracas-config-option ${st.tipoSorteio==='individual'?'active':''}" onclick="setTipoSorteioPracas('individual')">👆 Sorteio individual<br><small>Cada garçom toca em sortear.</small></button>
      </div>
      <div class="pracas-list">
        <div class="pracas-row"><div class="pracas-num">${stats.turnoDisponiveis}</div><div><div class="pracas-name">Praças disponíveis para sorteio</div><div class="pracas-sub">Total atualizado conforme salão ativo, bloqueios e turno selecionado.</div></div><span class="pracas-pill lock">Atualizado</span></div>
      </div>

      <div class="pracas-section-title"><span>Regra de final de semana</span><span class="pracas-count">F/ no almoço</span></div>
      <div class="pracas-list">
        <div class="pracas-row">
          <div class="pracas-num">F/</div>
          <div><div class="pracas-name">Incluir garçons do fechamento no sorteio do almoço</div><div class="pracas-sub">Use em sábados, domingos e feriados quando todos trabalham no almoço e jantar.</div></div>
          <button class="pracas-pill ${st.incluirFechamentoNoAlmoco?'lock':''}" onclick="toggleFechamentoAlmocoPracas()">${st.incluirFechamentoNoAlmoco?'✅ Ativo':'Desativado'}</button>
        </div>
      </div>

      <div class="pracas-section-title"><span>Salões cadastrados</span><span class="pracas-count">${totalSaloesAtivos}/${areas.length} ativos</span></div>
      <div class="pracas-list">
        ${areas.map(area=>`<div class="pracas-row"><div class="pracas-num">${isSalaoAtivo(area)?'✓':'×'}</div><div><div class="pracas-name">${area}</div><div class="pracas-sub">${getPracas().filter(p=>p.area===area).length} praças cadastradas</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="pracas-pill" onclick="editarSalaoPracas('${encodeURIComponent(area)}')">✏️ Editar</button><button class="pracas-pill ${isSalaoAtivo(area)?'lock':''}" onclick="toggleSalaoPracas('${encodeURIComponent(area)}')">${isSalaoAtivo(area)?'Sorteia':'Fora'}</button><button class="pracas-pill pracas-danger" onclick="excluirSalaoPracas('${encodeURIComponent(area)}')">Excluir</button></div></div>`).join('') || '<div class="pracas-empty">Nenhum salão cadastrado.</div>'}
      </div>
      <div class="pracas-actions"><button class="pracas-btn green" onclick="novoSalaoPracas()">+ Novo salão</button><button class="pracas-btn" onclick="novaPracaConfig()">+ Nova praça</button></div>

      <div class="pracas-section-title"><span>Editar praças, mesas, CF e F/</span><span class="pracas-count">${totalBloq} bloqueadas</span></div>
      <div class="pracas-list">${getPracas().map(p=>`<div class="pracas-row"><div class="pracas-num">${p.numero}</div><div><div class="pracas-name">Praça ${p.numero} <span class="pracas-pill ${tipoClass(p.tipo)}">${tipoLabel(p.tipo)}</span></div><div class="pracas-sub">${p.area} • Mesas: ${p.mesas}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="pracas-pill" onclick="editarConfigPraca('${p.id}')">✏️ Editar</button><button class="pracas-pill ${st.pracasBloqueadas[p.id]?'lock':''}" onclick="toggleBloqueioPraca('${p.id}')">${st.pracasBloqueadas[p.id]?'🚫 Bloqueada':'Disponível'}</button><button class="pracas-pill pracas-danger" onclick="excluirPracaConfig('${p.id}')">Excluir</button></div></div>`).join('') || '<div class="pracas-empty">Nenhuma praça cadastrada.</div>'}</div>
      <div class="pracas-actions"><button class="pracas-btn red" onclick="limparBloqueiosPracas()">🚫 Limpar bloqueios</button><button class="pracas-btn" onclick="restaurarPracasPadrao()">↩️ Restaurar padrão</button></div>
      <div class="pracas-actions"><button class="pracas-btn green" onclick="salvarConfigPracas()">💾 Salvar configurações</button><button class="pracas-btn" onclick="setPracasView('resultado')">📋 Ver escala</button></div>
    `;
  }

  function resultadoArrayAtual(){
    const r=st.resultado || {normal:[],cf:[],fechamento:[]};
    return [...(r.normal||[]), ...(r.cf||[]), ...(r.fechamento||[])];
  }
  function isPracaAtribuida(pracaId){ return resultadoArrayAtual().some(x=>x.praca && x.praca.id===pracaId); }
  function isPessoaAtribuida(id){ return resultadoArrayAtual().some(x=>x.pessoa && x.pessoa.id===id); }
  function tipoParaGrupo(tipo){ return tipo==='CF'?'cf':(tipo==='F'?'fechamento':'garcons'); }
  function arrDoGrupoResultado(grupo){ if(!st.resultado) return []; return grupo==='cf'?st.resultado.cf:(grupo==='fechamento'?st.resultado.fechamento:st.resultado.normal); }
  function pracaElegivelIndividual(grupo){
    let prs=getPracas().filter(p=>isPracaDisponivelTurno(p) && !isPracaAtribuida(p.id) && tipoParaGrupo(p.tipo)===grupo);
    return prs;
  }
  function pessoasElegiveisIndividual(grupo){ return selectedList(grupo).filter(p=>!isPessoaAtribuida(p.id)); }
  function renderSorteioIndividual(){
    const grupos=[['garcons','Garçons'],['cf','Chefe de fila (CF)'],['fechamento','Fechamento (F/)']];
    return `<div class="pracas-section-title"><span>Sorteio individual</span><span class="pracas-count">cada pessoa sorteia a sua praça</span></div>
      <div id="pracasSpinner" class="pracas-spinner-card pracas-hidden"><div class="pracas-label">Sorteando praça...</div><div id="pracasSpinnerNum" class="pracas-spinner-num">0</div></div>
      ${grupos.map(([g,label])=>{
        if(st.turno==='almoco' && g==='fechamento' && !st.incluirFechamentoNoAlmoco) return '';
        const pessoas=pessoasElegiveisIndividual(g);
        const pracas=pracaElegivelIndividual(g);
        return `<div class="pracas-card" style="margin-bottom:10px"><div class="pracas-section-title" style="margin-top:0"><span>${label}</span><span class="pracas-count">${pessoas.length} pessoas • ${pracas.length} praças</span></div>${pessoas.map(p=>`<div class="pracas-ind-person"><div><div class="pracas-name">${p.nome}</div><div class="pracas-sub">${p.funcao||p.setor||''}</div></div><button class="pracas-small-btn" ${!pracas.length?'disabled':''} onclick="sortearPracaIndividual('${g}','${encodeURIComponent(p.id)}')">🎲 Sortear</button></div>`).join('') || '<div class="pracas-empty">Todos deste grupo já sortearam ou não há pessoas elegíveis.</div>'}</div>`;
      }).join('')}`;
  }
  function pushResultadoIndividual(grupo, pessoa, praca){
    if(!st.resultado) st.resultado={id:'pr_'+Date.now(), data:st.data, turno:st.turno, criadoEm:new Date().toISOString(), normal:[], cf:[], fechamento:[], sobraram:{}, resumo:{modo:'individual'}};
    const alvo=arrDoGrupoResultado(grupo);
    alvo.push({praca, pessoa, travada:false});
    st.resultadosTurnos[st.turno]=st.resultado;
  }

  function nomePorPracaTurno(turno, pracaId){
    const r=st.resultadosTurnos[turno]; if(!r) return '';
    const all=[...(r.normal||[]),...(r.cf||[]),...(r.fechamento||[])];
    const ach=all.find(x=>x.praca && x.praca.id===pracaId);
    return ach && ach.pessoa ? (ach.pessoa.nome||'') : '';
  }
  function areaRows(){
    const groups=[]; let cur=null;
    getPracas().filter(isPracaDisponivelTurno).forEach(p=>{ if(!cur || cur.area!==p.area){ cur={area:p.area,rows:[]}; groups.push(cur); } cur.rows.push(p); });
    return groups;
  }
  function renderEscalaPracas(showActions, contexto){
    const data=fmtBR(st.data||todayISO());
    const diaSemana=(()=>{try{const d=new Date((st.data||todayISO())+'T12:00:00');return d.toLocaleDateString('pt-BR',{weekday:'long'}).toUpperCase();}catch(e){return '';}})();
    const qtdAlmoco=st.resultadosTurnos.almoco?resultadoArrayFrom(st.resultadosTurnos.almoco).filter(x=>x.pessoa&&x.pessoa.nome).length:0;
    const qtdJantar=st.resultadosTurnos.jantar?resultadoArrayFrom(st.resultadosTurnos.jantar).filter(x=>x.pessoa&&x.pessoa.nome).length:0;
    const equipeUnica=new Set([...selectedList('garcons'),...selectedList('cf'),...selectedList('fechamento')].filter(p=>p&&p.id).map(p=>p.id));
    const totalEquipe=equipeUnica.size || qtdAlmoco || qtdJantar || 0;
    const totalPracasDia=getPracas().filter(isPracaDisponivelTurno).length;
    const qtd=`${totalEquipe} / ${totalPracasDia}`;
    const groups=areaRows();
    const rowsHtml = groups.length ? groups.map(g=>`<tr class="pracas-area-row"><td colspan="5">${g.area}</td></tr>${g.rows.map(p=>`<tr><td class="pracas-prnum">${p.numero}º</td><td class="pracas-flag">${p.tipo==='F'?'F/':(p.tipo==='CF'?'CF':'')}</td><td>${nomePorPracaTurno('almoco',p.id)||''}</td><td class="pracas-mesas">${p.mesas}</td><td>${nomePorPracaTurno('jantar',p.id)||''}</td></tr>`).join('')}`).join('') : '<tr><td colspan="5">Nenhuma praça disponível conforme as configurações atuais.</td></tr>';
    return `<div id="pracasPrintArea" class="pracas-print-box ${(['resultado','sorteio'].includes(contexto)?'pracas-fit':'')}">
      <div class="pracas-print-title">ESCALA DE PRAÇAS DOS GARÇONS</div>
      <table class="pracas-meta-table"><tr><td rowspan="3" class="pracas-logo-cell">COCO<br>BAMBU</td><td>DATA: <b>${data}</b></td><td>TURNO: <b>ALMOÇO / JANTAR</b></td></tr><tr><td>DIA DA SEMANA: <b>${diaSemana}</b></td><td>GARÇONS / PRAÇAS: <b>${qtd}</b></td></tr><tr><td>MAITRE: ____________________</td><td></td></tr></table>
      <table class="pracas-escala-table"><colgroup><col class="pr-col-num"><col class="pr-col-flag"><col class="pr-col-almoco"><col class="pr-col-mesa"><col class="pr-col-jantar"></colgroup><thead><tr><th></th><th></th><th>ALMOÇO</th><th>Nº DA MESA</th><th>JANTAR</th></tr></thead><tbody>
      ${rowsHtml}
      </tbody></table>
    </div>${showActions?`<div class="pracas-print-actions no-print"><button class="pracas-btn" onclick="imprimirEscalaPracas()">🖨️ Imprimir / PDF</button><button class="pracas-btn green" onclick="abrirCompartilharPracas()">📤 Compartilhar</button></div>`:''}`;
  }
  function resultadoArrayFrom(r){ return [...(r.normal||[]),...(r.cf||[]),...(r.fechamento||[])]; }
  function textoEscalaTabela(){
    const linhas=[`ESCALA DE PRAÇAS DOS GARÇONS — ${fmtBR(st.data)}`,''];
    areaRows().forEach(g=>{ linhas.push(g.area); g.rows.forEach(p=>linhas.push(`${p.numero}º ${p.tipo==='F'?'F/':(p.tipo==='CF'?'CF':'')} | Mesas ${p.mesas} | Almoço: ${nomePorPracaTurno('almoco',p.id)||'-'} | Jantar: ${nomePorPracaTurno('jantar',p.id)||'-'}`)); linhas.push(''); });
    return linhas.join('\n').trim();
  }

  function renderAll(){ renderEquipe(); renderPracas(); renderSorteio(); renderResultado(); renderHistorico(); renderConfig(); updateTop(); }
  function updateTop(){
    const a=document.getElementById('prTurnoAlmoco'), j=document.getElementById('prTurnoJantar'); if(a) a.classList.toggle('active',st.turno==='almoco'); if(j) j.classList.toggle('active',st.turno==='jantar');
    const d=document.getElementById('pracasData'); if(d && d.value!==st.data) d.value=st.data;
  }
  function setView(v){
    ['Equipe','Sorteio','Resultado','Historico','Config'].forEach(name=>{const el=document.getElementById('pracasView'+name); if(el) el.classList.add('pracas-hidden');});
    const map={equipe:'Equipe',sorteio:'Sorteio',resultado:'Resultado',historico:'Historico',config:'Config'};
    const el=document.getElementById('pracasView'+map[v]); if(el) el.classList.remove('pracas-hidden');
    [['equipe','prNavEquipe'],['sorteio','prNavSorteio'],['resultado','prNavResultado'],['historico','prNavHistorico'],['config','prNavConfig']].forEach(([x,id])=>{const b=document.getElementById(id); if(b) b.classList.toggle('active',x===v);});
    if(v==='historico') carregarHistorico();
    if(v==='config') renderConfig();
  }

  window.openPracasDiarias = async function(){
    ensurePanel();
    carregarConfigLocal();
    st.data = st.data || todayISO();
    document.getElementById('pracasDiariasPanel').classList.add('open');
    try{ document.body.classList.remove('home-active'); }catch(e){}
    ensureSelected(); renderAll(); setView('equipe');
    await carregarAmbosTurnos();
    carregarHistorico();
  };
  window.closePracasDiarias = function(){ const p=document.getElementById('pracasDiariasPanel'); if(p) p.classList.remove('open'); };
  window.setPracasTurno = function(t){ st.turno=t; st.resultado=st.resultadosTurnos[t]||null; renderAll(); carregarSorteioSalvo(); };
  window.setPracasData = function(v){ st.data=v||todayISO(); st.resultado=null; st.resultadosTurnos={almoco:null,jantar:null}; renderAll(); carregarAmbosTurnos(); };
  window.setPracasGrupo = function(g){ st.grupo=g; renderEquipe(); };
  window.togglePracasPessoa = function(g,encodedId){ const id=decodeURIComponent(encodedId); st.selected[g][id]=!st.selected[g][id]; renderEquipe(); };
  window.setPracasFiltro = function(f){ st.pracaFiltro=f; renderPracas(); };
  window.setPracasView = setView;
  window.sortearPracasDiarias = fazerSorteio;
  window.refazerPracasDiarias = refazerSorteio;
  window.salvarPracasSorteio = salvar;
  window.copiarPracasWhatsApp = copiar;
  window.limparTravasPracas = function(){ if(confirm('Limpar todas as travas manuais?')){st.pracaLocks={}; renderPracas(); toast('🔓 Travas removidas');} };
  window.setTipoSorteioPracas = function(tipo){ st.tipoSorteio=tipo||'geral'; salvarConfigLocal(); renderAll(); toast(tipo==='individual'?'👆 Sorteio individual ativado':'🎲 Sorteio geral ativado'); };
  window.toggleFechamentoAlmocoPracas = function(){ st.incluirFechamentoNoAlmoco=!st.incluirFechamentoNoAlmoco; salvarConfigLocal(); renderAll(); toast(st.incluirFechamentoNoAlmoco?'✅ Fechamento incluído no almoço':'F/ removido do almoço'); };
  window.toggleSalaoPracas = function(encodedArea){ const area=decodeURIComponent(encodedArea); st.saloesAtivos[area]=!isSalaoAtivo(area); salvarConfigLocal(); renderAll(); toast((st.saloesAtivos[area]?'✅ ':'🚫 ')+area); };
  window.toggleBloqueioPraca = function(pracaId){ if(st.pracasBloqueadas[pracaId]) delete st.pracasBloqueadas[pracaId]; else st.pracasBloqueadas[pracaId]=true; salvarConfigLocal(); renderPracas(); renderConfig(); renderResultado(); renderSorteio(); };
  window.limparBloqueiosPracas = function(){ if(confirm('Liberar todas as praças bloqueadas?')){st.pracasBloqueadas={}; salvarConfigLocal(); renderAll(); toast('✅ Praças liberadas');} };
  window.sortearPracaIndividual = function(grupo, encodedId){
    const id=decodeURIComponent(encodedId); const pessoa=selectedList(grupo).find(p=>p.id===id); if(!pessoa) return toast('Pessoa não encontrada');
    const disponiveis=pracaElegivelIndividual(grupo); if(!disponiveis.length) return toast('Não há praça disponível para este grupo');
    const sp=document.getElementById('pracasSpinner'), num=document.getElementById('pracasSpinnerNum'); if(sp) sp.classList.remove('pracas-hidden');
    let ticks=0; const timer=setInterval(()=>{ const p=disponiveis[Math.floor(Math.random()*disponiveis.length)]; if(num) num.textContent=p.numero; ticks++; if(ticks>18){ clearInterval(timer); const escolhida=disponiveis[Math.floor(Math.random()*disponiveis.length)]; if(num) num.textContent=escolhida.numero; pushResultadoIndividual(grupo,pessoa,escolhida); setTimeout(()=>{if(sp) sp.classList.add('pracas-hidden'); renderSorteio(); renderResultado(); renderConfig(); toast(`🎲 ${pessoa.nome} caiu na Praça ${escolhida.numero}`);},500); } },80);
  };

  function mostrarAnimacaoSorteio(resultado){
    const arr=resultadoArrayFrom(resultado||st.resultado||{}).filter(x=>x.praca);
    if(!arr.length) return;
    const final=arr[arr.length-1];
    const nums=arr.map(x=>x.praca.numero);
    const old=document.getElementById('pracasSorteioAnimacao'); if(old) old.remove();
    const d=document.createElement('div'); d.id='pracasSorteioAnimacao'; d.className='pracas-sorteio-modal';
    d.innerHTML=`<div class="pracas-sorteio-box"><h3>🎲 Sorteio em andamento</h3><div class="pracas-sub">os números passam até parar na praça sorteada</div><div class="pracas-sorteio-roll"><div id="pracasRollNum" class="pracas-roll-num">--</div></div><div id="pracasRollFinal" class="pracas-sorteio-final">Sorteando...</div></div>`;
    document.body.appendChild(d);
    const num=document.getElementById('pracasRollNum'); const msg=document.getElementById('pracasRollFinal');
    let i=0; const all=getPracas().filter(isPracaDisponivelTurno).map(p=>p.numero); const base=all.length?all:nums;
    const timer=setInterval(()=>{ num.textContent=base[Math.floor(Math.random()*base.length)]||'--'; i++; if(i>24){ clearInterval(timer); num.textContent=final.praca.numero; num.classList.add('pracas-roll-final'); msg.innerHTML=`Praça sorteada:<br><b>${final.praca.area} - ${final.praca.numero}º</b><br><small>Mesas: ${final.praca.mesas}</small>`; setTimeout(()=>{ d.remove(); },1200); } },55);
  }

  function modalPracas(html){
    const old=document.getElementById('pracasModalBack'); if(old) old.remove();
    const d=document.createElement('div'); d.id='pracasModalBack'; d.className='pracas-modal-back';
    d.innerHTML=`<div class="pracas-modal">${html}</div>`;
    d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
    document.body.appendChild(d); return d;
  }
  window.fecharModalPracas=function(){ const d=document.getElementById('pracasModalBack'); if(d) d.remove(); };
  window.abrirCompartilharPracas=function(){
    modalPracas(`<h3>📤 Compartilhar escala</h3>
      <p style="color:#b8c2dd;margin-top:0">Escolha como deseja enviar a escala de praças.</p>
      <button class="pracas-btn green" style="width:100%;margin:6px 0" onclick="compartilharPracasTexto('whatsapp')">🟢 WhatsApp como texto</button>
      <button class="pracas-btn" style="width:100%;margin:6px 0" onclick="compartilharPracasTexto('telegram')">✈️ Telegram como texto</button>
      <button class="pracas-btn primary" style="width:100%;margin:8px 0" onclick="compartilharPracasImagem()">🖼️ Compartilhar como imagem da escala</button>
      <button class="pracas-btn red" style="width:100%;margin-top:8px" onclick="fecharModalPracas()">Cancelar</button>`);
  };
  window.compartilharPracasTexto=function(app){
    const texto=textoEscalaTabela();
    const url = app==='telegram'
      ? `https://t.me/share/url?url=&text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    try{ window.open(url,'_blank'); }catch(e){ fallbackCopy(texto,()=>toast('Texto copiado')); }
  };
  async function canvasEscalaPracas(){
    const canvas=document.createElement('canvas'); const W=1400; const rowH=42; const metaH=110; const groups=areaRows();
    let rows=0; groups.forEach(g=>{ rows+=1+g.rows.length; });
    const H=80+metaH+46+(rows*rowH)+40; canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); ctx.textBaseline='middle';
    const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    ctx.fillStyle='#202020'; ctx.fillRect(0,0,W,56); ctx.fillStyle='#fff'; ctx.font='900 28px Arial'; ctx.textAlign='center'; ctx.fillText('ESCALA DE PRAÇAS DOS GARÇONS',W/2,28);
    ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,0,W,56);
    const data=fmtBR(st.data||todayISO()); const d=new Date((st.data||todayISO())+'T12:00:00'); const dia=d.toLocaleDateString('pt-BR',{weekday:'long'}).toUpperCase();
    ctx.fillStyle='#8b5a24'; ctx.font='900 26px Arial'; ctx.textAlign='center'; ctx.fillText('COCO\nBAMBU'.split('\n')[0],150,88); ctx.fillText('BAMBU',150,120);
    ctx.fillStyle='#111'; ctx.font='700 22px Arial'; ctx.textAlign='left'; ctx.fillText(`DATA: ${data}`,300,86); ctx.fillText(`TURNO: ALMOÇO / JANTAR`,780,86); ctx.fillText(`DIA DA SEMANA: ${dia}`,300,126); ctx.fillText(`QUANT. GARÇOM: ${resultadoArrayFrom(st.resultadosTurnos.almoco||{}).length + resultadoArrayFrom(st.resultadosTurnos.jantar||{}).length}`,780,126); ctx.fillText('MAITRE: ____________________',300,166);
    ctx.strokeStyle='#999'; ctx.lineWidth=1; ctx.strokeRect(0,56,W,metaH); line(260,56,260,166); line(740,56,740,166); line(260,112,W,112);
    let y=56+metaH; const cols=[0,90,170,680,1030,W];
    ctx.fillStyle='#f4f4f4'; ctx.fillRect(0,y,W,46); ctx.fillStyle='#111'; ctx.font='900 22px Arial'; ctx.textAlign='center'; ctx.fillText('Nº DA MESA',(cols[2]+cols[3])/2,y+23); ctx.fillText('ALMOÇO',(cols[3]+cols[4])/2,y+23); ctx.fillText('JANTAR',(cols[4]+cols[5])/2,y+23); ctx.strokeRect(0,y,W,46); cols.forEach(x=>line(x,y,x,y+46)); y+=46;
    groups.forEach(g=>{ ctx.fillStyle='#242424'; ctx.fillRect(0,y,W,rowH); ctx.fillStyle='#fff'; ctx.font='900 22px Arial'; ctx.textAlign='center'; ctx.fillText(g.area,W/2,y+rowH/2); ctx.strokeRect(0,y,W,rowH); y+=rowH; g.rows.forEach(p=>{ ctx.fillStyle='#fff'; ctx.fillRect(0,y,W,rowH); ctx.fillStyle='#202020'; ctx.fillRect(cols[1],y,cols[2]-cols[1],rowH); ctx.strokeStyle='#111'; ctx.strokeRect(0,y,W,rowH); cols.forEach(x=>line(x,y,x,y+rowH)); ctx.fillStyle='#111'; ctx.font='900 20px Arial'; ctx.textAlign='center'; ctx.fillText(`${p.numero}º`,45,y+rowH/2); ctx.fillStyle='#fff'; ctx.fillText(p.tipo==='F'?'F/':(p.tipo==='CF'?'CF':''),(cols[1]+cols[2])/2,y+rowH/2); ctx.fillStyle='#111'; ctx.font='900 20px Arial'; ctx.fillText(p.mesas,(cols[2]+cols[3])/2,y+rowH/2); ctx.font='20px Arial'; ctx.fillText(nomePorPracaTurno('almoco',p.id)||'-',(cols[3]+cols[4])/2,y+rowH/2); ctx.fillText(nomePorPracaTurno('jantar',p.id)||'-',(cols[4]+cols[5])/2,y+rowH/2); y+=rowH; }); });
    return canvas;
  }
  window.compartilharPracasImagem=async function(){
    try{
      const canvas=await canvasEscalaPracas();
      canvas.toBlob(async blob=>{
        const file=new File([blob],`escala-pracas-${st.data||todayISO()}.png`,{type:'image/png'});
        if(navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({title:'Escala de Praças', text:`Escala de praças — ${fmtBR(st.data)}`, files:[file]});
        }else{
          const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; a.click(); toast('🖼️ Imagem gerada. Anexe no WhatsApp ou Telegram.');
        }
      },'image/png');
    }catch(e){ console.warn(e); toast('Não foi possível gerar a imagem. Use Imprimir/PDF.'); }
  };
  window.editarConfigPraca=function(pracaId){
    const p=getPracas().find(x=>x.id===pracaId); if(!p) return;
    modalPracas(`<h3>✏️ Editar praça ${p.numero}</h3>
      <label class="pracas-label">Número da praça</label><input id="editPracaNumero" type="number" class="pracas-text" value="${Number(p.numero)||''}">
      <label class="pracas-label">Salão / área</label><input id="editPracaArea" class="pracas-text" value="${String(p.area).replace(/"/g,'&quot;')}">
      <label class="pracas-label">Numeração das mesas</label><textarea id="editPracaMesas" class="pracas-text pracas-textarea">${String(p.mesas)}</textarea>
      <label class="pracas-label">Tipo da praça</label><select id="editPracaTipo" class="pracas-select"><option value="NORMAL" ${p.tipo==='NORMAL'?'selected':''}>Normal</option><option value="CF" ${p.tipo==='CF'?'selected':''}>CF — Chefe de fila</option><option value="F" ${p.tipo==='F'?'selected':''}>F/ — Fechamento</option></select>
      <div class="pracas-modal-actions"><button class="pracas-btn red" onclick="fecharModalPracas()">Cancelar</button><button class="pracas-btn green" onclick="salvarEdicaoPraca('${pracaId}')">Salvar</button></div>`);
  };
  window.salvarEdicaoPraca=function(pracaId){
    const numero=Number(document.getElementById('editPracaNumero')?.value||0);
    const area=document.getElementById('editPracaArea')?.value?.trim()||'';
    const mesas=document.getElementById('editPracaMesas')?.value?.trim()||'';
    const tipo=document.getElementById('editPracaTipo')?.value||'NORMAL';
    if(!numero || !area || !mesas) return toast('Preencha número, salão e mesas.');
    st.pracasCustom=st.pracasCustom||{}; st.pracasCustom[pracaId]=Object.assign({}, st.pracasCustom[pracaId]||{}, {numero,area,mesas,tipo});
    if(st.saloesRemovidos && st.saloesRemovidos[area]) delete st.saloesRemovidos[area];
    if(st.saloesAtivos && st.saloesAtivos[area]===undefined) st.saloesAtivos[area]=true;
    salvarConfigLocal(); fecharModalPracas(); renderAll(); toast('✅ Praça atualizada');
  };
  window.novaPracaConfig=function(areaPadrao){
    const areas=[...new Set(getPracas().map(p=>p.area))].sort();
    const prox=(getPracas().reduce((m,p)=>Math.max(m,Number(p.numero)||0),0)||0)+1;
    modalPracas(`<h3>+ Nova praça</h3>
      <label class="pracas-label">Número da praça</label><input id="novaPracaNumero" type="number" class="pracas-text" value="${prox}">
      <label class="pracas-label">Salão / área</label><input id="novaPracaArea" class="pracas-text" value="${String(areaPadrao||areas[0]||'').replace(/"/g,'&quot;')}" placeholder="Ex.: Salão Barra">
      <label class="pracas-label">Mesas</label><textarea id="novaPracaMesas" class="pracas-text pracas-textarea" placeholder="Ex.: 01, 02 e 03"></textarea>
      <label class="pracas-label">Tipo da praça</label><select id="novaPracaTipo" class="pracas-select"><option value="NORMAL">Normal</option><option value="CF">CF — Chefe de fila</option><option value="F">F/ — Fechamento</option></select>
      <div class="pracas-modal-actions"><button class="pracas-btn red" onclick="fecharModalPracas()">Cancelar</button><button class="pracas-btn green" onclick="salvarNovaPracaConfig()">Salvar</button></div>`);
  };
  window.salvarNovaPracaConfig=function(){
    const numero=Number(document.getElementById('novaPracaNumero')?.value||0);
    const area=document.getElementById('novaPracaArea')?.value?.trim()||'';
    const mesas=document.getElementById('novaPracaMesas')?.value?.trim()||'';
    const tipo=document.getElementById('novaPracaTipo')?.value||'NORMAL';
    if(!numero || !area || !mesas) return toast('Preencha número, salão e mesas.');
    const id='pc_'+Date.now();
    st.pracasExtras=Array.isArray(st.pracasExtras)?st.pracasExtras:[];
    st.pracasExtras.push({id,numero,area,mesas,tipo});
    st.saloesAtivos=st.saloesAtivos||{}; st.saloesAtivos[area]=true;
    if(st.saloesRemovidos && st.saloesRemovidos[area]) delete st.saloesRemovidos[area];
    salvarConfigLocal(); fecharModalPracas(); renderAll(); toast('✅ Nova praça cadastrada');
  };
  window.excluirPracaConfig=function(pracaId){
    const p=getPracas().find(x=>x.id===pracaId); if(!p) return;
    if(!confirm(`Excluir a Praça ${p.numero}?`)) return;
    st.pracasExtras=(st.pracasExtras||[]).filter(x=>x.id!==pracaId);
    st.pracasRemovidas=st.pracasRemovidas||{}; st.pracasRemovidas[pracaId]=true;
    if(st.pracasCustom) delete st.pracasCustom[pracaId];
    if(st.pracasBloqueadas) delete st.pracasBloqueadas[pracaId];
    if(st.pracaLocks) delete st.pracaLocks[pracaId];
    salvarConfigLocal(); renderAll(); toast('🗑️ Praça excluída');
  };
  window.novoSalaoPracas=function(){
    modalPracas(`<h3>+ Novo salão</h3>
      <label class="pracas-label">Nome do salão</label><input id="novoSalaoNome" class="pracas-text" placeholder="Ex.: Salão Vasto">
      <p class="pracas-sub">Depois de criar o salão, cadastre as praças dele no botão “Nova praça”.</p>
      <div class="pracas-modal-actions"><button class="pracas-btn red" onclick="fecharModalPracas()">Cancelar</button><button class="pracas-btn green" onclick="salvarNovoSalaoPracas()">Salvar</button></div>`);
  };
  window.salvarNovoSalaoPracas=function(){
    const nome=document.getElementById('novoSalaoNome')?.value?.trim();
    if(!nome) return toast('Informe o nome do salão.');
    st.saloesAtivos=st.saloesAtivos||{}; st.saloesAtivos[nome]=true;
    if(st.saloesRemovidos && st.saloesRemovidos[nome]) delete st.saloesRemovidos[nome];
    salvarConfigLocal(); fecharModalPracas(); renderAll(); toast('✅ Salão cadastrado');
  };
  window.editarSalaoPracas=function(encodedArea){
    const area=decodeURIComponent(encodedArea);
    modalPracas(`<h3>✏️ Editar salão</h3>
      <label class="pracas-label">Nome do salão</label><input id="editSalaoNome" class="pracas-text" value="${String(area).replace(/"/g,'&quot;')}">
      <div class="pracas-modal-actions"><button class="pracas-btn red" onclick="fecharModalPracas()">Cancelar</button><button class="pracas-btn green" onclick="salvarEdicaoSalaoPracas('${encodeURIComponent(area)}')">Salvar</button></div>`);
  };
  window.salvarEdicaoSalaoPracas=function(encodedArea){
    const antigo=decodeURIComponent(encodedArea);
    const novo=document.getElementById('editSalaoNome')?.value?.trim();
    if(!novo) return toast('Informe o nome do salão.');
    st.pracasCustom=st.pracasCustom||{};
    getPracas().filter(p=>p.area===antigo).forEach(p=>{ st.pracasCustom[p.id]=Object.assign({}, st.pracasCustom[p.id]||{}, {area:novo}); });
    st.saloesAtivos=st.saloesAtivos||{}; st.saloesAtivos[novo]=st.saloesAtivos[antigo]!==false; delete st.saloesAtivos[antigo];
    if(st.saloesRemovidos){ delete st.saloesRemovidos[antigo]; delete st.saloesRemovidos[novo]; }
    salvarConfigLocal(); fecharModalPracas(); renderAll(); toast('✅ Salão atualizado');
  };
  window.excluirSalaoPracas=function(encodedArea){
    const area=decodeURIComponent(encodedArea);
    if(!confirm(`Excluir o salão "${area}" e todas as praças dele?`)) return;
    st.saloesRemovidos=st.saloesRemovidos||{}; st.saloesRemovidos[area]=true;
    st.pracasExtras=(st.pracasExtras||[]).filter(p=>p.area!==area);
    getPracas().filter(p=>p.area===area).forEach(p=>{ st.pracasRemovidas=st.pracasRemovidas||{}; st.pracasRemovidas[p.id]=true; });
    if(st.saloesAtivos) delete st.saloesAtivos[area];
    salvarConfigLocal(); renderAll(); toast('🗑️ Salão excluído');
  };
  window.restaurarPracasPadrao=function(){ if(confirm('Restaurar TODAS as praças, salões, bloqueios e configurações para o padrão original?')){ st.pracasCustom={}; st.pracasExtras=[]; st.pracasRemovidas={}; st.saloesRemovidos={}; st.pracasBloqueadas={}; st.pracaLocks={}; st.saloesAtivos={'SALÃO BARRA':true,'LATERAL MÚSICO':true,'BEIRA MAR':true,'ÁREA PET':true,'VARANDA':true}; st.tipoSorteio='geral'; st.incluirFechamentoNoAlmoco=false; try{ ['pracas_config_custom','pracas_config_extras','pracas_config_removidas','pracas_config_saloes_removidos','pracas_config_saloes','pracas_config_bloqueadas','pracas_config_tipo','pracas_config_f_almoco'].forEach(k=>localStorage.removeItem(k)); }catch(e){} salvarConfigLocal(); renderAll(); toast('↩️ Padrão original restaurado'); } };
  window.salvarConfigPracas=async function(){
    salvarConfigLocal();
    const payload={pracasCustom:st.pracasCustom||{}, pracasExtras:st.pracasExtras||[], pracasRemovidas:st.pracasRemovidas||{}, saloesRemovidos:st.saloesRemovidos||{}, saloesAtivos:st.saloesAtivos||{}, pracasBloqueadas:st.pracasBloqueadas||{}, tipoSorteio:st.tipoSorteio, incluirFechamentoNoAlmoco:!!st.incluirFechamentoNoAlmoco, atualizadoEm:new Date().toISOString()};
    let salvouFirebase=false;
    if(window.fbDb){
      try{
        await window.fbDb.ref('pracas_diarias/configuracoes').set(payload);
        salvouFirebase=true;
      }catch(e){ console.warn('salvar configuração praças Firebase', e); }
    }
    renderAll();
    setPracasView('config');
    toast(salvouFirebase?'💾 Configurações salvas':'💾 Configurações salvas neste aparelho');
  };

  window.imprimirEscalaPracas = function(){
    const html = renderEscalaPracas(false);
    const w = window.open('', '_blank', 'width=900,height=700');
    if(!w){ window.print(); return; }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Escala de Praças</title><style>
      @page{size:A4 portrait;margin:8mm}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.pracas-print-box{background:#fff;color:#111;margin:0;padding:0;overflow:visible}.pracas-print-title{background:#202020!important;color:#fff!important;text-align:center;font-weight:900;padding:6px;font-size:16px;letter-spacing:.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pracas-meta-table,.pracas-escala-table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px}.pracas-meta-table td{border:1px solid #777;padding:5px}.pracas-escala-table th,.pracas-escala-table td{border:1px solid #111;padding:4px;text-align:center;vertical-align:middle}.pracas-escala-table th{background:#f4f4f4!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pracas-area-row td{background:#242424!important;color:#fff!important;font-weight:900;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pracas-flag{background:#202020!important;color:#fff!important;font-weight:900;width:34px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pracas-prnum{font-weight:900;width:40px}.pracas-mesas{font-weight:900}.pracas-print-actions,.no-print{display:none!important}
    </style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},300)}<\/script></body></html>`);
    w.document.close();
  };
  window.copiarEscalaPracasTabela = function(){ fallbackCopy(textoEscalaTabela(),()=>toast('📋 Escala de praças copiada')); };
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
  window.pracasAjuda = function(){ alert('Praças Diárias e Sorteio\n\n• Puxa automaticamente a equipe presente no mapa do dia.\n• Remove quem está de folga, falta, atestado ou troca de folga.\n• Sorteia garçons, CF e fechamento separadamente.\n• Permite travar praça manualmente.\n• Permite bloquear praça fora do sorteio.\n• Tem modo sorteio geral ou individual.\n• Gera escala para impressão.\n• Salva histórico no Firebase.\n• Compartilha texto no WhatsApp/Telegram ou imagem da escala.\n• Permite editar mesas, salões, CF e F/.'); };

  // Badge opcional no dashboard
  window.updatePracasDashboardBadge = function(){
    const el=document.getElementById('dashPracasBadge'); if(!el) return;
    const eq=equipeDoMapa(); el.textContent=(eq.garcons.length+eq.cf.length+eq.fechamento.length)+' elegíveis';
  };
  setInterval(()=>{ try{ window.updatePracasDashboardBadge(); }catch(e){} }, 4000);
})();

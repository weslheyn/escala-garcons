(function(){
  const $=id=>document.getElementById(id);
  const norm=s=>window.DeliveryImport?.norm?DeliveryImport.norm(s):String(s??'').trim().toLowerCase();
  const num=v=>window.DeliveryImport?.num?DeliveryImport.num(v):Number(v)||0;
  const dateBR=v=>window.DeliveryImport?.dateBR?DeliveryImport.dateBR(v):new Date(v);
  const money=v=>(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const n0=v=>(Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=(o,names)=>{for(const n of names){const k=norm(n);if(o&&o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!==''&&String(o[k]).trim()!=='—')return o[k]}return ''};
  const cleanId=v=>String(v??'').trim().replace(/\.0$/,'').replace(/\s+/g,'');
  let ifoodRowsRecreio=[],ifoodRowsBarra=[];
  let maestroRaw1=[],maestroRaw2=[];
  let charts={hour:null,weekday:null,reason:null};
  const STORE_RECREIO='delivery_ifood_recreio_normalized_v2';
  const STORE_BARRA='delivery_ifood_barra_normalized_v2';
  const BORDERE='delivery_cancel_bordere_v1';

  function normalizeIfood(o,storeKey){
    const dt=dateBR(get(o,['DATA E HORA DO PEDIDO','Data do pedido']));
    const cancelDt=dateBR(get(o,['DATA DO CANCELAMENTO','Data e hora do cancelamento']))||dt;
    const finalStatus=String(get(o,['STATUS FINAL DO PEDIDO','Status final','Status'])).trim();
    const cancelType=String(get(o,['TIPO DE CANCELAMENTO','Tipo cancelamento'])).trim();
    const valueCancelled=num(get(o,['VALOR DOS ITENS CANCELADOS','Valor dos itens cancelados']))||0;
    const isPartial=/parcial/i.test(finalStatus+' '+cancelType) || (valueCancelled>0 && !/cancelad[oa]$/i.test(finalStatus));
    const isCancelled=/cancel/i.test(finalStatus+' '+cancelType) || valueCancelled>0 || !!get(o,['DATA DO CANCELAMENTO']);
    return {
      fullId:String(get(o,['ID COMPLETO DO PEDIDO'])),
      shortId:cleanId(get(o,['ID CURTO DO PEDIDO','ID DO PEDIDO','Pedido'])),
      orderDt:dt?dt.toISOString():'',
      cancelDt:cancelDt?cancelDt.toISOString():'',
      dateKey:cancelDt?`${cancelDt.getFullYear()}-${String(cancelDt.getMonth()+1).padStart(2,'0')}-${String(cancelDt.getDate()).padStart(2,'0')}`:(dt?`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`:''),
      finalStatus, cancelType,
      reason:String(get(o,['MOTIVO DO CANCELAMENTO','Motivo do cancelamento'])).trim()||'Não informado',
      origin:String(get(o,['ORIGEM DO CANCELAMENTO','Origem do cancelamento'])).trim(),
      valueItems:num(get(o,['VALOR DOS ITENS (R$)','Valor dos itens']))||0,
      valuePaid:num(get(o,['TOTAL PAGO PELO CLIENTE (R$)','Total pago pelo cliente']))||0,
      valueCancelled,
      isPartial,isCancelled,
      channel:String(get(o,['CANAL DE VENDA'])).trim(),
      deliveryType:String(get(o,['TIPO DE ENTREGA'])).trim(),
      productLogistic:String(get(o,['PRODUTO LOGISTICO','Produto logístico','Produto logistico'])).trim(),
      demandDistance:String(get(o,['DISTÂNCIA CONSIDERADA NA COTAÇÃO (APENAS SOB DEMANDA)','Distância considerada na cotação apenas sob demanda'])).trim(),
      demandFreight:num(get(o,['FRETE COBRADO DO RESTAURANTE (APENAS SOB DEMANDA)','Frete cobrado do restaurante apenas sob demanda']))||0,
      store:storeKey||(/barra/i.test(String(get(o,['NOME DA LOJA','Loja'])))?'barra':/recreio/i.test(String(get(o,['NOME DA LOJA','Loja'])))?'recreio':'')
    };
  }
  function normalizeMaestro(o,source){
    const status=String(get(o,['Status','STATUS FINAL DO PEDIDO','Situação','Situacao'])).trim();
    const platform=String(get(o,['Plataforma','Origem','Canal','Canal de venda'])).trim();
    const pedido=cleanId(get(o,['Número','Numero','N Pedido','Pedido']));
    let partner=cleanId(get(o,['N App Parceiro','Nº App Parceiro','N° App Parceiro','Número do parceiro','Numero do parceiro','Nº do parceiro','N° do parceiro','Pedido parceiro','ID do parceiro','ID pedido parceiro','Número pedido parceiro']));
    // Alguns relatórios do integrador usam o próprio campo "N Pedido" como identificação externa.
    if(!partner && /ifood/i.test(platform)) partner=cleanId(get(o,['N Pedido','Pedido']));
    const dt=dateBR(get(o,['Data e Hora Início de Preparo','Data e Hora Inicio de Preparo','Data de criação','Data de criacao','Data','Criado em']));
    const storeName=String(get(o,['Loja','NOME DA LOJA','Restaurante'])).trim();
    const store=/barra/i.test(storeName)?'barra':/recreio/i.test(storeName)?'recreio':'';
    return {source,pedido,partner,status,platform,value:num(get(o,['Valor do pedido','Total R$','Total','Valor']))||0,dt:dt?dt.toISOString():'',dateKey:dt?`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`:'',cliente:String(get(o,['Cliente','Nome'])).trim(),store};
  }
  function selectedStore(){return $('cancelStoreFilter')?.value||'all'}
  function allIfoodRows(){return [...ifoodRowsRecreio,...ifoodRowsBarra]}
  function selectedIfoodRows(){const store=selectedStore();return store==='recreio'?ifoodRowsRecreio:store==='barra'?ifoodRowsBarra:allIfoodRows()}
  function ifoodDateBounds(){const keys=selectedIfoodRows().map(r=>r.dateKey).filter(Boolean).sort();return{min:keys[0]||'',max:keys[keys.length-1]||''}}
  function syncIfoodDateToData(force=false){
    const el=$('cancelDateFilter');if(!el)return;const b=ifoodDateBounds();if(!b.max)return;
    el.min=b.min;el.max=b.max;
    if(force||!el.value||el.value<b.min||el.value>b.max)el.value=b.max;
  }
  function setIfoodRows(raw,store='recreio'){
    const rows=(raw||[]).map(o=>normalizeIfood(o,store)).filter(r=>r.shortId||r.fullId);
    if(store==='barra')ifoodRowsBarra=rows;else ifoodRowsRecreio=rows;
    try{localStorage.setItem(store==='barra'?STORE_BARRA:STORE_RECREIO,JSON.stringify(rows))}catch(e){console.warn('iFood cache indisponível',e)}
    syncIfoodDateToData(true);render();
  }
  function setMaestroRows(raw1,raw2){maestroRaw1=raw1||[];maestroRaw2=raw2||[];render();}
  function restore(){
    try{const x=JSON.parse(localStorage.getItem(STORE_RECREIO)||'[]');if(Array.isArray(x))ifoodRowsRecreio=x}catch(e){}
    try{const x=JSON.parse(localStorage.getItem(STORE_BARRA)||'[]');if(Array.isArray(x))ifoodRowsBarra=x}catch(e){}
    // Migração suave do cache antigo: era o relatório do Recreio.
    if(!ifoodRowsRecreio.length){try{const x=JSON.parse(localStorage.getItem('delivery_ifood_normalized_v1')||'[]');if(Array.isArray(x))ifoodRowsRecreio=x.map(r=>({...r,store:r.store||'recreio'}))}catch(e){}}
  }

  function rangeFor(ref,period){
    const [y,m,d]=String(ref||'').split('-').map(Number);const x=new Date(y,m-1,d||1,12);
    if(period==='month')return [`${y}-${String(m).padStart(2,'0')}-01`,`${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`];
    if(period==='week'){const day=(x.getDay()+6)%7;const s=new Date(x);s.setDate(x.getDate()-day);const e=new Date(s);e.setDate(s.getDate()+6);const key=z=>`${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,'0')}-${String(z.getDate()).padStart(2,'0')}`;return[key(s),key(e)];}
    return[ref,ref];
  }
  const inRange=(k,a,b)=>k&&k>=a&&k<=b;
  function filteredIfood(){const ref=$('cancelDateFilter')?.value||$('dateFilter')?.value;const per=$('cancelPeriodFilter')?.value||'day';const [a,b]=rangeFor(ref,per);return selectedIfoodRows().filter(r=>inRange(r.dateKey,a,b));}
  function filteredMaestro(){
    const ref=$('cancelDateFilter')?.value||$('dateFilter')?.value;const per=$('cancelPeriodFilter')?.value||'day';const [a,b]=rangeFor(ref,per);
    const all=[...maestroRaw1.map(x=>normalizeMaestro(x,'MAESTRO 1')),...maestroRaw2.map(x=>normalizeMaestro(x,'MAESTRO 2'))];
    const store=selectedStore();
    const scoped=store==='all'?all:all.filter(r=>!r.store||r.store===store);
    const map=new Map();scoped.forEach(r=>{if(!r.pedido&&!r.partner)return;const k=`${r.store||store||''}|${r.partner||r.pedido}`;const old=map.get(k);if(!old||(/cancel/i.test(r.status)&&!/cancel/i.test(old.status)))map.set(k,r)});
    return [...map.values()].filter(r=>inRange(r.dateKey,a,b));
  }
  function cancelIfood(){return filteredIfood().filter(r=>r.isCancelled)}
  function cancelMaestro(){return filteredMaestro().filter(r=>/cancel/i.test(r.status))}

  function makeChart(id,type,data,options){const c=$(id);if(!c||!window.Chart)return null;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,{type,data,options});return charts[id]}
  function renderIfoodDashboard(){
    const rows=filteredIfood(),cc=rows.filter(r=>r.isCancelled),partials=cc.filter(r=>r.isPartial);
    const valueCancel=cc.reduce((s,r)=>s+(r.valueCancelled||0),0), totalItems=rows.reduce((s,r)=>s+(r.valueItems||0),0);
    const prev='—';
    const kpis=[['⊗','PEDIDOS CANCELADOS',cc.length,`${rows.length?((cc.length/rows.length)*100).toFixed(1):'0,0'}% do total de pedidos`],['▣','VALOR CANCELADO (ITENS)',money(valueCancel),'Valor dos itens cancelados'],['◐','CANCELAMENTO PARCIAL',partials.length,'Itens/pedidos parcialmente cancelados'],['☷','TOTAL DE PEDIDOS',rows.length,'Pedidos no período'],['▣','VALOR TOTAL (ITENS)',money(totalItems),'Valor dos itens no período']];
    const grid=$('ifoodKpis');if(grid)grid.innerHTML=kpis.map((k,i)=>`<div class="ifood-kpi ifood-kpi-${i}"><div class="ifood-kpi-icon">${k[0]}</div><div><small>${k[1]}</small><b>${k[2]}</b><span>${k[3]}</span></div></div>`).join('');
    const demand=rows.filter(r=>/sob\s*demanda/i.test(r.productLogistic||''));
    const demandFreight=demand.reduce((s,r)=>s+(r.demandFreight||0),0);
    const dg=$('ifoodDemandKpis');if(dg)dg.innerHTML=`<div class="ifood-demand-card"><div class="ifood-demand-icon">🛵</div><div><small>ENTREGAS SOB DEMANDA</small><b>${n0(demand.length)}</b><span>Solicitações no período selecionado</span></div></div><div class="ifood-demand-card value"><div class="ifood-demand-icon">R$</div><div><small>VALOR SOB DEMANDA</small><b>${money(demandFreight)}</b><span>Frete cobrado do restaurante</span></div></div>`;
    const byHour=Array(24).fill(0);cc.forEach(r=>{const d=r.cancelDt?new Date(r.cancelDt):null;if(d&&!isNaN(d))byHour[d.getHours()]++});
    makeChart('ifoodCancelHourChart','bar',{labels:Array.from({length:24},(_,i)=>String(i).padStart(2,'0')),datasets:[{data:byHour,backgroundColor:'#cf2946',borderRadius:3,maxBarThickness:16}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#aeb1b7',font:{size:9}}},y:{beginAtZero:true,grid:{color:'rgba(255,255,255,.07)'},ticks:{color:'#aeb1b7',precision:0}}}});
    const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],vals=Array(7).fill(0);cc.forEach(r=>{const d=r.cancelDt?new Date(r.cancelDt):null;if(d&&!isNaN(d))vals[d.getDay()]++});
    makeChart('ifoodCancelWeekChart','bar',{labels:days,datasets:[{data:vals,backgroundColor:'#cf2946',borderRadius:3,maxBarThickness:34}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#aeb1b7'}},y:{beginAtZero:true,grid:{color:'rgba(255,255,255,.07)'},ticks:{color:'#aeb1b7',precision:0}}}});
    const reasons={};cc.forEach(r=>{const k=r.reason||'Outros';reasons[k]=(reasons[k]||0)+1});const entries=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,5);const palette=['#d62e45','#e07c13','#e8b52b','#58b94e','#7865c9'];
    makeChart('ifoodCancelReasonChart','doughnut',{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1]),backgroundColor:palette,borderColor:'#16181b',borderWidth:2}]},{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false}}});
    const leg=$('ifoodReasonLegend');if(leg){const tot=cc.length||1;leg.innerHTML=entries.map((x,i)=>`<div><i style="background:${palette[i]}"></i><span>${esc(x[0])}</span><b>${(x[1]/tot*100).toFixed(1)}%</b></div>`).join('')||'<small>Sem cancelamentos no período.</small>'}
  }
  function buildComparison(){
    const ifc=cancelIfood(),mac=cancelMaestro();const mm=new Map(),im=new Map();
    const activeStore=selectedStore();
    mac.forEach(r=>{const id=cleanId(r.partner||r.pedido);if(!id)return;const k=`${r.store||activeStore||''}|${id}`;mm.set(k,r)});
    ifc.forEach(r=>{const id=cleanId(r.shortId);if(!id)return;const k=`${r.store||activeStore||''}|${id}`;im.set(k,r)});
    const keys=new Set([...mm.keys(),...im.keys()]), rows=[];
    keys.forEach(k=>{const m=mm.get(k),i=im.get(k);let situacao;if(i?.isPartial)situacao='Parcial iFood';else if(m&&i)situacao='Nos dois';else if(i)situacao='Só iFood';else situacao='Só Maestro';const value=i?(i.valueCancelled||0):(m?.value||0);rows.push({key:(i?.shortId||m?.partner||m?.pedido||k.split('|').pop()),m,i,situacao,value,store:i?.store||m?.store||''});});
    rows.sort((a,b)=>{const rank={'Só iFood':0,'Parcial iFood':1,'Só Maestro':2,'Nos dois':3};return (rank[a.situacao]-rank[b.situacao])||String(b.key).localeCompare(String(a.key),'pt-BR',{numeric:true})});return rows;
  }
  function renderComparison(){
    const rows=buildComparison(),mac=cancelMaestro(),ifc=cancelIfood();
    const onlyI=rows.filter(r=>r.situacao==='Só iFood'),onlyM=rows.filter(r=>r.situacao==='Só Maestro'),partials=rows.filter(r=>r.situacao==='Parcial iFood');
    const maestroVal=mac.reduce((s,r)=>s+(r.value||0),0), ifoodVal=ifc.reduce((s,r)=>s+(r.valueCancelled||0),0), consolidado=rows.reduce((s,r)=>s+r.value,0);
    const cards=[['maestro','CANCELADOS MAESTRO',mac.length,maestroVal],['ifood','CANCELADOS IFOOD',ifc.length,ifoodVal],['total','TOTAL CONSOLIDADO','SEM DUPLICIDADE',consolidado],['alert','SÓ IFOOD','NÃO CANCELADOS NO MAESTRO',onlyI.reduce((s,r)=>s+r.value,0)],['info','SÓ MAESTRO','NÃO ENCONTRADOS NO IFOOD',onlyM.reduce((s,r)=>s+r.value,0)]];
    const el=$('cancelCompareKpis');if(el)el.innerHTML=cards.map((c,i)=>`<div class="cancel-compare-card ${c[0]}"><small>${c[1]}</small>${i<2?`<b>${c[2]}</b>`:`<b>${i===2?rows.length:(i===3?onlyI.length:onlyM.length)}</b>`}<span>${money(c[3])}${i===2?' • sem duplicidade':''}</span></div>`).join('');
    const partialEl=$('cancelPartialNotice');if(partialEl)partialEl.innerHTML=partials.length?`<b>◐ ${partials.length} CANCELAMENTO${partials.length>1?'S':''} PARCIAL${partials.length>1?'IS':''}</b><span>${money(partials.reduce((s,r)=>s+r.value,0))} em itens cancelados parcialmente</span>`:'<b>◐ NENHUM CANCELAMENTO PARCIAL</b><span>Não há cancelamentos parciais no período.</span>';
    let visible=rows;const mode=$('cancelQuickFilter')?.value||'all';if(mode==='div')visible=rows.filter(r=>r.situacao!=='Nos dois');if(mode==='ifood')visible=onlyI;if(mode==='partial')visible=partials;
    const q=norm($('cancelSearch')?.value||'');if(q)visible=visible.filter(r=>norm([r.key,r.m?.pedido,r.m?.partner,r.m?.cliente,r.i?.reason,r.situacao].join(' ')).includes(q));
    const tbody=visible.map(r=>{const cls=r.situacao==='Nos dois'?'both':r.situacao==='Só iFood'?'only-ifood':r.situacao==='Só Maestro'?'only-maestro':'partial';const obs=r.situacao==='Nos dois'?'Pedido cancelado nas duas plataformas':r.situacao==='Só iFood'?'Não localizado como cancelado no Maestro':r.situacao==='Só Maestro'?'Não encontrado como cancelado no iFood':'Cancelamento parcial no iFood';const dt=r.i?.cancelDt?new Date(r.i.cancelDt).toLocaleString('pt-BR'):'—';return `<tr><td>${r.store==='barra'?'BARRA':r.store==='recreio'?'RECREIO':'—'}</td><td>${esc(r.i?.shortId||'—')}</td><td>${esc(r.m?.partner||r.m?.pedido||'—')}</td><td>${dt}</td><td><span class="cancel-pill ${r.m?'cancelled':'neutral'}">${r.m?'CANCELADO':'NÃO CANCELADO'}</span></td><td><span class="cancel-pill ${r.i?'cancelled':'neutral'}">${r.i?(r.i.isPartial?'PARCIAL':'CANCELADO'):'NÃO CANCELADO'}</span></td><td>${money(r.value)}</td><td><span class="cancel-situation ${cls}">${esc(r.situacao)}</span></td><td>${esc(obs)}</td></tr>`}).join('');
    const table=$('cancelCompareTable');if(table)table.innerHTML=`<table><thead><tr><th>LOJA</th><th>PEDIDO IFOOD<br><small>(ID curto)</small></th><th>Nº PARCEIRO<br><small>(Maestro)</small></th><th>DATA CANCELAMENTO</th><th>MAESTRO</th><th>IFOOD</th><th>VALOR CANCELADO</th><th>SITUAÇÃO</th><th>OBSERVAÇÃO</th></tr></thead><tbody>${tbody||'<tr><td colspan="9" class="cancel-empty">Nenhum registro para os filtros selecionados.</td></tr>'}</tbody></table>`;
  }
  function getBordere(){try{return JSON.parse(localStorage.getItem(BORDERE)||'{}')||{}}catch(e){return{}}}
  function renderBordere(){const key=$('cancelDateFilter')?.value||$('dateFilter')?.value;if(!key)return;const all=getBordere(),x=all[key]||{cancelamento:'',falha:'',outros:''};['cancelamento','falha','outros'].forEach(k=>{const el=$('bordere_'+k);if(el)el.value=x[k]??''});updateBordereTotal()}
  function updateBordereTotal(){const vals=['cancelamento','falha','outros'].map(k=>num($('bordere_'+k)?.value)||0);const el=$('bordereTotal');if(el)el.textContent=money(vals.reduce((a,b)=>a+b,0))}
  function saveBordere(){const key=$('cancelDateFilter')?.value||$('dateFilter')?.value;if(!key)return;const all=getBordere();all[key]={};['cancelamento','falha','outros'].forEach(k=>all[key][k]=$('bordere_'+k)?.value||'');localStorage.setItem(BORDERE,JSON.stringify(all));updateBordereTotal()}
  function render(){if(!$('view-cancelamentos'))return;syncIfoodDateToData(false);renderIfoodDashboard();renderComparison();renderBordere();const meta=$('ifoodImportedAt');if(meta){const b=ifoodDateBounds(),ref=$('cancelDateFilter')?.value||'',total=allIfoodRows().length;if(total){const fmt=k=>k?k.split('-').reverse().join('/'):'—';const sel=selectedStore()==='recreio'?'Recreio':selectedStore()==='barra'?'Barra':'Todas';meta.innerHTML=`Recreio ${ifoodRowsRecreio.length} • Barra ${ifoodRowsBarra.length} • exibindo ${sel} • período ${fmt(b.min)} a ${fmt(b.max)}${ref&&!filteredIfood().length?` <strong class="ifood-no-data">• sem dados em ${fmt(ref)}</strong>`:''}`;}else meta.textContent='Aguardando relatórios iFood';}}
  function bind(){
    const ref=$('dateFilter')?.value;if($('cancelDateFilter')&&ref)$('cancelDateFilter').value=ref;
    ['cancelStoreFilter','cancelPeriodFilter','cancelDateFilter','cancelQuickFilter'].forEach(id=>{const el=$(id);if(el)el.onchange=render});
    const storeFilter=$('cancelStoreFilter');if(storeFilter)storeFilter.onchange=()=>{syncIfoodDateToData(true);render()};
    const s=$('cancelSearch');if(s)s.oninput=renderComparison;
    ['cancelamento','falha','outros'].forEach(k=>{const el=$('bordere_'+k);if(el)el.oninput=saveBordere});
    const btn=$('cancelRefreshBtn');if(btn)btn.onclick=render;
    restore();syncIfoodDateToData(false);render();
  }
  window.DeliveryCancelamentos={setIfoodRows,setMaestroRows,render,bind};
})();

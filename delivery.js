(function(){
  let raw1=[],raw2=[],rawIfoodRecreio=[],rawIfoodBarra=[],importRows=[],historyRows=[],allRows=[],currentRows=[],prevRows=[];
  const loadedMonths=new Set();
  const $=id=>document.getElementById(id);
  const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)};
  const dateKeyLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monthKeyFromDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const parseKey=k=>{const [y,m,d]=String(k).split('-').map(Number);return new Date(y,m-1,d,12,0,0)};
  function serializeRows(rows){return rows.map(r=>{const x={...r};delete x.dt;return x})}
  function restoreRows(rows){return(rows||[]).map(r=>{const x={...r};x.dt=DeliveryImport.dateBR(x.created||x.inicio||x.entrega||x.finalizado);return x})}
  function dedupe(rows){const m=new Map();rows.forEach(r=>{const k=`${r.dateKey||''}|${r.pedido||''}`;if(!r.pedido)return;m.set(k,r)});return[...m.values()].sort((a,b)=>(b.dt?.getTime()||0)-(a.dt?.getTime()||0))}
  function rebuildPool(){allRows=dedupe([...historyRows,...importRows])}
  function between(r,start,end){if(!r.dateKey)return false;return r.dateKey>=dateKeyLocal(start)&&r.dateKey<=dateKeyLocal(end)}
  function periodRange(ref,period){
    const d=parseKey(ref);
    if(period==='month')return{start:new Date(d.getFullYear(),d.getMonth(),1,12),end:new Date(d.getFullYear(),d.getMonth()+1,0,12)};
    if(period==='week'){
      const day=(d.getDay()+6)%7;const start=new Date(d);start.setDate(d.getDate()-day);const end=new Date(start);end.setDate(start.getDate()+6);return{start,end};
    }
    return{start:new Date(d),end:new Date(d)};
  }
  function previousRange(range,period){
    if(period==='month'){
      const s=new Date(range.start.getFullYear(),range.start.getMonth()-1,1,12);return{start:s,end:new Date(s.getFullYear(),s.getMonth()+1,0,12)};
    }
    const days=period==='week'?7:1;const s=new Date(range.start),e=new Date(range.end);s.setDate(s.getDate()-days);e.setDate(e.getDate()-days);return{start:s,end:e};
  }
  function monthsInRange(start,end){const out=[];let d=new Date(start.getFullYear(),start.getMonth(),1,12);const last=new Date(end.getFullYear(),end.getMonth(),1,12);while(d<=last){out.push(monthKeyFromDate(d));d=new Date(d.getFullYear(),d.getMonth()+1,1,12)}return out}
  async function ensureMonths(start,end){
    for(const mk of monthsInRange(start,end)){
      if(loadedMonths.has(mk))continue;
      try{
        const saved=await DeliveryFirebase.loadMonth(mk);
        if(saved?.rows)historyRows=dedupe([...historyRows,...restoreRows(saved.rows)]);
      }catch(e){console.warn('Falha ao carregar mês',mk,e)}
      loadedMonths.add(mk);
    }
    rebuildPool();
  }
  async function fileChanged(which,file){
    if(!file)return;
    try{
      const rows=await DeliveryImport.parseFile(file);
      if(which===1){raw1=rows;$('file1Label').textContent=`${file.name} • ${rows.length} linhas`}
      else if(which===2){raw2=rows;$('file2Label').textContent=`${file.name} • ${rows.length} linhas`}
      else if(which===3){rawIfoodRecreio=rows;if($('fileIfoodRecreioLabel'))$('fileIfoodRecreioLabel').textContent=`${file.name} • ${rows.length} linhas`;window.DeliveryCancelamentos?.setIfoodRows?.(rows,'recreio')}
      else{rawIfoodBarra=rows;if($('fileIfoodBarraLabel'))$('fileIfoodBarraLabel').textContent=`${file.name} • ${rows.length} linhas`;window.DeliveryCancelamentos?.setIfoodRows?.(rows,'barra')}
      toast(`${which===3?'Relatório iFood Recreio':which===4?'Relatório iFood Barra':`Relatório ${which}`} carregado: ${rows.length} registros`)
    }catch(e){console.error(e);toast('Erro ao ler o arquivo')}
  }
  async function persistImportedMonth(rows){
    const byDay={},byMonth={};
    rows.forEach(r=>{
      if(!r.dateKey)return;
      (byDay[r.dateKey]||(byDay[r.dateKey]=[])).push(r);
      const mk=r.dateKey.slice(0,7);(byMonth[mk]||(byMonth[mk]=[])).push(r);
    });
    const now=new Date().toISOString();
    const dayPayload={};
    Object.entries(byDay).forEach(([date,rr])=>dayPayload[date]={date,updatedAt:now,metrics:DeliveryDashboard.metrics(rr),rows:serializeRows(rr)});
    try{await DeliveryFirebase.saveDays(dayPayload)}catch(e){console.warn('Não foi possível salvar os dias',e)}
    for(const [mk,rr] of Object.entries(byMonth)){
      try{
        await DeliveryFirebase.saveMonth(mk,{month:mk,updatedAt:now,from:rr.map(x=>x.dateKey).sort()[0],to:rr.map(x=>x.dateKey).sort().slice(-1)[0],metrics:DeliveryDashboard.metrics(rr),rows:serializeRows(rr)});
        await DeliveryFirebase.saveImportMeta(mk,{atualizadoEm:now,relatorio1:raw1.length,relatorio2:raw2.length,pedidos:rr.length,periodoInicio:rr.map(x=>x.dateKey).sort()[0],periodoFim:rr.map(x=>x.dateKey).sort().slice(-1)[0]});
        loadedMonths.add(mk);
      }catch(e){console.warn('Não foi possível salvar o mês',mk,e)}
    }
  }
  async function process(){
    if(!raw1.length&&!raw2.length){if(rawIfoodRecreio.length||rawIfoodBarra.length){if(rawIfoodRecreio.length)window.DeliveryCancelamentos?.setIfoodRows?.(rawIfoodRecreio,'recreio');if(rawIfoodBarra.length)window.DeliveryCancelamentos?.setIfoodRows?.(rawIfoodBarra,'barra');toast('Relatórios iFood atualizados');return}toast('Importe pelo menos um relatório');return}
    importRows=DeliveryImport.consolidate(raw1,raw2);
    window.DeliveryCancelamentos?.setMaestroRows?.(raw1,raw2);
    if(rawIfoodRecreio.length)window.DeliveryCancelamentos?.setIfoodRows?.(rawIfoodRecreio,'recreio');
    if(rawIfoodBarra.length)window.DeliveryCancelamentos?.setIfoodRows?.(rawIfoodBarra,'barra');
    if(!importRows.length){toast('Nenhum pedido identificado');return}
    rebuildPool();
    const keys=importRows.map(r=>r.dateKey).filter(Boolean).sort();
    const latest=keys[keys.length-1]||dateKeyLocal(new Date());
    $('dateFilter').value=latest;
    $('dateFilter').min=keys[0]||'';
    $('dateFilter').max=latest;
    await persistImportedMonth(importRows);
    await applyPeriod(latest);
    $('updatedAt').textContent=new Date().toLocaleString('pt-BR');
    toast(`${importRows.length} pedidos do mês consolidados • ${keys[0]?.split('-').reverse().join('/')} a ${latest.split('-').reverse().join('/')}`);
    loadHistory();
  }
  async function updateTrendChart(){
    const mode=$('trendChartMode')?.value||'week';
    const ref=$('dateFilter').value||dateKeyLocal(new Date());
    const d=parseKey(ref);
    let range;
    if(mode==='month') range={start:new Date(d.getFullYear(),0,1,12),end:new Date(d.getFullYear(),11,31,12)};
    else if(mode==='day') range=periodRange(ref,'day');
    else range=periodRange(ref,'week');
    await ensureMonths(range.start,range.end);
    const trendRows=allRows.filter(r=>between(r,range.start,range.end));
    DeliveryDashboard.renderTrendChart(trendRows,mode,ref);
  }
  function syncOrdersFilterOptions(){
    const periodEl=$('ordersPeriodFilter');
    if(periodEl&&$('periodFilter'))periodEl.value=$('periodFilter').value||'day';
    const motoEl=$('ordersMotoboyFilter');
    if(!motoEl)return;
    const selected=motoEl.value||'TODOS';
    const names=[...new Set(currentRows.map(r=>String(r.motoboy||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    motoEl.innerHTML='<option value="TODOS">Todos os motoboys</option>'+names.map(n=>`<option value="${n.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${n}</option>`).join('');
    motoEl.value=names.includes(selected)?selected:'TODOS';
  }
  const ORDER_COLUMNS=[
    ['pedido','Pedido'],['data','Data'],['hora','Hora'],['status','Status'],['turno','Turno'],['motoboy','Motoboy'],
    ['cliente','Cliente'],['regiao','Região'],['endereco','Endereço'],['platform','Plataforma'],['km','KM'],['valor','Valor'],['tempo','Tempo']
  ];
  const ORDER_COLUMNS_KEY='delivery_orders_columns_v1';
  const ORDER_WIDTHS_KEY='delivery_orders_column_widths_v1';
  const ORDER_COLUMNS_DEFAULT=['pedido','data','hora','status','turno','motoboy','cliente','regiao','platform','km','valor','tempo'];
  const ORDER_WIDTHS_DEFAULT={pedido:72,data:96,hora:72,status:94,turno:76,motoboy:130,cliente:190,regiao:150,endereco:320,platform:145,km:64,valor:92,tempo:78};
  function getOrderColumns(){
    try{const x=JSON.parse(localStorage.getItem(ORDER_COLUMNS_KEY)||'null');if(Array.isArray(x)&&x.length)return ORDER_COLUMNS.filter(c=>x.includes(c[0])).map(c=>c[0])}catch(e){}
    return ORDER_COLUMNS_DEFAULT.slice();
  }
  function saveOrderColumns(cols){localStorage.setItem(ORDER_COLUMNS_KEY,JSON.stringify(cols))}
  function getOrderColumnWidths(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(ORDER_WIDTHS_KEY)||'{}')||{}}catch(e){}
    return {...ORDER_WIDTHS_DEFAULT,...saved};
  }
  function saveOrderColumnWidth(key,width){
    const widths=getOrderColumnWidths();
    widths[key]=Math.max(48,Math.round(Number(width)||ORDER_WIDTHS_DEFAULT[key]||90));
    localStorage.setItem(ORDER_WIDTHS_KEY,JSON.stringify(widths));
  }
  function renderOrderColumnsMenu(){
    const menu=$('ordersColumnsMenu');if(!menu)return;const selected=getOrderColumns();
    menu.innerHTML='<div class="orders-columns-title">COLUNAS VISÍVEIS</div>'+ORDER_COLUMNS.map(([key,label])=>`<label><input type="checkbox" value="${key}" ${selected.includes(key)?'checked':''}><span>${label}</span></label>`).join('');
    menu.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{
      let cols=[...menu.querySelectorAll('input:checked')].map(x=>x.value);
      if(!cols.length){inp.checked=true;cols=[inp.value]}
      saveOrderColumns(cols);applyOrdersFilters();
    });
  }
  window.DeliveryOrdersColumns=getOrderColumns;
  window.DeliveryOrdersColumnWidths=getOrderColumnWidths;
  window.DeliverySaveOrdersColumnWidth=saveOrderColumnWidth;
  function applyOrdersFilters(){
    if(!$('ordersTable'))return;
    let rows=currentRows.slice();
    const moto=$('ordersMotoboyFilter')?.value||'TODOS';
    const turno=$('ordersShiftFilter')?.value||'TODOS';
    const q=DeliveryImport.norm($('orderSearch')?.value||'');
    const sort=$('ordersSortFilter')?.value||'orders';
    if(moto!=='TODOS')rows=rows.filter(r=>String(r.motoboy||'').trim()===moto);
    if(turno!=='TODOS')rows=rows.filter(r=>r.turno===turno);
    if(q)rows=rows.filter(r=>DeliveryImport.norm([r.pedido,r.cliente,r.motoboy,r.endereco,r.regiao,r.platform,r.status,r.turno].join(' ')).includes(q));
    if(sort==='motoboy'){
      rows.sort((a,b)=>{
        const am=String(a.motoboy||'').trim(),bm=String(b.motoboy||'').trim();
        if(!am&&!bm)return (b.dt?.getTime()||0)-(a.dt?.getTime()||0);
        if(!am)return 1;if(!bm)return -1;
        const c=am.localeCompare(bm,'pt-BR',{sensitivity:'base'});
        return c||((b.dt?.getTime()||0)-(a.dt?.getTime()||0));
      });
    }
    DeliveryDashboard.renderOrders(rows);
  }
  async function applyPeriod(ref){
    if(!ref)return;
    const period=$('periodFilter').value;
    const range=periodRange(ref,period);
    await ensureMonths(range.start,range.end);
    currentRows=allRows.filter(r=>between(r,range.start,range.end));
    if(window.DeliveryMap)await DeliveryMap.prepareRows(currentRows);
    prevRows=[];
    if($('compareSelect').value==='prev'){
      const pr=previousRange(range,period);
      await ensureMonths(pr.start,pr.end);
      prevRows=allRows.filter(r=>between(r,pr.start,pr.end));
      if(window.DeliveryMap)await DeliveryMap.prepareRows(prevRows);
    }
    DeliveryDashboard.renderAll(currentRows,prevRows);
    syncOrdersFilterOptions();
    applyOrdersFilters();
    await updateTrendChart();
    updatePeriodUI(range,period);
  }
  function updatePeriodUI(range,period){
    const names={day:'DIÁRIO',week:'SEMANAL',month:'MENSAL'};
    const fmt=d=>d.toLocaleDateString('pt-BR');
    const label=period==='day'?fmt(range.start):`${fmt(range.start)} — ${fmt(range.end)}`;
    document.title=`Delivery • ${names[period]} • ${label}`;
    const el=$('updatedAt');if(el)el.title=`Filtro ${names[period]}: ${label}`;
  }
  async function saveDay(){
    if(!currentRows.length){toast('Nada para salvar');return}
    await persistImportedMonth(currentRows);
    toast('Período salvo no histórico do Firebase');loadHistory();
  }
  async function loadHistory(){
    try{
      const months=await DeliveryFirebase.listMonths();
      const keys=Object.keys(months).sort().reverse();
      $('historyList').innerHTML=keys.length?keys.map(k=>{const m=months[k]||{};const [y,mo]=k.split('-');return`<div class="history-row"><span>${mo}/${y}<small>${m.from?m.from.split('-').reverse().join('/')+' a '+m.to.split('-').reverse().join('/'):''}</small></span><b>${m.metrics?.pedidos||0} pedidos</b></div>`}).join(''):'<div class="history-row">Nenhum histórico mensal salvo.</div>';
    }catch(e){$('historyList').innerHTML='<div class="history-row">Firebase indisponível.</div>'}
  }
  function exportCsv(){
    if(!currentRows.length)return toast('Nada para exportar');
    const data=currentRows.map(r=>({Pedido:r.pedido,Data:r.data,Hora:r.hora,Status:r.status,Turno:r.turno,Plataforma:r.platform,Cliente:r.cliente,Motoboy:r.motoboy,Regiao:r.regiao,Endereco:r.endereco,KM:r.km,Valor:r.valor,TempoPreparo:r.tempoPreparo,TempoEntrega:r.tempoEntrega,TempoTotal:r.tempoTotal}));
    const ws=XLSX.utils.json_to_sheet(data),csv=XLSX.utils.sheet_to_csv(ws,{FS:';'});const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`delivery_${$('periodFilter').value}_${$('dateFilter').value||'relatorio'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
  }
  function setupNav(){document.querySelectorAll('#deliveryNav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#deliveryNav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+b.dataset.view).classList.add('active');if(b.dataset.view==='regioes')setTimeout(()=>DeliveryMap?.showRegionView?.(currentRows),40);if(b.dataset.view==='cancelamentos'){window.DeliveryCancelamentos?.setMaestroRows?.(raw1,raw2);if($('cancelDateFilter')&&$('dateFilter'))$('cancelDateFilter').value=$('dateFilter').value;setTimeout(()=>window.DeliveryCancelamentos?.render?.(),30)}})}
  function bind(){
    $('file1').addEventListener('change',e=>fileChanged(1,e.target.files[0]));
    $('file2').addEventListener('change',e=>fileChanged(2,e.target.files[0]));
    $('fileIfoodRecreio')?.addEventListener('change',e=>fileChanged(3,e.target.files[0]));
    $('fileIfoodBarra')?.addEventListener('change',e=>fileChanged(4,e.target.files[0]));
    $('processBtn').onclick=process;
    $('refreshBtn').onclick=()=>applyPeriod($('dateFilter').value);
    $('dateFilter').onchange=e=>applyPeriod(e.target.value);
    $('periodFilter').onchange=()=>applyPeriod($('dateFilter').value);
    $('compareSelect').onchange=()=>applyPeriod($('dateFilter').value);
    $('trendChartMode').onchange=()=>updateTrendChart();
    $('saveDay').onclick=saveDay;$('exportCsv').onclick=exportCsv;
    $('ordersPeriodFilter').onchange=async e=>{ $('periodFilter').value=e.target.value; await applyPeriod($('dateFilter').value); };
    $('ordersMotoboyFilter').onchange=applyOrdersFilters;
    $('ordersShiftFilter').onchange=applyOrdersFilters;
    $('ordersSortFilter').onchange=applyOrdersFilters;
    $('orderSearch').oninput=applyOrdersFilters;
    renderOrderColumnsMenu();
    const colBtn=$('ordersColumnsBtn'),colMenu=$('ordersColumnsMenu');
    if(colBtn&&colMenu){
      const placeColumnsMenu=()=>{
        const r=colBtn.getBoundingClientRect();
        const menuW=Math.min(240,Math.max(200,window.innerWidth-16));
        const left=Math.max(8,Math.min(r.right-menuW,window.innerWidth-menuW-8));
        const below=r.bottom+6;
        const maxH=Math.max(180,window.innerHeight-below-8);
        colMenu.style.width=menuW+'px';
        colMenu.style.left=left+'px';
        colMenu.style.right='auto';
        colMenu.style.top=below+'px';
        colMenu.style.maxHeight=maxH+'px';
      };
      colBtn.onclick=e=>{
        e.stopPropagation();
        const opening=colMenu.hidden;
        colMenu.hidden=!opening;
        if(opening){placeColumnsMenu();requestAnimationFrame(placeColumnsMenu)}
      };
      colMenu.onclick=e=>e.stopPropagation();
      window.addEventListener('resize',()=>{if(!colMenu.hidden)placeColumnsMenu()});
      document.addEventListener('click',()=>{colMenu.hidden=true});
    }
    $('motoShiftFilter').onchange=()=>DeliveryDashboard.renderMotoCards(currentRows);
    setupNav();loadHistory();DeliveryMap?.init?.();DeliveryMap?.onChange?.(()=>applyPeriod($('dateFilter').value));
    window.DeliveryCancelamentos?.setMaestroRows?.(raw1,raw2);window.DeliveryCancelamentos?.bind?.();
    const today=dateKeyLocal(new Date());$('dateFilter').value=today;
  }
  document.addEventListener('DOMContentLoaded',bind);
})();

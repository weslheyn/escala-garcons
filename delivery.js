(function(){
  let raw1=[],raw2=[],importRows=[],historyRows=[],allRows=[],currentRows=[],prevRows=[];
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
      else{raw2=rows;$('file2Label').textContent=`${file.name} • ${rows.length} linhas`}
      toast(`Relatório ${which} carregado: ${rows.length} registros`)
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
    if(!raw1.length&&!raw2.length){toast('Importe pelo menos um relatório');return}
    importRows=DeliveryImport.consolidate(raw1,raw2);
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
  async function applyPeriod(ref){
    if(!ref)return;
    const period=$('periodFilter').value;
    const range=periodRange(ref,period);
    await ensureMonths(range.start,range.end);
    currentRows=allRows.filter(r=>between(r,range.start,range.end));
    prevRows=[];
    if($('compareSelect').value==='prev'){
      const pr=previousRange(range,period);
      await ensureMonths(pr.start,pr.end);
      prevRows=allRows.filter(r=>between(r,pr.start,pr.end));
    }
    DeliveryDashboard.renderAll(currentRows,prevRows);
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
  function setupNav(){document.querySelectorAll('#deliveryNav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#deliveryNav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+b.dataset.view).classList.add('active')})}
  function bind(){
    $('file1').addEventListener('change',e=>fileChanged(1,e.target.files[0]));
    $('file2').addEventListener('change',e=>fileChanged(2,e.target.files[0]));
    $('processBtn').onclick=process;
    $('refreshBtn').onclick=()=>applyPeriod($('dateFilter').value);
    $('dateFilter').onchange=e=>applyPeriod(e.target.value);
    $('periodFilter').onchange=()=>applyPeriod($('dateFilter').value);
    $('compareSelect').onchange=()=>applyPeriod($('dateFilter').value);
    $('saveDay').onclick=saveDay;$('exportCsv').onclick=exportCsv;
    $('orderSearch').oninput=e=>{const q=DeliveryImport.norm(e.target.value);DeliveryDashboard.renderOrders(currentRows.filter(r=>DeliveryImport.norm([r.pedido,r.cliente,r.motoboy,r.endereco,r.regiao,r.platform].join(' ')).includes(q)))};
    $('motoShiftFilter').onchange=()=>DeliveryDashboard.renderMotoCards(currentRows);
    setupNav();loadHistory();
    const today=dateKeyLocal(new Date());$('dateFilter').value=today;
  }
  document.addEventListener('DOMContentLoaded',bind);
})();

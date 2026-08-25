(function(){
  let hourChart=null,weekdayChart=null,platformChart=null;
  const money=v=>(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const n1=v=>(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
  const avg=a=>{const x=a.filter(v=>typeof v==='number'&&Number.isFinite(v));return x.length?x.reduce((p,c)=>p+c,0)/x.length:0};
  const sum=a=>a.filter(v=>typeof v==='number'&&Number.isFinite(v)).reduce((p,c)=>p+c,0);
  const fmtMin=m=>{m=Math.round(m||0);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
  const count=(rows,key)=>rows.reduce((o,r)=>{const k=typeof key==='function'?key(r):r[key];o[k||'Outros']=(o[k||'Outros']||0)+1;return o},{});
  const delivered=r=>r.status==='ENTREGUE';
  function metrics(rows){const ent=rows.filter(delivered);return{pedidos:rows.length,entregas:ent.length,motoboys:new Set(rows.map(r=>r.motoboy).filter(Boolean)).size,km:sum(ent.map(r=>r.km)),faturamento:sum(rows.filter(r=>r.status!=='CANCELADO').map(r=>r.valor)),ticket:ent.length?sum(rows.filter(r=>r.status!=='CANCELADO').map(r=>r.valor))/ent.length:0,cancelados:rows.filter(r=>r.status==='CANCELADO').length,tempoEntrega:avg(ent.map(r=>r.tempoEntrega)),tempoTotal:avg(ent.map(r=>r.tempoTotal))}}
  function delta(cur,prev,reverse=false){if(!prev)return{txt:'—',cls:''};const d=((cur-prev)/Math.abs(prev))*100;const good=reverse?d<=0:d>=0;return{txt:`${d>=0?'↑':'↓'} ${Math.abs(d).toFixed(1).replace('.',',')}%`,cls:good?'up':'down'}}
  function renderKpis(rows,prevRows){const m=metrics(rows),p=metrics(prevRows||[]);const items=[['🛵','ENTREGAS REALIZADAS',m.entregas,p.entregas,false],['📦','PEDIDOS TOTAIS',m.pedidos,p.pedidos,false],['👤','MOTOBOYS ATIVOS',m.motoboys,p.motoboys,false],['⌖','KM TOTAL PERCORRIDOS',`${n1(m.km)} km`,p.km,false,m.km],['◴','TEMPO MÉDIO DE ENTREGA',fmtMin(m.tempoEntrega),p.tempoEntrega,true,m.tempoEntrega],['💰','FATURAMENTO TOTAL',money(m.faturamento),p.faturamento,false,m.faturamento],['🎟️','TICKET MÉDIO',money(m.ticket),p.ticket,false,m.ticket],['⊗','CANCELADOS',m.cancelados,p.cancelados,true]];document.getElementById('kpiGrid').innerHTML=items.map(x=>{const curRaw=x.length>6?x[6]:x[2];const d=delta(+curRaw||0,+x[3]||0,x[4]);return`<div class="kpi"><div class="kpi-icon">${x[0]}</div><div><div class="lbl">${x[1]}</div><div class="val">${x[2]}</div><div class="delta ${d.cls}">${d.txt} <span>vs dia anterior</span></div></div></div>`}).join('')}
  function renderCharts(rows){
    const hours=Array.from({length:18},(_,i)=>i+6);
    const byH=hours.map(h=>rows.filter(r=>r.dt&&r.dt.getHours()===h).length);
    const entH=hours.map(h=>rows.filter(r=>r.dt&&r.dt.getHours()===h&&delivered(r)).length);
    if(hourChart)hourChart.destroy();
    hourChart=new Chart(document.getElementById('hourChart'),{
      type:'bar',
      data:{labels:hours.map(h=>String(h).padStart(2,'0')+'h'),datasets:[
        {label:'Pedidos',data:byH,backgroundColor:'#d4a03b',borderRadius:3,maxBarThickness:18},
        {label:'Entregas',data:entH,type:'line',borderColor:'#9a2438',backgroundColor:'#9a2438',tension:.28,pointRadius:1.8,borderWidth:2}
      ]},
      options:chartOpts()
    });

    const weekLabels=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
    const byWeek=[1,2,3,4,5,6,0].map(day=>rows.filter(r=>r.dt&&r.dt.getDay()===day).length);
    if(weekdayChart)weekdayChart.destroy();
    weekdayChart=new Chart(document.getElementById('weekdayChart'),{
      type:'bar',
      data:{labels:weekLabels,datasets:[{label:'Pedidos',data:byWeek,backgroundColor:'#d4a03b',borderRadius:5,maxBarThickness:34}]},
      options:chartOpts({hideLegend:true})
    });

    const c=count(rows,'platform');
    const entries=Object.entries(c).sort((a,b)=>b[1]-a[1]);
    const labels=entries.map(x=>x[0]),vals=entries.map(x=>x[1]);
    const total=vals.reduce((a,b)=>a+b,0);
    if(platformChart)platformChart.destroy();
    platformChart=new Chart(document.getElementById('platformChart'),{
      type:'doughnut',
      data:{labels,datasets:[{data:vals,backgroundColor:['#9f1f39','#d6a23b','#6f948a','#b7b7b7','#7d6aa7','#4b88b8'],borderWidth:0,hoverOffset:4}]},
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{legend:{position:'right',labels:{color:'#ddd',boxWidth:9,boxHeight:9,padding:10,font:{size:10},generateLabels(chart){
          const ds=chart.data.datasets[0];
          return chart.data.labels.map((label,i)=>({
            text:`${label} — ${ds.data[i]} pedidos (${total?((ds.data[i]/total)*100).toFixed(1):'0.0'}%)`,
            fillStyle:ds.backgroundColor[i],strokeStyle:ds.backgroundColor[i],lineWidth:0,hidden:false,index:i
          }));
        }}}},
        layout:{padding:{left:2,right:4,top:0,bottom:0}}
      }
    });
  }
  function chartOpts(extra={}){return{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#bbb',font:{size:9}},grid:{display:false}},y:{beginAtZero:true,ticks:{color:'#bbb',font:{size:9},precision:0},grid:{color:'#2d2d2d'}}},plugins:{legend:{display:!extra.hideLegend,labels:{color:'#ddd',boxWidth:12,font:{size:10}}}}}}
  function renderRegions(rows){const allowed=window.DeliveryMap?.configuredRegions?.()||[];const c={};rows.forEach(r=>{const region=allowed.includes(r.regiao)?r.regiao:'NÃO CLASSIFICADO';c[region]=(c[region]||0)+1});const arr=Object.entries(c).sort((a,b)=>b[1]-a[1]),max=arr[0]?.[1]||1,total=rows.length||1;document.getElementById('regionBars').innerHTML=arr.length?arr.map(([k,v])=>`<div class="bar-row ${k==='NÃO CLASSIFICADO'?'bar-unclassified':''}"><span>${k}</span><div class="bar-bg"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-val"><b>${v}</b> (${(v/total*100).toFixed(1)}%)</span></div>`).join('')+`<div class="distribution-total">TOTAL <b>${rows.length} PEDIDOS</b></div>`:'<div style="color:#888;font-size:11px;padding:10px">Sem pedidos no período.</div>';window.DeliveryMap?.renderDashboard?.(rows)}
  function shiftMetrics(rows,shift){const rr=rows.filter(r=>r.turno===shift),assigned=rr.filter(r=>r.motoboy);return{rows:rr,ped:rr.length,moto:new Set(assigned.map(r=>r.motoboy).filter(Boolean)).size,km:sum(rr.map(r=>r.km)),tempo:avg(rr.map(r=>r.tempoEntrega))}}
  function renderShifts(rows){const a=shiftMetrics(rows,'MANHÃ'),b=shiftMetrics(rows,'NOITE');const box=(n,x,range,night=false)=>`<div class="shift-box"><div class="shift-title ${night?'night':''}">${night?'☾':'☀'} TURNO ${n}<span class="shift-range">${range}</span></div><div class="shift-metrics"><div><small>Pedidos</small><b>${x.ped}</b></div><div><small>Motoboys</small><b>${x.moto}</b></div><div><small>KM</small><b>${n1(x.km)}</b></div><div><small>Média entrega</small><b>${fmtMin(x.tempo)}</b></div></div></div>`;document.getElementById('shiftSummary').innerHTML=box('MANHÃ',a,'até 16:59')+box('NOITE',b,'17:00 em diante',true);document.getElementById('shiftMini').innerHTML=`${box('MANHÃ',a,'até 16:59')}${box('NOITE',b,'17:00+',true)}`;renderShiftDetail(rows)}
  function renderStatusTimes(rows){const st=count(rows,'status');const total=rows.length||1;const arr=[['✓','ENTREGUE','st-ok'],['◷','EM ROTA','st-route'],['⊗','CANCELADO','st-cancel'],['Ⅱ','EM ANDAMENTO','']];document.getElementById('statusCards').innerHTML=arr.map(([i,k,c])=>`<div class="status-card"><div class="status-icon ${c}">${i}</div><small>${k}</small><b>${st[k]||0}</b><span>${((st[k]||0)/total*100).toFixed(1)}%</span></div>`).join('');const t=[['PREPARO',avg(rows.map(r=>r.tempoPreparo))],['ESPERA MOTOBOY',avg(rows.map(r=>{const a=DeliveryImport.dateBR(r.pronto),b=DeliveryImport.dateBR(r.alocado);return a&&b?(b-a)/60000:null}))],['ATÉ SAÍDA',avg(rows.map(r=>{const a=DeliveryImport.dateBR(r.alocado),b=DeliveryImport.dateBR(r.caminho);return a&&b?(b-a)/60000:null}))],['ENTREGA',avg(rows.map(r=>r.tempoEntrega))],['TEMPO TOTAL',avg(rows.map(r=>r.tempoTotal))]];document.getElementById('timeCards').innerHTML=t.map(([k,v])=>`<div class="time-card"><small>${k}</small><div style="font-size:26px;margin-top:8px">${k==='PREPARO'?'♨':k==='ESPERA MOTOBOY'?'👤':k==='ATÉ SAÍDA'?'🛵':k==='ENTREGA'?'⚑':'◴'}</div><b>${fmtMin(v)}</b></div>`).join('')}
  function renderRadius(rows){const total=rows.length||1;const valid=rows.filter(r=>typeof r.km==='number'&&Number.isFinite(r.km)&&r.km>=0);const bands=[['Até 3 km',x=>x<=3],['3–5 km',x=>x>3&&x<=5],['5–10 km',x=>x>5&&x<=10],['Acima de 10 km',x=>x>10]];let classified=0;let html=bands.map(([k,f])=>{const n=valid.filter(r=>f(r.km)).length;classified+=n;return`<div class="radius-line"><span>${k}</span><b>${n} pedidos <em>(${(n/total*100).toFixed(1)}%)</em></b></div>`}).join('');const missing=Math.max(0,rows.length-classified);html+=`<div class="radius-line radius-unclassified"><span>Não classificado</span><b>${missing} pedidos <em>(${(missing/total*100).toFixed(1)}%)</em></b></div><div class="distribution-total">TOTAL <b>${rows.length} PEDIDOS</b></div>`;document.getElementById('radiusStats').innerHTML=html}
  function motoStats(rows){const map={};rows.forEach(r=>{if(!r.motoboy)return;const x=map[r.motoboy]||(map[r.motoboy]={m:r.motoboy,e:0,p:0,km:0,t:[],turnos:new Set(),pedidos:[]});x.p++;x.pedidos.push(r);if(delivered(r))x.e++;x.km+=r.km||0;if(typeof r.tempoEntrega==='number')x.t.push(r.tempoEntrega);x.turnos.add(r.turno)});return Object.values(map).map(x=>({...x,kmMed:x.p?x.km/x.p:0,tMed:avg(x.t)})).sort((a,b)=>b.p-a.p)}
  function renderMoto(rows){const ms=motoStats(rows);document.getElementById('motoRanking').innerHTML=`<table class="rank-table"><thead><tr><th>#</th><th>MOTOBOY</th><th>PEDIDOS</th><th>KM</th><th>KM MÉDIO</th><th>TEMPO</th></tr></thead><tbody>${ms.slice(0,7).map((x,i)=>`<tr><td>${i+1}</td><td>${x.m}</td><td>${x.p}</td><td>${n1(x.km)}</td><td>${n1(x.kmMed)}</td><td>${fmtMin(x.tMed)}</td></tr>`).join('')}</tbody></table>`;renderMotoCards(rows)}
  function renderLatest(rows){document.getElementById('latestOrders').innerHTML=`<table class="rank-table"><thead><tr><th>PEDIDO</th><th>HORÁRIO</th><th>CLIENTE</th><th>REGIÃO</th><th>MOTOBOY</th><th>STATUS</th><th>VALOR</th></tr></thead><tbody>${rows.slice(0,7).map(r=>`<tr><td>${r.pedido}</td><td>${r.hora}</td><td>${r.cliente||'—'}</td><td>${r.regiao}</td><td>${r.motoboy||'—'}</td><td><span class="latest-status ${r.status==='ENTREGUE'?'st-ok':r.status==='CANCELADO'?'st-cancel':'st-route'}">${r.status}</span></td><td>${money(r.valor)}</td></tr>`).join('')}</tbody></table>`}
  function renderSummary(rows){const m=metrics(rows),date=rows[0]?.data||'—';const vals=[['RESUMO DO DIA',date],['Entregas',m.entregas],['Pedidos',m.pedidos],['Motoboys',m.motoboys],['KM Total',n1(m.km)+' km'],['Faturamento',money(m.faturamento)],['Ticket Médio',money(m.ticket)],['Tempo Médio Entrega',fmtMin(m.tempoEntrega)],['Cancelados',`${m.cancelados} (${m.pedidos?(m.cancelados/m.pedidos*100).toFixed(1):0}%)`]];document.getElementById('daySummary').innerHTML=vals.map(([a,b])=>`<div class="sum-cell"><small>${a}</small><b>${b}</b></div>`).join('')}
  function table(headers,rows){return`<table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`}
  function renderOrders(rows){document.getElementById('ordersTable').innerHTML=table(['Pedido','Data','Hora','Status','Turno','Motoboy','Cliente','Região','Plataforma','KM','Valor','Tempo'],rows.map(r=>`<tr><td>${r.pedido}</td><td>${r.data}</td><td>${r.hora}</td><td>${r.status}</td><td>${r.turno}</td><td>${r.motoboy||'—'}</td><td>${r.cliente||'—'}</td><td>${r.regiao}</td><td>${r.platform}</td><td>${n1(r.km)}</td><td>${money(r.valor)}</td><td>${fmtMin(r.tempoEntrega)}</td></tr>`))}
  function renderMotoCards(rows){const filter=document.getElementById('motoShiftFilter')?.value||'TODOS';const data=motoStats(filter==='TODOS'?rows:rows.filter(r=>r.turno===filter));document.getElementById('motoCards').innerHTML=data.map(x=>`<div class="detail-card"><h3>🛵 ${x.m}</h3><div class="mini-kpis"><div class="mini-kpi"><small>Pedidos</small><b>${x.p}</b></div><div class="mini-kpi"><small>KM</small><b>${n1(x.km)}</b></div><div class="mini-kpi"><small>KM médio</small><b>${n1(x.kmMed)}</b></div><div class="mini-kpi"><small>Tempo médio</small><b>${fmtMin(x.tMed)}</b></div></div><div style="margin-top:10px;color:#aaa;font-size:11px">Turnos: ${[...x.turnos].join(', ')}</div></div>`).join('')||'<div class="panel">Nenhum motoboy encontrado.</div>'}
  function renderShiftDetail(rows){document.getElementById('shiftDetail').innerHTML=['MANHÃ','NOITE'].map(s=>{const rr=rows.filter(r=>r.turno===s);return`<div class="detail-card"><h3>${s==='MANHÃ'?'☀':'☾'} TURNO ${s}</h3>${table(['Motoboy','Pedidos','KM','KM médio/pedido','Tempo médio'],motoStats(rr).map(x=>`<tr><td>${x.m}</td><td>${x.p}</td><td>${n1(x.km)}</td><td>${n1(x.kmMed)}</td><td>${fmtMin(x.tMed)}</td></tr>`))}</div>`}).join('')}
  function renderUnclassified(rows){
    const allowed=window.DeliveryMap?.configuredRegions?.()||[];
    const list=(rows||[]).filter(r=>!allowed.includes(r.regiao));
    const count=document.getElementById('unclassifiedDetailCount');
    if(count) count.textContent=`${list.length} ${list.length===1?'pedido':'pedidos'}`;
    const target=document.getElementById('unclassifiedOrders');
    if(!target)return;
    const reason=r=>{
      if(r.regiao==='FORA DAS ÁREAS')return 'Ponto localizado fora das áreas';
      if(r.locationApprox)return 'Posição aproximada — revisar';
      if(!Number.isFinite(+r.lat)||!Number.isFinite(+r.lng))return 'Endereço ainda não localizado';
      return 'Ponto não pertence a uma área configurada';
    };
    target.innerHTML=list.length
      ? table(
          ['Pedido','Cliente','Endereço','KM','Região atual','Motivo'],
          list.map(r=>`<tr>
            <td>${r.pedido}</td>
            <td>${r.cliente||'—'}</td>
            <td class="unresolved-address">${r.endereco||'—'}</td>
            <td>${n1(r.km)}</td>
            <td>${r.regiao||'—'}</td>
            <td class="unresolved-reason">${reason(r)}</td>
          </tr>`)
        )
      : '<div style="padding:12px;color:#77c66e;font-size:11px;font-weight:700">✓ Todos os pedidos do período estão classificados em uma área.</div>';
  }

  function renderAnalyticTables(rows){const allowedRegions=window.DeliveryMap?.configuredRegions?.()||[];const regs={};rows.forEach(r=>{const reg=allowedRegions.includes(r.regiao)?r.regiao:'NÃO CLASSIFICADO';const x=regs[reg]||(regs[reg]={p:0,e:0,c:0,km:0,v:0,t:[]});x.p++;if(delivered(r)){x.e++;x.km+=r.km||0;if(typeof r.tempoEntrega==='number')x.t.push(r.tempoEntrega)}if(r.status==='CANCELADO')x.c++;x.v+=r.valor||0});document.getElementById('regionsTable').innerHTML=table(['Região','Pedidos','Entregas','Cancelados','KM','Tempo médio','Faturamento'],Object.entries(regs).sort((a,b)=>b[1].p-a[1].p).map(([k,x])=>`<tr><td>${k}</td><td>${x.p}</td><td>${x.e}</td><td>${x.c}</td><td>${n1(x.km)}</td><td>${fmtMin(avg(x.t))}</td><td>${money(x.v)}</td></tr>`));const plats={};rows.forEach(r=>{const x=plats[r.platform]||(plats[r.platform]={p:0,e:0,c:0,v:0});x.p++;if(delivered(r))x.e++;if(r.status==='CANCELADO')x.c++;x.v+=r.valor||0});document.getElementById('platformsTable').innerHTML=table(['Plataforma','Pedidos','Entregas','Cancelados','Faturamento'],Object.entries(plats).sort((a,b)=>b[1].p-a[1].p).map(([k,x])=>`<tr><td>${k}</td><td>${x.p}</td><td>${x.e}</td><td>${x.c}</td><td>${money(x.v)}</td></tr>`));document.getElementById('timesTable').innerHTML=table(['Pedido','Motoboy','Preparo','Coleta','Entrega','Total','Status'],rows.map(r=>`<tr><td>${r.pedido}</td><td>${r.motoboy||'—'}</td><td>${fmtMin(r.tempoPreparo)}</td><td>${fmtMin(r.tempoColeta)}</td><td>${fmtMin(r.tempoEntrega)}</td><td>${fmtMin(r.tempoTotal)}</td><td>${r.status}</td></tr>`));const cc=rows.filter(r=>r.status==='CANCELADO');document.getElementById('cancelTable').innerHTML=table(['Pedido','Hora','Cliente','Região','Motoboy','Plataforma','Valor','Endereço'],cc.map(r=>`<tr><td>${r.pedido}</td><td>${r.hora}</td><td>${r.cliente||'—'}</td><td>${r.regiao}</td><td>${r.motoboy||'—'}</td><td>${r.platform}</td><td>${money(r.valor)}</td><td>${r.endereco||'—'}</td></tr>`))}
  function renderAll(rows,prevRows){renderKpis(rows,prevRows);renderCharts(rows);renderRegions(rows);renderShifts(rows);renderStatusTimes(rows);renderRadius(rows);renderMoto(rows);renderLatest(rows);renderSummary(rows);renderOrders(rows);renderAnalyticTables(rows);renderUnclassified(rows)}
  window.DeliveryDashboard={renderAll,renderOrders,renderMotoCards,metrics,money,n1,fmtMin};
})();

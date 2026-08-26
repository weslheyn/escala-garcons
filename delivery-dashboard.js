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
    const hours=Array.from({length:24},(_,i)=>i);
    const byH=hours.map(h=>rows.filter(r=>r.dt&&r.dt.getHours()===h).length);
    const entH=hours.map(h=>rows.filter(r=>r.dt&&r.dt.getHours()===h&&delivered(r)).length);
    if(hourChart)hourChart.destroy();
    const hourCtx=document.getElementById('hourChart').getContext('2d');
    const hourGrad=hourCtx.createLinearGradient(0,0,0,210);
    hourGrad.addColorStop(0,'#e8b94f');hourGrad.addColorStop(1,'#b9781d');
    hourChart=new Chart(document.getElementById('hourChart'),{
      type:'bar',
      data:{labels:hours.map(h=>String(h).padStart(2,'0')+':00'),datasets:[
        {label:'Pedidos',data:byH,backgroundColor:hourGrad,borderColor:'#f0c867',borderWidth:1,borderRadius:5,maxBarThickness:14,barPercentage:.78,categoryPercentage:.84},
        {label:'Entregas',data:entH,type:'line',borderColor:'#b52646',backgroundColor:'#b52646',tension:.34,pointRadius:1.6,pointHoverRadius:4,borderWidth:2.2,fill:false}
      ]},
      options:chartOpts({hourly:true}),
      plugins:[valueLabelPlugin]
    });

    // O gráfico central é controlado de forma independente pelo seletor DIA / SEMANA / MÊS.

    const c=count(rows,'platform');
    const entries=Object.entries(c).sort((a,b)=>b[1]-a[1]);
    const labels=entries.map(x=>x[0]),vals=entries.map(x=>x[1]);
    const total=vals.reduce((a,b)=>a+b,0);
    const palette=['#a8233f','#e0a936','#6f988e','#c5c7cb','#8a73b4','#4e90c6','#d26d35','#73808c'];
    if(platformChart)platformChart.destroy();
    platformChart=new Chart(document.getElementById('platformChart'),{
      type:'doughnut',
      data:{labels,datasets:[{data:vals,backgroundColor:labels.map((_,i)=>palette[i%palette.length]),borderColor:'#17191c',borderWidth:2,hoverBorderColor:'#f2c35b',hoverBorderWidth:2,hoverOffset:5}]},
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'68%',
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#111317',titleColor:'#f5c451',bodyColor:'#fff',borderColor:'#34373d',borderWidth:1,padding:10,callbacks:{label(ctx){const v=ctx.raw||0;return ` ${ctx.label}: ${v} pedidos (${total?((v/total)*100).toFixed(1):'0.0'}%)`;}}}},
        layout:{padding:{left:2,right:2,top:2,bottom:2}}
      },
      plugins:[doughnutCenterPlugin]
    });
    renderPlatformLegend(labels,vals,total,palette);
  }

  function renderTrendChart(rows,mode='week',ref=''){
    const canvas=document.getElementById('weekdayChart');if(!canvas)return;
    if(weekdayChart)weekdayChart.destroy();
    const ctx=canvas.getContext('2d');
    const grad=ctx.createLinearGradient(0,0,0,220);
    grad.addColorStop(0,'#f0c35a');grad.addColorStop(.55,'#d79a32');grad.addColorStop(1,'#a96619');
    let labels=[],data=[],title='PEDIDOS DA SEMANA';
    if(mode==='day'){
      labels=Array.from({length:24},(_,i)=>String(i).padStart(2,'0')+':00');
      data=labels.map((_,h)=>rows.filter(r=>r.dt&&r.dt.getHours()===h).length);
      title='PEDIDOS DO DIA';
    }else if(mode==='month'){
      labels=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
      data=labels.map((_,m)=>rows.filter(r=>r.dt&&r.dt.getMonth()===m).length);
      title='PEDIDOS POR MÊS';
    }else{
      labels=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
      data=[1,2,3,4,5,6,0].map(day=>rows.filter(r=>r.dt&&r.dt.getDay()===day).length);
      title='PEDIDOS DA SEMANA';
    }
    const titleEl=document.getElementById('trendChartTitle');
    if(titleEl)titleEl.innerHTML=`${title} <small>— QUANTIDADE</small>`;
    weekdayChart=new Chart(canvas,{
      type:'bar',
      data:{labels,datasets:[{label:'Pedidos',data,backgroundColor:grad,borderColor:'#f4cd72',borderWidth:1,borderRadius:8,maxBarThickness:mode==='day'?15:mode==='month'?30:38,barPercentage:.78,categoryPercentage:.82}]},
      options:{...chartOpts({hideLegend:true,weekday:true}),
        scales:{
          x:{ticks:{color:'#d9dce1',font:{family:mode==='day'?'Arial':'Barlow',size:mode==='day'?9:10,weight:mode==='day'?'400':'600'},autoSkip:false,maxRotation:mode==='day'?90:0,minRotation:mode==='day'?90:0,padding:mode==='day'?3:7},grid:{display:false},border:{color:'#3a3d43'},title:mode==='day'?{display:true,text:'HORA DO PEDIDO',color:'#747b84',font:{family:'Barlow',size:9,weight:'500'},padding:{top:8}}:undefined},
          y:{beginAtZero:true,ticks:{color:'#9298a1',font:{family:'Barlow',size:9,weight:'400'},precision:0,padding:5},grid:{color:'rgba(255,255,255,.06)'},border:{display:false}}
        },
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#111317',titleColor:'#f5c451',bodyColor:'#fff',borderColor:'#34373d',borderWidth:1,padding:10,callbacks:{label(c){return ` ${c.raw||0} pedidos`;}}}},
        animation:{duration:380}
      },
      plugins:[valueLabelPlugin]
    });
  }

  const valueLabelPlugin={id:'deliveryValueLabels',afterDatasetsDraw(chart){
    const {ctx}=chart;ctx.save();ctx.fillStyle='#f2d58a';ctx.font='600 9px Barlow, Arial';ctx.textAlign='center';ctx.textBaseline='bottom';
    chart.getDatasetMeta(0).data.forEach((el,i)=>{const v=chart.data.datasets[0].data[i];if(v>0)ctx.fillText(String(v),el.x,el.y-5)});ctx.restore();
  }};
  const doughnutCenterPlugin={id:'deliveryDonutCenter',afterDraw(chart){
    const ds=chart.data.datasets?.[0];if(!ds)return;const total=(ds.data||[]).reduce((a,b)=>a+(+b||0),0);const {ctx,chartArea}=chart;
    const x=(chartArea.left+chartArea.right)/2,y=(chartArea.top+chartArea.bottom)/2;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4f4f4';ctx.font='600 24px Barlow, Arial';ctx.fillText(String(total),x,y-5);ctx.fillStyle='#b7b9be';ctx.font='600 9px Barlow, Arial';ctx.fillText('PEDIDOS',x,y+16);ctx.restore();
  }};
  function renderPlatformLegend(labels,vals,total,palette){
    const el=document.getElementById('platformLegend');if(!el)return;
    el.innerHTML=labels.map((label,i)=>{const pct=total?((vals[i]/total)*100).toFixed(1):'0.0';return `<div class="platform-legend-row"><span class="platform-dot" style="background:${palette[i%palette.length]}"></span><span class="platform-name">${label}</span><span class="platform-meta"><b>${vals[i]}</b> pedidos · ${pct}%</span></div>`}).join('')||'<div class="platform-empty">Sem pedidos no período.</div>';
  }
  function chartOpts(extra={}){return{
    responsive:true,maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    scales:{
      x:{ticks:{color:extra.hourly?'#dfe2e7':'#cfd1d5',font:{family:extra.hourly?'Arial':'Barlow',size:extra.hourly?9:10,weight:extra.hourly?'400':'500'},autoSkip:extra.hourly?false:true,maxRotation:extra.hourly?90:0,minRotation:extra.hourly?90:0,padding:extra.hourly?3:5,align:'center'},grid:{display:false},border:{color:'#343840'},title:extra.hourly?{display:true,text:'HORA DO PEDIDO',color:'#747b84',font:{family:'Barlow',size:9,weight:'500'},padding:{top:8}}:undefined},
      y:{beginAtZero:true,suggestedMax:extra.weekday?undefined:undefined,ticks:{color:'#9298a1',font:{family:'Barlow',size:9,weight:'400'},precision:0,padding:5},grid:{color:'rgba(255,255,255,.06)'},border:{display:false}}
    },
    plugins:{
      legend:{display:!extra.hideLegend,labels:{color:'#e8e9eb',boxWidth:11,boxHeight:8,padding:12,font:{family:'Barlow',size:10,weight:'500'}}},
      tooltip:{backgroundColor:'#111317',titleColor:'#f5c451',bodyColor:'#fff',borderColor:'#34373d',borderWidth:1,padding:9,displayColors:true}
    },
    layout:{padding:{left:2,right:5,top:6,bottom:extra.hourly?10:0}}
  }}
  function renderRegions(rows){const allowed=window.DeliveryMap?.configuredRegions?.()||[];const c={};rows.forEach(r=>{const region=allowed.includes(r.regiao)?r.regiao:'NÃO CLASSIFICADO';c[region]=(c[region]||0)+1});const arr=Object.entries(c).sort((a,b)=>b[1]-a[1]),max=arr[0]?.[1]||1,total=rows.length||1;document.getElementById('regionBars').innerHTML=arr.length?arr.map(([k,v])=>`<div class="bar-row ${k==='NÃO CLASSIFICADO'?'bar-unclassified':''}"><span>${k}</span><div class="bar-bg"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-val"><b>${v}</b> (${(v/total*100).toFixed(1)}%)</span></div>`).join('')+`<div class="distribution-total">TOTAL <b>${rows.length} PEDIDOS</b></div>`:'<div style="color:#888;font-size:11px;padding:10px">Sem pedidos no período.</div>';window.DeliveryMap?.renderDashboard?.(rows)}
  function shiftMetrics(rows,shift){const rr=rows.filter(r=>r.turno===shift),assigned=rr.filter(r=>r.motoboy);return{rows:rr,ped:rr.length,moto:new Set(assigned.map(r=>r.motoboy).filter(Boolean)).size,km:sum(rr.map(r=>r.km)),tempo:avg(rr.map(r=>r.tempoEntrega))}}
  function renderShifts(rows){const a=shiftMetrics(rows,'MANHÃ'),b=shiftMetrics(rows,'NOITE');const box=(n,x,range,night=false)=>`<div class="shift-box"><div class="shift-title ${night?'night':''}">${night?'☾':'☀'} TURNO ${n}<span class="shift-range">${range}</span></div><div class="shift-metrics"><div><small>Pedidos</small><b>${x.ped}</b></div><div><small>Motoboys</small><b>${x.moto}</b></div><div><small>KM</small><b>${n1(x.km)}</b></div><div><small>Média entrega</small><b>${fmtMin(x.tempo)}</b></div></div></div>`;document.getElementById('shiftSummary').innerHTML=box('MANHÃ',a,'até 16:59')+box('NOITE',b,'17:00 em diante',true);const mini=document.getElementById('shiftMini');if(mini)mini.innerHTML=`${box('MANHÃ',a,'até 16:59')}${box('NOITE',b,'17:00+',true)}`;renderShiftDetail(rows)}
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
  window.DeliveryDashboard={renderAll,renderOrders,renderMotoCards,renderTrendChart,metrics,money,n1,fmtMin};
})();

(function(){
  const DEFAULT_CENTER=[-22.995,-43.430];
  const DEFAULT_ZOOM=11.6;
  const DEFAULT_ZONES=[
    {id:'recreio',name:'Recreio',color:'#f0b83f',coords:[[-23.043,-43.535],[-23.040,-43.465],[-23.015,-43.430],[-22.995,-43.455],[-23.004,-43.515]]},
    {id:'barra',name:'Barra da Tijuca',color:'#d64f42',coords:[[-23.025,-43.445],[-23.020,-43.330],[-22.995,-43.300],[-22.982,-43.355],[-22.993,-43.430]]},
    {id:'barra-olimpica',name:'Barra Olímpica',color:'#8e63d4',coords:[[-22.995,-43.430],[-22.980,-43.405],[-22.950,-43.385],[-22.945,-43.430],[-22.970,-43.455]]},
    {id:'vargens',name:'Vargem Grande e Pequena',color:'#55a76a',coords:[[-23.010,-43.555],[-22.965,-43.555],[-22.945,-43.470],[-22.985,-43.455],[-23.020,-43.505]]}
  ];
  const REGION_CENTERS={
    'Recreio':[-23.021,-43.485],'Barra da Tijuca':[-23.004,-43.365],'Barra Olímpica':[-22.974,-43.414],
    'Vargem Grande':[-22.978,-43.500],'Vargem Pequena':[-22.981,-43.465],'Taquara':[-22.923,-43.373],
    'Jacarepaguá':[-22.948,-43.340],'Itanhangá':[-22.987,-43.303],'Camorim':[-22.972,-43.438],
    'Pechincha':[-22.930,-43.357],'Freguesia':[-22.940,-43.344],'Curicica':[-22.951,-43.390],'Joá':[-23.011,-43.289]
  };
  let dashboardMap=null,regionMap=null,dashboardZoneLayer=null,dashboardMarkerLayer=null,drawLayer=null,drawControl=null;
  let zones=[],geoCache={},currentRows=[],changeHandler=null,drawName='';
  let mapFilters={platform:'TODOS',turno:'TODOS',status:'TODOS',raio:'TODOS',regiao:'TODOS',cluster:false,areas:false};
  const storageZones='cbDeliveryCustomRegionsV1',storageGeo='cbDeliveryGeoCacheV1';
  const GEO_VERSION=2;
  const safe=s=>String(s||'').trim();
  const norm=s=>window.DeliveryImport?.norm?DeliveryImport.norm(s):String(s||'').toLowerCase();
  const keyAddr=a=>norm(a).replace(/[^a-z0-9]+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const colorFor=i=>['#f0b83f','#d64f42','#8e63d4','#55a76a','#3fa7d6','#d65fa4','#a2bd4d','#e9863b'][i%8];
  function loadLocal(){try{zones=JSON.parse(localStorage.getItem(storageZones)||'null')||[];geoCache=JSON.parse(localStorage.getItem(storageGeo)||'{}')||{}}catch(e){zones=[];geoCache={}}if(!zones.length)zones=DEFAULT_ZONES.map(x=>({...x,coords:x.coords.map(p=>[...p])}));}
  async function loadRemote(){try{if(window.DeliveryFirebase?.isReady?.()){const [z,g]=await Promise.all([DeliveryFirebase.loadRegions?.(),DeliveryFirebase.loadGeoCache?.()]);if(Array.isArray(z)&&z.length)zones=z;if(g&&typeof g==='object')geoCache={...geoCache,...g}}}catch(e){console.warn('Falha ao carregar áreas/geocache do Delivery',e)}saveLocal()}
  function saveLocal(){try{localStorage.setItem(storageZones,JSON.stringify(zones));localStorage.setItem(storageGeo,JSON.stringify(geoCache))}catch(e){}}
  async function saveZones(){saveLocal();try{await DeliveryFirebase.saveRegions?.(zones)}catch(e){console.warn('Falha ao salvar áreas',e)}renderZoneList();drawZonesOnEditor();reclassify(currentRows);if(changeHandler)changeHandler()}
  function getCachedPoint(row){
    const g=geoCache[keyAddr(row.endereco)];
    if(g&&Number.isFinite(+g.lat)&&Number.isFinite(+g.lng)){
      const exact=g.geoVersion===GEO_VERSION&&g.quality==='exact';
      return{lat:+g.lat,lng:+g.lng,approx:!exact,quality:g.quality||'legacy'};
    }
    // Coordenadas embutidas no registro só são consideradas exatas se vierem
    // marcadas pela geocodificação v2. Evita perpetuar cache antigo impreciso.
    if(Number.isFinite(row.lat)&&Number.isFinite(row.lng)&&row.geoQuality==='exact'){
      return{lat:+row.lat,lng:+row.lng,approx:false,quality:'exact'};
    }
    const c=REGION_CENTERS[row._regionHint||row.regiao];
    if(c)return{lat:c[0],lng:c[1],approx:true,quality:'region'};
    return null
  }
  function polygonFeature(z){return turf.polygon([[...z.coords.map(([lat,lng])=>[lng,lat]),[z.coords[0][1],z.coords[0][0]]]])}
  function classifyPoint(lat,lng){if(!window.turf)return null;const pt=turf.point([lng,lat]);for(const z of zones){try{if(turf.booleanPointInPolygon(pt,polygonFeature(z)))return z.name}catch(e){}}return null}
  function reclassify(rows){let exact=0,approx=0,unassigned=0;for(const r of rows||[]){if(!r._regionHint)r._regionHint=r.regiao;const p=getCachedPoint(r);if(p){r.lat=p.lat;r.lng=p.lng;r.locationApprox=!!p.approx;r.geoQuality=p.quality||'';if(!p.approx){exact++;r.regiao=classifyPoint(p.lat,p.lng)||'FORA DAS ÁREAS'}else{approx++;r.regiao=classifyPoint(p.lat,p.lng)||r._regionHint||'A GEOCODIFICAR'}}else{unassigned++;r.regiao='A GEOCODIFICAR'}}updateBadge(exact,approx,unassigned,rows?.length||0);return rows}
  function updateBadge(exact,approx,unassigned,total){const b=document.getElementById('mapAccuracyBadge');if(b){b.textContent=`${exact}/${total} localizados`;b.classList.toggle('warn',exact<total)}const u=document.getElementById('unassignedCount');if(u){u.textContent=`${unassigned+approx} a revisar`;u.classList.toggle('warn',unassigned+approx>0)}}
  async function prepareRows(rows){currentRows=rows||[];reclassify(currentRows);return currentRows}

  const PLATFORM_COLORS={
    'IFOOD':'#d92d50',
    'APP COCO BAMBU':'#f0a91d',
    '99FOOD':'#58b987',
    'RAPPI':'#4d97d2',
    'PEDIDO MANUAL':'#8d67cf',
    'OUTROS':'#9ba2ab'
  };
  function platformColor(name){
    const k=safe(name).toUpperCase();
    return PLATFORM_COLORS[k]||'#e68a36';
  }
  function mapFilteredRows(rows){
    return (rows||[]).filter(r=>{
      if(mapFilters.platform!=='TODOS' && safe(r.platform)!==mapFilters.platform)return false;
      if(mapFilters.turno!=='TODOS' && safe(r.turno)!==mapFilters.turno)return false;
      if(mapFilters.status!=='TODOS' && safe(r.status)!==mapFilters.status)return false;
      if(mapFilters.regiao!=='TODOS' && safe(r.regiao)!==mapFilters.regiao)return false;
      const km=Number(r.km);
      if(mapFilters.raio==='0-3' && !(Number.isFinite(km)&&km<=3))return false;
      if(mapFilters.raio==='3-5' && !(Number.isFinite(km)&&km>3&&km<=5))return false;
      if(mapFilters.raio==='5-10' && !(Number.isFinite(km)&&km>5&&km<=10))return false;
      if(mapFilters.raio==='10+' && !(Number.isFinite(km)&&km>10))return false;
      return true;
    });
  }
  function mapFilterOptions(rows,key){
    return [...new Set((rows||[]).map(r=>safe(r[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }
  function filterSelect(id,label,values,current){
    return `<label><span>${label}</span><select id="${id}"><option value="TODOS">Todos</option>${values.map(v=>`<option value="${esc(v)}"${v===current?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  }
  function ensureMapUi(map){
    const panel=map.getContainer();
    let ui=panel.querySelector('.orders-map-ui');
    if(!ui){
      ui=document.createElement('div');ui.className='orders-map-ui';
      ui.innerHTML=`<button class="orders-map-filter-btn" type="button">☷ FILTROS</button><div class="orders-map-filter-panel"></div>`;
      panel.appendChild(ui);
      ui.querySelector('.orders-map-filter-btn').onclick=e=>{e.stopPropagation();ui.classList.toggle('open')};
      L.DomEvent.disableClickPropagation(ui);L.DomEvent.disableScrollPropagation(ui);
    }
    return ui;
  }
  function renderMapFilterPanel(rows,map){
    const ui=ensureMapUi(map),box=ui.querySelector('.orders-map-filter-panel');
    const platforms=mapFilterOptions(rows,'platform');
    const turnos=mapFilterOptions(rows,'turno');
    const statuses=mapFilterOptions(rows,'status');
    const regioes=mapFilterOptions(rows,'regiao').filter(x=>x!=='A GEOCODIFICAR');
    box.innerHTML=`<div class="map-filter-head"><b>FILTROS DO MAPA</b><button type="button" data-close>×</button></div>
      ${filterSelect('mapFilterPlatform','Plataforma',platforms,mapFilters.platform)}
      ${filterSelect('mapFilterTurno','Turno',turnos,mapFilters.turno)}
      ${filterSelect('mapFilterStatus','Status',statuses,mapFilters.status)}
      ${filterSelect('mapFilterRegion','Região',regioes,mapFilters.regiao)}
      <label><span>Raio</span><select id="mapFilterRadius"><option value="TODOS">Todos</option><option value="0-3"${mapFilters.raio==='0-3'?' selected':''}>Até 3 km</option><option value="3-5"${mapFilters.raio==='3-5'?' selected':''}>3–5 km</option><option value="5-10"${mapFilters.raio==='5-10'?' selected':''}>5–10 km</option><option value="10+"${mapFilters.raio==='10+'?' selected':''}>Acima de 10 km</option></select></label>
      <div class="map-switch-row"><span>Agrupar pontos próximos</span><input id="mapFilterCluster" type="checkbox"${mapFilters.cluster?' checked':''}></div>
      <div class="map-switch-row"><span>Exibir áreas das regiões</span><input id="mapFilterAreas" type="checkbox"${mapFilters.areas?' checked':''}></div>
      <button type="button" class="map-filter-regeo">RELOCALIZAR ENDEREÇOS</button>
      <button type="button" class="map-filter-clear">LIMPAR FILTROS</button>`;
    const rerender=()=>{
      mapFilters.platform=box.querySelector('#mapFilterPlatform').value;
      mapFilters.turno=box.querySelector('#mapFilterTurno').value;
      mapFilters.status=box.querySelector('#mapFilterStatus').value;
      mapFilters.regiao=box.querySelector('#mapFilterRegion').value;
      mapFilters.raio=box.querySelector('#mapFilterRadius').value;
      mapFilters.cluster=box.querySelector('#mapFilterCluster').checked;
      mapFilters.areas=box.querySelector('#mapFilterAreas').checked;
      renderDashboard(currentRows);
    };
    box.querySelectorAll('select,input').forEach(x=>x.onchange=rerender);
    box.querySelector('[data-close]').onclick=()=>ui.classList.remove('open');
    box.querySelector('.map-filter-regeo').onclick=async()=>{const b=box.querySelector('.map-filter-regeo');b.disabled=true;b.textContent='LOCALIZANDO...';for(const r of currentRows){const k=keyAddr(r.endereco);const g=geoCache[k];if(!g||g.geoVersion!==GEO_VERSION||g.quality!=='exact')delete geoCache[k]}saveLocal();await geocodePending();b.disabled=false;b.textContent='RELOCALIZAR ENDEREÇOS'};
    box.querySelector('.map-filter-clear').onclick=()=>{mapFilters={platform:'TODOS',turno:'TODOS',status:'TODOS',raio:'TODOS',regiao:'TODOS',cluster:false,areas:false};renderDashboard(currentRows)};
  }
  function markerPopup(r){
    const km=Number.isFinite(+r.km)?`${(+r.km).toLocaleString('pt-BR',{maximumFractionDigits:1})} km`:'—';
    const val=Number.isFinite(+r.valor)?(+r.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
    return `<div class="order-map-popup"><b>Pedido ${esc(r.pedido)}</b><span>${esc(r.cliente||'Cliente não informado')}</span><hr>
      <small>Horário</small><strong>${esc(r.hora||'—')}</strong>
      <small>Plataforma</small><strong>${esc(r.platform||'—')}</strong>
      <small>Região</small><strong>${esc(r.regiao||'—')}</strong>
      <small>Motoboy</small><strong>${esc(r.motoboy||'—')}</strong>
      <small>KM</small><strong>${esc(km)}</strong>
      <small>Status</small><strong>${esc(r.status||'—')}</strong>
      <small>Valor</small><strong>${esc(val)}</strong>
      <small>Endereço</small><strong>${esc(r.endereco||'—')}</strong></div>`;
  }
  function exactCoordinateGroups(rows){
    const groups=new Map();
    for(const r of rows){
      // Agrupa apenas coordenadas praticamente idênticas.
      // Muitos pedidos podem ter o mesmo destino/endereço ou o geocoder pode
      // devolver o mesmo ponto. No mapa, cada pedido continua sendo exibido.
      const key=`${(+r.lat).toFixed(6)}|${(+r.lng).toFixed(6)}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(r);
    }
    return [...groups.values()];
  }
  function displayLatLng(r,index,total){
    const lat=+r.lat,lng=+r.lng;
    if(total<=1)return [lat,lng];
    // Separação SOMENTE visual para pontos sobrepostos.
    // Não altera a coordenada salva nem a classificação da região.
    const ring=Math.floor(index/10);
    const pos=index%10;
    const count=Math.min(10,total-ring*10);
    const angle=(Math.PI*2*pos/Math.max(1,count))+(ring*.31);
    const meters=10+(ring*8);
    const dLat=(meters/111320)*Math.sin(angle);
    const dLng=(meters/(111320*Math.cos(lat*Math.PI/180)))*Math.cos(angle);
    return [lat+dLat,lng+dLng];
  }
  function renderMapLegend(map,rows){
    const panel=map.getContainer();
    let legend=panel.querySelector('.orders-map-legend');
    if(!legend){legend=document.createElement('div');legend.className='orders-map-legend';panel.appendChild(legend)}
    const counts={};rows.forEach(r=>{const p=safe(r.platform)||'Outros';counts[p]=(counts[p]||0)+1});
    legend.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<span><i style="background:${platformColor(p)}"></i>${esc(p)} <b>${n}</b></span>`).join('');
  }
  function ensureDashboardMap(){
    const el=document.getElementById('deliveryHeatMap');if(!el||!window.L)return null;
    if(!dashboardMap){
      dashboardMap=L.map(el,{zoomControl:true,attributionControl:true,preferCanvas:true}).setView(DEFAULT_CENTER,DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(dashboardMap);
      dashboardZoneLayer=L.featureGroup().addTo(dashboardMap);
      dashboardMarkerLayer=L.featureGroup().addTo(dashboardMap);
      ensureMapUi(dashboardMap);
    }
    setTimeout(()=>dashboardMap.invalidateSize(),20);
    return dashboardMap;
  }
  function renderDashboard(rows){
    const map=ensureDashboardMap();if(!map)return;
    currentRows=rows||currentRows;reclassify(currentRows);
    dashboardZoneLayer.clearLayers();dashboardMarkerLayer.clearLayers();

    renderMapFilterPanel(currentRows,map);

    if(mapFilters.areas){
      zones.forEach(z=>{
        const poly=L.polygon(z.coords,{color:z.color,weight:1.2,fillColor:z.color,fillOpacity:.025,dashArray:'5 7'}).addTo(dashboardZoneLayer);
        poly.bindTooltip(z.name,{permanent:false,direction:'center',className:'region-label'});
      });
    }

    const filtered=mapFilteredRows(currentRows);
    const exactRows=filtered.filter(r=>!r.locationApprox&&Number.isFinite(r.lat)&&Number.isFinite(r.lng));
    const approxRows=filtered.filter(r=>r.locationApprox&&Number.isFinite(r.lat)&&Number.isFinite(r.lng));
    const mappedRows=[...exactRows,...approxRows];
    const renderedBounds=[];

    if(mapFilters.cluster){
      exactCoordinateGroups(mappedRows).forEach(group=>{
        if(group.length===1){
          const r=group[0],c=platformColor(r.platform),ll=[r.lat,r.lng],approx=!!r.locationApprox;
          renderedBounds.push(ll);
          L.circleMarker(ll,{radius:approx?5.5:6,color:approx?'#ffffff':'#111318',weight:approx?1.8:1.7,fillColor:c,fillOpacity:approx?.5:.98,dashArray:approx?'3 2':null})
            .bindPopup(markerPopup(r)+(approx?'<div class="approx-note">⚠ posição aproximada</div>':''),{maxWidth:300})
            .bindTooltip(`Pedido ${esc(r.pedido)} • ${esc(r.platform||'')}`,{direction:'top',offset:[0,-5]})
            .addTo(dashboardMarkerLayer);
        }else{
          const lat=group.reduce((sum,r)=>sum+(+r.lat),0)/group.length;
          const lng=group.reduce((sum,r)=>sum+(+r.lng),0)/group.length;
          const c=platformColor(group[0].platform);
          renderedBounds.push([lat,lng]);
          const mk=L.circleMarker([lat,lng],{
            radius:Math.min(18,8+Math.log2(group.length)*3),
            color:'#fff',weight:1.3,fillColor:c,fillOpacity:.94
          });
          mk.bindTooltip(String(group.length),{permanent:true,direction:'center',className:'cluster-count'});
          mk.bindPopup(`<div class="order-map-popup"><b>${group.length} pedidos neste ponto</b><span>Desative “Agrupar pontos próximos” para ver cada pedido separadamente.</span></div>`);
          mk.addTo(dashboardMarkerLayer);
        }
      });
    }else{
      // Exibe TODOS os pedidos. Se vários tiverem a mesma coordenada,
      // abre levemente os pontos em volta dela para não ficarem escondidos.
      exactCoordinateGroups(mappedRows).forEach(group=>{
        group.forEach((r,i)=>{
          const c=platformColor(r.platform);
          const ll=displayLatLng(r,i,group.length);
          renderedBounds.push(ll);
          const approx=!!r.locationApprox;
          const marker=L.circleMarker(ll,{
            radius:approx?5.5:6,
            color:approx?'#ffffff':'#111318',
            weight:approx?1.8:1.7,
            fillColor:c,
            fillOpacity:approx?.5:.98,
            dashArray:approx?'3 2':null
          });
          marker.bindPopup(markerPopup(r)+(approx?'<div class="approx-note">⚠ posição aproximada — número exato não confirmado</div>':''),{maxWidth:310});
          marker.bindTooltip(`Pedido ${esc(r.pedido)} • ${esc(r.platform||'')}`,{direction:'top',offset:[0,-6]});
          marker.addTo(dashboardMarkerLayer);
        });
      });
    }

    renderMapLegend(map,mappedRows);

    const bounds=renderedBounds;
    if(bounds.length>=2)map.fitBounds(bounds,{padding:[34,34],maxZoom:14});
    else if(bounds.length===1)map.setView(bounds[0],14);
    else{
      const zoneBounds=[];zones.forEach(z=>z.coords.forEach(x=>zoneBounds.push(x)));
      if(zoneBounds.length)map.fitBounds(zoneBounds,{padding:[18,18],maxZoom:12});
    }

    const panel=map.getContainer();
    let fl=panel.querySelector('.region-summary-floater');
    if(!fl){fl=document.createElement('div');fl.className='region-summary-floater';panel.appendChild(fl)}
    const noPoint=Math.max(0,filtered.length-mappedRows.length);
    fl.innerHTML=`<b>${mappedRows.length} pedidos demarcados</b><small>${exactRows.length} exatos • ${approxRows.length} aproximados${noPoint?` • ${noPoint} sem ponto`:''}</small>`;
    const badge=document.getElementById('mapAccuracyBadge');
    if(badge)badge.textContent=`${mappedRows.length}/${filtered.length} no mapa`;
  }
  function ensureRegionMap(){const el=document.getElementById('deliveryRegionMap');if(!el||!window.L)return null;if(!regionMap){regionMap=L.map(el,{zoomControl:true,preferCanvas:true}).setView(DEFAULT_CENTER,DEFAULT_ZOOM);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd',attribution:'© OpenStreetMap © CARTO'}).addTo(regionMap);drawLayer=L.featureGroup().addTo(regionMap);drawControl=new L.Control.Draw({position:'topleft',draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true,shapeOptions:{color:'#f0b83f',weight:2,fillOpacity:.15}}},edit:{featureGroup:drawLayer,remove:false}});regionMap.addControl(drawControl);regionMap.on(L.Draw.Event.CREATED,e=>{const name=safe(drawName||document.getElementById('newRegionName')?.value)||`Região ${zones.length+1}`;const coords=e.layer.getLatLngs()[0].map(p=>[+p.lat.toFixed(6),+p.lng.toFixed(6)]);zones.push({id:'z_'+Date.now(),name,color:colorFor(zones.length),coords});drawName='';const inp=document.getElementById('newRegionName');if(inp)inp.value='';saveZones()});regionMap.on(L.Draw.Event.EDITED,e=>{e.layers.eachLayer(layer=>{const id=layer.options.zoneId,z=zones.find(x=>x.id===id);if(z)z.coords=layer.getLatLngs()[0].map(p=>[+p.lat.toFixed(6),+p.lng.toFixed(6)])});saveZones()})}setTimeout(()=>regionMap.invalidateSize(),20);drawZonesOnEditor();drawOrderMarkers();return regionMap}
  function drawZonesOnEditor(){if(!regionMap||!drawLayer)return;drawLayer.clearLayers();zones.forEach(z=>{const l=L.polygon(z.coords,{color:z.color,weight:2,fillColor:z.color,fillOpacity:.14,zoneId:z.id}).addTo(drawLayer);l.options.zoneId=z.id;l.bindTooltip(z.name,{permanent:true,direction:'center',className:'region-label'});l.on('click',()=>selectZone(z.id))})}
  function drawOrderMarkers(){if(!regionMap)return;if(regionMap._deliveryMarkers){regionMap._deliveryMarkers.forEach(x=>regionMap.removeLayer(x))}regionMap._deliveryMarkers=[];for(const r of currentRows){const p=getCachedPoint(r);if(!p)continue;const c=L.circleMarker([p.lat,p.lng],{radius:p.approx?3:4,color:p.approx?'#8b8b8b':'#f0b83f',weight:1,fillColor:p.approx?'#666':'#f0b83f',fillOpacity:.75}).addTo(regionMap);c.bindPopup(`<b>Pedido ${esc(r.pedido)}</b><br>${esc(r.cliente||'')}<br>${esc(r.endereco||'')}<br><small>${p.approx?'Posição aproximada':'Endereço localizado'}</small>`);regionMap._deliveryMarkers.push(c)}}
  function selectZone(id){const z=zones.find(x=>x.id===id);if(!z||!regionMap)return;regionMap.fitBounds(z.coords,{padding:[30,30]})}
  function renderZoneList(){const el=document.getElementById('regionZoneList');if(!el)return;const counts={};currentRows.forEach(r=>counts[r.regiao]=(counts[r.regiao]||0)+1);el.innerHTML=zones.map(z=>`<div class="zone-row"><i class="zone-color" style="background:${z.color}"></i><div><b>${esc(z.name)}</b><small>${counts[z.name]||0} pedidos no período</small></div><div class="zone-actions"><button data-fit="${z.id}">ver</button><button data-rename="${z.id}">renomear</button><button class="danger" data-del="${z.id}">excluir</button></div></div>`).join('');el.querySelectorAll('[data-fit]').forEach(b=>b.onclick=()=>selectZone(b.dataset.fit));el.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{const z=zones.find(x=>x.id===b.dataset.rename);if(!z)return;const n=prompt('Novo nome da região:',z.name);if(n&&n.trim()){z.name=n.trim();saveZones()}});el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('Excluir esta área?'))return;zones=zones.filter(x=>x.id!==b.dataset.del);saveZones()})}
  function bindEditor(){const start=document.getElementById('startDrawRegion');if(start&&!start.dataset.bound){start.dataset.bound='1';start.onclick=()=>{ensureRegionMap();drawName=safe(document.getElementById('newRegionName')?.value);if(!drawName){alert('Digite o nome da região antes de desenhar.');return}new L.Draw.Polygon(regionMap,drawControl.options.draw.polygon).enable()}}const fit=document.getElementById('fitRegionsBtn');if(fit&&!fit.dataset.bound){fit.dataset.bound='1';fit.onclick=()=>{ensureRegionMap();const pts=zones.flatMap(z=>z.coords);if(pts.length)regionMap.fitBounds(pts,{padding:[25,25]})}}const geo=document.getElementById('geoPendingBtn');if(geo&&!geo.dataset.bound){geo.dataset.bound='1';geo.onclick=()=>geocodePending()}
    const retry=document.getElementById('retryUnclassifiedBtn');
    if(retry&&!retry.dataset.bound){retry.dataset.bound='1';retry.onclick=()=>retryUnclassified()}
  }
  function cleanAddress(address){
    return safe(address)
      .replace(/\.\s*Complemento:.*$/i,'')
      .replace(/\.\s*Refer[eê]ncia:.*$/i,'')
      .replace(/\b(apto|apartamento|bloco|sala|loja|casa)\b.*$/i,'')
      .replace(/\s+/g,' ')
      .replace(/\s+,/g,',')
      .trim();
  }
  function parseBrazilAddress(address){
    const clean=cleanAddress(address);
    const cep=(clean.match(/\b\d{5}-?\d{3}\b/)||[])[0]||'';
    const withoutCep=clean.replace(/\b\d{5}-?\d{3}\b/g,'').replace(/\s+/g,' ').trim();
    const parts=withoutCep.split(',').map(x=>x.trim()).filter(Boolean);
    let street='',number='',bairro='';
    if(parts.length){
      street=parts[0].replace(/\s+-\s+.*$/,'').trim();
      const second=parts[1]||'';
      let m=second.match(/\b(\d{1,6}[A-Za-z]?)\b/);
      if(m){number=m[1];bairro=second.replace(m[0],'').replace(/^[-\s]+|[-\s]+$/g,'').trim()}
      if(!number){
        m=street.match(/^(.*?)[,\s]+(\d{1,6}[A-Za-z]?)$/);
        if(m){street=m[1].trim();number=m[2]}
      }
      if(!bairro){
        bairro=(parts.slice(2).find(x=>!/rio de janeiro|\brj\b|brasil/i.test(x))||'')
          .replace(/^[-\s]+|[-\s]+$/g,'').trim();
      }
    }
    return{clean,street,number,bairro,cep};
  }
  function words(s){
    return norm(s).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>2&&!['rua','avenida','av','estrada','rodovia','travessa'].includes(x));
  }
  function similarity(a,b){
    const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return 0;
    let hit=0;A.forEach(x=>{if(B.has(x))hit++});
    return hit/Math.max(A.size,B.size);
  }
  function candidateScore(hit,p){
    const ad=hit.address||{};
    const road=ad.road||ad.pedestrian||ad.residential||ad.footway||ad.path||'';
    const hn=safe(ad.house_number);
    let score=0;
    if(p.number&&hn&&norm(hn)===norm(p.number))score+=70;
    else if(p.number&&hn)score-=35;
    else if(p.number&&!hn)score-=12;
    score+=similarity(p.street,road)*35;
    const place=[ad.suburb,ad.neighbourhood,ad.quarter,ad.city_district].filter(Boolean).join(' ');
    if(p.bairro&&similarity(p.bairro,place)>.35)score+=12;
    if(p.cep&&safe(ad.postcode).replace(/\D/g,'')===p.cep.replace(/\D/g,''))score+=15;
    if(['house','building','apartments','residential'].includes(safe(hit.type)))score+=8;
    return score;
  }
  async function nominatimSearch(url){
    const res=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'pt-BR'}});
    if(!res.ok){if(res.status===429)throw new Error('Limite temporário do mapa. Aguarde e tente novamente.');return[]}
    return await res.json();
  }
  async function geocodeAddress(address){
    const p=parseBrazilAddress(address);if(!p.clean)return null;
    const base='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=br&bounded=1&viewbox=-43.65,-22.80,-43.15,-23.15';
    const urls=[];
    if(p.street&&p.number){
      const streetParam=`${p.number} ${p.street}`;
      urls.push(base+'&street='+encodeURIComponent(streetParam)+'&city='+encodeURIComponent('Rio de Janeiro')+'&state='+encodeURIComponent('Rio de Janeiro')+(p.cep?'&postalcode='+encodeURIComponent(p.cep):''));
    }
    const q1=[p.street,p.number,p.bairro,'Rio de Janeiro','RJ',p.cep,'Brasil'].filter(Boolean).join(', ');
    if(q1)urls.push(base+'&q='+encodeURIComponent(q1));
    urls.push(base+'&q='+encodeURIComponent(p.clean+', Rio de Janeiro, RJ, Brasil'));

    let best=null,bestScore=-999;
    for(const url of [...new Set(urls)]){
      const arr=await nominatimSearch(url);
      for(const hit of arr||[]){
        const lat=+hit.lat,lng=+hit.lon;
        if(!(Number.isFinite(lat)&&Number.isFinite(lng)&&lat<=-22.80&&lat>=-23.15&&lng>=-43.65&&lng<=-43.15))continue;
        const sc=candidateScore(hit,p);
        if(sc>bestScore){bestScore=sc;best={hit,lat,lng,score:sc}}
      }
      if(bestScore>=85)break;
      await sleep(300);
    }
    if(!best)return null;
    const ad=best.hit.address||{};
    const exactNumber=!p.number || (ad.house_number&&norm(ad.house_number)===norm(p.number));
    const road=ad.road||ad.pedestrian||ad.residential||'';
    const exactRoad=!p.street || similarity(p.street,road)>=.45;
    const quality=(exactNumber&&exactRoad&&best.score>=55)?'exact':'approx';
    return{
      lat:best.lat,lng:best.lng,
      display:best.hit.display_name||'',
      address:ad,
      matchedHouseNumber:ad.house_number||'',
      matchedRoad:road,
      score:best.score,
      quality,
      geoVersion:GEO_VERSION,
      updatedAt:new Date().toISOString(),
      source:'nominatim-v2'
    }
  }

  function regionHintFromAddress(address){
    const a=norm(address);
    const pairs=[
      ['recreio','Recreio'],['barra da tijuca','Barra da Tijuca'],['barra olimpica','Barra Olímpica'],
      ['barra olímpica','Barra Olímpica'],['vargem grande','Vargem Grande'],['vargem pequena','Vargem Pequena'],
      ['taquara','Taquara'],['jacarepagua','Jacarepaguá'],['jacarepaguá','Jacarepaguá'],
      ['itanhanga','Itanhangá'],['itanhangá','Itanhangá'],['camorim','Camorim'],
      ['pechincha','Pechincha'],['freguesia','Freguesia'],['curicica','Curicica'],['joa','Joá'],['joá','Joá']
    ];
    for(const [k,v] of pairs)if(a.includes(k))return v;
    return '';
  }
  async function geocodeFallback(address,rowHint=''){
    const p=parseBrazilAddress(address);if(!p.clean)return null;
    const base='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=br&bounded=1&viewbox=-43.65,-22.80,-43.15,-23.15';
    const hints=[p.bairro,rowHint,regionHintFromAddress(address)].filter(Boolean);
    const queries=[
      [p.street,p.bairro,'Rio de Janeiro','RJ','Brasil'].filter(Boolean).join(', '),
      [p.street,rowHint,'Rio de Janeiro','RJ','Brasil'].filter(Boolean).join(', '),
      [p.bairro,'Rio de Janeiro','RJ','Brasil'].filter(Boolean).join(', ')
    ].filter(Boolean);
    let best=null,bestScore=-999;
    for(const q of [...new Set(queries)]){
      const arr=await nominatimSearch(base+'&q='+encodeURIComponent(q));
      for(const hit of arr||[]){
        const lat=+hit.lat,lng=+hit.lon;
        if(!(Number.isFinite(lat)&&Number.isFinite(lng)&&lat<=-22.80&&lat>=-23.15&&lng>=-43.65&&lng<=-43.15))continue;
        const ad=hit.address||{};
        const road=ad.road||ad.pedestrian||ad.residential||'';
        let sc=similarity(p.street,road)*45;
        const place=[ad.suburb,ad.neighbourhood,ad.quarter,ad.city_district].filter(Boolean).join(' ');
        for(const h of hints)if(similarity(h,place)>.3)sc+=18;
        if(sc>bestScore){bestScore=sc;best={lat,lng,hit,score:sc}}
      }
      if(bestScore>=40)break;
      await sleep(250);
    }
    if(best){
      const ad=best.hit.address||{};
      return{
        lat:best.lat,lng:best.lng,display:best.hit.display_name||'',address:ad,
        matchedHouseNumber:ad.house_number||'',
        matchedRoad:ad.road||ad.pedestrian||ad.residential||'',
        score:best.score,quality:'approx',geoVersion:GEO_VERSION,
        updatedAt:new Date().toISOString(),source:'nominatim-v2-fallback'
      };
    }
    const region=rowHint||regionHintFromAddress(address);
    const c=REGION_CENTERS[region];
    if(c){
      return{
        lat:c[0],lng:c[1],display:region,score:0,quality:'region',
        geoVersion:GEO_VERSION,updatedAt:new Date().toISOString(),source:'region-fallback'
      };
    }
    return null;
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function retryUnclassified(){
    const allowed=configuredRegions();
    let reset=0;
    for(const r of currentRows||[]){
      if(allowed.includes(r.regiao))continue;
      const k=keyAddr(r.endereco);
      if(!k)continue;
      const cached=geoCache[k];
      // Remove somente resultados negativos/aproximados para permitir nova tentativa.
      // Pontos reais já encontrados continuam preservados.
      if(!cached || cached.notFound || r.locationApprox){
        delete geoCache[k];
        delete r.lat; delete r.lng; r.locationApprox=false;
        reset++;
      }
    }
    saveLocal();
    const prog=document.getElementById('geoProgress');
    if(prog)prog.textContent=reset?`Reprocessando ${reset} endereço(s) não classificado(s)...`:'Os endereços não classificados já possuem coordenadas; revise os polígonos das áreas.';
    if(reset) await geocodePending();
    else {
      reclassify(currentRows);
      drawOrderMarkers();
      renderZoneList();
      renderDashboard(currentRows);
      if(changeHandler)changeHandler();
    }
  }

  async function geocodePending(){
    const btn=document.getElementById('geoPendingBtn'),prog=document.getElementById('geoProgress');
    const uniq=[],seen=new Set();
    for(const r of currentRows){
      const k=keyAddr(r.endereco);if(!k||seen.has(k))continue;
      const cached=geoCache[k];
      const isExactV2=cached&&cached.geoVersion===GEO_VERSION&&cached.quality==='exact'&&Number.isFinite(+cached.lat)&&Number.isFinite(+cached.lng);
      if(isExactV2)continue;
      seen.add(k);uniq.push({k,address:r.endereco});
    }
    if(!uniq.length){if(prog)prog.textContent='Todos os endereços deste período já foram processados.';return}
    if(btn){btn.disabled=true;btn.textContent='LOCALIZANDO...'}
    let exact=0,approx=0,fail=0;
    for(let i=0;i<uniq.length;i++){
      const item=uniq[i];
      if(prog)prog.textContent=`Localizando ${i+1} de ${uniq.length} • ${item.address}`;
      try{
        let g=await geocodeAddress(item.address);
        if(!g||g.quality!=='exact'){
          const related=currentRows.find(r=>keyAddr(r.endereco)===item.k);
          const hint=related?related._regionHint||related.regiao:'';
          const fb=await geocodeFallback(item.address,hint);
          if(fb)g=fb;
        }
        if(g){
          geoCache[item.k]=g;
          if(g.quality==='exact')exact++;else approx++;
        }else{
          geoCache[item.k]={notFound:true,geoVersion:GEO_VERSION,quality:'notFound',updatedAt:new Date().toISOString()};
          fail++;
        }
      }catch(e){console.warn(e);fail++}
      saveLocal();
      if((i+1)%10===0){try{await DeliveryFirebase.saveGeoCache?.(geoCache)}catch(e){}}
      await sleep(1100);
    }
    try{await DeliveryFirebase.saveGeoCache?.(geoCache)}catch(e){}
    reclassify(currentRows);drawOrderMarkers();renderZoneList();renderDashboard(currentRows);
    if(changeHandler)changeHandler();
    if(prog)prog.textContent=`Concluído: ${exact} exatos • ${approx} aproximados • ${fail} sem ponto.`;
    if(btn){btn.disabled=false;btn.textContent='LOCALIZAR ENDEREÇOS'}
  }
  async function init(){loadLocal();await loadRemote();bindEditor()}
  function showRegionView(rows){currentRows=rows||currentRows;reclassify(currentRows);ensureRegionMap();drawOrderMarkers();renderZoneList()}
  function onChange(fn){changeHandler=fn}
  function validRegionName(name){return zones.some(z=>z.name===name)}
  function configuredRegions(){return zones.map(z=>z.name)}
  loadLocal();
  window.DeliveryMap={init,prepareRows,renderDashboard,showRegionView,onChange,configuredRegions,validRegionName,reclassify,getCachedPoint,retryUnclassified};
})();
(function(){
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  const num=v=>{if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;let s=String(v).replace(/R\$/gi,'').replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null};
  const dateBR=v=>{if(v instanceof Date&&!isNaN(v))return v;if(!v||String(v).trim()==='—')return null;const s=String(v).trim();let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*-?\s*|\s+)(\d{2}):(\d{2})(?::(\d{2}))?/);if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0));const d=new Date(s);return isNaN(d)?null:d};
  const get=(o,names)=>{for(const n of names){const k=norm(n);if(o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!==''&&String(o[k]).trim()!=='—')return o[k]}return ''};
  async function parseFile(file){
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array',cellDates:false,raw:false});
    const ws=wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false}).map(row=>{const o={};Object.keys(row).forEach(k=>o[norm(k)]=row[k]);return o});
  }
  function regionFromAddress(addr){const s=norm(addr);const rules=[['recreio dos bandeirantes','Recreio'],['recreio','Recreio'],['barra da tijuca','Barra da Tijuca'],['itanhanga','Itanhangá'],['jacarepagua','Jacarepaguá'],['taquara','Taquara'],['vargem grande','Vargem Grande'],['vargem pequena','Vargem Pequena'],['camorim','Camorim'],['anil','Anil'],['rocinha','Rocinha'],['barra guaratiba','Barra de Guaratiba'],['joa,','Joá'],['pechincha','Pechincha'],['freguesia','Freguesia'],['curicica','Curicica'],['rio 2','Barra Olímpica'],['barra olimpica','Barra Olímpica'],['olimpica','Barra Olímpica'],['abelardo bueno','Barra Olímpica'],['jaime poggi','Barra Olímpica'],['lucio costa','Barra da Tijuca'],['lúcio costa','Barra da Tijuca'],['americas','Recreio'],['américas','Recreio']];for(const [a,b] of rules)if(s.includes(norm(a)))return b;return 'A GEOCODIFICAR'}
  const platform=o=>{const p=String(get(o,['Origem']));if(/ifood/i.test(p))return'iFood';if(/99food/i.test(p))return'99Food';if(/app coco/i.test(p))return'App Coco Bambu';if(/pedido manual/i.test(p))return'Pedido manual';return p&& !/system|coco bambu/i.test(p)?p:'Outros'};
  function normalize1(o){const pedido=String(get(o,['N Pedido','Número','Numero'])).replace(/\.0$/,'').trim();const enderecoAgilizone=get(o,['Endereco','Endereço']);return{pedido,source1:true,created:get(o,['Data de criacao','Data de criação']),status1:get(o,['Status']),platform:platform(o),cliente:get(o,['Nome','Cliente']),endereco:enderecoAgilizone,enderecoAgilizone,taxaEntrega:num(get(o,['Taxa de entrega'])),valor:num(get(o,['Total R$','Valor do pedido'])),cobrado:num(get(o,['Cobrado R$'])),pagOffline:num(get(o,['Pagamentos Offline'])),pagOnline:num(get(o,['Pagamentos Online'])),pagamento:get(o,['Forma de Pagamento','Pagamento']),telefone:get(o,['Telefone']),descontos:get(o,['Descontos'])}}
  function normalize2(o){const pedido=String(get(o,['Número','Numero','N Pedido'])).replace(/\.0$/,'').trim();const enderecoMaestro=get(o,['Endereço','Endereco']);return{pedido,source2:true,created:get(o,['Data e Hora Início de Preparo','Data e Hora Inicio de Preparo']),status2:get(o,['Status']),cliente:get(o,['Cliente']),endereco:enderecoMaestro,enderecoMaestro,motoboy:get(o,['Entregador']),empresa:get(o,['Empresa de Entrega']),km:num(get(o,['Distância em raio (km)','Distancia em raio (km)'])),tempoPreparo:num(get(o,['Tempo de preparo (min)'])),tempoColeta:num(get(o,['Tempo de coleta do entregador (min)'])),tempoEntrega:num(get(o,['Tempo de entrega do entregador (min)'])),tempoTotal:num(get(o,['Tempo total do pedido (min)'])),inicio:get(o,['Data e Hora Início de Preparo','Data e Hora Inicio de Preparo']),pronto:get(o,['Data e Hora Pronto']),alocado:get(o,['Data e Hora Alocado']),caminho:get(o,['Data e Hora Caminho']),entrega:get(o,['Data e Hora Entrega']),finalizado:get(o,['Data e Hora Finalizado']),tipo:get(o,['Tipo']),origem2:get(o,['Origem'])}}
  function merge(a,b){
    const out={...a};
    Object.keys(b).forEach(k=>{
      if((out[k]===undefined||out[k]===null||out[k]==='')&&b[k]!==undefined&&b[k]!==null&&b[k]!=='')out[k]=b[k]
    });
    ['motoboy','empresa','km','tempoPreparo','tempoColeta','tempoEntrega','tempoTotal','inicio','pronto','alocado','caminho','entrega','finalizado','tipo','origem2'].forEach(k=>{
      if(b[k]!==undefined&&b[k]!==null&&String(b[k]).trim()!==''&&String(b[k]).trim()!=='—')out[k]=b[k];
    });
    // Os dois relatórios possuem o mesmo pedido. Para mapa, o MAESTRO é a fonte principal
    // porque traz endereço completo com cidade/bairro/complemento. O Agilizone fica como apoio.
    if(b.enderecoMaestro&&String(b.enderecoMaestro).trim()&&String(b.enderecoMaestro).trim()!=='—'){
      out.enderecoMaestro=b.enderecoMaestro;
      out.endereco=b.enderecoMaestro;
      out.enderecoFonte='MAESTRO';
    }else if(a.enderecoAgilizone&&String(a.enderecoAgilizone).trim()){
      out.enderecoAgilizone=a.enderecoAgilizone;
      out.endereco=a.enderecoAgilizone;
      out.enderecoFonte='AGILIZONE';
    }
    return out
  }
  function status(r){const s=norm(r.status1||r.status2);if(s.includes('cancel'))return'CANCELADO';if(s.includes('entreg')||s.includes('finaliz'))return'ENTREGUE';if(s.includes('rota')||s.includes('despach'))return'EM ROTA';if(s.includes('pronto'))return'PRONTO';if(s.includes('preparo')||s.includes('aloc')||s.includes('confirm'))return'EM ANDAMENTO';return s?String(r.status1||r.status2).toUpperCase():'OUTROS'}
  function enrich(r){const dt=dateBR(r.created)||dateBR(r.inicio)||dateBR(r.entrega)||dateBR(r.finalizado);r.dt=dt;r.data=dt?`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`:'';r.dateKey=dt?`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`:'';r.hora=dt?`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`:'';r.turno=dt&&dt.getHours()>=17?'NOITE':'MANHÃ';r.status=status(r);r.regiao=regionFromAddress(r.endereco);r._regionHint=r.regiao;if(!r.platform)r.platform='Outros';if(r.tempoEntrega==null){const a=dateBR(r.caminho),b=dateBR(r.entrega);if(a&&b)r.tempoEntrega=Math.max(0,Math.round((b-a)/60000))}if(r.tempoTotal==null){const a=dateBR(r.inicio),b=dateBR(r.entrega)||dateBR(r.finalizado);if(a&&b)r.tempoTotal=Math.max(0,Math.round((b-a)/60000))}if(r.tempoPreparo==null){const a=dateBR(r.inicio),b=dateBR(r.pronto);if(a&&b)r.tempoPreparo=Math.max(0,Math.round((b-a)/60000))}return r}
  function consolidate(rows1,rows2){const map=new Map();rows1.map(normalize1).forEach(r=>{if(r.pedido)map.set(r.pedido,r)});rows2.map(normalize2).forEach(r=>{if(!r.pedido)return;map.set(r.pedido,map.has(r.pedido)?merge(map.get(r.pedido),r):r)});return[...map.values()].map(enrich).sort((a,b)=>(b.dt?.getTime()||0)-(a.dt?.getTime()||0))}
  window.DeliveryImport={parseFile,consolidate,norm,num,dateBR};
})();

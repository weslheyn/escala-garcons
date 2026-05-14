const GS_DEFAULT=[
  ['', 'G1', '286511'],
  ['WILLIAN FRANCO', 'G2', '744432'],
  ['FABRICIO', 'G3', '337700'],
  ['IGOR FERREIRA', 'G4', '264684'],
  ['', 'G5', '847551'],
  ['', 'G6', '820157'],
  ['', 'G7', '558311'],
  ['', 'G8', '008398'],
  ['', 'G9', '999556'],
  ['', 'G10', '375339'],
  ['', 'G11', '514736'],
  ['', 'G12', '848700'],
  ['', 'G13', '303665'],
  ['', 'G14', '895374'],
  ['KLEBER', 'G15', '873436'],
  ['ANDRE', 'G16', '863621'],
  ['', 'G17', '839542'],
  ['FABRICIA', 'G18', '447782'],
  ['ALEXANDRE', 'G19', '274713'],
  ['FABIALLY', 'G20', '808791'],
  ['ANA LUCIA', 'G21', '310815'],
  ['', 'G22', '307658'],
  ['RICKSON', 'G23', '879566'],
  ['PATRICIA', 'G24', '825466'],
  ['HELEN', 'G25', '720093'],
  ['MARINA', 'G26', '826000'],
  ['LEYREAN', 'G27', '490507'],
  ['PAULO', 'G28', '408259'],
  ['MIGUEL SEBASTIAN', 'G29', '151116'],
  ['', 'G30', '180820'],
  ['', 'G31', '279629'],
  ['', 'G32', '252862'],
  ['', 'G33', '795893'],
  ['', 'G34', '188859'],
  ['CAMILA', 'G35', '187924'],
  ['BAR', 'G36', '654536'],
  ['SAMUEL OLIVEIRA', 'G37', '702444'],
  ['', 'G38', '435622'],
  ['', 'G39', '533391'],
  ['', 'G40', '395385'],
  ['', 'M01', 'DIGITAL'],
  ['THIAGO SANTOS', 'M02', 'DIGITAL']
];
function pt(v){if(!v)return '-'; if(/^\d{4}-\d{2}-\d{2}$/.test(v)){let [y,m,d]=v.split('-');return `${d}/${m}/${y}`} return v}
function load(){let arr=[];try{arr=JSON.parse(localStorage.getItem('gs_registros')||'[]')}catch(e){};let by={};arr.forEach(g=>by[g.codigo]=g);GS_DEFAULT.forEach(x=>{if(!by[x[1]])by[x[1]]={nome:x[0],codigo:x[1],senha:x[2],ultimaAlteracao:'',bloqueadoAte:'',historico:[]};});arr=GS_DEFAULT.map(x=>by[x[1]]);localStorage.setItem('gs_registros',JSON.stringify(arr));return arr}
function status(g){if(g.nome)return 'EM USO'; if(g.bloqueadoAte && g.bloqueadoAte>=new Date().toISOString().slice(0,10))return 'BLOQUEADO'; return 'LIVRE'}
function render(){let b=(document.getElementById('busca').value||'').toUpperCase(), s=document.getElementById('status').value, c=document.getElementById('cod').value; let arr=load().filter(g=>(!b||g.nome.toUpperCase().includes(b)||g.codigo.includes(b))&&(!s||status(g)==s)&&(!c||g.codigo==c)); document.getElementById('body').innerHTML=arr.map(g=>`<div class="gs-row"><div>${g.nome||g.codigo+'<br><small>(Disponível)</small>'}</div><div style="color:#f5c842;font-weight:bold">${g.codigo}</div><div><span class="senha">${g.senha} 🔒</span></div><div><span class="pill ${status(g)=='EM USO'?'em':status(g)=='BLOQUEADO'?'bloq':'livre'}">${status(g)}</span></div><div>${pt(g.ultimaAlteracao)}${g.bloqueadoAte?'<br><small>Bloqueado até '+pt(g.bloqueadoAte)+'</small>':''}</div><div><button class="btn" onclick="edit('${g.codigo}')">✏️</button></div></div>`).join('')}
function fill(){document.getElementById('cod').innerHTML='<option value="">Todos os G\\'s</option>'+load().map(g=>`<option>${g.codigo}</option>`).join('');render()}
function edit(c){let arr=load(),g=arr.find(x=>x.codigo==c),n=prompt('Nome do garçom:',g.nome||''); if(n===null)return; n=n.trim().toUpperCase(); if(n!==g.nome){g.nome=n;g.ultimaAlteracao=new Date().toISOString().slice(0,10);g.bloqueadoAte=n?'':new Date(Date.now()+30*864e5).toISOString().slice(0,10);localStorage.setItem('gs_registros',JSON.stringify(arr));render();}}
window.onload=fill;

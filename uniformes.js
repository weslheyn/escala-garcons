(function(){
  const STORAGE_KEY='uniformes_app_v6_anapolis_2026';
  const $=sel=>document.querySelector(sel);
  const $$=sel=>Array.from(document.querySelectorAll(sel));
  const moneyless=n=>Number(n||0);
  const now=()=>new Date().toISOString();
  const fmtDate=iso=>{try{return new Date(iso).toLocaleString('pt-BR')}catch(e){return iso||''}};

  let state={itens:[], movimentos:[], funcionarios:{}, atualizadoEm:null};
  let firebaseReady=false;
  let saving=false;

  function cloneSeed(){ return (window.UNIFORMES_SEED||[]).map(i=>Object.assign({},i)); }
  function normalizeState(raw){
    const seed=cloneSeed();
    const byId={}; seed.forEach(i=>byId[i.id]=i);
    const incoming=(raw&&Array.isArray(raw.itens))?raw.itens:[];
    incoming.forEach(i=>{ if(i&&i.id) byId[i.id]=Object.assign({}, byId[i.id]||{}, i); });
    return {
      itens:Object.values(byId).map(calcItem),
      movimentos:(raw&&Array.isArray(raw.movimentos))?raw.movimentos:[],
      funcionarios:(raw&&raw.funcionarios)||{},
      atualizadoEm:(raw&&raw.atualizadoEm)||null
    };
  }
  function calcItem(item){
    item.estoqueAtual=moneyless(item.estoqueAtual);
    item.emUso=moneyless(item.emUso);
    item.lavanderia=moneyless(item.lavanderia);
    item.ideal=moneyless(item.ideal);
    item.comprar=Math.max(item.ideal-item.estoqueAtual,0);
    item.status=item.estoqueAtual<=0?'ZERADO':(item.comprar>0?'COMPRAR':'OK');
    return item;
  }
  function setores(){ return [...new Set(state.itens.map(i=>i.setor))].sort((a,b)=>a.localeCompare(b,'pt-BR')); }
  function itemById(id){ return state.itens.find(i=>i.id===id); }
  function setText(id,val){ const el=$(id); if(el) el.textContent=val; }
  function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  async function persist(){
    state.atualizadoEm=now(); saveLocal(); renderAll();
    if(firebaseReady && window.UniformesFirebase && !saving){
      saving=true;
      try{ await window.UniformesFirebase.saveState(state); }catch(e){ console.warn(e); }
      saving=false;
    }
  }

  function populateSetorSelect(select, all=false){
    const el=typeof select==='string'?$(select):select; if(!el) return;
    const current=el.value;
    el.innerHTML=(all?'<option value="TODOS">Todos os setores</option>':'')+setores().map(s=>`<option value="${s}">${s}</option>`).join('');
    if([...el.options].some(o=>o.value===current)) el.value=current;
  }
  function populateUniformeSelect(setorSel, itemSel){
    const setor=$(setorSel)?.value; const el=$(itemSel); if(!el) return;
    const items=state.itens.filter(i=>!setor||setor==='TODOS'||i.setor===setor).sort((a,b)=>`${a.grupo} ${a.nome}`.localeCompare(`${b.grupo} ${b.nome}`,'pt-BR'));
    el.innerHTML=items.map(i=>`<option value="${i.id}">${i.nome} • ${i.grupo} • estoque ${i.estoqueAtual}</option>`).join('');
  }
  function uniformeOptionsBySetor(setor, selected=''){
    const items=state.itens.filter(i=>!setor||setor==='TODOS'||i.setor===setor).sort((a,b)=>`${a.grupo} ${a.nome}`.localeCompare(`${b.grupo} ${b.nome}`,'pt-BR'));
    return items.map(i=>`<option value="${i.id}" ${i.id===selected?'selected':''}>${i.nome} • ${i.grupo} • estoque ${i.estoqueAtual}</option>`).join('');
  }
  function addMovItemRow(selected='', qtd=1){
    const box=$('#movItensLista'); if(!box) return;
    const setor=$('#movSetor')?.value || '';
    const row=document.createElement('div'); row.className='mov-item-row';
    row.innerHTML=`<select class="movUniformeItem">${uniformeOptionsBySetor(setor, selected)}</select><input class="movQtdItem" type="number" min="1" value="${qtd}"><button class="remove-item-btn" type="button" title="Remover">×</button>`;
    row.querySelector('.remove-item-btn').addEventListener('click',()=>{ if($$('.mov-item-row').length>1){ row.remove(); } });
    box.appendChild(row);
  }
  function refreshMovItemRows(){
    const rows=$$('.mov-item-row');
    if(!rows.length){ addMovItemRow(); return; }
    const setor=$('#movSetor')?.value || '';
    rows.forEach(row=>{ const sel=row.querySelector('.movUniformeItem'); const current=sel?.value||''; if(sel) sel.innerHTML=uniformeOptionsBySetor(setor,current); });
  }
  function getMovItems(){
    return $$('.mov-item-row').map(row=>({id:row.querySelector('.movUniformeItem')?.value, qtd:Math.max(1,parseInt(row.querySelector('.movQtdItem')?.value||'1',10))})).filter(x=>x.id);
  }
  function populateFuncionarios(){
    const dl=$('#listaColaboradores'); if(!dl) return;
    const nomes=Object.values(state.funcionarios||{}).map(f=>f.nome||f.name||f).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    dl.innerHTML=nomes.map(n=>`<option value="${String(n).replace(/"/g,'&quot;')}"></option>`).join('');
  }

  function renderResumo(){
    const totals=state.itens.reduce((acc,i)=>{acc.estoque+=i.estoqueAtual;acc.uso+=i.emUso;acc.lav+=i.lavanderia;acc.comp+=i.comprar;return acc},{estoque:0,uso:0,lav:0,comp:0});
    setText('#kpiEstoque',totals.estoque); setText('#kpiUso',totals.uso); setText('#kpiLavanderia',totals.lav); setText('#kpiComprar',totals.comp); setText('#totalItensResumo',`${state.itens.length} itens cadastrados`);
    const setorBox=$('#resumoSetores'); if(setorBox){
      setorBox.innerHTML=setores().map(s=>{const arr=state.itens.filter(i=>i.setor===s); const est=arr.reduce((a,i)=>a+i.estoqueAtual,0); const comp=arr.reduce((a,i)=>a+i.comprar,0); return `<div class="setor-row"><div><strong>${s}</strong><div class="muted">${arr.length} itens • estoque ${est}</div></div><span class="badge ${comp>0?'COMPRAR':'OK'}">Comprar ${comp}</span></div>`}).join('');
    }
    const alerts=$('#alertasCompra'); if(alerts){
      const crit=state.itens.filter(i=>i.comprar>0).sort((a,b)=>b.comprar-a.comprar).slice(0,10);
      alerts.innerHTML=crit.length?crit.map(i=>`<div class="alert-row"><div><strong>${i.nome}</strong><div class="muted">${i.setor} • ${i.grupo}</div></div><span class="badge ${i.status}">${i.status} • ${i.comprar}</span></div>`).join(''):'<div class="empty">Nenhum item pendente de compra.</div>';
    }
  }
  function renderEstoque(){
    const setor=$('#filtroSetor')?.value||'TODOS'; const busca=($('#buscaItem')?.value||'').toUpperCase(); const tb=$('#tabelaEstoque'); if(!tb) return;
    const rows=state.itens.filter(i=>(setor==='TODOS'||i.setor===setor)&&(`${i.setor} ${i.grupo} ${i.nome} ${i.tamanho}`.toUpperCase().includes(busca))).sort((a,b)=>`${a.setor} ${a.grupo} ${a.nome}`.localeCompare(`${b.setor} ${b.grupo} ${b.nome}`,'pt-BR'));
    tb.innerHTML=rows.map(i=>`<tr><td>${i.setor}</td><td>${i.grupo}</td><td><strong>${i.nome}</strong><div class="muted">${i.tipo} • ${i.tamanho}</div></td><td>${i.ideal}</td><td>${i.estoqueAtual}</td><td>${i.emUso}</td><td>${i.lavanderia}</td><td>${i.comprar}</td><td><span class="badge ${i.status}">${i.status}</span></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum item encontrado.</td></tr>';
  }
  function renderCompras(){ const tb=$('#tabelaCompras'); if(!tb) return; const rows=state.itens.filter(i=>i.comprar>0).sort((a,b)=>b.comprar-a.comprar); tb.innerHTML=rows.map(i=>`<tr><td>${i.setor}</td><td><strong>${i.nome}</strong><div class="muted">${i.grupo}</div></td><td>${i.estoqueAtual}</td><td>${i.ideal}</td><td><strong>${i.comprar}</strong></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma compra necessária.</td></tr>'; }
  function renderLavanderia(){ const tb=$('#tabelaLavanderia'); if(!tb) return; const rows=state.itens.filter(i=>i.lavanderia>0).sort((a,b)=>b.lavanderia-a.lavanderia); tb.innerHTML=rows.map(i=>`<tr><td><strong>${i.nome}</strong><div class="muted">${i.grupo}</div></td><td>${i.setor}</td><td>${i.lavanderia}</td><td>${i.estoqueAtual}</td><td>${i.comprar}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma peça na lavanderia.</td></tr>'; }
  function renderHistorico(){ const el=$('#historicoLista'); if(!el) return; const rows=[...state.movimentos].slice(-80).reverse(); el.innerHTML=rows.map(m=>`<div class="history-row"><div><strong>${m.tipo}</strong><div class="muted">${fmtDate(m.data)} • ${m.itemNome||''} • Qtd ${m.qtd}</div></div><div class="muted">${m.colaborador||m.fornecedor||''}<br>${m.obs||''}</div></div>`).join('')||'<div class="empty">Sem movimentações.</div>'; }
  function renderFuncionarios(){ const el=$('#listaFuncionarios'); if(!el) return; const busca=($('#buscaFuncionario')?.value||'').toUpperCase(); const posse={}; state.movimentos.forEach(m=>{ if(!m.colaborador) return; posse[m.colaborador]=posse[m.colaborador]||{}; if(m.tipo==='ENTREGA') posse[m.colaborador][m.itemNome]=(posse[m.colaborador][m.itemNome]||0)+m.qtd; if(m.tipo==='DEVOLUÇÃO') posse[m.colaborador][m.itemNome]=(posse[m.colaborador][m.itemNome]||0)-m.qtd; }); const nomes=Object.keys(posse).filter(n=>n.toUpperCase().includes(busca)).sort(); el.innerHTML=nomes.map(n=>{const itens=Object.entries(posse[n]).filter(([,q])=>q>0).map(([item,q])=>`${item}: ${q}`).join(' • ')||'Sem peças em aberto'; return `<div class="func-row"><strong>${n}</strong><div class="muted">${itens}</div></div>`}).join('')||'<div class="empty">Nenhum funcionário com peça registrada ainda.</div>'; }
  function renderAll(){ populateSetorSelect('#movSetor'); populateSetorSelect('#lavSetor'); populateSetorSelect('#filtroSetor',true); populateUniformeSelect('#movSetor','#movUniforme'); populateUniformeSelect('#lavSetor','#lavUniforme'); populateFuncionarios(); renderResumo(); renderEstoque(); renderCompras(); renderLavanderia(); renderHistorico(); renderFuncionarios(); }

  function registerMovement(){
    const tipo=$('#movTipo').value;
    const col=$('#movColaborador').value.trim();
    const obs=$('#movObs').value.trim();
    const itensMov=getMovItems();
    if(!itensMov.length) return alert('Acrescente pelo menos um uniforme.');
    if(tipo!=='AJUSTE' && !col) return alert('Informe o colaborador.');
    for(const mov of itensMov){
      const item=itemById(mov.id);
      if(!item) return alert('Selecione todos os uniformes.');
      if(tipo==='ENTREGA' && item.estoqueAtual<mov.qtd) return alert(`Estoque insuficiente para ${item.nome}. Estoque atual: ${item.estoqueAtual}`);
    }
    const loteId='lote_'+Date.now();
    itensMov.forEach((mov,idx)=>{
      const item=itemById(mov.id); const qtd=mov.qtd;
      if(tipo==='ENTREGA'){ item.estoqueAtual-=qtd; item.emUso+=qtd; }
      if(tipo==='DEVOLUÇÃO'){ item.estoqueAtual+=qtd; item.emUso=Math.max(item.emUso-qtd,0); }
      if(tipo==='AJUSTE'){ item.estoqueAtual+=qtd; }
      calcItem(item);
      state.movimentos.push({id:'mov_'+Date.now()+'_'+idx,loteId,tipo,data:now(),itemId:item.id,itemNome:item.nome,setor:item.setor,qtd,colaborador:col,obs});
    });
    persist();
    alert(itensMov.length>1 ? 'Movimentação registrada com vários uniformes.' : 'Movimentação registrada.');
  }
  function registerLaundry(){
    const tipo=$('#lavAcao').value, id=$('#lavUniforme').value, item=itemById(id), qtd=Math.max(1,parseInt($('#lavQtd').value||'1',10)); if(!item) return alert('Selecione um uniforme.');
    if(tipo==='ENVIAR_LAVANDERIA' && item.estoqueAtual<qtd) return alert('Estoque insuficiente para enviar.');
    if(tipo==='RETORNO_LAVANDERIA' && item.lavanderia<qtd) return alert('Quantidade maior do que está na lavanderia.');
    if(tipo==='ENVIAR_LAVANDERIA'){ item.estoqueAtual-=qtd; item.lavanderia+=qtd; }
    if(tipo==='RETORNO_LAVANDERIA'){ item.estoqueAtual+=qtd; item.lavanderia=Math.max(item.lavanderia-qtd,0); }
    calcItem(item);
    state.movimentos.push({id:'lav_'+Date.now(),tipo,data:now(),itemId:item.id,itemNome:item.nome,setor:item.setor,qtd,fornecedor:$('#lavFornecedor').value.trim(),previsao:$('#lavPrevisao').value});
    persist(); alert('Lavanderia registrada.');
  }
  function copyCompras(){
    const txt=state.itens.filter(i=>i.comprar>0).sort((a,b)=>a.setor.localeCompare(b.setor,'pt-BR')||b.comprar-a.comprar).map(i=>`${i.setor} | ${i.nome} | Comprar: ${i.comprar} | Estoque: ${i.estoqueAtual}/${i.ideal}`).join('\n');
    navigator.clipboard?.writeText('LISTA DE COMPRAS - UNIFORMES\n'+txt); alert('Lista copiada.');
  }
  function bind(){
    $$('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{ $$('.page').forEach(p=>p.classList.remove('active')); $('#'+btn.dataset.page)?.classList.add('active'); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===btn.dataset.page)); window.scrollTo({top:0,behavior:'smooth'}); }));
    $('#movSetor')?.addEventListener('change',refreshMovItemRows);
    $('#lavSetor')?.addEventListener('change',()=>populateUniformeSelect('#lavSetor','#lavUniforme'));
    $('#filtroSetor')?.addEventListener('change',renderEstoque); $('#buscaItem')?.addEventListener('input',renderEstoque); $('#buscaFuncionario')?.addEventListener('input',renderFuncionarios);
    $('#btnAddMovItem')?.addEventListener('click',()=>addMovItemRow());
    $('#btnRegistrarMov')?.addEventListener('click',registerMovement); $('#btnRegistrarLav')?.addEventListener('click',registerLaundry); $('#btnCopiarCompras')?.addEventListener('click',copyCompras);
  }
  async function init(){
    const local=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); state=normalizeState(local); bind(); renderAll(); refreshMovItemRows();
    if(window.UniformesFirebase && await window.UniformesFirebase.init()){
      firebaseReady=true; $('#syncStatus').textContent='Sincronizado Firebase';
      window.UniformesFirebase.listenState(remote=>{ if(remote && !saving){ state=normalizeState(remote); saveLocal(); renderAll(); } else if(!remote){ window.UniformesFirebase.saveState(state); } });
      window.UniformesFirebase.listenFuncionarios(list=>{ const obj={}; (list||[]).forEach((f,idx)=>{ const nome=f.nome||f.name||f.NOME||f.colaborador; if(nome) obj['f_'+idx]={nome,setor:f.setor||f.SETOR||''}; }); state.funcionarios=obj; saveLocal(); populateFuncionarios(); });
    }
  }
  document.addEventListener('DOMContentLoaded',init);
})();

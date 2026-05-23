(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const LS='uniformes_estoque_v5_premium';
  let firebaseReady=false, selected=[];
  let state={itens:{},movimentacoes:{},funcionarios:[],funcionariosAvulsos:[]};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const now=()=>new Date().toISOString();
  const dataBR=d=>new Date(d||Date.now()).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

  function itemCalc(i){
    const atual=Math.max(0,Number(i.estoqueAtual||0)), ideal=Math.max(0,Number(i.ideal||0)), minimo=Math.max(0,Number(i.minimo||0));
    const comprar=Math.max(0,ideal-atual);
    const status=atual<=0?'ZERADO':(comprar>0||atual<=minimo?'COMPRAR':'OK');
    return {...i,estoqueAtual:atual,ideal,minimo,comprar,status};
  }
  function arrItens(){return Object.values(state.itens||{}).map(itemCalc).sort((a,b)=>String(a.setor).localeCompare(b.setor)||String(a.nome).localeCompare(b.nome)||String(a.tamanho).localeCompare(b.tamanho));}
  function arrMov(){return Object.values(state.movimentacoes||{}).sort((a,b)=>String(b.dataISO||'').localeCompare(String(a.dataISO||'')));}
  function setores(){return [...new Set(arrItens().map(i=>i.setor).filter(Boolean))].sort();}
  function grupos(setor=''){return [...new Set(arrItens().filter(i=>!setor||i.setor===setor).map(i=>i.grupo).filter(Boolean))].sort();}
  function nomes(setor='',grupo=''){return [...new Set(arrItens().filter(i=>(!setor||i.setor===setor)&&(!grupo||i.grupo===grupo)).map(i=>i.nome).filter(Boolean))].sort();}
  function tamanhos(setor='',nome=''){return [...new Set(arrItens().filter(i=>(!setor||i.setor===setor)&&(!nome||i.nome===nome)).map(i=>i.tamanho).filter(Boolean))].sort();}
  function byId(id){return state.itens?.[id]?itemCalc(state.itens[id]):null;}

  function loadLocal(){try{const raw=localStorage.getItem(LS); if(raw) state={...state,...JSON.parse(raw)};}catch(e){console.warn(e)}}
  function saveLocal(){localStorage.setItem(LS,JSON.stringify(state));}
  async function persist(){saveLocal(); renderAll(); if(firebaseReady&&window.UniformesFirebase){try{await UniformesFirebase.saveState(state)}catch(e){console.warn(e)}}}
  function seed(force=false){ if(force||!Object.keys(state.itens||{}).length){ state.itens={}; (window.UNIFORMES_SEED||[]).forEach(x=>state.itens[x.id]=itemCalc({...x,criadoEm:now()})); saveLocal(); }}

  function setSync(ok,text){
    $('#syncTitle').textContent=ok?'Firebase conectado':'Modo local';
    $('#syncText').textContent=text|| (ok?'Sincronizando em /uniformes_estoque':'Dados salvos neste dispositivo');
    $('#syncDot').style.background=ok?'#26d07c':'#f59e0b';
  }
  async function initFirebase(){
    try{
      if(!window.UniformesFirebase) return setSync(false);
      firebaseReady=await UniformesFirebase.init();
      setSync(firebaseReady);
      if(firebaseReady){
        UniformesFirebase.listenState(remote=>{ if(remote&&remote.itens){ state={...state,...remote}; saveLocal(); fillAll(); renderAll(); }});
        UniformesFirebase.listenFuncionarios(list=>{ state.funcionarios=(list||[]); saveLocal(); fillFuncionariosDropdown(); });
      }
    }catch(e){console.warn(e);setSync(false)}
  }

  function fillSelect(el,values,first='Selecione'){
    if(!el) return;
    el.innerHTML=`<option value="">${esc(first)}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  function fillAll(){
    const s=setores();
    ['movSetor','entradaSetor','quickSetor','filterSetor','filterFuncSetor','novoFuncSetor'].forEach(id=>fillSelect($('#'+id),s,id.startsWith('filter')?'Todos os setores':'Selecione o setor'));
    fillQuickLists(); fillEntradaItens(); fillItemPicker(); fillFuncionariosDropdown();
  }
  function fillQuickLists(){
    const setor=$('#quickSetor')?.value||''; const grupo=$('#quickGrupo')?.value||''; const nome=$('#quickNome')?.value||'';
    fillSelect($('#quickGrupo'),grupos(setor),'Selecione o grupo'); if(grupo) $('#quickGrupo').value=grupo;
    fillSelect($('#quickNome'),nomes(setor,$('#quickGrupo')?.value||''),'Selecione o uniforme'); if(nome) $('#quickNome').value=nome;
    fillSelect($('#quickTamanho'),tamanhos(setor,$('#quickNome')?.value||''),'Selecione o tamanho');
  }
  function fillEntradaItens(){
    const setor=$('#entradaSetor')?.value||'';
    const itens=arrItens().filter(i=>!setor||i.setor===setor);
    const el=$('#entradaItem'); if(!el) return;
    el.innerHTML=`<option value="">Selecione o uniforme</option>`+itens.map(i=>`<option value="${esc(i.id)}">${esc(i.nome)} · Tam. ${esc(i.tamanho)} · atual ${i.estoqueAtual}</option>`).join('');
  }

  function normalizeFuncionario(raw,fonte='escala'){
    if(!raw) return null;
    const nome=raw.nomeCompleto||raw.nome||raw.name||raw.NOME||raw.funcionario||raw.colaborador||raw.nomeFreelance||'';
    if(!nome) return null;
    const setor=raw.setor||raw.categoria||raw.grupoEscala||raw.funcao||raw.cargo||raw.area||'';
    return {nome:String(nome).trim(),setor:String(setor||'').trim(),fonte:raw.fonte||fonte,id:raw.id||raw.key||uid('func')};
  }
  function allFuncionarios(){
    const fonte=$('#movFonte')?.value||'todos';
    const base=[...(state.funcionarios||[]).map(f=>normalizeFuncionario(f,f.fonte||'escala')),...(state.funcionariosAvulsos||[]).map(f=>normalizeFuncionario(f,f.fonte||'avulso'))].filter(Boolean);
    const map=new Map(); base.forEach(f=>{const k=norm(f.nome); if(!map.has(k)||(!map.get(k).setor&&f.setor)) map.set(k,f)});
    return [...map.values()].filter(f=>fonte==='todos'||f.fonte===fonte||(fonte==='freelance'&&/free/i.test(f.fonte))||(fonte==='avulso'&&['avulso','freelance_local'].includes(f.fonte)) ).sort((a,b)=>a.nome.localeCompare(b.nome));
  }
  function fillFuncionariosDropdown(){ showFuncDropdown(false); }
  function selectedFunc(){const n=$('#movFuncionario')?.value||''; return allFuncionarios().find(f=>norm(f.nome)===norm(n))||null;}
  function showFuncDropdown(force=true){
    const box=$('#funcDropdown'); if(!box) return;
    const q=norm($('#movFuncionario')?.value||'');
    const list=allFuncionarios().filter(f=>!q||norm(`${f.nome} ${f.setor} ${f.fonte}`).includes(q)).slice(0,30);
    box.innerHTML=list.map(f=>`<button type="button" data-name="${esc(f.nome)}" data-setor="${esc(f.setor)}"><b>${esc(f.nome)}</b><small>${esc(f.setor||'Setor não informado')} · ${esc(f.fonte||'base')}</small></button>`).join('') || `<button type="button" data-create="1">Cadastrar "${esc($('#movFuncionario').value)}"</button>`;
    box.classList.toggle('hidden',!force);
    $$('button',box).forEach(btn=>btn.onclick=()=>{
      if(btn.dataset.create){ openFuncModal($('#movFuncionario').value); return; }
      $('#movFuncionario').value=btn.dataset.name||'';
      const setor=matchSetor(btn.dataset.setor||''); if(setor) $('#movSetor').value=setor;
      box.classList.add('hidden'); fillItemPicker();
    });
  }
  function matchSetor(st){return setores().find(s=>norm(s)===norm(st)||norm(s).includes(norm(st))||norm(st).includes(norm(s)))||'';}

  function holdings(includeIds=false){
    const map={};
    arrMov().slice().reverse().forEach(m=>{
      if(!m.funcionario||!m.itemId) return;
      const k=slug(m.funcionario); map[k] ||= {nome:m.funcionario,setor:m.setor,itens:{}};
      const mult=m.tipo==='ENTREGA'?1:(['DEVOLUCAO','PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo)?-1:0);
      if(!mult) return;
      map[k].itens[m.itemId] ||= {itemId:m.itemId,nome:m.itemNome,tamanho:m.tamanho,setor:m.setor,qtd:0};
      map[k].itens[m.itemId].qtd += mult*Number(m.qtd||0);
    });
    return Object.values(map).map(p=>({...p,itens:Object.values(p.itens).filter(i=>i.qtd>0).map(i=>includeIds?i:{nome:i.nome,tamanho:i.tamanho,setor:i.setor,qtd:i.qtd})})).filter(p=>p.itens.length);
  }
  function getEmPosse(func,itemId){const p=holdings(true).find(h=>norm(h.nome)===norm(func)); const it=p?.itens?.find(i=>i.itemId===itemId); return Math.max(0,Number(it?.qtd||0));}
  function fillItemPicker(){
    const el=$('#itemPicker'); if(!el) return;
    const setor=$('#movSetor')?.value||''; const tipo=$('#movTipo')?.value||'ENTREGA'; const funcionario=$('#movFuncionario')?.value||'';
    let itens=arrItens().filter(i=>setor&&i.setor===setor);
    if(tipo==='DEVOLUCAO'){
      const ids=new Set((holdings(true).find(p=>norm(p.nome)===norm(funcionario))?.itens||[]).map(i=>i.itemId));
      itens=itens.filter(i=>ids.has(i.id));
    }
    el.innerHTML=`<option value="">${setor?'Selecione o uniforme':'Selecione o setor primeiro'}</option>`+itens.map(i=>{
      const detalhe=tipo==='DEVOLUCAO'?`em posse ${getEmPosse(funcionario,i.id)}`:`estoque ${i.estoqueAtual}`;
      return `<option value="${esc(i.id)}">${esc(i.nome)} · Tam. ${esc(i.tamanho)} · ${detalhe}</option>`;
    }).join('');
  }
  function renderSelected(){
    $('#selectedCount').textContent=`${selected.length} ${selected.length===1?'item':'itens'}`;
    $('#selectedItems').innerHTML=selected.map((s,idx)=>{const i=byId(s.itemId)||{};return `<div class="selected-item"><div><strong>${esc(i.nome||'-')}</strong><small>${esc(i.setor||'')} · Tam. ${esc(i.tamanho||'')}</small></div><input type="number" min="1" value="${s.qtd}" data-sel-qtd="${idx}"><button type="button" data-remove-sel="${idx}">×</button></div>`}).join('')||`<div class="empty">Nenhum uniforme adicionado ainda.</div>`;
    $$('[data-remove-sel]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.removeSel),1);renderSelected()});
    $$('[data-sel-qtd]').forEach(inp=>inp.oninput=()=>{selected[Number(inp.dataset.selQtd)].qtd=Math.max(1,Number(inp.value||1))});
  }
  function addSelected(){
    const id=$('#itemPicker').value; if(!id) return alert('Selecione um uniforme.');
    const qtd=Math.max(1,Number($('#itemQtd').value||1));
    const exist=selected.find(x=>x.itemId===id); if(exist) exist.qtd+=qtd; else selected.push({itemId:id,qtd});
    $('#itemPicker').value=''; $('#itemQtd').value=1; renderSelected();
  }

  function renderDashboard(){
    const itens=arrItens(); const res=itens.reduce((a,i)=>(a.total+=i.estoqueAtual,a.zerados+=i.status==='ZERADO'?1:0,a.baixo+=i.status!=='OK'?1:0,a.comprar+=i.comprar,a),{total:0,zerados:0,baixo:0,comprar:0});
    const oc=resumoOcorrencias();
    $('#kpiEstoque').textContent=res.total; $('#kpiZerados').textContent=res.zerados; $('#kpiBaixo').textContent=res.baixo; $('#kpiComprar').textContent=res.comprar; $('#kpiPerdidos').textContent=oc.PERDIDO||0; $('#kpiDanificados').textContent=(oc.DANIFICADO||0)+(oc.RASGADO||0);
    $('#heroStatus').textContent=res.baixo?'Estoque sob atenção':'Estoque equilibrado'; $('#heroText').textContent=res.baixo?`${res.baixo} itens abaixo do ideal e ${res.comprar} peças para comprar.`:'Nenhum alerta crítico no momento.';
    const by={}; itens.forEach(i=>{by[i.setor]||={atual:0,ideal:0,comprar:0};by[i.setor].atual+=i.estoqueAtual;by[i.setor].ideal+=i.ideal;by[i.setor].comprar+=i.comprar});
    $('#sectorBars').innerHTML=Object.entries(by).sort((a,b)=>b[1].comprar-a[1].comprar).map(([s,d])=>{const pct=d.ideal?Math.min(100,Math.round(d.atual/d.ideal*100)):0;return `<div class="bar-row"><b>${esc(s)}</b><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span>${d.atual}/${d.ideal}</span></div>`}).join('')||empty('Nenhum setor');
    $('#alertList').innerHTML=itens.filter(i=>i.status!=='OK').sort((a,b)=>b.comprar-a.comprar).slice(0,8).map(i=>`<div class="alert-item"><div><b>${esc(i.nome)}</b><small>${esc(i.setor)} · Tam. ${esc(i.tamanho)} · atual ${i.estoqueAtual}</small></div><strong>Comprar ${i.comprar}</strong></div>`).join('')||`<div class="alert-item"><div><b>Estoque completo</b><small>Sem compras pendentes.</small></div><strong>OK</strong></div>`;
    renderMovList('#recentBody',arrMov().slice(0,7));
  }
  function renderMovList(target,movs,full=false){
    const el=$(target); if(!el) return;
    el.innerHTML=movs.map(m=>`<div class="list-row"><span>${esc(m.dataTexto||'')}</span><span class="badge ${esc(m.tipo)}">${esc(m.tipo)}</span><b>${esc(m.funcionario||'-')}</b><small>${esc(m.setor||'-')}</small><small>${esc(m.itemNome||'-')} ${esc(m.tamanho||'')}</small><b>${m.qtd||0}</b>${full?`<small>${m.antes??'-'} → ${m.depois??'-'}</small><small>${esc(m.obs||'')}</small>`:''}</div>`).join('')||empty('Nenhuma movimentação registrada.');
  }
  function renderEstoque(){
    const q=norm($('#searchEstoque')?.value||''), setor=$('#filterSetor')?.value||'', status=$('#filterStatus')?.value||'';
    const rows=arrItens().filter(i=>(!setor||i.setor===setor)&&(!status||i.status===status)&&(!q||norm(`${i.setor} ${i.grupo} ${i.nome} ${i.tamanho}`).includes(q)));
    $('#estoqueBody').innerHTML=rows.map(i=>`<div class="inv-row"><small>${esc(i.setor)}</small><b>${esc(i.nome)}<small>${esc(i.grupo||'')} · Tam. ${esc(i.tamanho)}</small></b><span class="qty-num">${i.estoqueAtual}</span><span>${i.ideal}</span><span>${i.comprar}</span><span class="badge ${i.status}">${i.status}</span><button class="btn mini soft" data-edit-stock="${esc(i.id)}">Editar</button></div>`).join('')||empty('Nenhum item encontrado.');
    $$('[data-edit-stock]').forEach(b=>b.onclick=()=>prefillEdit(b.dataset.editStock));
  }
  function prefillEdit(id){const i=byId(id); if(!i)return; $('#quickSetor').value=i.setor; fillQuickLists(); $('#quickGrupo').value=i.grupo||''; fillQuickLists(); $('#quickNome').value=i.nome; fillQuickLists(); $('#quickTamanho').value=i.tamanho; $('#quickAtual').value=i.estoqueAtual; $('#quickIdeal').value=i.ideal; $('#quickMinimo').value=i.minimo; jump('estoque'); window.scrollTo({top:0,behavior:'smooth'});}
  function renderCompras(){
    $('#comprasBody').innerHTML=arrItens().filter(i=>i.comprar>0).sort((a,b)=>b.comprar-a.comprar).map(i=>`<div class="buy-row"><small>${esc(i.setor)}</small><b>${esc(i.nome)}<small>Tam. ${esc(i.tamanho)}</small></b><span>${i.estoqueAtual}</span><span>${i.ideal}</span><strong>${i.comprar}</strong><span class="badge ${i.status}">${i.status==='ZERADO'?'Urgente':'Comprar'}</span></div>`).join('')||empty('Nenhuma compra necessária.');
  }
  function renderFuncionarios(){
    const q=norm($('#searchFunc')?.value||''), setor=$('#filterFuncSetor')?.value||'';
    const rows=holdings().filter(p=>(!q||norm(p.nome).includes(q))&&(!setor||p.setor===setor));
    $('#funcCards').innerHTML=rows.map(p=>`<article class="person-card"><h3>${esc(p.nome)}</h3><small>${esc(p.setor||'Setor não informado')}</small><ul>${p.itens.map(i=>`<li><span>${esc(i.nome)} ${esc(i.tamanho||'')}</span><b>${i.qtd}</b></li>`).join('')}</ul></article>`).join('')||empty('Nenhum uniforme em posse.');
  }
  function resumoOcorrencias(){const out={PERDIDO:0,DANIFICADO:0,RASGADO:0}; arrMov().forEach(m=>{if(out[m.tipo]!=null) out[m.tipo]+=Number(m.qtd||0)}); return out;}
  function renderReports(){
    const r=resumoOcorrencias(); $('#repPerdidos').textContent=r.PERDIDO||0; $('#repDanificados').textContent=r.DANIFICADO||0; $('#repRasgados').textContent=r.RASGADO||0; $('#repOcorrencias').textContent=(r.PERDIDO||0)+(r.DANIFICADO||0)+(r.RASGADO||0);
    const occ=arrMov().filter(m=>['PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo));
    renderMovList('#ocorrenciasBody',occ,true);
  }
  function renderHistorico(){
    const q=norm($('#searchHist')?.value||''), tipo=$('#filterHistTipo')?.value||'';
    const rows=arrMov().filter(m=>(!tipo||m.tipo===tipo)&&(!q||norm(`${m.tipo} ${m.funcionario} ${m.setor} ${m.itemNome} ${m.obs}`).includes(q)));
    renderMovList('#historicoBody',rows,true);
  }
  function renderAll(){renderDashboard();renderEstoque();renderCompras();renderFuncionarios();renderReports();renderHistorico();fillEntradaItens();fillItemPicker();}
  function empty(t){return `<div class="empty">${esc(t)}</div>`}

  function registrarMov(tipo,item,qtd,func,setor,cond,resp,obs){
    const antes=item.estoqueAtual; let depois=antes; let realTipo=tipo;
    if(tipo==='ENTREGA') depois=Math.max(0,antes-qtd);
    if(tipo==='ENTRADA'||tipo==='AJUSTE') depois=antes+qtd;
    if(tipo==='DEVOLUCAO'){
      if(['DANIFICADO','RASGADO','PERDIDO'].includes(cond)) realTipo=cond; else depois=antes+qtd;
    }
    state.itens[item.id]=itemCalc({...item,estoqueAtual:depois});
    const id=uid('mov'); state.movimentacoes[id]={id,tipo:realTipo,tipoOriginal:tipo,condicao:cond||'',itemId:item.id,itemNome:item.nome,tamanho:item.tamanho,setor:setor||item.setor,funcionario:func||'',qtd,antes,depois,responsavel:resp||'',obs:obs||'',dataISO:now(),dataTexto:dataBR()};
  }
  async function submitMov(e){
    e.preventDefault();
    const tipo=$('#movTipo').value, funcionario=$('#movFuncionario').value.trim(), setor=$('#movSetor').value, cond=$('#movCondicao').value, resp=$('#movResponsavel').value.trim(), obs=$('#movObs').value.trim();
    if(!funcionario) return alert('Informe o funcionário.'); if(!setor) return alert('Selecione o setor.'); if(!selected.length) return alert('Adicione pelo menos um uniforme.');
    for(const s of selected){const item=byId(s.itemId); if(!item) continue; const qtd=Math.max(1,Number(s.qtd||1)); if(tipo==='ENTREGA'&&item.estoqueAtual<qtd){ if(!confirm(`${item.nome} tem estoque ${item.estoqueAtual}. Deseja registrar mesmo assim?`)) return; } if(tipo==='DEVOLUCAO'&&getEmPosse(funcionario,item.id)<qtd){ alert(`${funcionario} não possui ${qtd} de ${item.nome}.`); return; } registrarMov(tipo,item,qtd,funcionario,setor,cond,resp,obs); }
    selected=[]; renderSelected(); e.target.reset(); $('#movTipo').value=tipo; await persist(); alert('Movimentação salva com sucesso.');
  }
  async function submitEntrada(e){
    e.preventDefault(); const id=$('#entradaItem').value; const item=byId(id); if(!item) return alert('Selecione o uniforme.'); const qtd=Math.max(1,Number($('#entradaQtd').value||1)); registrarMov('ENTRADA',item,qtd,'',$('#entradaSetor').value,'',$('#entradaResp').value,$('#entradaObs').value); e.target.reset(); await persist(); alert('Entrada adicionada ao estoque.');
  }
  async function submitQuickItem(e){
    e.preventDefault(); const setor=$('#quickSetor').value, grupo=$('#quickGrupo').value, nome=$('#quickNome').value, tamanho=$('#quickTamanho').value; if(!setor||!nome) return alert('Selecione setor e uniforme.'); const id=[setor,nome,tamanho].map(slug).join('_'); state.itens[id]=itemCalc({id,setor,grupo,nome,tipo:nome.split(' ')[0]||'',tamanho,estoqueAtual:Number($('#quickAtual').value||0),ideal:Number($('#quickIdeal').value||0),minimo:Number($('#quickMinimo').value||0),origem:'Cadastro manual',criadoEm:now()}); await persist(); alert('Item salvo.');
  }

  function jump(tab){$$('.tab').forEach(x=>x.classList.remove('active')); $$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab)); $('#'+tab)?.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});}
  function openFuncModal(name=''){ $('#novoFuncNome').value=name||$('#movFuncionario').value||''; $('#funcModal').classList.remove('hidden'); }
  async function submitFunc(e){e.preventDefault(); state.funcionariosAvulsos=state.funcionariosAvulsos||[]; state.funcionariosAvulsos.push({nome:$('#novoFuncNome').value.trim(),setor:$('#novoFuncSetor').value,fonte:$('#novoFuncTipo').value==='freelance'?'freelance_local':'avulso',criadoEm:now()}); $('#movFuncionario').value=$('#novoFuncNome').value.trim(); $('#movSetor').value=$('#novoFuncSetor').value; $('#funcModal').classList.add('hidden'); await persist(); fillItemPicker();}

  function exportCsv(){
    const rows=[['Data','Tipo','Funcionario','Setor','Uniforme','Tamanho','Qtd','Antes','Depois','Obs'],...arrMov().map(m=>[m.dataTexto,m.tipo,m.funcionario,m.setor,m.itemNome,m.tamanho,m.qtd,m.antes,m.depois,m.obs])];
    download('relatorio_uniformes.csv',rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n'),'text/csv;charset=utf-8');
  }
  function exportExcel(){
    const html=`<html><meta charset="utf-8"><body><h2>Relatório de Uniformes</h2><h3>Estoque</h3>${tableHtml(['Setor','Uniforme','Tam','Atual','Ideal','Comprar','Status'],arrItens().map(i=>[i.setor,i.nome,i.tamanho,i.estoqueAtual,i.ideal,i.comprar,i.status]))}<h3>Compras</h3>${tableHtml(['Setor','Uniforme','Tam','Atual','Ideal','Comprar'],arrItens().filter(i=>i.comprar>0).map(i=>[i.setor,i.nome,i.tamanho,i.estoqueAtual,i.ideal,i.comprar]))}<h3>Histórico</h3>${tableHtml(['Data','Tipo','Funcionário','Setor','Uniforme','Qtd','Obs'],arrMov().map(m=>[m.dataTexto,m.tipo,m.funcionario,m.setor,m.itemNome,m.qtd,m.obs]))}</body></html>`;
    download('relatorio_uniformes.xls',html,'application/vnd.ms-excel');
  }
  function tableHtml(head,rows){return `<table border="1" cellspacing="0" cellpadding="6"><thead><tr>${head.map(h=>`<th style="background:#4a0719;color:#fff">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
  function download(name,content,type){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function copiarCompras(){const txt=arrItens().filter(i=>i.comprar>0).map(i=>`${i.setor} | ${i.nome} | Tam. ${i.tamanho} | Comprar ${i.comprar}`).join('\n'); navigator.clipboard?.writeText(txt); alert('Lista copiada.');}

  function bind(){
    $$('.nav-btn').forEach(b=>b.onclick=()=>jump(b.dataset.tab)); $$('[data-tab-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.tabJump)); $$('[data-open-mov]').forEach(b=>b.onclick=()=>{jump('movimentacao'); $('#movTipo').value=b.dataset.openMov; fillItemPicker();});
    $('#movForm').onsubmit=submitMov; $('#entradaForm').onsubmit=submitEntrada; $('#quickItemForm').onsubmit=submitQuickItem; $('#funcForm').onsubmit=submitFunc;
    ['movSetor','movTipo','movFuncionario'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{if(id==='movTipo')selected=[]; renderSelected(); fillItemPicker();}));
    $('#movFuncionario').addEventListener('input',()=>{showFuncDropdown(true); const f=selectedFunc(); if(f){const s=matchSetor(f.setor); if(s) $('#movSetor').value=s;} fillItemPicker();});
    $('#movFuncionario').addEventListener('focus',()=>showFuncDropdown(true)); document.addEventListener('click',e=>{if(!e.target.closest('.searchbox')) $('#funcDropdown')?.classList.add('hidden')});
    $('#movFonte').onchange=()=>{showFuncDropdown(false); fillItemPicker();}; $('#btnNovoFuncionario').onclick=()=>openFuncModal(); $('#funcModalClose').onclick=()=>$('#funcModal').classList.add('hidden');
    $('#btnAddItem').onclick=addSelected; $('#entradaSetor').onchange=fillEntradaItens; $('#quickSetor').onchange=fillQuickLists; $('#quickGrupo').onchange=fillQuickLists; $('#quickNome').onchange=fillQuickLists;
    ['searchEstoque','filterSetor','filterStatus'].forEach(id=>$('#'+id)?.addEventListener('input',renderEstoque)); ['searchFunc','filterFuncSetor'].forEach(id=>$('#'+id)?.addEventListener('input',renderFuncionarios)); ['searchHist','filterHistTipo'].forEach(id=>$('#'+id)?.addEventListener('input',renderHistorico));
    $('#btnExportCsv').onclick=exportCsv; $('#btnExportExcel').onclick=exportExcel; $('#btnExportExcel2').onclick=exportExcel; $('#btnCopiarCompras').onclick=copiarCompras; $('#btnBackup').onclick=()=>download('backup_uniformes.json',JSON.stringify(state,null,2),'application/json'); $('#btnSeed').onclick=()=>{if(confirm('Importar base da planilha e substituir itens atuais?')){seed(true);fillAll();renderAll();persist();}}; $('#btnSalvarFirebase').onclick=()=>persist().then(()=>alert('Salvo.')); $('#btnResetLocal').onclick=()=>{if(confirm('Resetar apenas dados locais?')){localStorage.removeItem(LS);location.reload();}};
  }

  window.addEventListener('DOMContentLoaded',async()=>{loadLocal(); seed(false); bind(); fillAll(); renderSelected(); renderAll(); await initFirebase();});
})();

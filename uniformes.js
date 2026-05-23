(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const LS_KEY = 'uniformes_estoque_v1';

  const state = {
    itens:{},
    movimentacoes:{},
    funcionarios:[],
    funcionariosAvulsos:[],
    firebase:false,
    initialized:false
  };

  const norm = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const todayBR = () => new Date().toLocaleString('pt-BR');
  const arrItens = () => Object.values(state.itens || {}).map(calcItem).sort((a,b)=>a.setor.localeCompare(b.setor)||a.nome.localeCompare(b.nome));
  const arrMov = () => Object.values(state.movimentacoes || {}).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const isOcorrencia = (m) => ['PERDIDO','DANIFICADO','RASGADO'].includes(String(m.condicao||m.tipo||'').toUpperCase());

  function calcItem(item){
    const atual = Number(item.estoqueAtual||0);
    const ideal = Number(item.ideal||0);
    const minimo = Number(item.minimo||0);
    const comprar = Math.max(ideal - atual, 0);
    const status = atual <= 0 ? 'ZERADO' : (atual < Math.max(ideal, minimo) ? 'COMPRAR' : 'OK');
    return {...item, estoqueAtual:atual, ideal, minimo, comprar, status};
  }

  function toast(msg){
    const el=document.createElement('div');
    el.className='toast';
    el.textContent=msg;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3200);
  }

  function saveLocal(){
    localStorage.setItem(LS_KEY, JSON.stringify({
      itens:state.itens,
      movimentacoes:state.movimentacoes,
      funcionariosAvulsos:state.funcionariosAvulsos,
      atualizadoEm:new Date().toISOString()
    }));
  }

  async function persist(){
    saveLocal();
    if(state.firebase && window.UniformesFirebase){
      try{
        await UniformesFirebase.saveState({
          itens:state.itens,
          movimentacoes:state.movimentacoes,
          funcionariosAvulsos:state.funcionariosAvulsos
        });
      }catch(e){ console.warn(e); }
    }
    renderAll();
  }

  function loadLocal(){
    try{
      const raw=localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function seedState(force=false){
    if(!force && Object.keys(state.itens||{}).length) return;
    const seed = window.UNIFORMES_SEED || [];
    state.itens = {};
    seed.forEach(x => state.itens[x.id] = calcItem({...x, criadoEm:new Date().toISOString()}));
    state.movimentacoes = state.movimentacoes || {};
    saveLocal();
  }

  function setores(){
    return [...new Set(arrItens().map(i=>i.setor).filter(Boolean))].sort();
  }

  function fillSelects(){
    const opts = setores().map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    $('#movSetor').innerHTML = `<option value="">Selecione</option>${opts}`;
    $('#filterSetor').innerHTML = `<option value="">Todos os setores</option>${opts}`;
    $('#filterFuncSetor').innerHTML = `<option value="">Todos os setores</option>${opts}`;
    if($('#novoFuncSetor')) $('#novoFuncSetor').innerHTML = `<option value="">Selecione</option>${opts}`;
  }

  function fillItemsSelect(){
    const setor = $('#movSetor').value;
    const tipo = $('#movTipo')?.value || 'ENTREGA';
    const funcionario = $('#movFuncionario')?.value.trim() || '';
    let list = arrItens().filter(i => !setor || i.setor === setor);

    if(tipo === 'DEVOLUCAO' && funcionario){
      const posse = employeeHoldings(true).find(p => norm(p.nome) === norm(funcionario));
      const ids = new Set((posse?.itens || []).map(i=>i.itemId));
      list = list.filter(i => ids.has(i.id));
    }

    const checklist = $('#movItensChecklist');
    if(!checklist) return;
    checklist.innerHTML = list.map(i=>{
      const emPosse = getQtdEmPosse(funcionario, i.id);
      const extra = tipo === 'DEVOLUCAO' ? `em posse ${emPosse}` : `estoque ${i.estoqueAtual}`;
      const max = tipo === 'DEVOLUCAO' && emPosse ? emPosse : Math.max(i.estoqueAtual, 1);
      return `<label class="check-item">
        <input type="checkbox" value="${i.id}">
        <span><b>${escapeHtml(i.nome)}</b><small>${escapeHtml(i.setor)} · Tam. ${escapeHtml(i.tamanho)} · ${extra}</small></span>
        <input class="check-qtd" type="number" min="1" max="${max}" value="1" title="Quantidade">
      </label>`;
    }).join('') || empty(tipo === 'DEVOLUCAO' ? 'Nenhum uniforme em posse desse funcionário/setor.' : 'Nenhum uniforme cadastrado para esse setor.');

    const condWrap = $('#movCondicaoWrap');
    if(condWrap) condWrap.style.display = tipo === 'DEVOLUCAO' ? '' : 'none';
  }

  function selectedMovItems(){
    return $$('#movItensChecklist .check-item').map(row=>{
      const check = row.querySelector('input[type="checkbox"]');
      const qtd = row.querySelector('.check-qtd');
      return check?.checked ? {itemId:check.value, qtd:Math.max(1, Number(qtd?.value || $('#movQtd').value || 1))} : null;
    }).filter(Boolean);
  }

  function getQtdEmPosse(funcionario, itemId){
    if(!funcionario || !itemId) return 0;
    let total = 0;
    arrMov().slice().reverse().forEach(m=>{
      if(norm(m.funcionario||'') !== norm(funcionario) || m.itemId !== itemId) return;
      if(m.tipo === 'ENTREGA') total += Number(m.qtd||0);
      if(m.tipo === 'DEVOLUCAO') total -= Number(m.qtd||0);
      if(['PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo)) total -= Number(m.qtd||0);
    });
    return Math.max(0,total);
  }

  function normalizeFuncionario(raw, fonte='escala'){
    if(!raw) return null;
    const nome = raw.nomeCompleto || raw.nome || raw.name || raw.NOME || raw.funcionario || raw.colaborador || '';
    if(!nome) return null;
    const setor = raw.setor || raw.categoria || raw.grupoEscala || raw.funcao || raw.cargo || raw.area || '';
    return { nome:String(nome).trim(), setor:String(setor||'').trim(), fonte, id:raw.id || raw.key || uid('pessoa') };
  }

  function allFuncionarios(){
    const fonte = $('#movFonte')?.value || 'todos';
    const fixed = (state.funcionarios || []).map(f=>normalizeFuncionario(f, f.fonte || 'escala')).filter(Boolean);
    const avulsos = (state.funcionariosAvulsos || []).map(f=>normalizeFuncionario(f, f.fonte || f.tipo || 'avulso')).filter(Boolean);
    const merged = [...fixed, ...avulsos];
    const by = new Map();
    merged.forEach(f=>{
      const k = norm(f.nome);
      if(!by.has(k) || (!by.get(k).setor && f.setor)) by.set(k,f);
    });
    return [...by.values()].filter(f=> fonte==='todos' || f.fonte===fonte || (fonte==='freelance' && /free/i.test(f.fonte)) || (fonte==='avulso' && ['avulso','freelance_local'].includes(f.fonte)) );
  }

  function funcionarioSelecionado(){
    const nome = $('#movFuncionario')?.value.trim() || '';
    if(!nome) return null;
    return allFuncionarios().find(f=>norm(f.nome)===norm(nome)) || null;
  }

  function syncFuncionarioSetor(){
    const f = funcionarioSelecionado();
    if(f && f.setor && !$('#movSetor').value){
      const match = setores().find(s=>norm(s)===norm(f.setor) || norm(s).includes(norm(f.setor)) || norm(f.setor).includes(norm(s)));
      if(match) $('#movSetor').value = match;
    }
    fillItemsSelect();
  }

  function fillFuncionarios(){
    const dl = $('#funcionariosList');
    if(!dl) return;
    dl.innerHTML = allFuncionarios().map(f => `<option value="${escapeHtml(f.nome)}">${escapeHtml((f.setor||'Setor não informado')+' · '+(f.fonte||''))}</option>`).join('');
  }

  function renderDashboard(){
    const itens = arrItens();
    const k = itens.reduce((acc,i)=>{
      acc.estoque += i.estoqueAtual;
      acc.zerados += i.status === 'ZERADO' ? 1 : 0;
      acc.baixo += i.status !== 'OK' ? 1 : 0;
      acc.comprar += i.comprar;
      return acc;
    },{estoque:0,zerados:0,baixo:0,comprar:0});
    const perdas = resumoOcorrencias();
    $('#kpiEstoque').textContent = k.estoque;
    $('#kpiZerados').textContent = k.zerados;
    $('#kpiBaixo').textContent = k.baixo;
    $('#kpiComprar').textContent = k.comprar;
    $('#kpiPerdidos').textContent = perdas.PERDIDO || 0;
    $('#kpiDanificados').textContent = (perdas.DANIFICADO || 0) + (perdas.RASGADO || 0);

    const bySetor = {};
    itens.forEach(i=>{
      bySetor[i.setor] ||= {atual:0, ideal:0, comprar:0};
      bySetor[i.setor].atual += i.estoqueAtual;
      bySetor[i.setor].ideal += i.ideal;
      bySetor[i.setor].comprar += i.comprar;
    });
    $('#sectorBars').innerHTML = Object.entries(bySetor).sort((a,b)=>b[1].comprar-a[1].comprar).map(([setor,d])=>{
      const pct = d.ideal ? Math.min(100, Math.round((d.atual/d.ideal)*100)) : 0;
      return `<div class="bar-row"><b>${escapeHtml(setor)}</b><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span>${d.atual}/${d.ideal}</span></div>`;
    }).join('') || empty('Nenhum setor cadastrado');

    const alertas = itens.filter(i=>i.status!=='OK').sort((a,b)=>b.comprar-a.comprar).slice(0,10);
    $('#alertList').innerHTML = alertas.map(i=>`<div class="alert-item"><div><b>${escapeHtml(i.nome)}</b><small>${escapeHtml(i.setor)} · Tam. ${escapeHtml(i.tamanho)} · atual ${i.estoqueAtual}</small></div><strong>Comprar ${i.comprar}</strong></div>`).join('') || `<div class="alert-item ok"><div><b>Estoque completo</b><small>Nenhum item abaixo do ideal.</small></div><strong>OK</strong></div>`;

    renderMovTable('#recentBody', arrMov().slice(0,8));
  }

  function renderMovTable(target, movs){
    $(target).innerHTML = movs.map(m=>`<tr>
      <td>${escapeHtml(m.dataTexto||'')}</td><td><span class="badge ${m.tipo}">${escapeHtml(m.tipo)}</span></td>
      <td>${escapeHtml(m.funcionario||'-')}</td><td>${escapeHtml(m.setor||'-')}</td><td>${escapeHtml(m.itemNome||'-')}</td>
      <td>${m.qtd}</td>
    </tr>`).join('') || `<tr><td colspan="6">Nenhuma movimentação registrada.</td></tr>`;
  }

  function renderEstoque(){
    const q=norm($('#searchEstoque').value);
    const setor=$('#filterSetor').value, status=$('#filterStatus').value;
    const rows=arrItens().filter(i=>(!setor||i.setor===setor)&&(!status||i.status===status)&&(!q||norm(`${i.setor} ${i.nome} ${i.tamanho} ${i.tipo}`).includes(q)));
    $('#estoqueBody').innerHTML = rows.map(i=>`<tr>
      <td>${escapeHtml(i.setor)}</td><td><b>${escapeHtml(i.nome)}</b><br><small>${escapeHtml(i.grupo||'')}</small></td><td>${escapeHtml(i.tamanho)}</td>
      <td>${i.estoqueAtual}</td><td>${i.ideal}</td><td><b>${i.comprar}</b></td>
      <td><span class="badge ${i.status}">${i.status}</span></td>
      <td><button class="ghost mini" data-edit="${i.id}">Editar</button></td>
    </tr>`).join('') || `<tr><td colspan="8">Nenhum item encontrado.</td></tr>`;
    $$('[data-edit]').forEach(b=>b.onclick=()=>openItemModal(b.dataset.edit));
  }

  function employeeHoldings(includeIds=false){
    const map = {};
    arrMov().slice().reverse().forEach(m=>{
      if(!m.funcionario || !m.itemId) return;
      const fkey = norm(m.funcionario).replace(/[^a-z0-9]+/g,'_');
      map[fkey] ||= {nome:m.funcionario,setor:m.setor,itens:{}};
      const mult = m.tipo === 'ENTREGA' ? 1 : (['DEVOLUCAO','PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo) ? -1 : 0);
      if(!mult) return;
      map[fkey].itens[m.itemId] ||= {itemId:m.itemId,nome:m.itemNome,tamanho:m.tamanho,qtd:0};
      map[fkey].itens[m.itemId].qtd += mult * Number(m.qtd||0);
    });
    return Object.values(map).map(p=>({...p,itens:Object.values(p.itens).filter(i=>i.qtd>0).map(i=>includeIds?i:(({itemId,...rest})=>rest)(i))})).filter(p=>p.itens.length);
  }

  function renderFuncionarios(){
    const q=norm($('#searchFunc').value), setor=$('#filterFuncSetor').value;
    const cards=employeeHoldings().filter(p=>(!q||norm(p.nome).includes(q))&&(!setor||p.setor===setor));
    $('#funcCards').innerHTML = cards.map(p=>`<article class="person-card">
      <h3>${escapeHtml(p.nome)}</h3><small>${escapeHtml(p.setor||'Setor não informado')}</small>
      <ul>${p.itens.map(i=>`<li><span>${escapeHtml(i.nome)} ${escapeHtml(i.tamanho||'')}</span><b>${i.qtd}</b></li>`).join('')}</ul>
    </article>`).join('') || empty('Nenhum uniforme em posse de funcionário.');
  }

  function renderCompras(){
    const rows=arrItens().filter(i=>i.comprar>0).sort((a,b)=>b.comprar-a.comprar);
    $('#comprasBody').innerHTML = rows.map(i=>`<tr><td>${escapeHtml(i.setor)}</td><td>${escapeHtml(i.nome)}</td><td>${escapeHtml(i.tamanho)}</td><td>${i.estoqueAtual}</td><td>${i.ideal}</td><td><b>${i.comprar}</b></td><td><span class="badge ${i.status}">${i.status==='ZERADO'?'URGENTE':'REPOSIÇÃO'}</span></td></tr>`).join('') || `<tr><td colspan="7">Nenhuma compra necessária.</td></tr>`;
  }

  function renderHistorico(){
    const q=norm($('#searchHist').value), tipo=$('#filterHistTipo').value;
    const rows=arrMov().filter(m=>(!tipo||m.tipo===tipo)&&(!q||norm(`${m.funcionario} ${m.itemNome} ${m.responsavel} ${m.obs} ${m.condicao}`).includes(q)));
    $('#historicoBody').innerHTML = rows.map(m=>`<tr>
      <td>${escapeHtml(m.dataTexto||'')}</td><td><span class="badge ${m.tipo}">${escapeHtml(m.tipo)}</span></td><td>${escapeHtml(m.funcionario||'-')}</td>
      <td>${escapeHtml(m.setor||'-')}</td><td>${escapeHtml(m.itemNome||'-')}</td><td>${m.qtd}</td><td>${m.antes}</td><td>${m.depois}</td><td>${escapeHtml(m.condicao ? m.condicao+' · '+(m.obs||'') : (m.obs||'-'))}</td>
    </tr>`).join('') || `<tr><td colspan="9">Nenhum histórico encontrado.</td></tr>`;
  }

  function resumoOcorrencias(){
    return arrMov().reduce((acc,m)=>{
      const key = ['PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo) ? m.tipo : (isOcorrencia(m) ? m.condicao : '');
      if(key) acc[key] = (acc[key]||0) + Number(m.qtd||0);
      return acc;
    },{});
  }

  function renderRelatorios(){
    if(!$('#ocorrenciasBody')) return;
    const r = resumoOcorrencias();
    $('#repPerdidos').textContent = r.PERDIDO || 0;
    $('#repDanificados').textContent = r.DANIFICADO || 0;
    $('#repRasgados').textContent = r.RASGADO || 0;
    $('#repOcorrencias').textContent = (r.PERDIDO||0)+(r.DANIFICADO||0)+(r.RASGADO||0);
    const rows = arrMov().filter(m=>['PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo) || isOcorrencia(m));
    $('#ocorrenciasBody').innerHTML = rows.map(m=>`<tr><td><span class="badge ${m.tipo}">${escapeHtml(m.condicao||m.tipo)}</span></td><td>${escapeHtml(m.funcionario||'-')}</td><td>${escapeHtml(m.setor||'-')}</td><td>${escapeHtml(m.itemNome||'-')}</td><td>${m.qtd}</td><td>${escapeHtml(m.dataTexto||'-')}</td><td>${escapeHtml(m.obs||'-')}</td></tr>`).join('') || `<tr><td colspan="7">Nenhuma ocorrência registrada.</td></tr>`;
  }

  function renderAll(){
    fillSelects(); fillItemsSelect(); fillFuncionarios();
    renderDashboard(); renderEstoque(); renderFuncionarios(); renderCompras(); renderHistorico(); renderRelatorios();
  }

  function empty(msg){ return `<div class="note">${escapeHtml(msg)}</div>`; }

  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  function openItemModal(id=''){
    const item = id ? state.itens[id] : {id:'',setor:'',grupo:'',nome:'',tipo:'',tamanho:'ÚNICO',estoqueAtual:0,ideal:0,minimo:0};
    $('#modalTitle').textContent = id ? 'Editar item' : 'Novo item';
    $('#itemId').value = item.id || '';
    $('#itemSetor').value = item.setor || '';
    $('#itemGrupo').value = item.grupo || '';
    $('#itemNome').value = item.nome || '';
    $('#itemTipo').value = item.tipo || '';
    $('#itemTamanho').value = item.tamanho || 'ÚNICO';
    $('#itemAtual').value = item.estoqueAtual || 0;
    $('#itemIdeal').value = item.ideal || 0;
    $('#itemMinimo').value = item.minimo || 0;
    $('#modal').classList.remove('hidden');
  }

  async function registrarMov(e){
    e.preventDefault();
    const tipo=$('#movTipo').value;
    const itensSelecionados = selectedMovItems();
    if(!itensSelecionados.length) return toast('Selecione pelo menos um uniforme.');
    const funcionario=$('#movFuncionario').value.trim();
    const setorForm=$('#movSetor').value;
    const responsavel=$('#movResponsavel').value.trim();
    const obs=$('#movObs').value.trim();
    const condicao=$('#movCondicao')?.value || 'BOM_ESTADO';
    const agora = Date.now();

    for(const sel of itensSelecionados){
      const item=state.itens[sel.itemId];
      if(!item) continue;
      const qtd=Math.max(1, Number(sel.qtd||1));
      const antes=Number(item.estoqueAtual||0);
      let depois=antes;
      let tipoFinal=tipo;

      if(tipo === 'ENTREGA'){
        if(qtd > antes) return toast(`Estoque insuficiente para ${item.nome}. Disponível: ${antes}`);
        depois = antes - qtd;
      }else if(tipo === 'DEVOLUCAO'){
        const emPosse = getQtdEmPosse(funcionario, item.id);
        if(funcionario && qtd > emPosse) return toast(`Devolução maior que a posse de ${item.nome}. Em posse: ${emPosse}`);
        if(['DANIFICADO','RASGADO','PERDIDO'].includes(condicao)){
          tipoFinal = condicao;
          depois = antes; // não volta para o estoque
        }else{
          depois = antes + qtd;
        }
      }else if(tipo === 'ENTRADA'){
        depois = antes + qtd;
      }else if(tipo === 'AJUSTE'){
        depois = qtd;
      }

      item.estoqueAtual = depois;
      state.itens[item.id] = calcItem(item);
      const mov = {
        id:uid('mov'), ts:agora + Math.floor(Math.random()*999), dataTexto:todayBR(), tipo:tipoFinal, tipoOrigem:tipo, condicao: tipo === 'DEVOLUCAO' ? condicao : '', itemId:item.id,
        itemNome:item.nome, tamanho:item.tamanho, setor:setorForm || item.setor,
        funcionario, qtd, antes, depois, responsavel, obs
      };
      state.movimentacoes[mov.id]=mov;
    }
    await persist();
    e.target.reset();
    $('#movQtd').value=1;
    fillItemsSelect();
    toast('Movimentação registrada com sucesso.');
  }

  function saveItem(e){
    e.preventDefault();
    const id=$('#itemId').value || uid('uniforme');
    const item=calcItem({
      id,
      setor:$('#itemSetor').value.trim(),
      grupo:$('#itemGrupo').value.trim(),
      nome:$('#itemNome').value.trim(),
      tipo:$('#itemTipo').value.trim(),
      tamanho:$('#itemTamanho').value.trim(),
      estoqueAtual:Number($('#itemAtual').value||0),
      ideal:Number($('#itemIdeal').value||0),
      minimo:Number($('#itemMinimo').value||0),
      atualizadoEm:new Date().toISOString()
    });
    state.itens[id]=item;
    persist();
    $('#modal').classList.add('hidden');
    toast('Item salvo.');
  }

  function exportCsv(){
    const header=['Setor','Grupo','Uniforme','Tipo','Tamanho','Estoque Atual','Ideal','Minimo','Comprar','Status'];
    const lines=[header, ...arrItens().map(i=>[i.setor,i.grupo,i.nome,i.tipo,i.tamanho,i.estoqueAtual,i.ideal,i.minimo,i.comprar,i.status])];
    downloadText('estoque_uniformes.csv', lines.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n'));
  }


  function gerarPlanilhaExcel(){
    const itens = arrItens();
    const compras = itens.filter(i=>i.comprar>0).sort((a,b)=>b.comprar-a.comprar);
    const movs = arrMov();
    const ocorrencias = movs.filter(m=>['PERDIDO','DANIFICADO','RASGADO'].includes(m.tipo) || isOcorrencia(m));
    const funcionarios = employeeHoldings(true).flatMap(p => p.itens.map(i => ({funcionario:p.nome,setor:p.setor,uniforme:i.nome,tamanho:i.tamanho,qtd:i.qtd})));
    const resumo = resumoOcorrencias();
    const totalEstoque = itens.reduce((a,i)=>a+i.estoqueAtual,0);
    const totalComprar = itens.reduce((a,i)=>a+i.comprar,0);
    const xml = buildExcelXml([
      {name:'Dashboard', rows:[
        ['RELATÓRIO DE ESTOQUE DE UNIFORMES - COCO BAMBU / VASTO'],
        ['Gerado em', todayBR()],
        [],
        ['Indicador','Valor'],
        ['Total em estoque', totalEstoque],
        ['Itens zerados', itens.filter(i=>i.status==='ZERADO').length],
        ['Itens abaixo do ideal', itens.filter(i=>i.status!=='OK').length],
        ['Peças para comprar', totalComprar],
        ['Uniformes perdidos', resumo.PERDIDO||0],
        ['Uniformes danificados', resumo.DANIFICADO||0],
        ['Uniformes rasgados', resumo.RASGADO||0]
      ]},
      {name:'Estoque', rows:[['Setor','Grupo','Uniforme','Tipo','Tamanho','Estoque atual','Ideal','Mínimo','Comprar','Status'], ...itens.map(i=>[i.setor,i.grupo,i.nome,i.tipo,i.tamanho,i.estoqueAtual,i.ideal,i.minimo,i.comprar,i.status])]},
      {name:'Lista de Compras', rows:[['Setor','Uniforme','Tamanho','Atual','Ideal','Comprar','Prioridade'], ...compras.map(i=>[i.setor,i.nome,i.tamanho,i.estoqueAtual,i.ideal,i.comprar,i.status==='ZERADO'?'URGENTE':'REPOSIÇÃO'])]},
      {name:'Histórico', rows:[['Data','Tipo','Condição','Funcionário','Setor','Uniforme','Tamanho','Qtd','Antes','Depois','Responsável','Observação'], ...movs.map(m=>[m.dataTexto,m.tipo,m.condicao||'',m.funcionario,m.setor,m.itemNome,m.tamanho,m.qtd,m.antes,m.depois,m.responsavel,m.obs])]},
      {name:'Ocorrências', rows:[['Tipo','Funcionário','Setor','Uniforme','Tamanho','Qtd','Data','Responsável','Observação'], ...ocorrencias.map(m=>[m.condicao||m.tipo,m.funcionario,m.setor,m.itemNome,m.tamanho,m.qtd,m.dataTexto,m.responsavel,m.obs])]},
      {name:'Por Funcionário', rows:[['Funcionário','Setor','Uniforme','Tamanho','Quantidade em posse'], ...funcionarios.map(f=>[f.funcionario,f.setor,f.uniforme,f.tamanho,f.qtd])]}
    ]);
    downloadBlob('relatorio_estoque_uniformes.xls', xml, 'application/vnd.ms-excel;charset=utf-8');
    toast('Planilha completa gerada.');
  }

  function buildExcelXml(sheets){
    const esc = v => String(v ?? '').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const rowsXml = rows => rows.map((r,idx)=>`<Row>${r.map(v=>`<Cell ss:StyleID="${idx===0?'Title':idx===3?'Header':'Cell'}"><Data ss:Type="${typeof v === 'number' ? 'Number':'String'}">${esc(v)}</Data></Cell>`).join('')}</Row>`).join('');
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#FFFFFF"/><Interior ss:Color="#6F1022" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
<Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#111827"/><Interior ss:Color="#D8AA4E" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
<Style ss:ID="Cell"><Font ss:Color="#111827"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/></Borders></Style>
</Styles>
${sheets.map(sh=>`<Worksheet ss:Name="${esc(sh.name).slice(0,31)}"><Table>${rowsXml(sh.rows)}</Table></Worksheet>`).join('')}
</Workbook>`;
  }

  function downloadBlob(filename, content, type){
    const blob=new Blob([content],{type});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
  }

  function copiarCompras(){
    const txt=arrItens().filter(i=>i.comprar>0).map(i=>`${i.setor} | ${i.nome} | Tam. ${i.tamanho} | Comprar: ${i.comprar}`).join('\n');
    navigator.clipboard?.writeText(txt);
    toast('Lista de compras copiada.');
  }

  function backupJson(){
    downloadText('backup_uniformes_estoque.json', JSON.stringify({itens:state.itens,movimentacoes:state.movimentacoes}, null, 2));
  }

  function downloadText(filename, text){
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
  }

  function bind(){
    $$('.nav-btn').forEach(btn=>btn.onclick=()=>{
      $$('.nav-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      $$('.tab').forEach(t=>t.classList.remove('active')); $('#'+btn.dataset.tab).classList.add('active');
      renderAll();
    });
    $$('[data-open-mov]').forEach(b=>b.onclick=()=>{ $('.nav-btn[data-tab="movimentacao"]').click(); $('#movTipo').value=b.dataset.openMov; fillItemsSelect(); });
    $$('[data-tab-jump]').forEach(b=>b.onclick=()=>{ const t=b.dataset.tabJump; $(`.nav-btn[data-tab="${t}"]`)?.click(); });
    $('#movSetor').onchange=fillItemsSelect;
    $('#movTipo').onchange=fillItemsSelect;
    $('#movFonte').onchange=()=>{fillFuncionarios(); syncFuncionarioSetor();};
    $('#movFuncionario').oninput=syncFuncionarioSetor;
    $('#movForm').onsubmit=registrarMov;
    $('#btnNovoItem').onclick=()=>openItemModal('');
    $('#itemForm').onsubmit=saveItem;
    $('#modalClose').onclick=()=>$('#modal').classList.add('hidden');
    $('#btnNovoFuncionario').onclick=()=>{ $('#novoFuncNome').value=$('#movFuncionario').value.trim(); $('#funcModal').classList.remove('hidden'); };
    $('#funcModalClose').onclick=()=>$('#funcModal').classList.add('hidden');
    $('#funcForm').onsubmit=async(e)=>{ e.preventDefault(); const f={id:uid('func'), nome:$('#novoFuncNome').value.trim(), setor:$('#novoFuncSetor').value, fonte:$('#novoFuncTipo').value==='freelance'?'freelance_local':'avulso', criadoEm:new Date().toISOString()}; if(!f.nome||!f.setor) return toast('Informe nome e setor.'); state.funcionariosAvulsos=state.funcionariosAvulsos||[]; state.funcionariosAvulsos.push(f); $('#movFuncionario').value=f.nome; $('#movSetor').value=f.setor; $('#funcModal').classList.add('hidden'); await persist(); toast('Funcionário cadastrado no módulo.'); };
    ['searchEstoque','filterSetor','filterStatus','searchFunc','filterFuncSetor','searchHist','filterHistTipo'].forEach(id=>$('#'+id).oninput=renderAll);
    $('#btnExportCsv').onclick=exportCsv;
    $('#btnExportExcel').onclick=gerarPlanilhaExcel;
    $('#btnExportExcel2').onclick=gerarPlanilhaExcel;
    $('#btnCopiarCompras').onclick=copiarCompras;
    $('#btnBackup').onclick=backupJson;
    $('#btnSeed').onclick=async()=>{ if(confirm('Importar a base da planilha? Isso substitui os itens cadastrados, mas mantém o histórico.')){ state.itens={}; seedState(true); await persist(); toast('Base da planilha importada.'); } };
    $('#btnSalvarFirebase').onclick=async()=>{ await persist(); toast('Salvo/sincronizado.'); };
    $('#btnResetLocal').onclick=()=>{ if(confirm('Resetar somente o armazenamento local deste navegador?')){ localStorage.removeItem(LS_KEY); location.reload(); } };
  }

  async function init(){
    bind();
    const local = loadLocal();
    if(local){ state.itens = local.itens || {}; state.movimentacoes = local.movimentacoes || {}; state.funcionariosAvulsos = local.funcionariosAvulsos || []; }
    seedState(false);

    if(window.UniformesFirebase && await UniformesFirebase.init()){
      state.firebase=true;
      $('#syncDot').classList.add('on'); $('#syncTitle').textContent='Firebase conectado'; $('#syncText').textContent='Sincronizando em /uniformes_estoque';
      UniformesFirebase.listenFuncionarios(funcs => { state.funcionarios=funcs || []; fillFuncionarios(); });
      UniformesFirebase.listenState(remote => {
        if(remote && (remote.itens || remote.movimentacoes)){
          state.itens = remote.itens || state.itens;
          state.movimentacoes = remote.movimentacoes || state.movimentacoes;
          state.funcionariosAvulsos = remote.funcionariosAvulsos || state.funcionariosAvulsos;
          saveLocal(); renderAll();
        }else{
          persist();
        }
      });
    }else{
      $('#syncTitle').textContent='Modo local';
      $('#syncText').textContent='Firebase não carregou; dados salvos no navegador.';
    }
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

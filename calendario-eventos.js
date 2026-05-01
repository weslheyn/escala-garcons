// Calendário de Eventos — módulo isolado
// Lê Firebase: calendario_eventos/eventos
// Não interfere em escala, frequência, mapa ou freelancers.
let _eventosCache = {};
let _eventosFiltro = 'hoje';
let _eventosListenerStarted = false;

function eventosHojeISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function eventosParseDate(v){
  if(!v) return null;
  let s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){ const [y,m,d] = s.slice(0,10).split('-').map(Number); return new Date(y,m-1,d); }
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){ const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); }
  if(/^\d{2}\/\d{2}$/.test(s)){ const [d,m] = s.split('/').map(Number); return new Date(new Date().getFullYear(),m-1,d); }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}
function eventosISO(v){
  const d = eventosParseDate(v);
  if(!d) return '';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function eventosFmtData(v){
  const d = eventosParseDate(v);
  if(!d) return v || '';
  return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');
}
function eventosCor(st){
  const s = (st || '').toUpperCase();
  if(s.includes('DECLIN') || s.includes('CANCEL') || s.includes('PERD')) return '#ff3b30';
  if(s.includes('FECHADO') || s.includes('CONTRATO ASSINADO') || s.includes('CONFIRM')) return '#8bd34a';
  if(s.includes('APROV') || s.includes('AGUARDANDO')) return '#2f80ed';
  if(s.includes('INTERESSE')) return '#ff9800';
  if(s.includes('PROPOSTA')) return '#f5c842';
  return '#f5c842';
}
function eventosNormalizaItem(raw, id){
  raw = raw || {};
  return {
    id: id || raw.id || '',
    data: raw.data || raw.dataEvento || raw.DATA || raw.dia || '',
    unidade: raw.unidade || raw.loja || raw.UNIDADE || '',
    cliente: raw.cliente || raw.nomeCliente || raw.nome || raw.CLIENTE || '',
    telefone: raw.telefone || raw.TELEFONE || '',
    tipoEvento: raw.tipoEvento || raw.evento || raw.tipo || raw.TIPO_EVENTO || '',
    cardapio: raw.cardapio || raw.menu || raw.tipoCardapio || raw.CARDAPIO || '',
    horario: raw.horario || raw.hora || raw.HORARIO || '',
    pessoas: raw.pessoas || raw.qtdPessoas || raw.quantidadePessoas || raw.QTD || '',
    status: raw.statusNegociacao || raw.status || raw.STATUS || '',
    responsavel: raw.responsavel || raw.RESPONSAVEL || '',
    formaPagamento: raw.formaPagamento || raw.pagamento || '',
    valorTotal: raw.valorTotal || raw.valor || '',
    observacao: raw.observacao || raw.obs || raw.OBSERVACAO || raw.descricao || '',
    atualizadoEm: raw.atualizadoEm || ''
  };
}
function openCalendarioEventos(){
  try{ showAppFromDashboard(); }catch(e){}
  const inp = document.getElementById('eventosDataFiltro');
  if(inp && !inp.value) inp.value = eventosHojeISO();
  openPanel('eventosPanel');
  eventosStartFirebase();
  eventosRender();
}
function eventosStartFirebase(force){
  if(_eventosListenerStarted && !force) return;
  if(!(typeof fbDb !== 'undefined' && fbDb)){ eventosRender(); return; }
  _eventosListenerStarted = true;
  try{
    fbDb.ref('calendario_eventos/eventos').off();
    fbDb.ref('calendario_eventos/eventos').on('value', snap => {
      _eventosCache = snap.val() || {};
      eventosRender();
      eventosUpdateBadge();
    });
  }catch(e){ console.warn('eventosStartFirebase', e); }
}
function eventosSetFiltro(f){
  _eventosFiltro = f;
  document.querySelectorAll('.eventos-chip').forEach(b => b.classList.remove('active'));
  const id = {hoje:'evChipHoje',semana:'evChipSemana',mes:'evChipMes',todos:'evChipTodos'}[f];
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  eventosRender();
}
function eventosFiltrados(){
  const refISO = (document.getElementById('eventosDataFiltro')?.value) || eventosHojeISO();
  const ref = eventosParseDate(refISO) || new Date();
  const stFiltro = (document.getElementById('eventosStatusFiltro')?.value || '').toUpperCase();
  const ini = new Date(ref); ini.setDate(ref.getDate() - ref.getDay()); ini.setHours(0,0,0,0);
  const fim = new Date(ini); fim.setDate(ini.getDate()+6); fim.setHours(23,59,59,999);
  let arr = Object.entries(_eventosCache || {}).map(([id,v]) => eventosNormalizaItem(v,id)).filter(ev => ev.data);
  arr = arr.filter(ev => {
    const d = eventosParseDate(ev.data);
    if(!d) return false;
    if(stFiltro && !String(ev.status || '').toUpperCase().includes(stFiltro)) return false;
    if(_eventosFiltro === 'hoje') return eventosISO(ev.data) === refISO;
    if(_eventosFiltro === 'semana') return d >= ini && d <= fim;
    if(_eventosFiltro === 'mes') return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
    return true;
  });
  arr.sort((a,b) => (eventosISO(a.data)+String(a.horario||'')).localeCompare(eventosISO(b.data)+String(b.horario||'')));
  return arr;
}
function eventosRender(){
  const content = document.getElementById('eventosContent');
  if(!content) return;
  const todos = Object.entries(_eventosCache || {}).map(([id,v]) => eventosNormalizaItem(v,id));
  const hoje = eventosHojeISO();
  const now = new Date();
  const semanaIni = new Date(); semanaIni.setDate(now.getDate()-now.getDay()); semanaIni.setHours(0,0,0,0);
  const semanaFim = new Date(semanaIni); semanaFim.setDate(semanaIni.getDate()+6); semanaFim.setHours(23,59,59,999);
  const kHoje = todos.filter(e => eventosISO(e.data) === hoje).length;
  const kSemana = todos.filter(e => { const d = eventosParseDate(e.data); return d && d >= semanaIni && d <= semanaFim; }).length;
  const kMes = todos.filter(e => { const d = eventosParseDate(e.data); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const eh = document.getElementById('evKpiHoje'); if(eh) eh.textContent = kHoje;
  const es = document.getElementById('evKpiSemana'); if(es) es.textContent = kSemana;
  const em = document.getElementById('evKpiMes'); if(em) em.textContent = kMes;
  const lista = eventosFiltrados();
  if(!lista.length){
    content.innerHTML = '<div class="evento-empty">Nenhum evento encontrado para o filtro selecionado.<br><br>Quando o Apps Script enviar a planilha para o Firebase, os eventos aparecerão aqui automaticamente.</div>';
    return;
  }
  content.innerHTML = lista.map(ev => {
    const cor = eventosCor(ev.status);
    const meta = [];
    if(ev.data) meta.push('📅 ' + eventosFmtData(ev.data));
    if(ev.horario) meta.push('🕒 ' + ev.horario);
    if(ev.unidade) meta.push('📍 ' + ev.unidade);
    if(ev.pessoas) meta.push('👥 ' + ev.pessoas + ' pessoas');
    if(ev.cardapio) meta.push('🍽️ ' + ev.cardapio);
    if(ev.formaPagamento) meta.push('💳 ' + ev.formaPagamento);
    if(ev.valorTotal) meta.push('💰 ' + ev.valorTotal);
    if(ev.responsavel) meta.push('👤 ' + ev.responsavel);
    return `<div class="evento-card" style="border-left-color:${cor}"><div class="evento-top"><div><div class="evento-title">${ev.cliente || ev.tipoEvento || 'Evento sem cliente'}</div><div class="evento-meta">${meta.join('<br>')}</div></div><div class="evento-status" style="background:${cor}20;color:${cor};border-color:${cor}55">${ev.status || 'Sem status'}</div></div>${ev.observacao ? `<div class="evento-obs">${ev.observacao}</div>` : ''}</div>`;
  }).join('');
}
function eventosUpdateBadge(){
  const b = document.getElementById('dashEventosBadge');
  if(!b) return;
  const n = Object.entries(_eventosCache || {}).map(([id,v]) => eventosNormalizaItem(v,id)).filter(e => eventosISO(e.data) === eventosHojeISO()).length;
  b.textContent = n ? `${n} hoje` : 'Eventos';
}
function eventosTextoAgendaHoje(){
  const ref = (document.getElementById('eventosDataFiltro')?.value) || eventosHojeISO();
  const lista = Object.entries(_eventosCache || {}).map(([id,v]) => eventosNormalizaItem(v,id)).filter(e => eventosISO(e.data) === ref).sort((a,b) => String(a.horario||'').localeCompare(String(b.horario||'')));
  let txt = `📅 Agenda de Eventos – ${eventosFmtData(ref)}\n\n`;
  if(!lista.length) return txt + 'Nenhum evento cadastrado para esta data.';
  lista.forEach(e => {
    txt += `${e.horario ? e.horario + ' – ' : ''}${e.cliente || e.tipoEvento || 'Evento'}\n`;
    if(e.unidade) txt += `Unidade: ${e.unidade}\n`;
    if(e.pessoas) txt += `Pessoas: ${e.pessoas}\n`;
    if(e.status) txt += `Status: ${e.status}\n`;
    if(e.cardapio) txt += `Cardápio: ${e.cardapio}\n`;
    txt += '\n';
  });
  return txt.trim();
}
function eventosCopiarAgendaHoje(){
  const txt = eventosTextoAgendaHoje();
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(() => showToast('📋 Agenda copiada')); }
  else { prompt('Copie a agenda:', txt); }
}
function eventosMostrarAjuda(){
  alert('Integração:\n\n1. Abra sua planilha Google.\n2. Vá em Extensões > Apps Script.\n3. Cole o arquivo AppsScript_Calendario_Eventos_Isolado.gs.\n4. Configure FIREBASE_URL.\n5. Execute sincronizarCalendarioEventos() e crie o gatilho onEdit.\n\nO app lê calendario_eventos/eventos em tempo real.');
}

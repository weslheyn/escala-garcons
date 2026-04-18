
// ═══════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════
const DAYS=['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
const DAY_NAMES=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
const isFolgaSemanal=(f,diaSem)=>!!f&&(f.folga===diaSem||f.folga2===diaSem);
const CATS=[
  'GERENTE','MAÎTRE','GARÇOM','CHEFE DE FILA','CUMIM',
  'RECEPCIONISTA','OPE. CAIXA','DELIVERY','BARMAN','COPEIRO',
  'AUXILIAR DE BAR','ENCANTADORA','CONTR. DE ACESSO','ALMOXARIFE',
  'AUX. ALMOXARIFADO','ADMINISTRATIVO','AUX. ASG','AUX. MANUTÊNÇÃO',
  'TEC. NUTRIÇÃO','NUTRICIONISTA'
];
const CAT_COLORS={
  'GERENTE':'#f5c842','MAÎTRE':'#e67e22','GARÇOM':'#3498db',
  'CHEFE DE FILA':'#1abc9c','CUMIM':'#9b59b6','RECEPCIONISTA':'#27ae60',
  'OPE. CAIXA':'#e84393','DELIVERY':'#16a085','BARMAN':'#d35400',
  'COPEIRO':'#2ecc71','AUXILIAR DE BAR':'#c0392b','ENCANTADORA':'#ff6b9d',
  'CONTR. DE ACESSO':'#e74c3c','ALMOXARIFE':'#7f8c8d','AUX. ALMOXARIFADO':'#95a5a6',
  'ADMINISTRATIVO':'#bdc3c7','AUX. ASG':'#8e44ad','AUX. MANUTÊNÇÃO':'#f39c12',
  'TEC. NUTRIÇÃO':'#00b894','NUTRICIONISTA':'#00cec9'
};
const STATUS=[
  {id:'presente',      emoji:'✅', label:'Presente',         planilha:'PRESENTE',    color:'#27ae60'},
  {id:'falta',         emoji:'❌', label:'Falta',             planilha:'FALTA',       color:'#e74c3c'},
  {id:'atestado',      emoji:'🏥', label:'Atestado',          planilha:'ATESTADO',    color:'#2980b9'},
  {id:'troca-horario', emoji:'🔄', label:'Troca Horário',     planilha:'TROCA HOR.',  color:'#d35400'},
  {id:'troca-folga',   emoji:'📅', label:'Troca Folga',       planilha:'TROCA FOLGA', color:'#8e44ad'},
  {id:'medida',        emoji:'⚠️', label:'Medida Discipl.',   planilha:'MEDIDA DISC.',color:'#e84393'},
  {id:'saida-antecipada',emoji:'🚪',label:'Saída Antecipada', planilha:'SAÍDA ANTEC.',color:'#f39c12'},
  {id:'banco-horas',   emoji:'⏱️', label:'Banco de Horas',    planilha:'BANCO HORAS', color:'#00b894'},
];
const PROG_FALTA=['Advertência escrita','Suspensão 1 dia','Suspensão 3 dias','Suspensão 5 dias','Justa causa'];
const PROG_OUTROS=['Advertência verbal','Advertência escrita','Suspensão 1 dia','Suspensão 3 dias','Suspensão 5 dias','Justa causa'];
const MOTIVOS_FALTA=['Falta sem justificativa'];
const GCLIENT_ID='429328314952-7haf0e82uj6vbrk74tklsf8q2asoeken.apps.googleusercontent.com';
// ID da planilha de escala de funcionários (pode ser alterado pelo usuário)
let ESCALA_SHEET_ID = localStorage.getItem('escala_sheet_id') || '1VbDI5Xb2PupXrWsgs5MkqGObN4KiqJZDp-ulkMqNBUo';
// Nome da aba da escala ativa (padrão: MARCO/ABRIL)
let ESCALA_ABA = localStorage.getItem('escala_aba') || 'MARCO/ABRIL26';
const GSCOPES='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive email profile';

// ═══════════════════════════════════════════════════
// FIREBASE — SYNC EM TEMPO REAL
// ═══════════════════════════════════════════════════
// Credenciais reais do projeto coco-bambu-presenca
localStorage.removeItem('fb_config');

const FB_CONFIG_DEFAULT = {
  apiKey: "AIzaSyBYJkigpHe2O7ge1XXBEM3DbvHfyqU3QHo",
  authDomain: "coco-bambu-presenca.firebaseapp.com",
  databaseURL: "https://coco-bambu-presenca-default-rtdb.firebaseio.com",
  projectId: "coco-bambu-presenca",
  storageBucket: "coco-bambu-presenca.firebasestorage.app",
  messagingSenderId: "429328314952",
  appId: "1:429328314952:web:8602247aa1306991c79e7d",
};
// WEEK_KEY da semana ATUAL (fixo, para o listener em tempo real)
const WEEK_KEY = (()=>{
  const d=new Date(); const dow=d.getDay(); const diff=dow===0?-6:1-dow;
  const mon=new Date(d); mon.setDate(d.getDate()+diff);
  return `semana_${mon.getFullYear()}_${String(mon.getMonth()+1).padStart(2,'0')}_${String(mon.getDate()).padStart(2,'0')}`;
})();

// Retorna a chave Firebase para qualquer semana (offset relativo à atual)
function getWeekKey(offset){
  offset = offset || 0;
  const d=new Date(); const dow=d.getDay(); const diff=dow===0?-6:1-dow;
  const mon=new Date(d); mon.setDate(d.getDate()+diff+(offset*7));
  return `semana_${mon.getFullYear()}_${String(mon.getMonth()+1).padStart(2,'0')}_${String(mon.getDate()).padStart(2,'0')}`;
}

function getWeekKeyByDate(dt){
  const d=new Date(dt);
  const dow=d.getDay();
  const diff=dow===0?-6:1-dow;
  const mon=new Date(d);
  mon.setDate(d.getDate()+diff);
  mon.setHours(0,0,0,0);
  return `semana_${mon.getFullYear()}_${String(mon.getMonth()+1).padStart(2,'0')}_${String(mon.getDate()).padStart(2,'0')}`;
}

let fbApp = null;
let fbDb  = null;
let fbConnected = false;
let _ignoringRemoteUpdate = false;
let _fbListenerActive = false;

// Abre modal de configuração Firebase (override manual)
function openFbConfig(){
  const saved = load('fb_config', {});
  document.getElementById('fb_db_url').value = saved.databaseURL || FB_CONFIG_DEFAULT.databaseURL;
  document.getElementById('fb_api_key').value = saved.apiKey || FB_CONFIG_DEFAULT.apiKey;
  document.getElementById('fb_project_id').value = saved.projectId || FB_CONFIG_DEFAULT.projectId;
  openModal('fbConfigModal');
}

// Salva e reconecta Firebase com config manual
function saveFbConfig(){
  const databaseURL = document.getElementById('fb_db_url').value.trim();
  const apiKey      = document.getElementById('fb_api_key').value.trim();
  const projectId   = document.getElementById('fb_project_id').value.trim();
  if(!databaseURL || !apiKey || !projectId){showToast('⚠️ Preencha todos os campos');return;}
  const cfg={databaseURL,apiKey,projectId,
    authDomain:projectId+'.firebaseapp.com',
    storageBucket:projectId+'.firebasestorage.app'};
  save('fb_config',cfg);
  closeModal('fbConfigModal');
  _fbListenerActive=false; fbDb=null; fbApp=null; fbConnected=false;
  initFirebase();
  showToast('🔥 Reconectando...');
}

function initFirebase(){
  // Usa credenciais salvas manualmente, ou as credenciais reais embutidas
  const cfg = load('fb_config', null) || FB_CONFIG_DEFAULT;
  try {
    if(!window.firebase){
      setSyncStatus('err','Firebase SDK não carregado');
      setTimeout(initFirebase, 2000);
      return;
    }
    // Inicializa ou reutiliza app Firebase
    try { fbApp = firebase.app(); }
    catch(e){ fbApp = firebase.initializeApp(cfg); }
    fbDb = firebase.database();

    // Monitora status de conexão em tempo real
    fbDb.ref('.info/connected').on('value', snap => {
      fbConnected = !!snap.val();
      const btn = document.getElementById('syncBtn');
      if(fbConnected){
        setSyncStatus('ok','🔄 Sync em tempo real ativo');
        btn.textContent='✅ ONLINE';
        btn.onclick=pullFromFirebase;
        btn.style.cssText='background:var(--green);color:#fff;border-color:var(--green);margin-left:auto;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:Barlow,sans-serif';
        if(!_fbListenerActive) startFbListener();
      } else {
        setSyncStatus('loading','Reconectando...');
        btn.textContent='🔄 SYNC';
        btn.onclick=pullFromFirebase;
        btn.style.cssText='background:none;border:1px solid var(--border);color:var(--accent);margin-left:auto;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:Barlow,sans-serif';
      }
    });
    setSyncStatus('loading','Conectando ao Firebase...');
  } catch(e) {
    setSyncStatus('err','Erro: '+e.message);
    console.warn('Firebase:', e.message);
  }
}

// ═══════════════════════════════════════════════════
// FIREBASE KEY SYSTEM — usa Base64 para evitar
// qualquer problema com caracteres especiais nos nomes
// ═══════════════════════════════════════════════════

// Codifica chave para Firebase usando Base64 (sem chars problemáticos)
function fbEncode(key){
  try{
    // btoa precisa de string ASCII — converte UTF-8 primeiro
    return btoa(unescape(encodeURIComponent(key)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }catch(e){
    // Fallback: remove chars ruins manualmente
    return key.normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9_\-]/g,'_')
      .replace(/_+/g,'_').replace(/^_|_$/g,'');
  }
}

// Decodifica chave do Firebase de volta para a chave original
function fbDecode(encoded){
  try{
    const b64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
    return decodeURIComponent(escape(atob(b64)));
  }catch(e){
    return encoded; // fallback: retorna como está
  }
}

function weekKeyToMondayDate(wk){
  const m = String(wk||'').match(/^semana_(\d{4})_(\d{2})_(\d{2})$/);
  if(!m) return null;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
}

function normalizePresenceKey(localKey, wk){
  if(!localKey) return '';
  if(localKey.startsWith('drec_')) return localKey;
  const m = String(localKey).match(/^([0-6])_(.+)$/);
  if(!m) return localKey;
  const monday = weekKeyToMondayDate(wk);
  if(!monday) return localKey;
  const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + Number(m[1]));
  const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  return `drec_${m[2]}_${iso}`;
}

function isPresenceKeyForMonth(k, ano, mes){
  if(!String(k).startsWith('drec_')) return false;
  const m = String(k).match(/_(\d{4})-(\d{2})-(\d{2})$/);
  return !!(m && Number(m[1])===ano && Number(m[2])===mes);
}

function limparCacheMes(ano, mes){
  Object.keys(_fbCache).forEach(k=>{
    if(/^\d_/.test(k) || isPresenceKeyForMonth(k, ano, mes)) delete _fbCache[k];
  });
}

async function carregarMesFirebaseNormalizado(ano, mes, opts={}){
  if(!(fbDb && fbConnected)) return {map:{}, migrados:0, removidosLegado:0};
  const totalDias = diasNoMes(ano, mes);
  const weekKeys = new Set();
  for(let d=1; d<=totalDias; d++) weekKeys.add(getWeekKeyByDate(new Date(ano, mes-1, d)));

  const monthMap = {};
  let migrados = 0;
  let removidosLegado = 0;

  for(const wk of [...weekKeys]){
    const snap = await fbDb.ref('presenca/'+wk).once('value');
    const data = snap.val() || {};
    const ops = [];

    Object.entries(data).forEach(([fbKey,v])=>{
      const localKey = fbDecode(fbKey);
      const normalizado = normalizePresenceKey(localKey, wk);
      if(!v || v.status === '' || v.status === undefined) return;
      if(isPresenceKeyForMonth(normalizado, ano, mes)) monthMap[normalizado] = v;
      if(opts.migrarLegado && normalizado !== localKey && normalizado.startsWith('drec_')){
        ops.push(fbDb.ref('presenca/'+wk+'/'+fbEncode(normalizado)).set(v));
        ops.push(fbDb.ref('presenca/'+wk+'/'+fbKey).remove());
        migrados++;
        removidosLegado++;
      }
    });

    if(ops.length) await Promise.allSettled(ops);
  }

  return {map: monthMap, migrados, removidosLegado};
}

function startFbListener(){
  if(!fbDb || _fbListenerActive) return;
  _fbListenerActive = true;

  fbDb.ref('presenca/'+WEEK_KEY).on('value', snap => {
    if(_ignoringRemoteUpdate) return;
    const data = snap.val() || {};

    // Remove somente as chaves da semana atual antes de reconstruir.
    // Assim evitamos manter marcações antigas quando alguém limpa um status.
    Object.keys(_fbCache).forEach(k=>{
      if(k.startsWith('drec_')){
        const m=k.match(/_(\d{4}-\d{2}-\d{2})$/);
        if(m){
          const dt=new Date(m[1]+'T00:00:00');
          const wk=getWeekKeyByDate(dt);
          if(wk===WEEK_KEY) delete _fbCache[k];
        }
      }
      if(/^\d_/.test(k)) delete _fbCache[k];
    });

    Object.entries(data).forEach(([fbKey,v])=>{
      const localKey = fbDecode(fbKey);
      const normalizedKey = normalizePresenceKey(localKey, WEEK_KEY);
      if(v && v.status !== '' && v.status !== undefined && normalizedKey.startsWith('drec_')) _fbCache[normalizedKey] = v;
      else {
        delete _fbCache[localKey];
        delete _fbCache[normalizedKey];
      }
    });

    buildMain(); refreshPendBadge(); buildSummary();
    if(document.getElementById('trocasPanel').classList.contains('open')) buildTrocasPanel();
    if(document.getElementById('mapaPanel').classList.contains('open')) renderMapa();
    if(gToken&&SHEET_ID) triggerSheetsSync();
  });
  pullFromFirebase();
}

// Limpa cache em memória — todas as chaves de presença/dados operacionais
function _limparCacheLocal(){
  Object.keys(_fbCache).forEach(k=>{
    if(
      k.startsWith('drec_')   ||  // registros por data
      /^\d_/.test(k)          ||  // registros semanais (0_NOME, 1_NOME...)
      k.startsWith('folga_')  ||  // registros de folga interativa
      k.startsWith('just_')   ||  // justificativas
      k.startsWith('bh_extra_')   // banco de horas extra
    ){
      delete _fbCache[k];
    }
  });
}

function pushToFirebase(key, value){
  if(!fbDb || !fbConnected){
    // Sem Firebase — salva só local como fallback
    return;
  }
  _ignoringRemoteUpdate = true;
  const safeKey = fbEncode(key);
  fbDb.ref('presenca/'+WEEK_KEY+'/'+safeKey).set(value)
    .catch(e=>console.warn('Push FB:', e.message))
    .finally(()=>{ setTimeout(()=>{ _ignoringRemoteUpdate = false; }, 800); });
}

function pullFromFirebase(){
  if(!fbDb){ openFbConfig(); return; }
  setSyncStatus('loading','Sincronizando...');
  // Limpa cache em memória antes de puxar
  _limparCacheLocal();
  fbDb.ref('presenca/'+WEEK_KEY).once('value').then(snap=>{
    const data = snap.val() || {};
    Object.entries(data).forEach(([fbKey,v])=>{
      const localKey = fbDecode(fbKey);
      const normalizedKey = normalizePresenceKey(localKey, WEEK_KEY);
      if(v && v.status !== '' && v.status !== undefined && normalizedKey.startsWith('drec_')) _fbCache[normalizedKey] = v;
      else {
        delete _fbCache[localKey];
        delete _fbCache[normalizedKey];
      }
    });
    buildMain(); refreshPendBadge(); buildSummary();
    setSyncStatus('ok','🔄 Sync em tempo real ativo');
    showToast('🔄 Sincronizado!');
  }).catch(e=>{
    setSyncStatus('err','Erro ao sincronizar');
    console.warn('Pull FB:', e.message);
  });
}

// ═══════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════
const SK='gp5_';

// ── CACHE EM MEMÓRIA (fonte de verdade = Firebase) ──
// Dados de presença ficam APENAS aqui, nunca no localStorage
const _fbCache = {};

// Salva no cache em memória E envia ao Firebase
const save=(k,v)=>{
  // Configurações e equipe ainda vão pro localStorage
  if(k==='equipe'||k==='equipe_version'||k==='fb_config'||k==='sheet_id_v2'||k==='g_token_ts'){
    localStorage.setItem(SK+k,JSON.stringify(v));
  } else {
    _fbCache[k]=v;
  }
};

// Lê do cache em memória ou localStorage (para config)
const load=(k,def=null)=>{
  if(k==='equipe'||k==='equipe_version'||k==='fb_config'||k==='sheet_id_v2'||k==='g_token_ts'){
    try{const v=localStorage.getItem(SK+k);return v!==null?JSON.parse(v):def}catch{return def}
  }
  return k in _fbCache ? _fbCache[k] : def;
};

// ═══════════════════════════════════════════════════
// EQUIPE — LISTA COMPLETA CONFORME ESCALA ATUAL
// ═══════════════════════════════════════════════════
// Versão da equipe — incrementar sempre que atualizar a lista
const EQUIPE_VERSION = 'v20260406_v9';

const EQUIPE_DEFAULT = [
  // ── GERENTES ──────────────────────────────────────────────
  {id:'g1', nome:'TAIZA RANGEL CARMO',          categoria:'GERENTE',          turno:'INTERCALADO', horIni:'11:00',horFim:'22:00',folga:'SEG',folgaDom:['05/04/2026']},
  {id:'g2', nome:'FABIO SILVA MEDEIROS',         categoria:'GERENTE',          turno:'ABERTURA',    horIni:'06:00',horFim:'15:00',folga:'TER',folgaDom:['19/04/2026']},
  {id:'g3', nome:'WESLEYN DA SILVA DIAS',        categoria:'GERENTE',          turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'QUA',folgaDom:['12/04/2026']},

  // ── MAÎTRES ───────────────────────────────────────────────
  {id:'m1', nome:'THIAGO SANTOS FERREIRA',       categoria:'MAÎTRE',           turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'m2', nome:'JOSÉ RICARDO ARAUJO DE BRITO', categoria:'MAÎTRE',           turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'TER',folgaDom:['15/04/2026']},
  {id:'m3', nome:'WESLEY JANUARIO CORREA',       categoria:'MAÎTRE',           turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUA',folgaDom:['05/04/2026']},
  {id:'m4', nome:'EDMAGNA DOS SANTOS SILVA',     categoria:'MAÎTRE',           turno:'INTERCALADO', horIni:'10:00',horFim:'21:20',folga:'QUI',folgaDom:['29/03/2026']},

  // ── GARÇOM VASTO ──────────────────────────────────────────
  {id:'f13', nome:'MIGUEL SEBASTIAN JACU',                       categoria:'GARÇOM',        turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'TER',folgaDom:['12/04/2026']},
  {id:'f14', nome:'WILLIAM DE LIMA FRANCO',                      categoria:'CHEFE DE FILA', turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUA',folgaDom:['19/04/2026']},
  {id:'f15', nome:'KAIAN DA SILVA VERISSIMO DOS SANTOS',         categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUI',folgaDom:['05/04/2026']},

  // ── GARÇOM ABERTURA ───────────────────────────────────────
  {id:'f1',  nome:'SAMUEL OLIVEIRA',                             categoria:'GARÇOM',        turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'QUA',folgaDom:['19/04/2026']},
  {id:'f2',  nome:'RICKSON KALANY MIRANDA',                      categoria:'CHEFE DE FILA', turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'SEG',folgaDom:['29/03/2026']},

  // ── GARÇOM FECHAMENTO ─────────────────────────────────────
  {id:'f16b',nome:'SARA RAQUEL FERREIRA DE SOUSA',               categoria:'CHEFE DE FILA', turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'SEG',folgaDom:['22/03/2026']},
  {id:'f17', nome:'KLEBER SILVA DA CONCEICAO',                   categoria:'GARÇOM',        turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'QUI',folgaDom:['05/04/2026']},

  // ── GARÇOM INTERCALADO ────────────────────────────────────
  {id:'f3',  nome:'CAMILA PRISCILA PADILHA SALES',               categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'f4',  nome:'PATRICIA ARAUJO MOURA',                       categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'f5',  nome:'MARINA EDUARDA PIMENTA',                      categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'SEG',folgaDom:['22/03/2026']},
  {id:'f6',  nome:'FABIELLY RAIANNY CANDIDO DA SILVA RODRIGUES', categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'TER',folgaDom:['05/04/2026']},
  {id:'f7',  nome:'ANA LUCIA GONSALVES',                         categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'TER',folgaDom:['12/04/2026']},
  {id:'f8',  nome:'FABRICIA SOUSA SANTOS',                       categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'TER',folgaDom:['22/03/2026']},
  {id:'f9',  nome:'ALEXANDRE ALVES DA MOTA',                     categoria:'CHEFE DE FILA', turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'TER',folgaDom:['05/04/2026']},
  {id:'f10', nome:'ANDRE PAULO CUNHA PEREIRA',                   categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUA',folgaDom:['19/04/2026']},
  {id:'f11', nome:'JOSE FABRICIO PEREIRA SOARES',                categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUI',folgaDom:['12/04/2026']},
  {id:'f12', nome:'ROSEANE FRANKLIN DO NASCIMENTO',              categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUI',folgaDom:['19/04/2026']},
  {id:'f19', nome:'IGOR FERREIRA DE LIMA',                       categoria:'GARÇOM',        turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUI',folgaDom:['26/04/2026']},
  {id:'f18', nome:'LEYREAN MARIA GONSAVES M. DE ABREL',          categoria:'GARÇOM',        turno:'LICENÇA',     horIni:'',    horFim:'',    folga:''},

  // ── CUMIM ABERTURA ────────────────────────────────────────
  {id:'c1', nome:'GEORGE ALVES DA SILVA JUNIOR',     categoria:'CUMIM', turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'SEG',folgaDom:['05/04/2026']},
  {id:'c2', nome:'JOAO GUILHERME NOGUEIRA DA SILVA', categoria:'CUMIM', turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'TER',folgaDom:['12/04/2026']},
  {id:'c3', nome:'ADRIAN DE SOUSA AMORIM',           categoria:'CUMIM', turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'QUA',folgaDom:['19/04/2026']},
  {id:'c4', nome:'FELIPE DE LIMA DIAS',              categoria:'CUMIM', turno:'ABERTURA',    horIni:'07:30',horFim:'15:50',folga:'QUI',folgaDom:['05/04/2026']},

  // ── CUMIM INTERCALADO ─────────────────────────────────────
  {id:'c5', nome:'EDLANE UMBELINO SOARES',           categoria:'CUMIM', turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'c6', nome:'LETICIA BENEVINUTO DE AZEVEDO',    categoria:'CUMIM', turno:'INTERCALADO', horIni:'10:00',horFim:'20:20',folga:'QUA',folgaDom:['22/05/2026']},

  // ── CUMIM FECHAMENTO ──────────────────────────────────────
  {id:'c8', nome:'LUCAS DA COSTA CUNHA',             categoria:'CUMIM', turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'SEG',folgaDom:['22/03/2026']},
  {id:'c9', nome:'ISMAEL CARLOS SANTANA DA SILVA',   categoria:'CUMIM', turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'TER',folgaDom:['12/04/2026']},
  {id:'c10',nome:'EDUARDO OLIVEIRA DA SILVA',        categoria:'CUMIM', turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'QUA',folgaDom:['15/04/2026']},

  // ── OPE. CAIXA ────────────────────────────────────────────
  {id:'cx1',nome:'GISELA STEFANIA ACOSTA',   categoria:'OPE. CAIXA', turno:'ABERTURA',    horIni:'11:00',horFim:'19:20',folga:'TER',folgaDom:['12/04/2026']},
  {id:'cx2',nome:'IGOR LUIZ FERREIRA GOMES', categoria:'OPE. CAIXA', turno:'FECHAMENTO',  horIni:'17:00',horFim:'01:20',folga:'QUA',folgaDom:['26/03/2026']},

  // ── DELIVERY ──────────────────────────────────────────────
  {id:'d1', nome:'BIATRIZ DE LIMA DANTAS',           categoria:'LIDER',    turno:'INTERCALADO', horIni:'11:00',horFim:'20:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'d2', nome:'EVELYN FREITAS DE LUNA MARTINS',   categoria:'ATENDENTE',turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'TER',folgaDom:['15/04/2026']},

  // ── BAR ───────────────────────────────────────────────────
  {id:'b1', nome:'MARLON CABRAL BARRETO',                    categoria:'BARMAN',         turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'TER',folgaDom:['12/04/2026']},
  {id:'b2', nome:'LARISSA ALBUQUERQUE DOS SANTOS RODRIGUES', categoria:'COPEIRO',        turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'SEG',folgaDom:['19/04/2026']},
  {id:'b3', nome:'CARLA EDUARDA SILVEIRA DE OLIVEIRA',       categoria:'AUXILIAR DE BAR',turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'TER',folgaDom:['26/04/2026']},
  {id:'b4', nome:'LEONILSON RODRIGUES PEREIRA',              categoria:'COPEIRO',        turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'QUA',folgaDom:['12/04/2026']},
  {id:'b5', nome:'DANIELLE GONCALVES DOS PASSOS',            categoria:'COPEIRO',        turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'QUI',folgaDom:['29/03/2026']},
  {id:'b6', nome:'RHAI FELLIPE DO ROSARIO TEIXEIRA',         categoria:'BARMAN',         turno:'INTERCALADO', horIni:'11:00',horFim:'22:20',folga:'QUI',folgaDom:['05/04/2026']},
  {id:'b7', nome:'FRANCISCO JHONE PEREIRA FROTA',            categoria:'AUXILIAR DE BAR',turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'SEG',folgaDom:['05/04/2026']},
  {id:'b8', nome:'DANIEL RIBEIRO JORGE',                     categoria:'AUXILIAR DE BAR',turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'TER',folgaDom:['19/04/2026']},
  {id:'b9', nome:'ADALBERTO TRINDADE DE SENA',               categoria:'AUXILIAR DE BAR',turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'QUA',folgaDom:['05/03/2026']},
  {id:'b10',nome:'NELYNE MARIA COSTA MENEZES VIEIRA',        categoria:'COPEIRO',        turno:'FECHAMENTO',  horIni:'16:00',horFim:'00:20',folga:'QUI',folgaDom:['05/04/2026']},

  // ── RECEPÇÃO ──────────────────────────────────────────────
  {id:'r1', nome:'ISRAEL DE JESUS SILVA',          categoria:'RECEPCIONISTA', turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'r2', nome:'NATHALIA GONCALVES DA SILVA',    categoria:'RECEPCIONISTA', turno:'INTERCALADO', horIni:'11:00',horFim:'19:20',folga:'TER'},
  {id:'r3', nome:'GABRIELA PAIXAO',                categoria:'RECEPCIONISTA', turno:'ABERTURA',    horIni:'08:00',horFim:'16:20',folga:'QUA',folgaDom:['05/04/2026']},

  // ── ALMOXARIFADO ──────────────────────────────────────────
  {id:'alm2',nome:'FLAVIO PEREIRA DA SILVA', categoria:'AUX. ALMOXARIFADO', turno:'ABERTURA', horIni:'07:00',horFim:'15:20',folga:'SAB',folgaDom:['29/03/2026']},
  {id:'alm3',nome:'JONSON ALVES SOUZA',      categoria:'AUX. ALMOXARIFADO', turno:'ABERTURA', horIni:'08:00',horFim:'16:20',folga:'QUI',folgaDom:['12/04/2026']},

  // ── ADMINISTRATIVO ────────────────────────────────────────
  {id:'adm1',nome:'DAVID BRUNO CLEMENTE BONFIM', categoria:'LANCADOR',     turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},
  {id:'adm2',nome:'VALDETE PEREIRA DOS SANTOS',  categoria:'ASSISTENTE RH', turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},
  {id:'adm3',nome:'OSVALDINA CAPAO DE SOUZA',    categoria:'ANALISTA DE RH',turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},
  {id:'adm4',nome:'EDUARDO DE CASTRO CANDIDO',   categoria:'AUDITOR',       turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},
  {id:'adm5',nome:'DIEGO DE OLIVEIRA DUARTE',    categoria:'COMPRADOR',     turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},

  // ── BRINQUEDOTECA ─────────────────────────────────────────
  {id:'br4',nome:'JESSICA DE JESUS DE OLIVEIRA LOPES DUTRA',categoria:'ENCANTADORA',turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'TER',folgaDom:['26/04/2026']},
  {id:'br1',nome:'GABRIELA ALVES DE MOURA',                  categoria:'ENCANTADORA',turno:'FECHAMENTO',  horIni:'15:00',horFim:'23:20',folga:'TER',folgaDom:['19/04/2026']},
  {id:'br2',nome:'KARINE VITORIA DA SILVA',                  categoria:'ENCANTADORA',turno:'INTERCALADO', horIni:'11:00',horFim:'19:20',folga:'QUA',folgaDom:['12/04/2026']},
  {id:'br3',nome:'RAFAELA DOS SANTOS NICOLAU',               categoria:'ENCANTADORA',turno:'LICENÇA',     horIni:'',    horFim:'',    folga:''},

  // ── CONTROLADOR DE ACESSO ─────────────────────────────────
  {id:'ca1',nome:'BRUNA DAS GRACAS FIDELIS',categoria:'CONTR. DE ACESSO',turno:'ABERTURA',horIni:'08:00',horFim:'16:20',folga:'TER',folgaDom:['19/04/2026']},

  // ── MANUTENÇÃO ────────────────────────────────────────────
  {id:'man1',nome:'MILTON ROBERTO NASCIMENTO DOS SANTOS',categoria:'AUX. MANUTENCAO',turno:'ADMINISTRATIVO',horIni:'08:00',horFim:'17:00',folga:'SAB',folga2:'DOM'},

  // ── GOVERNANÇA ────────────────────────────────────────────
  {id:'asg1',nome:'DANIEL SOARES DE SOUZA LACERDA',categoria:'AUX. ASG',turno:'ABERTURA',horIni:'07:30',horFim:'15:50',folga:'SEG',folgaDom:['19/04/2026']},
  {id:'asg2',nome:'RAQUEL SANTOS DE SOUZA',         categoria:'AUX. ASG',turno:'ABERTURA',horIni:'07:30',horFim:'15:50',folga:'TER',folgaDom:['12/04/2026']},
  {id:'asg3',nome:'EVANDRO BARRETO DE AMORIM',      categoria:'AUX. ASG',turno:'ABERTURA',horIni:'07:30',horFim:'15:50',folga:'QUI',folgaDom:['05/04/2026']},

  // ── NUTRIÇÃO ──────────────────────────────────────────────
  {id:'nut1',nome:'VITORIA CRISTINA AGUIAR DE ANDRADE',categoria:'TEC. NUTRICAO', turno:'ABERTURA',     horIni:'08:00',horFim:'16:20',folga:'SEG',folgaDom:['12/04/2026']},
  {id:'nut2',nome:'GABRIELA FREITAS SILVA',            categoria:'NUTRICIONISTA', turno:'ADMINISTRATIVO',horIni:'10:00',horFim:'18:20',folga:'SAB',folga2:'DOM'},
  {id:'nut3',nome:'DAIANE DA SILVA OLIVEIRA',          categoria:'TEC. NUTRICAO', turno:'FECHAMENTO',   horIni:'16:00',horFim:'00:20',folga:'QUA',folgaDom:['19/04/2026']},
]

// Carrega equipe — se versão diferente ou localStorage vazio, usa a lista padrão
let EQUIPE = (()=>{
  const savedVersion = load('equipe_version', null);
  const savedEquipe  = load('equipe', null);
  // Se versão desatualizada ou lista vazia/pequena, reseta com a lista padrão completa
  if(!savedEquipe || savedEquipe.length < EQUIPE_DEFAULT.length || savedVersion !== EQUIPE_VERSION){
    save('equipe', EQUIPE_DEFAULT);
    save('equipe_version', EQUIPE_VERSION);
    return EQUIPE_DEFAULT.map(f=>({...f})); // cópia para evitar mutação
  }
  return savedEquipe;
})();

function getTurnos(){
  const t={};
  EQUIPE.forEach(f=>{
    const turnoKey=f.turno==='LICENÇA'?'LICENÇA':f.turno;
    if(!t[turnoKey])t[turnoKey]={id:turnoKey.toLowerCase(),label:turnoKey,membros:[],horario:''};
    t[turnoKey].membros.push(f);
    if(f.horIni&&f.horFim)t[turnoKey].horario=f.horIni+' às '+f.horFim;
  });
  const order=['ABERTURA','INTERCALADO','FECHAMENTO','ADMINISTRATIVO','LICENÇA'];
  const colors={'ABERTURA':'#f5c842','INTERCALADO':'#3498db','FECHAMENTO':'#e74c3c','ADMINISTRATIVO':'#27ae60','LICENÇA':'#7f8c8d'};
  return order.filter(k=>t[k]).map(k=>({...t[k],color:colors[k]||'#888'}));
}

// ═══════════════════════════════════════════════════
// DATAS DA SEMANA
// ═══════════════════════════════════════════════════
// Offset em semanas em relação à semana atual (0=atual, -1=anterior, +1=próxima)
let weekOffset = 0;

// Calcula as datas da semana com base no offset
function getWeekDates(offset){
  offset = offset || 0;
  const today=new Date();
  const dow=today.getDay();
  const diff=dow===0?-6:1-dow;
  const mon=new Date(today);
  mon.setDate(today.getDate()+diff+(offset*7));
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

// Semana atual (recalculada a cada navegação)
let WEEK_DATES=getWeekDates(0);
let WEEK_DAY_NUMS=WEEK_DATES.map(d=>d.getDate());

// Hoje: SEG=0,...SAB=5,DOM=6
const TODAY_IDX=(()=>{const dow=new Date().getDay();return dow===0?6:dow-1;})();
let curDay=TODAY_IDX;

// Navega para semana anterior/próxima
function navegarSemana(delta){
  if(weekOffset+delta < -8) return; // limite 8 semanas
  weekOffset += delta;
  WEEK_DATES   = getWeekDates(weekOffset);
  WEEK_DAY_NUMS= WEEK_DATES.map(d=>d.getDate());
  if(weekOffset===0) curDay=TODAY_IDX;
  else curDay=0;
  buildTabs();
  // Se não é semana atual, carrega dados do Firebase para essa semana
  if(weekOffset!==0 && fbDb && fbConnected){
    _carregarSemanaFirebase(weekOffset);
  } else {
    buildMain();
  }
}

// Carrega dados de uma semana específica do Firebase para o cache
function _carregarSemanaFirebase(offset){
  const wk = getWeekKey(offset);
  setSyncStatus('loading','Carregando semana...');

  // Limpa somente a semana alvo para evitar vazamento visual entre semanas
  Object.keys(_fbCache).forEach(k=>{
    if(k.startsWith('drec_')){
      const m=k.match(/_(\d{4}-\d{2}-\d{2})$/);
      if(m){
        const dt=new Date(m[1]+'T00:00:00');
        if(getWeekKeyByDate(dt)===wk) delete _fbCache[k];
      }
    }
  });

  fbDb.ref('presenca/'+wk).once('value').then(snap=>{
    const data = snap.val() || {};
    Object.entries(data).forEach(([fbKey,v])=>{
      const localKey = fbDecode(fbKey);
      const normalizedKey = normalizePresenceKey(localKey, wk);
      if(v && v.status !== '' && v.status !== undefined && normalizedKey.startsWith('drec_')) _fbCache[normalizedKey] = v;
      else {
        delete _fbCache[localKey];
        delete _fbCache[normalizedKey];
      }
    });
    buildMain(); refreshPendBadge(); buildSummary();
    setSyncStatus('ok','🔄 Sync em tempo real ativo');
  }).catch(e=>{
    buildMain();
    console.warn('Carrega semana FB:', e.message);
  });
}

// Volta para semana atual
function irParaHoje(){
  if(weekOffset===0) return;
  weekOffset=0;
  WEEK_DATES=getWeekDates(0);
  WEEK_DAY_NUMS=WEEK_DATES.map(d=>d.getDate());
  curDay=TODAY_IDX;
  buildTabs();
  // Recarrega dados da semana atual do Firebase
  if(fbDb && fbConnected) pullFromFirebase();
  else buildMain();
}

// Semana atual = pode editar | semana passada/futura = somente leitura
function isSemanaAtual(){ return weekOffset===0; }

// ═══════════════════════════════════════════════════
// RECORDS DE PRESENÇA
// ═══════════════════════════════════════════════════
function getRec(day,name){
  // ── Chave primária: por data (inequívoca entre semanas) ──────
  const d = WEEK_DATES[day];
  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dk = `drec_${name}_${iso}`;
  const byDate = load(dk, null);
  if(byDate && byDate.status) return byDate;

  // ── Fallback: chave simples day_nome (semana atual no Firebase) ──
  // Só usa se a data corresponde à semana atual (evita confusão entre semanas)
  if(weekOffset === 0){
    const byDay = load(day+'_'+name, null);
    if(byDay && byDay.status) return byDay;
  }

  return {status:'',extra:{}};
}
function setRec(day,name,status,extra){
  if(status === undefined || status === null) return;

  const d   = WEEK_DATES[day];
  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const wk  = getWeekKey(weekOffset);
  const dkDate = `drec_${name}_${iso}`;
  const ref = fbDb && fbConnected ? fbDb.ref('presenca/'+wk+'/'+fbEncode(dkDate)) : null;

  // Status vazio = limpar registro de verdade
  if(status === ''){
    delete _fbCache[dkDate];
    if(ref){
      _ignoringRemoteUpdate = true;
      ref.remove()
        .catch(e=>console.warn('setRec remove:', e))
        .finally(()=>{ setTimeout(()=>{ _ignoringRemoteUpdate = false; }, 1000); });
    }
  }else{
    const val = {status, extra: extra||{}, ts: Date.now()};
    save(dkDate, val);
    if(ref){
      _ignoringRemoteUpdate = true;
      ref.set(val)
        .catch(e=>console.warn('setRec:', e))
        .finally(()=>{ setTimeout(()=>{ _ignoringRemoteUpdate = false; }, 1000); });
    }
  }

  if(gToken&&SHEET_ID) triggerSheetsSync();
  if(document.getElementById('mapaPanel') && document.getElementById('mapaPanel').classList.contains('open')){
    renderMapa();
  }
}

// ═══════════════════════════════════════════════════
// JUSTIFICATIVAS
// ═══════════════════════════════════════════════════
function getJusts(nome){return load('just_'+nome,[])}
function addJust(nome,just){
  const list=getJusts(nome);
  list.push({...just,id:'j'+Date.now(),ts:Date.now()});
  const key='just_'+nome;
  save(key,list);
  pushToFirebase(key,list);
}

// ═══════════════════════════════════════════════════
// ATESTADOS
// ═══════════════════════════════════════════════════
function getAllAtestados(){
  const all=[];
  EQUIPE.forEach(f=>{
    const justs=getJusts(f.nome);
    justs.filter(j=>j.tipo==='atestado').forEach(j=>all.push({...j,nome:f.nome,cat:f.categoria}));
    for(let d=0;d<6;d++){
      const r=getRec(d,f.nome);
      if(r.status==='atestado'&&r.extra&&r.extra.ini){
        const dateStr=WEEK_DATES[d].toLocaleDateString('pt-BR');
        if(!all.find(a=>a.nome===f.nome&&a.data===dateStr)){
          all.push({id:'w'+d+f.nome,data:dateStr,tipo:'atestado',ini:r.extra.ini,fim:r.extra.fim,dias:r.extra.dias,obs:r.extra.obs,nome:f.nome,cat:f.categoria,ts:r.ts||0});
        }
      }
    }
  });
  return all.sort((a,b)=>b.ts-a.ts);
}

// ═══════════════════════════════════════════════════
// DISCIPLINAR
// ═══════════════════════════════════════════════════
function getProgAtual(nome,motivo){
  const isFalta=MOTIVOS_FALTA.includes(motivo);
  const prog=isFalta?PROG_FALTA:PROG_OUTROS;
  const justs=getJusts(nome).filter(j=>j.motivo===motivo&&j.medida&&j.medida!=='Sem medida'&&j.medida!=='Sem medida disciplinar');
  const idx=justs.length;
  return {prog,idx,proxima:prog[idx]||'Justa causa',isFalta};
}

function getAllDisciplinar(){
  const byFunc={};
  EQUIPE.forEach(f=>{
    const justs=getJusts(f.nome).filter(j=>j.tipo==='falta'||j.tipo==='medida');
    if(!justs.length)return;
    const byMotivo={};
    justs.forEach(j=>{
      const m=j.motivo||'Outro';
      if(!byMotivo[m])byMotivo[m]=[];
      byMotivo[m].push(j);
    });
    byFunc[f.nome]={func:f,byMotivo};
  });
  return byFunc;
}

function getProxMedida(nome,motivo){
  const {prog,idx}=getProgAtual(nome,motivo);
  return prog[idx]||'Justa causa';
}

// ═══════════════════════════════════════════════════
// PENDÊNCIAS
// ═══════════════════════════════════════════════════
function getPendencias(){
  const pend=[];
  const todayIdx=curDay;
  EQUIPE.forEach(f=>{
    if(f.turno==='LICENÇA')return;
    const dias=[];
    for(let d=0;d<=todayIdx-1;d++){
      if(isFolgaSemanal(f,DAYS[d]))continue;
      const r=getRec(d,f.nome);
      if(r.status!=='falta')continue;
      const dateStr=WEEK_DATES[d].toLocaleDateString('pt-BR');
      const justs=getJusts(f.nome);
      const justified=justs.some(j=>j.data===dateStr);
      if(!justified)dias.push({d,dateStr});
    }
    if(dias.length)pend.push({func:f,dias});
  });
  return pend;
}

// ═══════════════════════════════════════════════════
// GOOGLE AUTH
// ═══════════════════════════════════════════════════
let gToken=null;
let autoSyncInterval=null;

function setSheetsStatus(type,msg,btnTxt,btnAction){
  const dot=document.getElementById('sheetsDot');
  const msgEl=document.getElementById('sheetsMsg');
  const btn=document.getElementById('sheetsBtn');
  if(dot){
    dot.style.background=type==='ok'?'#27ae60':type==='loading'?'#f5c842':type==='err'?'#e74c3c':'var(--muted)';
  }
  if(msgEl)msgEl.textContent=msg;
  if(btn){
    btn.textContent=btnTxt||'📊 CONECTAR PLANILHA';
    if(btnAction)btn.onclick=btnAction;
  }
}

function gLogin(){
  if(!window.google){showToast('Aguarde o Google carregar...');return;}
  setSheetsStatus('loading','Aguardando autorização Google...','⏳ AGUARDE...');
  SHEET_ID=null;
  try{
    const client=google.accounts.oauth2.initTokenClient({
      client_id:GCLIENT_ID,
      scope:GSCOPES,
      callback:async(resp)=>{
        if(resp.error){
          setSheetsStatus('err','Erro: '+resp.error,'📊 TENTAR NOVAMENTE',gLogin);
          showToast('❌ Erro ao conectar: '+resp.error);
          return;
        }
        // Verifica email da conta conectada
        const CONTAS_PERMITIDAS=['gerencia.barra@cocobambu.com','liderancacbbarra@gmail.com'];
        let emailConta='';
        try{
          const info=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{
            headers:{Authorization:'Bearer '+resp.access_token}
          });
          const userData=await info.json();
          emailConta=(userData.email||'').toLowerCase().trim();
          console.log('Email detectado:', emailConta);
          showToast('📧 Conta: '+emailConta);
        }catch(e){
          console.warn('Erro userinfo:', e);
          emailConta='';
        }
        if(!CONTAS_PERMITIDAS.includes(emailConta)){
          gToken=null;
          setSheetsStatus('err','Conta não autorizada: '+emailConta,'📊 CONECTAR PLANILHA',gLogin);
          showToast('❌ Não autorizado: '+emailConta);
          return;
        }
        gToken=resp.access_token;
        save('g_token_ts',Date.now());
        setSheetsStatus('loading','Criando planilha...','⏳ AGUARDE...');
        showToast('✅ Google conectado! Criando planilha...');
        const ok=await ensurePlanilha();
        if(ok){
          await syncFrequenciaTotal();
          await syncTrocasSheet();
          await syncFaltasSheet();
          await syncAtestadosSheet();
          await syncMedidasSheet();
          startAutoSync();
        }
      },
      error_callback:(err)=>{
        console.warn('OAuth error:', err);
        setSheetsStatus('err','Erro ao conectar — tente no computador','📊 TENTAR NOVAMENTE',gLogin);
        showToast('❌ Erro OAuth: use o computador para conectar pela primeira vez');
      }
    });
    client.requestAccessToken({prompt:'select_account'});
  }catch(e){
    setSheetsStatus('err','Erro: '+e.message,'📊 TENTAR NOVAMENTE',gLogin);
    showToast('❌ Use o computador para conectar ao Google');
  }
}

function setSyncStatus(type,msg){
  document.getElementById('syncDot').className='sync-dot'+(type?' '+type:'');
  document.getElementById('syncMsg').textContent=msg;
}

async function gFetch(url,method='GET',body=null){
  const opts={method,headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  const r=await fetch(url,opts);
  if(r.status===401){gToken=null;setSyncStatus('err','Sessão expirada — reconecte');return null;}
  return r.json();
}

// ═══════════════════════════════════════════════════
// PLANILHA MENSAL — ESTRUTURA COMPLETA
// ═══════════════════════════════════════════════════
let SHEET_ID=load('sheet_id_v2',null);

// Retorna quantos dias tem o mês atual
function diasNoMes(ano,mes){return new Date(ano,mes,0).getDate();}

// Retorna o dia da semana (abreviado) para um dia do mês
function getDiaSemana(ano,mes,dia){
  const d=new Date(ano,mes-1,dia);
  return ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()];
}
// Converte status do app para texto da planilha
function statusToCell(nome,dayOfMonth,ano,mes){
  const f=EQUIPE.find(x=>x.nome===nome);
  if(!f)return '';
  if(f.turno==='LICENÇA')return 'LICENÇA';
  const diaSem=getDiaSemana(ano,mes,dayOfMonth);
  if(isFolgaSemanal(f,diaSem))return 'FOLGA';

  // Dias futuros não têm registro — deixa em branco
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const dtDia=new Date(ano,mes-1,dayOfMonth); dtDia.setHours(0,0,0,0);
  if(dtDia>hoje) return '';

  const dateKey=`${ano}-${String(mes).padStart(2,'0')}-${String(dayOfMonth).padStart(2,'0')}`;

  // 1) Chave por data (drec_NOME_YYYY-MM-DD) — semanas não-atuais
  let rec=load('drec_'+nome+'_'+dateKey,null);

  // 2) Chave simples da semana atual (dayIdx_NOME)
  if(!rec||!rec.status){
    for(let di=0;di<7;di++){
      const wd=WEEK_DATES[di];
      if(wd.getFullYear()===ano && wd.getMonth()+1===mes && wd.getDate()===dayOfMonth){
        const byDay=load(di+'_'+nome,null);
        if(byDay&&byDay.status) rec=byDay;
        break;
      }
    }
  }

  // 3) Cache do Firebase (semanas já carregadas)
  if(!rec||!rec.status){
    const cacheKey='drec_'+nome+'_'+dateKey;
    if(_fbCache[cacheKey]&&_fbCache[cacheKey].status) rec=_fbCache[cacheKey];
  }

  if(rec&&rec.status){
    const stObj=STATUS.find(s=>s.id===rec.status);
    if(stObj)return stObj.planilha;
    return rec.status.toUpperCase();
  }
  return '';
}

async function carregarMesDoFirebase(ano,mes){
  if(!(fbDb&&fbConnected)) return;
  const result = await carregarMesFirebaseNormalizado(ano, mes, {migrarLegado:false});
  Object.entries(result.map).forEach(([k,v])=>{ _fbCache[k]=v; });
}

async function reconciliarMesAtual(){
  if(!(fbDb && fbConnected)){
    showToast('Conecte o Firebase primeiro');
    setSyncStatus('err','Firebase não conectado');
    return;
  }
  if(!(gToken && SHEET_ID)){
    showToast('Conecte a planilha Google primeiro');
    setSheetsStatus('err','Conecte a planilha Google','📊 CONECTAR PLANILHA',gLogin);
    return;
  }

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth()+1;

  try{
    setSyncStatus('loading','Reconciliando Firebase...');
    setSheetsStatus('loading','Reconciliando mês atual...','⏳ AGUARDE...');

    const antes = Object.keys(_fbCache).filter(k=>isPresenceKeyForMonth(k, ano, mes)).length;
    const result = await carregarMesFirebaseNormalizado(ano, mes, {migrarLegado:true});

    limparCacheMes(ano, mes);
    Object.entries(result.map).forEach(([k,v])=>{ _fbCache[k]=v; });

    if(weekOffset===0) await pullFromFirebase();
    else _carregarSemanaFirebase(weekOffset);

    buildMain();
    refreshPendBadge();
    buildSummary();

    await syncFrequenciaTotal();
    await syncTrocasSheet();
    await syncFaltasSheet();
    await syncAtestadosSheet();
    await syncMedidasSheet();

    const depois = Object.keys(result.map).length;
    const corrigidos = Math.max(0, antes - depois);
    setSyncStatus('ok','Firebase reconciliado');
    setSheetsStatus('ok',`✅ Reconciliação concluída | ${depois} registros do mês`,'🔗 Abrir Planilha',()=>window.open('https://docs.google.com/spreadsheets/d/'+SHEET_ID,'_blank'));
    showToast(`✅ Reconciliação concluída | migrados: ${result.migrados} | limpos: ${corrigidos + result.removidosLegado}`);
  }catch(e){
    console.error('reconciliarMesAtual:', e);
    setSyncStatus('err','Erro na reconciliação');
    setSheetsStatus('err','Erro na reconciliação: '+e.message,'🧹 TENTAR',reconciliarMesAtual);
    showToast('❌ Erro ao reconciliar: '+e.message);
  }
}

// Retorna texto detalhado para coluna de observações na planilha
function statusToCellDetail(nome,dayOfMonth,ano,mes){
  const dateKey=`${ano}-${String(mes).padStart(2,'0')}-${String(dayOfMonth).padStart(2,'0')}`;
  const rec=load('drec_'+nome+'_'+dateKey,null);
  if(!rec||!rec.status)return '';
  const ex=rec.extra||{};
  if(rec.status==='saida-antecipada'){
    let d='SAÍDA: ';
    if(ex.horSaida)d+=ex.horSaida;
    if(ex.justificativa)d+=' | '+ex.justificativa;
    return d;
  }
  if(rec.status==='banco-horas'){
    let d='BH: ';
    if(ex.tipo)d+=ex.tipo;
    if(ex.horas)d+=' '+ex.horas+'h';
    if(ex.dataFormatada)d+=' ('+ex.dataFormatada+')';
    else if(ex.dataRegistro)d+=' ('+ex.dataRegistro+')';
    if(ex.periodo)d+=' '+ex.periodo;
    if(ex.obs)d+=' | '+ex.obs;
    return d;
  }
  if(rec.status==='presente'&&rec.extra&&rec.extra.domTipo){
    if(rec.extra.domTipo==='compra')return 'COMPRA FOLGA '+( rec.extra.compTipo||'');
    if(rec.extra.domTipo==='troca')return 'TROCA→'+(rec.extra.folgaEm||rec.extra.diaSem||'');
    return '';
  }
  if(rec.status==='troca-folga'){
    let d='';
    if(ex.trab)d+='Trab:'+ex.trab;
    if(ex.folga)d+=' Folga:'+ex.folga;
    return d;
  }
  if(rec.status==='atestado'){
    let d='';
    if(ex.dias)d+=ex.dias+'d';
    if(ex.obs)d+=' '+ex.obs;
    return d;
  }
  if(rec.status==='troca-horario'){
    return ex.ini&&ex.fim?ex.ini+'→'+ex.fim:'';
  }
  return '';
}

async function ensurePlanilha(){
  const hoje=new Date();
  const ano=hoje.getFullYear();
  const mes=hoje.getMonth()+1;
  const nomePlanilha=`Coco Bambu Frequencia ${ano}`;
  const nomeAba=`${String(mes).padStart(2,'0')}-${ano}`;

  setSheetsStatus('loading','Verificando planilha...','⏳ AGUARDE...');

  // Se já tem planilha salva, verifica se ainda existe e reutiliza
  if(SHEET_ID){
    try{
      const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=spreadsheetId,sheets.properties`);
      if(info&&info.spreadsheetId){
        // Boa — planilha existe! Cria a aba do mês se não existir
        const hasAba=info.sheets?.some(s=>s.properties.title===nomeAba);
        if(!hasAba){
          await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
            requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:300,columnCount:40}}}}]
          });
        }
        setSheetsStatus('loading','Planilha encontrada! Atualizando...','⏳ AGUARDE...');
        return true;
      }
    }catch(e){
      console.warn('Planilha salva não encontrada:', e.message);
    }
    // Planilha salva não existe mais — reseta para criar nova
    SHEET_ID=null;
    save('sheet_id_v2',null);
  }

  // Busca planilha existente pelo nome antes de criar nova
  setSheetsStatus('loading','Buscando planilha...','⏳ AGUARDE...');
  try{
    const search=await gFetch(`https://www.googleapis.com/drive/v3/files?q=name='${nomePlanilha}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`);
    if(search?.files?.length>0){
      // Reutiliza planilha existente
      SHEET_ID=search.files[0].id;
      save('sheet_id_v2',SHEET_ID);
      // Garante aba do mês
      const info2=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
      const hasAba=info2?.sheets?.some(s=>s.properties.title===nomeAba);
      if(!hasAba){
        await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
          requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:300,columnCount:40}}}}]
        });
      }
      setSheetsStatus('loading','Planilha encontrada! Atualizando...','⏳ AGUARDE...');
      return true;
    }
  }catch(e){ console.warn('Busca drive:', e.message); }

  // Só cria nova se não encontrou nenhuma
  setSheetsStatus('loading','Criando planilha...','⏳ AGUARDE...');
  try{
    const r=await gFetch('https://sheets.googleapis.com/v4/spreadsheets','POST',{
      properties:{title:nomePlanilha},
      sheets:[{properties:{title:nomeAba,gridProperties:{rowCount:300,columnCount:40}}}]
    });
    if(!r||!r.spreadsheetId){
      setSheetsStatus('err','Erro ao criar planilha','📊 TENTAR',gLogin);
      return false;
    }
    SHEET_ID=r.spreadsheetId;
    save('sheet_id_v2',SHEET_ID);
    setSheetsStatus('loading','Planilha criada! Preenchendo...','⏳ AGUARDE...');
    return true;
  }catch(e){
    setSheetsStatus('err','Erro: '+e.message,'📊 TENTAR',gLogin);
    return false;
  }
}

// ═══════════════════════════════════════════════════
// SYNC COMPLETO DA FREQUÊNCIA MENSAL
// ═══════════════════════════════════════════════════
let syncQueue=[];
let syncTimer=null;
let lastFullSync=0;

// Enfileira um sync suave (debounce 2s)
function enqueueSyncCell(nome,dayOfMonth){
  syncQueue.push({nome,dayOfMonth});
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>flushSyncQueue(),2000);
}

async function flushSyncQueue(){
  if(!gToken||!SHEET_ID||!syncQueue.length)return;
  const hoje=new Date();
  const ano=hoje.getFullYear();
  const mes=hoje.getMonth()+1;
  const nomeAba=`${String(mes).padStart(2,'0')}-${ano}`;
  const sorted=[...EQUIPE].sort((a,b)=>a.nome.localeCompare(b.nome));

  // Calcula posições de cada funcionário
  const funcRow={};
  sorted.forEach((f,i)=>funcRow[f.nome]=i+4); // linha base (1=cabeçalho mês, 2=cabeçalho dias semana, 3=cabeçalho dias num, 4=primeiro func)

  const updates=[];
  const processed=new Set();
  syncQueue.forEach(({nome,dayOfMonth})=>{
    const key=nome+'_'+dayOfMonth;
    if(processed.has(key))return;
    processed.add(key);
    const row=funcRow[nome];
    if(!row)return;
    const col=dayOfMonth+4; // col A=Nome, B=Função, C=Período, D=Obs, depois dias 1,2,...
    const colLetter=colToLetter(col);
    const val=statusToCell(nome,dayOfMonth,ano,mes);
    updates.push({range:`${nomeAba}!${colLetter}${row}`,values:[[val]]});
  });
  syncQueue=[];

  if(!updates.length)return;
  setSyncStatus('loading','Sincronizando...');
  try{
    // Batch update
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,'POST',{
      valueInputOption:'RAW',
      data:updates
    });
    setSyncStatus('ok',`Sincronizado — ${new Date().toLocaleTimeString('pt-BR')}`);
  }catch(e){setSyncStatus('err','Erro no sync');}
}

// Converte número de coluna para letra(s): 1=A, 2=B, 27=AA...
function colToLetter(n){
  let s='';
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}
  return s;
}

// Sync total — atualiza apenas células que mudaram (sem apagar a aba)
async function syncFrequenciaTotal(){
  if(!gToken||!SHEET_ID){showToast('Conecte o Google primeiro');return;}
  setSyncStatus('loading','Atualizando planilha...');
  setSheetsStatus('loading','Escrevendo dados...','⏳ AGUARDE...');

  const hoje=new Date();
  const ano=hoje.getFullYear();
  const mes=hoje.getMonth()+1;
  const nomeAba=`${String(mes).padStart(2,'0')}-${ano}`;
  const totalDias=diasNoMes(ano,mes);
  const meses=['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const nomeMes=meses[mes-1];

  try{
    // ── 1) Carrega todas as semanas do mês do Firebase ──────────
    await carregarMesDoFirebase(ano,mes);

    // ── 2) Garante que a aba existe ──────────────────────────────
    const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if(!info){setSheetsStatus('err','Sem resposta Google','📊 TENTAR',()=>syncFrequenciaTotal());return;}

    let sheetId=null;
    const hasAba=info.sheets?.find(s=>s.properties.title===nomeAba);
    const isNovaAba=!hasAba;

    if(!hasAba){
      const r=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
        requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:300,columnCount:40}}}}]
      });
      sheetId=r?.replies?.[0]?.addSheet?.properties?.sheetId;
    } else {
      sheetId=hasAba.properties.sheetId;
    }

    const sorted=[...EQUIPE].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    const totalCols=4+totalDias;
    const lastCol=colToLetter(totalCols);
    const numRows=2+sorted.length;

    // ── 3) Monta os dados ─────────────────────────────────────────
    const row1=['Mes:', nomeMes, '', 'PERIODO:', ...Array.from({length:totalDias},()=>'dia:')];
    const row2=['Colaborador:', 'Funcao:', 'Periodo:', 'Status', ...Array.from({length:totalDias},(_,i)=>String(i+1))];
    const dataRows=sorted.map(f=>{
      const row=[f.nome, f.categoria||'', f.turno||'', ''];
      for(let d=1;d<=totalDias;d++) row.push(statusToCell(f.nome,d,ano,mes)||'');
      return row;
    });
    const allRows=[row1, row2, ...dataRows];

    // ── 4) Escreve com batchUpdate de valores (SEM apagar a aba) ──
    // Usa values.batchUpdate que só atualiza as células especificadas
    // O Google Sheets trata isso como edição incremental → sem conflito
    const writeResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
      {
        method:'POST',
        headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'},
        body: JSON.stringify({
          valueInputOption:'RAW',
          data:[{
            range:`${nomeAba}!A1:${lastCol}${numRows}`,
            majorDimension:'ROWS',
            values:allRows
          }]
        })
      }
    );
    const writeData=await writeResp.json();

    if(writeResp.status!==200){
      setSheetsStatus('err','Erro: '+writeData.error?.message,'📊 TENTAR',()=>syncFrequenciaTotal());
      showToast('❌ Erro: '+writeData.error?.message);
      return;
    }

    // ── 5) Formatação — só aplica em aba nova ou forçado ─────────
    if(sheetId!=null && isNovaAba){
      await _aplicarFormatacaoAba(sheetId, sorted, totalDias);
    }

    const hora=new Date().toLocaleTimeString('pt-BR');
    setSyncStatus('ok','Planilha atualizada');
    setSheetsStatus('ok',`✅ ${hora}`,'🔗 Abrir Planilha',()=>window.open('https://docs.google.com/spreadsheets/d/'+SHEET_ID,'_blank'));
    const sb=document.getElementById('sheetsBtn');
    if(sb){sb.style.background='#27ae60';sb.style.color='#fff';sb.style.borderColor='#27ae60';}
    const total=writeData.totalUpdatedCells||writeData.responses?.reduce((s,r)=>s+(r.updatedCells||0),0)||'?';
    showToast('✅ '+total+' células atualizadas!');
    lastFullSync=Date.now();
  }catch(e){
    console.error('syncFrequenciaTotal:',e);
    setSyncStatus('err','Erro planilha');
    setSheetsStatus('err','Erro: '+e.message,'📊 TENTAR',()=>syncFrequenciaTotal());
    showToast('❌ Erro: '+e.message);
  }
}

// Aplica formatação visual na aba (chamado só na criação ou forçado)
async function _aplicarFormatacaoAba(sheetId, sorted, totalDias){
  try{
    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const white=rgb(255,255,255),black=rgb(0,0,0);
    const amarelo=rgb(255,255,0),azulEsc=rgb(0,112,192);
    const azulDias=rgb(189,215,238),azulZebra=rgb(221,235,247);
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{
      range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},
      cell:{userEnteredFormat:{backgroundColor:bg||white,textFormat:{bold:!!bold,foregroundColor:fg||black,fontSize:sz||9},horizontalAlignment:ha||'CENTER',verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'}},
      fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r1,r2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r1,endIndex:r2},properties:{pixelSize:px},fields:'pixelSize'}});
    const cf=(txt,bg,fg)=>({addConditionalFormatRule:{rule:{
      ranges:[{sheetId,startRowIndex:2,endRowIndex:2+sorted.length,startColumnIndex:4,endColumnIndex:4+totalDias}],
      booleanRule:{condition:{type:'TEXT_CONTAINS',values:[{userEnteredValue:txt}]},format:{backgroundColor:bg,textFormat:{bold:true,foregroundColor:fg}}}
    },index:0}});
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{requests:[
      cw(0,1,180),cw(1,2,100),cw(2,3,80),cw(3,4,60),cw(4,4+totalDias,40),
      rh(0,1,24),rh(1,2,24),rh(2,2+sorted.length,18),
      cr(0,1,0,4+totalDias,azulEsc,white,true,11,'CENTER'),
      cr(0,1,0,1,azulEsc,white,true,11,'LEFT'),
      cr(0,1,4,4+totalDias,azulDias,azulEsc,true,9,'CENTER'),
      cr(1,2,0,4+totalDias,amarelo,black,true,10,'CENTER'),
      cr(1,2,0,1,amarelo,black,true,10,'LEFT'),
      ...sorted.map((_,i)=>cr(2+i,3+i,0,4+totalDias,i%2===0?azulZebra:white,black,false,9,'CENTER')),
      ...sorted.map((_,i)=>cr(2+i,3+i,0,1,i%2===0?azulZebra:white,black,true,9,'LEFT')),
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:2,frozenColumnCount:4}},fields:'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'}},
      cf('PRESENTE',rgb(0,176,80),white),
      cf('FALTA',rgb(255,80,80),white),
      cf('ATESTADO',rgb(255,235,156),rgb(120,80,0)),
      cf('FOLGA',rgb(200,200,200),rgb(60,60,60)),
      cf('LICENCA',rgb(173,216,230),rgb(0,80,120)),
      cf('TROCA HOR.',rgb(189,215,238),rgb(0,70,127)),
      cf('TROCA FOLGA',rgb(218,190,255),rgb(80,0,160)),
      cf('MEDIDA',rgb(255,150,180),rgb(120,0,60)),
      cf('SAIDA',rgb(255,220,100),rgb(100,60,0)),
      cf('BANCO HORAS',rgb(180,255,220),rgb(0,100,70)),
    ]});
  }catch(e){ console.warn('Formatação:', e.message); }
}
// ─── AUTO-SYNC a cada 30 segundos + sync imediato ao salvar ───
function startAutoSync(){
  if(autoSyncInterval)clearInterval(autoSyncInterval);
  if(gToken&&SHEET_ID){
    syncFrequenciaTotal().catch(()=>{});
    syncTrocasSheet().catch(()=>{});
    syncFaltasSheet().catch(()=>{});
    syncAtestadosSheet().catch(()=>{});
    syncMedidasSheet().catch(()=>{});
  }
  autoSyncInterval=setInterval(()=>{
    if(gToken&&SHEET_ID){
      syncFrequenciaTotal().catch(()=>{});
      syncTrocasSheet().catch(()=>{});
      syncFaltasSheet().catch(()=>{});
      syncAtestadosSheet().catch(()=>{});
      syncMedidasSheet().catch(()=>{});
    }
  },30000);
}

// Chamado toda vez que um status é salvo — dispara sync da planilha
function triggerSheetsSync(){
  if(gToken&&SHEET_ID){
    clearTimeout(window._sheetsSyncTimer);
    window._sheetsSyncTimer=setTimeout(()=>{
      syncFrequenciaTotal().catch(()=>{});
      syncTrocasSheet().catch(()=>{});
      syncFaltasSheet().catch(()=>{});
      syncAtestadosSheet().catch(()=>{});
      syncMedidasSheet().catch(()=>{});
    },3000);
  }
}

// ─── Sincroniza aba de Trocas de Folga no Google Sheets ───
async function syncTrocasSheet(){
  if(!gToken||!SHEET_ID)return;
  const nomeAba='Trocas de Folga';
  const nomeAbaEnc=encodeURIComponent(nomeAba);

  try{
    // Garante que a aba existe
    const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if(!info)return;
    let sheetId=null;
    const hasAba=info.sheets?.find(s=>s.properties.title===nomeAba);
    if(!hasAba){
      const r=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
        requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:500,columnCount:8}}}}]
      });
      sheetId=r?.replies?.[0]?.addSheet?.properties?.sheetId;
    }else{
      sheetId=hasAba.properties.sheetId;
    }
    if(sheetId==null){console.warn('syncTrocasSheet: sheetId nulo');return;}

    // Busca todas as trocas do Firebase
    if(!fbDb)return;
    const snap=await fbDb.ref('trocas').once('value');
    const data=snap.val();
    const trocas=data?Object.values(data):[];
    trocas.sort((a,b)=>(a.ts||0)-(b.ts||0));

    // Monta linhas
    const cabecalho=['Carimbo de data/hora','COLABORADOR:','FUNCAO:','TROCA DE FOLGA:','TRABALHA:','FOLGA:','AUTORIZADO:'];
    const dataRows=trocas.map(t=>{
      const ts=t.ts?new Date(t.ts).toLocaleString('pt-BR'):'';
      return [ts, t.nome||'', t.categoria||'', 'TROCA DE FOLGA',
              t.trabalhouFmt||t.trabalhouIso||'', t.folgaFmt||t.folgaIso||'', t.auth||''];
    });
    const allRows=[cabecalho,...dataRows];
    const rangeStr=`${nomeAba}!A1:G${allRows.length}`;

    // 1) Limpa
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${nomeAbaEnc}!A1:G${allRows.length+10}:clear`,'POST',{});

    // 2) Escreve com fetch nativo (mais confiável)
    const wr=await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(rangeStr)}?valueInputOption=RAW`,
      {method:'PUT', headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'},
       body:JSON.stringify({range:rangeStr, majorDimension:'ROWS', values:allRows})}
    );
    const wrData=await wr.json();
    console.log('Trocas write:', wr.status, 'cells:', wrData.updatedCells);
    if(wr.status!==200){console.warn('Erro escrita trocas:', wrData.error?.message);return;}

    // 3) Formatação
    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const white=rgb(255,255,255),black=rgb(0,0,0);
    const roxo=rgb(103,58,183);
    const azulZebra=rgb(221,235,247);
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{
      range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},
      cell:{userEnteredFormat:{backgroundColor:bg||white,textFormat:{bold:!!bold,foregroundColor:fg||black,fontSize:sz||9},horizontalAlignment:ha||'LEFT',verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'}},
      fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r1,r2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r1,endIndex:r2},properties:{pixelSize:px},fields:'pixelSize'}});

    const requests=[
      cw(0,1,160),cw(1,2,180),cw(2,3,130),cw(3,4,160),cw(4,5,110),cw(5,6,110),cw(6,7,130),
      rh(0,1,28), rh(1,1+Math.max(trocas.length,1),20),
      cr(0,1,0,7,roxo,white,true,10,'CENTER'),
      ...trocas.map((_,i)=>cr(1+i,2+i,0,7,i%2===0?azulZebra:white,black,false,9,'LEFT')),
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
    ];
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{requests});
    showToast('✅ Aba Trocas atualizada! ('+trocas.length+' registros)');

  }catch(e){
    console.error('syncTrocasSheet erro:',e);
  }
}

// ─── Sincroniza aba de Faltas no Google Sheets ───
async function syncFaltasSheet(){
  if(!gToken||!SHEET_ID)return;
  const nomeAba='Faltas';
  const nomeAbaEnc=encodeURIComponent(nomeAba);

  try{
    // Garante que a aba existe
    const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if(!info)return;
    let sheetId=null;
    const hasAba=info.sheets?.find(s=>s.properties.title===nomeAba);
    if(!hasAba){
      const r=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
        requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:1000,columnCount:9}}}}]
      });
      sheetId=r?.replies?.[0]?.addSheet?.properties?.sheetId;
    }else{
      sheetId=hasAba.properties.sheetId;
    }
    if(sheetId==null){console.warn('syncFaltasSheet: sheetId nulo');return;}

    // Coleta todos os registros de falta do Firebase (semana atual) + justificativas
    const faltas=[];

    // 1) Faltas da semana atual (do cache em memória)
    EQUIPE.forEach(f=>{
      for(let di=0;di<7;di++){
        const rec=getRec(di,f.nome);
        if(rec&&rec.status==='falta'){
          const dt=WEEK_DATES[di];
          const dtIso=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
          const dtFmt=dt.toLocaleDateString('pt-BR');
          const diaSem=DAYS[di];
          const ex=rec.extra||{};
          // Verifica se tem justificativa
          const justs=getJusts(f.nome);
          const just=justs.find(j=>j.data===dtFmt);
          faltas.push({
            ts: rec.ts||Date.now(),
            nome: f.nome,
            categoria: f.categoria||'',
            turno: f.turno||'',
            dataFmt: dtFmt,
            dataIso: dtIso,
            diaSem,
            obs: ex.obs||'',
            justificada: just? 'SIM':'NÃO',
            tipoJust: just? (just.tipo==='atestado'?'ATESTADO':just.tipo==='justificado'?'JUSTIFICADO':'INJUSTIFICADA') : 'INJUSTIFICADA',
            medida: just? (just.medida||'') : '',
            resp: just? (just.resp||'') : '',
            obsJust: just? (just.obs||'') : ''
          });
        }
      }
    });

    // 2) Faltas históricas do Firebase (drec_ de outros meses)
    if(fbDb){
      const snap=await fbDb.ref('presenca').once('value');
      const allData=snap.val()||{};
      Object.entries(allData).forEach(([weekKey, weekData])=>{
        if(!weekData) return;
        Object.entries(weekData).forEach(([fbKey, rec])=>{
          try{
            const localKey=fbDecode(fbKey);
            // Só processa chaves drec_ (por data específica)
            if(!localKey.startsWith('drec_')) return;
            if(!rec||rec.status!=='falta') return;
            // Formato: drec_NOME_YYYY-MM-DD
            const parts=localKey.replace('drec_','').split('_');
            const dateIso=parts[parts.length-1];
            if(!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
            const nomeFalta=parts.slice(0,-1).join('_').replace(/_/g,' ');
            const f=EQUIPE.find(x=>x.nome===nomeFalta||fbEncode(x.nome)===nomeFalta);
            if(!f) return;
            const dt=new Date(dateIso+'T12:00:00');
            const dtFmt=dt.toLocaleDateString('pt-BR');
            const diaSem=DAYS[(dt.getDay()+6)%7];
            // Evita duplicata com semana atual
            const jaExiste=faltas.some(x=>x.nome===f.nome&&x.dataIso===dateIso);
            if(jaExiste) return;
            const ex=rec.extra||{};
            const justs=getJusts(f.nome);
            const just=justs.find(j=>j.data===dtFmt);
            faltas.push({
              ts: rec.ts||0,
              nome: f.nome,
              categoria: f.categoria||'',
              turno: f.turno||'',
              dataFmt: dtFmt,
              dataIso: dateIso,
              diaSem,
              obs: ex.obs||'',
              justificada: just?'SIM':'NÃO',
              tipoJust: just?(just.tipo==='atestado'?'ATESTADO':just.tipo==='justificado'?'JUSTIFICADO':'INJUSTIFICADA'):'INJUSTIFICADA',
              medida: just?(just.medida||''):'',
              resp: just?(just.resp||''):'',
              obsJust: just?(just.obs||''):''
            });
          }catch(e){}
        });
      });
    }

    // Ordena por data desc, depois por nome
    faltas.sort((a,b)=>{
      const d=b.dataIso.localeCompare(a.dataIso);
      return d!==0?d:a.nome.localeCompare(b.nome,'pt-BR');
    });

    // Monta linhas
    const cabecalho=[
      'Carimbo de data/hora','COLABORADOR:','FUNÇÃO:','TURNO:',
      'DATA:','DIA DA SEMANA:','STATUS:','MEDIDA DISCIPLINAR:','REGISTRADO POR:','OBSERVAÇÕES:'
    ];
    const dataRows=faltas.map(x=>{
      const ts=x.ts?new Date(x.ts).toLocaleString('pt-BR'):'';
      return [
        ts, x.nome, x.categoria, x.turno,
        x.dataFmt, x.diaSem,
        x.tipoJust==='ATESTADO'?'ATESTADO':x.tipoJust==='JUSTIFICADO'?'JUSTIFICADA':'FALTA INJUSTIFICADA',
        x.medida||'—', x.resp||'—',
        [x.obs, x.obsJust].filter(Boolean).join(' | ')||'—'
      ];
    });
    const allRows=[cabecalho,...dataRows];
    const totalCols=10;
    const lastCol='J';
    const rangeStr=`${nomeAba}!A1:${lastCol}${allRows.length}`;

    // 1) Limpa a aba
    await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${nomeAbaEnc}!A1:${lastCol}${allRows.length+20}:clear`,
      'POST',{}
    );

    // 2) Escreve dados
    const wr=await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(rangeStr)}?valueInputOption=RAW`,
      {method:'PUT', headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'},
       body:JSON.stringify({range:rangeStr, majorDimension:'ROWS', values:allRows})}
    );
    const wrData=await wr.json();
    if(wr.status!==200){console.warn('Erro escrita faltas:',wrData.error?.message);return;}

    // 3) Formatação
    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const white=rgb(255,255,255), black=rgb(0,0,0);
    const vermelhoEsc=rgb(192,0,0), vermelhoHdr=rgb(220,30,30);
    const vermelhoClaro=rgb(255,230,230), laranjaClaro=rgb(255,245,220);
    const cinzaZebra=rgb(245,245,245);
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{
      range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},
      cell:{userEnteredFormat:{
        backgroundColor:bg||white,
        textFormat:{bold:!!bold,foregroundColor:fg||black,fontSize:sz||9},
        horizontalAlignment:ha||'LEFT',verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'
      }},
      fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r1,r2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r1,endIndex:r2},properties:{pixelSize:px},fields:'pixelSize'}});
    // Formatação condicional
    const cfTexto=(txt,bg,fg,idx)=>({addConditionalFormatRule:{rule:{
      ranges:[{sheetId,startRowIndex:1,endRowIndex:1+Math.max(faltas.length,1),startColumnIndex:6,endColumnIndex:7}],
      booleanRule:{
        condition:{type:'TEXT_CONTAINS',values:[{userEnteredValue:txt}]},
        format:{backgroundColor:bg,textFormat:{bold:true,foregroundColor:fg}}
      }
    },index:idx}});

    const requests=[
      // Larguras das colunas
      cw(0,1,150), // data/hora
      cw(1,2,190), // nome
      cw(2,3,120), // função
      cw(3,4,110), // turno
      cw(4,5,90),  // data
      cw(5,6,80),  // dia semana
      cw(6,7,150), // status
      cw(7,8,160), // medida
      cw(8,9,140), // resp
      cw(9,10,200),// obs
      // Alturas
      rh(0,1,30),
      rh(1,1+Math.max(faltas.length,1),20),
      // Cabeçalho vermelho
      cr(0,1,0,totalCols,vermelhoEsc,white,true,10,'CENTER'),
      // Linhas zebradas
      ...faltas.map((_,i)=>cr(1+i,2+i,0,totalCols,i%2===0?cinzaZebra:white,black,false,9,'LEFT')),
      // Nome em negrito
      ...faltas.map((_,i)=>cr(1+i,2+i,1,2,i%2===0?cinzaZebra:white,black,true,9,'LEFT')),
      // Coluna Data centralizada
      ...faltas.map((_,i)=>cr(1+i,2+i,4,6,i%2===0?cinzaZebra:white,black,false,9,'CENTER')),
      // Congelamento
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
      // Formatação condicional por status
      cfTexto('FALTA INJUSTIFICADA',rgb(255,200,200),vermelhoEsc,0),
      cfTexto('ATESTADO',rgb(255,240,160),rgb(120,80,0),1),
      cfTexto('JUSTIFICADA',rgb(200,240,200),rgb(0,100,0),2),
    ];
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{requests});
    showToast('✅ Aba Faltas atualizada! ('+faltas.length+' registros)');

  }catch(e){
    console.error('syncFaltasSheet erro:',e);
  }
}

// ─── Sincroniza aba de Atestados no Google Sheets ───
async function syncAtestadosSheet(){
  if(!gToken||!SHEET_ID)return;
  const nomeAba='Atestados';
  const nomeAbaEnc=encodeURIComponent(nomeAba);
  try{
    const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if(!info)return;
    let sheetId=null;
    const hasAba=info.sheets?.find(s=>s.properties.title===nomeAba);
    if(!hasAba){
      const r=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
        requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:1000,columnCount:9}}}}]
      });
      sheetId=r?.replies?.[0]?.addSheet?.properties?.sheetId;
    }else{
      sheetId=hasAba.properties.sheetId;
    }
    if(sheetId==null){console.warn('syncAtestadosSheet: sheetId nulo');return;}

    // Coleta todos os atestados das justificativas + registros semanais
    const atestados=[];
    const hoje=new Date();

    EQUIPE.forEach(f=>{
      // 1) Atestados das justificativas registradas
      const justs=getJusts(f.nome);
      justs.filter(j=>j.tipo==='atestado'||j.tipo==='justificado').forEach(j=>{
        const iniDate=j.ini?new Date(j.ini+'T12:00:00'):null;
        const fimDate=j.fim?new Date(j.fim+'T12:00:00'):null;
        const expirado=fimDate?fimDate<hoje:false;
        const diasNum=j.dias?parseInt(j.dias):
          (iniDate&&fimDate?Math.round((fimDate-iniDate)/(1000*60*60*24))+1:1);
        const fmt=d=>{if(!d)return'';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
        atestados.push({
          ts:j.ts||0,
          nome:f.nome,
          categoria:f.categoria||'',
          turno:f.turno||'',
          dataRegistro:j.data||'',
          dataIni:j.tipo==='justificado'?j.data:(fmt(j.ini)||j.data||''),
          dataFim:j.tipo==='justificado'?j.data:(fmt(j.fim)||''),
          dias:j.tipo==='justificado'?'1':String(diasNum||''),
          tipo:j.tipo==='justificado'?'JUSTIFICADO':'ATESTADO MÉDICO',
          cid:j.obs||'',
          status:expirado?'ENCERRADO':'VÁLIDO'
        });
      });

      // 2) Atestados da semana atual (status direto no card)
      for(let di=0;di<7;di++){
        const rec=getRec(di,f.nome);
        if(rec&&rec.status==='atestado'&&rec.extra&&(rec.extra.ini||rec.extra.obs)){
          const dateStr=WEEK_DATES[di].toLocaleDateString('pt-BR');
          const jaExiste=atestados.some(a=>a.nome===f.nome&&a.dataRegistro===dateStr);
          if(!jaExiste){
            const iniDate=rec.extra.ini?new Date(rec.extra.ini+'T12:00:00'):null;
            const fimDate=rec.extra.fim?new Date(rec.extra.fim+'T12:00:00'):null;
            const expirado=fimDate?fimDate<hoje:false;
            const diasNum=rec.extra.dias?parseInt(rec.extra.dias):
              (iniDate&&fimDate?Math.round((fimDate-iniDate)/(1000*60*60*24))+1:1);
            const fmt=d=>{if(!d)return'';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
            atestados.push({
              ts:rec.ts||0,
              nome:f.nome,
              categoria:f.categoria||'',
              turno:f.turno||'',
              dataRegistro:dateStr,
              dataIni:fmt(rec.extra.ini)||dateStr,
              dataFim:fmt(rec.extra.fim)||'',
              dias:String(diasNum||'1'),
              tipo:'ATESTADO MÉDICO',
              cid:rec.extra.obs||'',
              status:expirado?'ENCERRADO':'VÁLIDO'
            });
          }
        }
      }
    });

    atestados.sort((a,b)=>{
      // Ordena por data de início desc (converte dd/mm/yyyy para yyyy-mm-dd para comparar)
      const toIso=s=>{if(!s)return'';const p=s.split('/');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:s;};
      const d=toIso(b.dataIni).localeCompare(toIso(a.dataIni));
      return d!==0?d:a.nome.localeCompare(b.nome,'pt-BR');
    });

    const cabecalho=[
      'Carimbo de data/hora','COLABORADOR:','FUNÇÃO:','TURNO:',
      'DATA REGISTRO:','INÍCIO:','FIM:','DIAS:','TIPO:','CID / OBSERVAÇÃO:','STATUS:'
    ];
    const dataRows=atestados.map(x=>{
      const ts=x.ts?new Date(x.ts).toLocaleString('pt-BR'):'';
      return [ts,x.nome,x.categoria,x.turno,x.dataRegistro,x.dataIni,x.dataFim,x.dias,x.tipo,x.cid||'—',x.status];
    });
    const allRows=[cabecalho,...dataRows];
    const lastCol='K'; const totalCols=11;
    const rangeStr=`${nomeAba}!A1:${lastCol}${allRows.length}`;

    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${nomeAbaEnc}!A1:${lastCol}${allRows.length+20}:clear`,'POST',{});
    const wr=await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(rangeStr)}?valueInputOption=RAW`,
      {method:'PUT',headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'},
       body:JSON.stringify({range:rangeStr,majorDimension:'ROWS',values:allRows})}
    );
    const wrData=await wr.json();
    if(wr.status!==200){console.warn('Erro escrita atestados:',wrData.error?.message);return;}

    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const white=rgb(255,255,255),black=rgb(0,0,0);
    const azulHdr=rgb(13,71,161);
    const cinzaZebra=rgb(240,248,255);
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{
      range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},
      cell:{userEnteredFormat:{backgroundColor:bg||white,textFormat:{bold:!!bold,foregroundColor:fg||black,fontSize:sz||9},horizontalAlignment:ha||'LEFT',verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'}},
      fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r1,r2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r1,endIndex:r2},properties:{pixelSize:px},fields:'pixelSize'}});
    const cfTexto=(txt,bg,fg,idx)=>({addConditionalFormatRule:{rule:{
      ranges:[{sheetId,startRowIndex:1,endRowIndex:1+Math.max(atestados.length,1),startColumnIndex:10,endColumnIndex:11}],
      booleanRule:{condition:{type:'TEXT_CONTAINS',values:[{userEnteredValue:txt}]},format:{backgroundColor:bg,textFormat:{bold:true,foregroundColor:fg}}}
    },index:idx}});

    const requests=[
      cw(0,1,150),cw(1,2,190),cw(2,3,120),cw(3,4,110),
      cw(4,5,90),cw(5,6,90),cw(6,7,90),cw(7,8,55),
      cw(8,9,130),cw(9,10,200),cw(10,11,90),
      rh(0,1,30),rh(1,1+Math.max(atestados.length,1),20),
      cr(0,1,0,totalCols,azulHdr,white,true,10,'CENTER'),
      ...atestados.map((_,i)=>cr(1+i,2+i,0,totalCols,i%2===0?cinzaZebra:white,black,false,9,'LEFT')),
      ...atestados.map((_,i)=>cr(1+i,2+i,1,2,i%2===0?cinzaZebra:white,black,true,9,'LEFT')),
      ...atestados.map((_,i)=>cr(1+i,2+i,4,8,i%2===0?cinzaZebra:white,black,false,9,'CENTER')),
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
      cfTexto('VÁLIDO',rgb(200,240,200),rgb(0,100,0),0),
      cfTexto('ENCERRADO',rgb(230,230,230),rgb(100,100,100),1),
      cfTexto('JUSTIFICADO',rgb(255,245,180),rgb(120,80,0),2),
    ];
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{requests});
    showToast('✅ Aba Atestados atualizada! ('+atestados.length+' registros)');
  }catch(e){
    console.error('syncAtestadosSheet erro:',e);
  }
}

// ─── Sincroniza aba de Medidas Disciplinares no Google Sheets ───
async function syncMedidasSheet(){
  if(!gToken||!SHEET_ID)return;
  const nomeAba='Medidas Disciplinares';
  const nomeAbaEnc=encodeURIComponent(nomeAba);
  try{
    const info=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if(!info)return;
    let sheetId=null;
    const hasAba=info.sheets?.find(s=>s.properties.title===nomeAba);
    if(!hasAba){
      const r=await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{
        requests:[{addSheet:{properties:{title:nomeAba,gridProperties:{rowCount:1000,columnCount:9}}}}]
      });
      sheetId=r?.replies?.[0]?.addSheet?.properties?.sheetId;
    }else{
      sheetId=hasAba.properties.sheetId;
    }
    if(sheetId==null){console.warn('syncMedidasSheet: sheetId nulo');return;}

    // Coleta todas as medidas disciplinares de todas as justificativas
    const medidas=[];
    const PROG_FALTA_L=['Advertência escrita','Suspensão 1 dia','Suspensão 3 dias','Suspensão 5 dias','Justa causa'];
    const PROG_OUTROS_L=['Advertência verbal','Advertência escrita','Suspensão 1 dia','Suspensão 3 dias','Suspensão 5 dias','Justa causa'];

    EQUIPE.forEach(f=>{
      const justs=getJusts(f.nome).filter(j=>(j.tipo==='falta'||j.tipo==='medida')&&j.medida&&j.medida!=='Sem medida'&&j.medida!=='Sem medida disciplinar');
      justs.forEach(j=>{
        const isFalta=(j.motivo==='Falta sem justificativa');
        const prog=isFalta?PROG_FALTA_L:PROG_OUTROS_L;
        const isJusta=j.medida==='Justa causa';
        // Calcula nível de gravidade na progressão
        const nivel=prog.indexOf(j.medida)+1||1;
        medidas.push({
          ts:j.ts||0,
          nome:f.nome,
          categoria:f.categoria||'',
          turno:f.turno||'',
          data:j.data||'',
          motivo:j.motivo||'',
          medida:j.medida||'',
          nivel:String(nivel),
          isJusta,
          resp:j.resp||'',
          obs:j.obs||''
        });
      });
    });

    medidas.sort((a,b)=>{
      // Justa causa sempre primeiro, depois por data desc
      if(a.isJusta&&!b.isJusta)return -1;
      if(!a.isJusta&&b.isJusta)return 1;
      const toIso=s=>{if(!s)return'';const p=s.split('/');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:s;};
      const d=toIso(b.data).localeCompare(toIso(a.data));
      return d!==0?d:a.nome.localeCompare(b.nome,'pt-BR');
    });

    const cabecalho=[
      'Carimbo de data/hora','COLABORADOR:','FUNÇÃO:','TURNO:',
      'DATA:','MOTIVO / OCORRÊNCIA:','MEDIDA APLICADA:','NÍVEL:','REGISTRADO POR:','OBSERVAÇÕES:'
    ];
    const dataRows=medidas.map(x=>{
      const ts=x.ts?new Date(x.ts).toLocaleString('pt-BR'):'';
      return [ts,x.nome,x.categoria,x.turno,x.data,x.motivo,x.medida,x.nivel,x.resp||'—',x.obs||'—'];
    });
    const allRows=[cabecalho,...dataRows];
    const lastCol='J'; const totalCols=10;
    const rangeStr=`${nomeAba}!A1:${lastCol}${allRows.length}`;

    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${nomeAbaEnc}!A1:${lastCol}${allRows.length+20}:clear`,'POST',{});
    const wr=await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(rangeStr)}?valueInputOption=RAW`,
      {method:'PUT',headers:{'Authorization':'Bearer '+gToken,'Content-Type':'application/json'},
       body:JSON.stringify({range:rangeStr,majorDimension:'ROWS',values:allRows})}
    );
    const wrData=await wr.json();
    if(wr.status!==200){console.warn('Erro escrita medidas:',wrData.error?.message);return;}

    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const white=rgb(255,255,255),black=rgb(0,0,0);
    const roxoHdr=rgb(74,0,112);
    const cinzaZebra=rgb(250,245,255);
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{
      range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},
      cell:{userEnteredFormat:{backgroundColor:bg||white,textFormat:{bold:!!bold,foregroundColor:fg||black,fontSize:sz||9},horizontalAlignment:ha||'LEFT',verticalAlignment:'MIDDLE',wrapStrategy:'CLIP'}},
      fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r1,r2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r1,endIndex:r2},properties:{pixelSize:px},fields:'pixelSize'}});
    const cfTexto=(col_ini,col_fim,txt,bg,fg,idx)=>({addConditionalFormatRule:{rule:{
      ranges:[{sheetId,startRowIndex:1,endRowIndex:1+Math.max(medidas.length,1),startColumnIndex:col_ini,endColumnIndex:col_fim}],
      booleanRule:{condition:{type:'TEXT_CONTAINS',values:[{userEnteredValue:txt}]},format:{backgroundColor:bg,textFormat:{bold:true,foregroundColor:fg}}}
    },index:idx}});

    const requests=[
      cw(0,1,150),cw(1,2,190),cw(2,3,120),cw(3,4,110),
      cw(4,5,90),cw(5,6,200),cw(6,7,170),cw(7,8,55),
      cw(8,9,140),cw(9,10,200),
      rh(0,1,30),rh(1,1+Math.max(medidas.length,1),20),
      cr(0,1,0,totalCols,roxoHdr,white,true,10,'CENTER'),
      ...medidas.map((_,i)=>cr(1+i,2+i,0,totalCols,i%2===0?cinzaZebra:white,black,false,9,'LEFT')),
      ...medidas.map((_,i)=>cr(1+i,2+i,1,2,i%2===0?cinzaZebra:white,black,true,9,'LEFT')),
      ...medidas.map((_,i)=>cr(1+i,2+i,4,5,i%2===0?cinzaZebra:white,black,false,9,'CENTER')),
      ...medidas.map((_,i)=>cr(1+i,2+i,7,8,i%2===0?cinzaZebra:white,black,true,9,'CENTER')),
      {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
      // Formatação condicional da coluna MEDIDA APLICADA
      cfTexto(6,7,'Justa causa',rgb(200,0,0),white,0),
      cfTexto(6,7,'Suspensão 5',rgb(255,150,100),rgb(120,0,0),1),
      cfTexto(6,7,'Suspensão 3',rgb(255,200,150),rgb(100,50,0),2),
      cfTexto(6,7,'Suspensão 1',rgb(255,235,180),rgb(100,70,0),3),
      cfTexto(6,7,'Advertência escrita',rgb(255,245,200),rgb(80,60,0),4),
      cfTexto(6,7,'Advertência verbal',rgb(240,255,220),rgb(50,80,0),5),
    ];
    await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,'POST',{requests});
    showToast('✅ Aba Medidas Disciplinares atualizada! ('+medidas.length+' registros)');
  }catch(e){
    console.error('syncMedidasSheet erro:',e);
  }
}

// ─── Armazenamento por data específica (dia/mês/ano) ───
function getRecByDate(nome,ano,mes,dia){
  const key=`${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return load('drec_'+nome+'_'+key,{status:'',extra:{}});
}
function setRecByDate(nome,ano,mes,dia,status,extra){
  const key=`${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  const fullKey='drec_'+nome+'_'+key;
  if(status===''){
    delete _fbCache[fullKey];
    if(fbDb&&fbConnected){
      const wk=getWeekKeyByDate(new Date(key+'T00:00:00'));
      fbDb.ref('presenca/'+wk+'/'+fbEncode(fullKey)).remove().catch(()=>{});
    }
    return;
  }
  const val={status,extra,ts:Date.now()};
  save(fullKey,val);
  pushToFirebase(fullKey,val);
}

// ─── Bridge: quando selecionar status na semana atual, salva também por data ───
function bridgeSaveByDate(nome,dayIdx,status,extra){
  const d=WEEK_DATES[dayIdx];
  const key=`drec_${nome}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const val={status,extra,ts:Date.now()};
  save(key,val);
  pushToFirebase(key, val);
  if(gToken&&SHEET_ID) triggerSheetsSync(); // sync automático ao salvar
}

// ═══════════════════════════════════════════════════
// SYNC EQUIPE (manter compatibilidade)
// ═══════════════════════════════════════════════════
let EQUIPE_SHEET_ID=SHEET_ID; // usa mesma planilha
async function pushEquipeToSheets(){
  // Agora integrado no sync mensal — não precisa de aba separada
  if(gToken)await syncFrequenciaTotal().catch(()=>{});
}

// ═══════════════════════════════════════════════════
// CRUD EQUIPE
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// IMPORTAÇÃO DA ESCALA — CICLO 20→20
// ═══════════════════════════════════════════════════

// ── Calcula qual aba usar baseado na data atual ──
// Regra: ciclo vai do dia 20 ao dia 19 do mês seguinte
// Ex: 20/mar–19/abr 2026 = aba "MARCO/ABRIL26"
//     20/abr–19/mai 2026 = aba "ABRIL/MAIO26"
// O sufixo do ano usa os 2 últimos dígitos do ano do fim do ciclo
const MESES_NOMES = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO',
                     'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

function _abaAtual(){
  const hoje = new Date();
  const dia  = hoje.getDate();
  const mes  = hoje.getMonth(); // 0-based (0=jan)
  const ano  = hoje.getFullYear();

  // Ciclo: dia 20 de um mês até dia 19 do mês seguinte
  // Ex: 20/mar–19/abr = "MARCO/ABRIL26"
  let mesIni, anoIni;
  if(dia >= 20){
    mesIni = mes;          // ciclo começa neste mês
    anoIni = ano;
  } else {
    mesIni = (mes - 1 + 12) % 12; // mês anterior
    anoIni = mes === 0 ? ano - 1 : ano; // se janeiro, ano anterior
  }
  const mesFim = (mesIni + 1) % 12;
  const anoFim = mesIni === 11 ? anoIni + 1 : anoIni; // virada dez→jan
  const sufixo = String(anoFim).slice(-2); // "2026" → "26"
  return MESES_NOMES[mesIni] + '/' + MESES_NOMES[mesFim] + sufixo;
}

// ── Mapeia variações de nome de função para categorias do app ──
function _mapCategoria(funcStr){
  const f = (funcStr||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const MAP = {
    'GERENTE':'GERENTE',
    'MAITRE':'MAÎTRE','MAITRES':'MAÎTRE',
    'GARCOM':'GARÇOM','GARSONS':'GARÇOM',
    'CHEFE DE FILA':'CHEFE DE FILA',
    'CUMIM':'CUMIM',
    'RECEPCIONISTA':'RECEPCIONISTA',
    'OPE. CAIXA':'OPE. CAIXA','OPERADOR DE CAIXA':'OPE. CAIXA','CAIXA':'OPE. CAIXA',
    'LIDER':'DELIVERY','ATENDENTE':'DELIVERY','DELIVERY':'DELIVERY',
    'BARMAN':'BARMAN',
    'COPEIRO':'COPEIRO',
    'AUXILIAR DE BAR':'AUXILIAR DE BAR','AUX. BAR':'AUXILIAR DE BAR','AUX BAR':'AUXILIAR DE BAR','AUX.BAR':'AUXILIAR DE BAR',
    'ENCANTADORA':'ENCANTADORA',
    'CONTR. DE ACESSO':'CONTR. DE ACESSO','CONTR DE ACESSO':'CONTR. DE ACESSO',
    'CONTROLADOR DE ACESSO':'CONTR. DE ACESSO','CONTR.DE ACESSO':'CONTR. DE ACESSO',
    'ALMOXARIFE':'ALMOXARIFE',
    'AUX. ALMOXARIFADO':'AUX. ALMOXARIFADO','AUX ALMOXARIFADO':'AUX. ALMOXARIFADO','AUX.ALMOXARIFADO':'AUX. ALMOXARIFADO',
    'LANCADOR':'ADMINISTRATIVO','LANCADORES':'ADMINISTRATIVO',
    'ASSISTENTE RH':'ADMINISTRATIVO','ANALISTA DE RH':'ADMINISTRATIVO',
    'AUDITOR':'ADMINISTRATIVO','COMPRADOR':'ADMINISTRATIVO','ADMINISTRATIVO':'ADMINISTRATIVO',
    'AUX. ASG':'AUX. ASG','AUX ASG':'AUX. ASG','AUX. LIMPEZA':'AUX. ASG','AUX LIMPEZA':'AUX. ASG',
    'AUX. MANUTENCAO':'AUX. MANUTÊNÇÃO','AUX. MANUTENCAO':'AUX. MANUTÊNÇÃO',
    'AUX. MANUTENCAO':'AUX. MANUTÊNÇÃO','AUX MANUTENCAO':'AUX. MANUTÊNÇÃO',
    'TEC. NUTRICAO':'TEC. NUTRIÇÃO','TEC NUTRICAO':'TEC. NUTRIÇÃO','TEC.NUTRICAO':'TEC. NUTRIÇÃO',
    'NUTRICIONISTA':'NUTRICIONISTA',
  };
  return MAP[f] || funcStr.trim() || 'GARÇOM';
}

// ── Detecta turno pelo horário de início ──
function _detectTurno(horStr, funcao){
  const h = (horStr||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(h.includes('LICENCA')||h.includes('LICENCA')) return 'LICENÇA';
  // Funções administrativas — folga sab+dom
  const admFuncs = ['LANCADOR','ASSISTENTE RH','ANALISTA DE RH','AUDITOR','COMPRADOR',
                    'ADMINISTRATIVO','NUTRICIONISTA'];
  const fNorm = (funcao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if(admFuncs.some(a=>fNorm.includes(a))) return 'ADMINISTRATIVO';
  // Extrai primeira hora
  const m = h.match(/(\d{1,2})(?::(\d{2}))?/);
  if(!m) return 'INTERCALADO';
  const ini = parseInt(m[1]);
  if(ini >= 5  && ini <= 9)  return 'ABERTURA';
  if(ini >= 10 && ini <= 12) return 'INTERCALADO';
  if(ini >= 13 && ini <= 17) return 'FECHAMENTO';
  return 'INTERCALADO';
}

// ── Extrai horário de início e fim ──
function _parseHorario(horStr){
  if(!horStr) return {ini:'',fim:''};
  const s = horStr.toString()
    .replace(/às|as|ÀS|AS/gi,' ')
    .replace(/h(?=\d)/gi,':')   // 11h00 → 11:00
    .replace(/h\b/gi,':00')     // 11h → 11:00
    .replace(/[\/\\]/g,' ');
  // Extrai todos os tempos HH:MM ou H:MM no string
  const times = [...s.matchAll(/(\d{1,2}):(\d{2})/g)].map(m=>{
    const hh = m[1].padStart(2,'0');
    const mm = m[2];
    return `${hh}:${mm}`;
  });
  // Pode ter múltiplos horários (intercalado: "11:00 às 15:00 / 19:00 às 22:20")
  // Pega o primeiro como entrada e o último como saída
  if(times.length >= 2) return {ini:times[0], fim:times[times.length-1]};
  if(times.length === 1) return {ini:times[0], fim:''};
  return {ini:'',fim:''};
}

// ── Detecta o dia de folga fixo (coluna com "FOLGA") ──
function _detectFolga(row){
  // Colunas: C=SEG(2), D=TER(3), E=QUA(4), F=QUI(5), G=SEX(6), H=SAB(7)
  const map = [{d:'SEG',i:2},{d:'TER',i:3},{d:'QUA',i:4},{d:'QUI',i:5},{d:'SEX',i:6},{d:'SAB',i:7}];
  for(const {d,i} of map){
    const v = (row[i]||'').toString().toUpperCase().trim();
    if(v==='FOLGA') return d;
  }
  return '';
}

// ── Extrai datas de folga do domingo (coluna I) ──
function _parseFolgaDom(domCell){
  const s = (domCell||'').toString();
  return s.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
}

// ── Normaliza nome para comparação ──
function _normNome(s){
  return (s||'').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim();
}

// ── Verifica se uma linha é cabeçalho/seção e deve ser ignorada ──
// ── Verifica se uma linha é de FUNCIONÁRIO válido ──
// Critério principal: coluna B deve ser uma FUNÇÃO conhecida
// Isso evita capturar cabeçalhos, subtítulos e linhas vazias
// ═══════════════════════════════════════════════════════════════
// IMPORTADOR DA PLANILHA DE ESCALA — versão final
//
// ESTRUTURA DA PLANILHA DE ESCALA (ex: aba MARCO/ABRIL26):
//   Linha 1   : Título (ESCALA COCO BAMBU...)   → ignora
//   Linha 2   : Vazia                           → ignora
//   Linha 3   : Cabeçalho de grupo (GERENTES..) → ignora (col B = "FUNÇÃO")
//   Linha 4-N : Funcionários reais
//     A = Nome | B = Função | C = SEG | D = TER | E = QUA
//     F = QUI  | G = SEXTA  | H = SAB | I = DOM (data folga dom) | J = HORÁRIO
//   Linha tot : "TOTAL = N"                     → ignora
//
// REGRA DE OURO: a planilha de escala NÃO tem coluna de status/licença.
// Licença é controlada SOMENTE pelo app. Jamais inferir licença pela escala.
// ═══════════════════════════════════════════════════════════════

// ── Funções válidas na planilha ──────────────────────────────
const _FUNCS_OK = new Set([
  'GERENTE',
  'MAÎTRE','MAITRE',
  'GARÇOM','GARCOM',
  'CHEFE DE FILA',
  'CUMIM',
  'RECEPCIONISTA',
  'OPE. CAIXA','OPE.CAIXA','OPERADOR DE CAIXA',
  'LIDER','ATENDENTE',
  'BARMAN',
  'COPEIRO',
  'AUXILIAR DE BAR','AUX. BAR','AUX BAR','AUX.BAR',
  'ENCANTADORA',
  'CONTR. DE ACESSO','CONTR DE ACESSO','CONTROLADOR DE ACESSO',
  'ALMOXARIFE',
  'AUX. ALMOXARIFADO','AUX ALMOXARIFADO',
  'LANCADOR','LANÇADOR',
  'ASSISTENTE RH','ANALISTA DE RH',
  'AUDITOR','COMPRADOR','ADMINISTRATIVO',
  'AUX. ASG','AUX ASG','AUX. LIMPEZA','AUX LIMPEZA',
  'AUX. MANUTENCAO','AUX. MANUTENÇÃO','AUX MANUTENCAO',
  'TEC. NUTRIÇÃO','TEC. NUTRICAO','TEC NUTRICAO',
  'NUTRICIONISTA',
]);

// Normaliza string: sem acento, maiúscula, sem espaços duplos
function _norm(s){
  return (s||'').toString().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim();
}
// Alias (compatibilidade)
function _normNome(s){ return _norm(s); }

// Verifica se col B é uma função reconhecida
function _funcOk(funcStr){
  const f = _norm(funcStr);
  if(!f) return false;
  // Verifica exato ou prefixo
  if(_FUNCS_OK.has(f)) return true;
  for(const ok of _FUNCS_OK){
    if(f.startsWith(ok) || ok === f.split(' ')[0]) return true;
  }
  return false;
}

// Col B = "FUNÇÃO" → cabeçalho de seção, pula
function _isLinhaSecao(nome, funcao){
  if(!nome || !nome.trim()) return true;
  const f = _norm(funcao);
  if(f === 'FUNCAO' || f === 'FUNCOES' || !f) return true;
  // Função não reconhecida → seção ou lixo
  if(!_funcOk(funcao)) return true;
  // Nome muito curto
  if(_norm(nome).replace(/ /g,'').length < 3) return true;
  return false;
}
// Alias
function _isFuncaoValida(funcStr){ return _funcOk(funcStr); }

// Mapeia função da planilha → categoria do app
function _mapCategoria(funcStr){
  const f = _norm(funcStr);
  const M = {
    'GERENTE':'GERENTE',
    'MAITRE':'MAÎTRE','MAITRES':'MAÎTRE',
    'GARCOM':'GARÇOM','GARSONS':'GARÇOM',
    'CHEFE DE FILA':'CHEFE DE FILA',
    'CUMIM':'CUMIM',
    'RECEPCIONISTA':'RECEPCIONISTA',
    'OPE. CAIXA':'OPE. CAIXA','OPE.CAIXA':'OPE. CAIXA',
    'OPERADOR DE CAIXA':'OPE. CAIXA',
    'LIDER':'DELIVERY','ATENDENTE':'DELIVERY',
    'BARMAN':'BARMAN',
    'COPEIRO':'COPEIRO',
    'AUXILIAR DE BAR':'AUXILIAR DE BAR','AUX. BAR':'AUXILIAR DE BAR',
    'AUX BAR':'AUXILIAR DE BAR','AUX.BAR':'AUXILIAR DE BAR',
    'ENCANTADORA':'ENCANTADORA',
    'CONTR. DE ACESSO':'CONTR. DE ACESSO','CONTR DE ACESSO':'CONTR. DE ACESSO',
    'CONTROLADOR DE ACESSO':'CONTR. DE ACESSO',
    'ALMOXARIFE':'ALMOXARIFE',
    'AUX. ALMOXARIFADO':'AUX. ALMOXARIFADO','AUX ALMOXARIFADO':'AUX. ALMOXARIFADO',
    'LANCADOR':'ADMINISTRATIVO','LANCADOR':'ADMINISTRATIVO',
    'ASSISTENTE RH':'ADMINISTRATIVO','ANALISTA DE RH':'ADMINISTRATIVO',
    'AUDITOR':'ADMINISTRATIVO','COMPRADOR':'ADMINISTRATIVO',
    'ADMINISTRATIVO':'ADMINISTRATIVO',
    'AUX. ASG':'AUX. ASG','AUX ASG':'AUX. ASG',
    'AUX. LIMPEZA':'AUX. ASG','AUX LIMPEZA':'AUX. ASG',
    'AUX. MANUTENCAO':'AUX. MANUTÊNÇÃO','AUX. MANUTENCAO':'AUX. MANUTÊNÇÃO',
    'AUX MANUTENCAO':'AUX. MANUTÊNÇÃO',
    'TEC. NUTRICAO':'TEC. NUTRIÇÃO','TEC NUTRICAO':'TEC. NUTRIÇÃO',
    'NUTRICIONISTA':'NUTRICIONISTA',
  };
  return M[f] || funcStr.trim();
}

// Detecta turno pelo horário de início e pela função
function _detectTurno(horStr, funcao){
  const fNorm = _norm(funcao);
  // Administrativos: folga sab+dom
  const adm = ['LANCADOR','ASSISTENTE RH','ANALISTA DE RH','AUDITOR',
                'COMPRADOR','ADMINISTRATIVO','NUTRICIONISTA'];
  if(adm.some(a => fNorm.includes(a))) return 'ADMINISTRATIVO';
  // Extrai primeira hora do string
  const m = (horStr||'').match(/(\d{1,2})[:h]/i);
  if(!m) return 'INTERCALADO';
  const h = parseInt(m[1]);
  if(h >= 5  && h <= 9)  return 'ABERTURA';
  if(h >= 10 && h <= 12) return 'INTERCALADO';
  if(h >= 13 && h <= 17) return 'FECHAMENTO';
  return 'INTERCALADO';
}

// Extrai HH:MM de início e fim do string de horário
// Suporta: "11:00 às 22:20", "07:30 às 15:50", "11:00 às 15:00/ 19:00 às 22:20"
function _parseHorario(horStr){
  if(!horStr) return {ini:'', fim:''};
  const all = [...horStr.matchAll(/(\d{1,2}):(\d{2})/g)]
    .map(m => m[1].padStart(2,'0')+':'+m[2]);
  if(all.length === 0) return {ini:'', fim:''};
  return {ini: all[0], fim: all[all.length-1]};
}

// Detecta o dia de folga fixo (coluna C=SEG..H=SAB com valor "FOLGA")
function _detectFolga(row){
  const dias = [
    {d:'SEG',i:2},{d:'TER',i:3},{d:'QUA',i:4},
    {d:'QUI',i:5},{d:'SEX',i:6},{d:'SAB',i:7}
  ];
  for(const {d,i} of dias){
    if(_norm(row[i]||'') === 'FOLGA') return d;
  }
  return '';
}

// Extrai datas de folga do domingo (coluna I), ex: "05/04/2026"
function _parseFolgaDom(cell){
  return ((cell||'').toString().match(/\d{2}\/\d{2}\/\d{4}/g) || []);
}

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
let _importPreview = null;
let _abasDisponiveis = [];

// Abre modal e detecta aba correta automaticamente
async function abrirImportarEscala(){
  document.getElementById('imp_sheet_id').value = ESCALA_SHEET_ID;
  document.getElementById('imp_preview').style.display = 'none';
  document.getElementById('imp_btn_aplicar').style.display = 'none';
  document.getElementById('imp_btn_ler').style.display = '';
  _importPreview = null;

  const abaAuto = _abaAtual();
  const hoje = new Date();
  document.getElementById('imp_aba_auto').innerHTML =
    `<span style="color:var(--accent);font-weight:800">📅 ${abaAuto}</span>
     <span style="font-size:10px;color:var(--sub);margin-left:8px">
       (hoje é dia ${hoje.getDate()} — ciclo 20→20)
     </span>`;

  openModal('importEscalaModal');
  if(gToken) await carregarAbas();
}

// Carrega lista de abas da planilha via API
async function carregarAbas(){
  if(!gToken){ showToast('⚠️ Conecte o Google Sheets primeiro'); return; }
  const sheetId = document.getElementById('imp_sheet_id').value.trim() || ESCALA_SHEET_ID;
  const sel = document.getElementById('imp_aba_select');
  sel.innerHTML = '<option>⏳ Carregando...</option>';
  try{
    const info = await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    );
    if(!info||!info.sheets){ sel.innerHTML='<option>❌ Erro ao listar abas</option>'; return; }
    _abasDisponiveis = info.sheets.map(s=>s.properties.title);
    const abaAuto = _abaAtual();
    // Coloca aba do ciclo atual primeiro
    const sorted = [..._abasDisponiveis].sort((a,b)=>
      a===abaAuto?-1:b===abaAuto?1:0
    );
    sel.innerHTML = sorted.map(aba=>{
      const cur = aba===abaAuto;
      return `<option value="${aba}" ${cur?'selected':''}>
        ${aba}${cur?' ← CICLO ATUAL':''}
      </option>`;
    }).join('');
    ESCALA_SHEET_ID = sheetId;
    localStorage.setItem('escala_sheet_id', sheetId);
  }catch(e){
    sel.innerHTML=`<option>❌ Erro: ${e.message}</option>`;
  }
}

// Lê a planilha de escala e monta a prévia
async function lerEscalaSheets(){
  if(!gToken){ showToast('⚠️ Conecte o Google Sheets primeiro'); return; }
  const sheetId = document.getElementById('imp_sheet_id').value.trim()||ESCALA_SHEET_ID;
  const aba = document.getElementById('imp_aba_select').value || _abaAtual();
  if(!sheetId){ showToast('⚠️ Informe o ID da planilha'); return; }
  if(!aba){ showToast('⚠️ Selecione a aba'); return; }

  const btn = document.getElementById('imp_btn_ler');
  btn.textContent='⏳ LENDO...'; btn.disabled=true;

  try{
    // Lê A1:K150 — colunas A→J são suficientes, K dá margem
    const range = encodeURIComponent(`'${aba}'!A1:K150`);
    const data  = await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`
    );
    if(!data||!data.values||!data.values.length){
      showToast(`❌ Aba "${aba}" não encontrada ou vazia`);
      btn.textContent='🔍 LER PLANILHA'; btn.disabled=false; return;
    }
    ESCALA_SHEET_ID=sheetId; ESCALA_ABA=aba;
    localStorage.setItem('escala_sheet_id',sheetId);
    localStorage.setItem('escala_aba',aba);

    const rows = data.values;
    const lidos = [];          // funcionários válidos lidos
    const nomesSet = new Set();// deduplicação por nome normalizado

    for(const row of rows){
      const nome   = (row[0]||'').toString().trim();
      const funcao = (row[1]||'').toString().trim();

      // FILTRO: só passa se col B for função reconhecida
      if(_isLinhaSecao(nome, funcao)) continue;

      const nNorm = _normNome(nome);
      // Evita duplicata (mesmo nome aparece em seções diferentes)
      if(nomesSet.has(nNorm)) continue;
      nomesSet.add(nNorm);

      // Col J (índice 9) = HORÁRIO
      const horStr  = (row[9]||'').toString().trim();
      const {ini,fim} = _parseHorario(horStr);
      const turno   = _detectTurno(horStr, funcao);
      const folga   = _detectFolga(row);
      const folgaDom= _parseFolgaDom(row[8]||'');
      const cat     = _mapCategoria(funcao);
      // Folga2 (domingo) para administrativos
      const sabVal  = _norm(row[7]||'');
      const folga2  = (turno==='ADMINISTRATIVO'&&sabVal==='FOLGA') ? 'DOM' : undefined;

      lidos.push({
        nome: nome.toUpperCase(),
        categoria: cat,
        turno,
        horIni: ini,
        horFim: fim,
        folga,
        folga2,
        folgaDom: folgaDom.length?folgaDom:undefined,
      });
    }

    if(!lidos.length){
      showToast(`❌ Nenhum funcionário encontrado em "${aba}"`);
      btn.textContent='🔍 LER PLANILHA'; btn.disabled=false; return;
    }

    // ── Compara com equipe atual (sem duplicatas) ──────────────────
    // Monta mapa nome_normalizado → funcionário atual (sem dups)
    const mapAtual = new Map();
    for(const f of EQUIPE){
      const n = _normNome(f.nome);
      if(!mapAtual.has(n)) mapAtual.set(n, f);
    }

    const adicionados=[], atualizados=[], inalterados=[], removidos=[];
    const normsLidos = new Set(lidos.map(x=>_normNome(x.nome)));

    // Para cada funcionário lido, tenta casar com alguém no app
    for(const lido of lidos){
      const nL = _normNome(lido.nome);
      // 1) Match exato
      let match = mapAtual.get(nL);
      // 2) Match tolerante: um nome começa com o outro (mínimo 8 chars)
      if(!match && nL.length>=8){
        for(const [nA,f] of mapAtual){
          if(nA.length>=8 && (nA.startsWith(nL)||nL.startsWith(nA))){
            match=f; break;
          }
        }
      }
      if(!match){
        adicionados.push(lido);
      } else {
        const mudou = match.turno!==lido.turno
                   || match.horIni!==lido.horIni
                   || match.horFim!==lido.horFim
                   || match.folga!==lido.folga
                   || (match.folga2||'')!==(lido.folga2||'')
                   || match.categoria!==lido.categoria;
        if(mudou) atualizados.push({antigo:match, novo:lido});
        else      inalterados.push(match);
      }
    }

    // Quem está no app MAS NÃO na planilha
    // IMPORTANTE: NÃO marca licença automaticamente — só mostra ao usuário
    // e o usuário decide ao clicar APLICAR
    for(const [nA,f] of mapAtual){
      if(f.turno==='LICENÇA') continue; // já em licença, não aparece como "saiu"
      // Verifica se não casou com nenhum nome lido
      const casou = normsLidos.has(nA) ||
        [...normsLidos].some(nL=>nL.length>=8&&nA.length>=8&&(nA.startsWith(nL)||nL.startsWith(nA)));
      if(!casou) removidos.push(f);
    }

    _importPreview = {lidos, adicionados, atualizados, inalterados, removidos, sheetId, aba};
    _renderImportPreview();

  }catch(e){
    console.error('lerEscalaSheets:',e);
    showToast('❌ Erro: '+e.message);
  }finally{
    btn.textContent='🔍 LER PLANILHA'; btn.disabled=false;
  }
}

// Renderiza a prévia no modal
function _renderImportPreview(){
  const {adicionados,atualizados,inalterados,removidos,aba} = _importPreview;
  document.getElementById('imp_preview').style.display='block';

  // Cards de resumo
  document.getElementById('imp_stats').innerHTML=[
    {n:adicionados.length, l:'Novos',       c:'#27ae60'},
    {n:atualizados.length, l:'Atualizados', c:'#f5c842'},
    {n:inalterados.length, l:'Sem mudança', c:'#7a85a3'},
    {n:removidos.length,   l:'Saíram',      c:'#e74c3c'},
  ].map(x=>`
    <div style="background:var(--s2);border-radius:9px;padding:7px 14px;border:1px solid ${x.c}44;text-align:center;flex:1">
      <div style="font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:${x.c}">${x.n}</div>
      <div style="font-size:9px;color:var(--sub);font-weight:700">${x.l}</div>
    </div>`).join('');

  let html='';
  adicionados.forEach(f=>{
    html+=`<div style="padding:9px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <span style="color:#27ae60;font-size:16px;font-weight:900">+</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${f.nome}</div>
        <div style="font-size:10px;color:var(--sub)">${f.categoria} · ${f.turno}${f.horIni?' · '+f.horIni+(f.horFim?' às '+f.horFim:''):''}</div>
      </div>
      <span style="background:#27ae6022;color:#27ae60;border:1px solid #27ae6044;border-radius:8px;font-size:9px;font-weight:700;padding:2px 8px">NOVO</span>
    </div>`;
  });
  atualizados.forEach(({antigo,novo})=>{
    const d=[];
    if(antigo.turno!==novo.turno)         d.push(`turno: ${antigo.turno}→${novo.turno}`);
    if(antigo.horIni!==novo.horIni||antigo.horFim!==novo.horFim)
                                           d.push(`horário: ${novo.horIni}–${novo.horFim}`);
    if(antigo.folga!==novo.folga || (antigo.folga2||'')!==(novo.folga2||''))         d.push(`folga: ${(antigo.folga||'—')+((antigo.folga2||'')?'/'+antigo.folga2:'')}→${(novo.folga||'—')+((novo.folga2||'')?'/'+novo.folga2:'')}`);
    if(antigo.categoria!==novo.categoria) d.push(`função: ${novo.categoria}`);
    html+=`<div style="padding:9px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <span style="color:#f5c842;font-size:16px;font-weight:900">~</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${antigo.nome}</div>
        <div style="font-size:10px;color:#f5c842">${d.join(' | ')}</div>
      </div>
      <span style="background:#f5c84222;color:#c49b00;border:1px solid #f5c84244;border-radius:8px;font-size:9px;font-weight:700;padding:2px 8px">MUDA</span>
    </div>`;
  });
  removidos.forEach(f=>{
    html+=`<div style="padding:9px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;opacity:.6">
      <span style="color:#e74c3c;font-size:16px;font-weight:900">−</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${f.nome}</div>
        <div style="font-size:10px;color:var(--sub)">${f.categoria} · ${f.turno}</div>
      </div>
      <span style="background:#e74c3c22;color:#e74c3c;border:1px solid #e74c3c44;border-radius:8px;font-size:9px;font-weight:700;padding:2px 8px">SAIU</span>
    </div>`;
  });
  if(!html){
    html=`<div style="padding:20px;text-align:center;color:var(--sub);font-size:12px">✅ Equipe 100% atualizada com a escala "${aba}"!</div>`;
  }
  document.getElementById('imp_lista').innerHTML=html;
  document.getElementById('imp_btn_aplicar').style.display=
    (adicionados.length||atualizados.length||removidos.length)?'':'none';
}

// Aplica as mudanças na equipe
function aplicarImportacao(){
  if(!_importPreview) return;
  const {lidos, aba} = _importPreview;
  const ts = Date.now();

  // ══════════════════════════════════════════════════════
  // RECONSTRUÇÃO TOTAL DA EQUIPE
  // A planilha de escala é a ÚNICA fonte da verdade.
  // Apaga tudo que estava antes e reconstrói do zero.
  // Para preservar vínculos com registros de frequência,
  // reutiliza o ID do funcionário quando o nome casa.
  // ══════════════════════════════════════════════════════

  // Salva mapa de IDs existentes ANTES de apagar (nome_norm → id)
  const mapaIds = new Map();
  for(const f of EQUIPE){
    const n = _normNome(f.nome);
    if(!mapaIds.has(n)) mapaIds.set(n, f.id);
  }

  // Busca ID existente por nome (exato ou tolerante)
  function _achaNome(nL){
    if(mapaIds.has(nL)) return mapaIds.get(nL);
    if(nL.length < 8) return null;
    for(const [nA, id] of mapaIds){
      if(nA.length >= 8 && (nA.startsWith(nL) || nL.startsWith(nA))) return id;
    }
    return null;
  }

  // Apaga TUDO e reconstrói apenas com quem está na planilha
  EQUIPE = lidos.map(f => {
    const nL = _normNome(f.nome);
    const id = _achaNome(nL) || ('imp_'+ts+'_'+Math.random().toString(36).slice(2,7));
    return {
      id,
      nome:      f.nome,
      categoria: f.categoria,
      turno:     f.turno,
      horIni:    f.horIni  || '',
      horFim:    f.horFim  || '',
      folga:     f.folga   || '',
      folga2:    f.folga2  || undefined,
      folgaDom:  f.folgaDom || undefined,
    };
  });

  // Limpa localStorage para garantir que não sobra lixo
  localStorage.removeItem('gp5_equipe');
  localStorage.removeItem('gp5_equipe_version');

  save('equipe', EQUIPE);
  save('equipe_version', 'esc_'+ts);
  closeModal('importEscalaModal');
  document.getElementById('totalPill').textContent=EQUIPE.length+' TOTAL';

  const bar=document.getElementById('importStatusBar');
  if(bar){
    bar.style.display='block';
    bar.innerHTML=`<div style="display:flex;align-items:center;gap:8px;color:var(--green)">
      <span>✅</span>
      <div>
        <span style="font-weight:700">Escala "${aba}" importada — ${EQUIPE.length} funcionários</span>
        <span style="color:var(--sub);font-size:10px;margin-left:6px">${new Date().toLocaleString('pt-BR')}</span>
      </div>
      <button onclick="abrirImportarEscala()" style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer">↻ Reimportar</button>
    </div>`;
  }

  const p=[];
  if(adicionados.length) p.push(adicionados.length+' novos');
  if(atualizados.length) p.push(atualizados.length+' atualizados');
  if(removidos.length)   p.push(removidos.length+' saíram');
  showToast('✅ Importado: '+(p.join(', ')||'sem mudanças'));

  _importPreview=null;

  // IMPORTANTE: aguarda o Firebase recarregar os dados de frequência
  // antes de reconstruir a tela — evita perder registros do cache
  if(fbDb && fbConnected){
    // Puxa dados frescos do Firebase e só então reconstrói a tela
    pullFromFirebase();   // já chama buildMain() internamente
    setTimeout(()=>{ buildEquipeContent('TODOS'); },800);
  } else {
    buildMain(); refreshPendBadge();
    buildEquipeContent('TODOS');
  }

  // Sync das planilhas com delay para não competir com o pullFromFirebase
  if(gToken&&SHEET_ID){
    setTimeout(()=>{
      syncFrequenciaTotal().catch(()=>{});
      syncFaltasSheet().catch(()=>{});
      syncAtestadosSheet().catch(()=>{});
      syncMedidasSheet().catch(()=>{});
    },3000);
  }
}


function openAddFuncModal(){
  document.getElementById('funcModalTitle').textContent='NOVO FUNCIONÁRIO';
  ['f_nome','f_hor_ini','f_hor_fim'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f_cat').value='GARÇOM';
  document.getElementById('f_turno').value='INTERCALADO';
  document.getElementById('f_folga').value='';
  document.getElementById('f_edit_id').value='';
  openModal('funcModal');
}
function openEditFuncModal(id){
  const f=EQUIPE.find(x=>x.id===id);if(!f)return;
  document.getElementById('funcModalTitle').textContent='EDITAR FUNCIONÁRIO';
  document.getElementById('f_nome').value=f.nome;
  document.getElementById('f_cat').value=f.categoria;
  document.getElementById('f_turno').value=f.turno;
  document.getElementById('f_hor_ini').value=f.horIni||'';
  document.getElementById('f_hor_fim').value=f.horFim||'';
  document.getElementById('f_folga').value=f.folga||'';
  document.getElementById('f_edit_id').value=id;
  openModal('funcModal');
}
async function saveFuncModal(){
  const nome=document.getElementById('f_nome').value.trim().toUpperCase();
  if(!nome){showToast('⚠️ Informe o nome');return;}
  const editId=document.getElementById('f_edit_id').value;
  const func={id:editId||'f'+Date.now(),nome,categoria:document.getElementById('f_cat').value,turno:document.getElementById('f_turno').value,horIni:document.getElementById('f_hor_ini').value,horFim:document.getElementById('f_hor_fim').value,folga:document.getElementById('f_folga').value};
  if(editId){const idx=EQUIPE.findIndex(x=>x.id===editId);if(idx>=0)EQUIPE[idx]=func;}
  else EQUIPE.push(func);
  save('equipe',EQUIPE);
  closeModal('funcModal');
  buildMain();refreshPendBadge();
  document.getElementById('totalPill').textContent=EQUIPE.length+' TOTAL';
  showToast(editId?'✅ Funcionário atualizado!':'✅ Funcionário adicionado!');
  if(gToken)await pushEquipeToSheets().catch(()=>{});
  if(document.getElementById('equipePanel').classList.contains('open'))buildEquipeContent('TODOS');
}
async function delFunc(id){
  const f=EQUIPE.find(x=>x.id===id);if(!f)return;
  if(!confirm('Remover '+f.nome+' da equipe?'))return;
  EQUIPE=EQUIPE.filter(x=>x.id!==id);
  save('equipe',EQUIPE);buildMain();refreshPendBadge();
  document.getElementById('totalPill').textContent=EQUIPE.length+' TOTAL';
  showToast('🗑️ '+f.nome+' removido');
  if(gToken)await pushEquipeToSheets().catch(()=>{});
  buildEquipeContent('TODOS');
}

// ═══════════════════════════════════════════════════
// JUSTIFICAR FALTA RETROATIVA
// ═══════════════════════════════════════════════════
function openJustModal(nome,day){
  const f=EQUIPE.find(x=>x.nome===nome);
  const dateStr=WEEK_DATES[day].toLocaleDateString('pt-BR');
  document.getElementById('justModalTitle').textContent='JUSTIFICAR FALTA';
  document.getElementById('justInfo').innerHTML='<strong>'+nome+'</strong><br>'+DAY_NAMES[day]+', '+dateStr+'<br><span style="color:var(--sub)">'+((f&&f.categoria)||'')+' · '+((f&&f.turno)||'')+'</span>';
  document.getElementById('j_fname').value=nome;
  document.getElementById('j_day').value=day;
  document.getElementById('j_tipo').value='falta';
  document.getElementById('j_motivo').value='Falta sem justificativa';
  document.getElementById('j_at_ini').value='';document.getElementById('j_at_fim').value='';
  document.getElementById('j_at_dias').value='';document.getElementById('j_at_obs').value='';
  document.getElementById('j_obs').value='';document.getElementById('j_resp').value='';
  toggleJustFields();updateJustMedida();
  openModal('justModal');
}
function toggleJustFields(){
  const tipo=document.getElementById('j_tipo').value;
  document.getElementById('j_atestado_fields').style.display=tipo==='atestado'?'block':'none';
  document.getElementById('j_falta_fields').style.display=tipo!=='atestado'&&tipo!=='justificado'?'block':'none';
  document.getElementById('j_prog_box').style.display=tipo==='falta'?'block':'none';
}
function updateJustMedida(){
  toggleJustFields();
  const tipo=document.getElementById('j_tipo').value;
  if(tipo!=='falta')return;
  const nome=document.getElementById('j_fname').value;
  const motivo=document.getElementById('j_motivo').value;
  document.getElementById('j_outro_wrap').style.display=motivo==='Outro'?'block':'none';
  if(!nome)return;
  const {prog,idx,proxima}=getProgAtual(nome,motivo);
  const steps=prog.map((s,i)=>{
    let cls='prog-step';
    if(i<idx)cls+=' done';
    else if(i===idx)cls+=' current';
    return '<div class="'+cls+'" title="'+s+'"></div>';
  }).join('');
  document.getElementById('j_prog_visual').innerHTML='<div class="prog-bar">'+steps+'</div>';
  const isJusta=proxima==='Justa causa';
  document.getElementById('j_medida_label').innerHTML=(isJusta?'<span style="color:#e74c3c;font-weight:800">🚨 PRÓXIMA: JUSTA CAUSA</span>':'<span style="color:#e67e22">Próxima medida sugerida: <strong>'+proxima+'</strong></span>');
  document.getElementById('j_medida').value=proxima;
}
function saveJustificativa(){
  const nome=document.getElementById('j_fname').value;
  const day=parseInt(document.getElementById('j_day').value);
  const tipo=document.getElementById('j_tipo').value;
  const dateStr=WEEK_DATES[day].toLocaleDateString('pt-BR');
  let just={data:dateStr,tipo};
  if(tipo==='atestado'){
    just.ini=document.getElementById('j_at_ini').value;
    just.fim=document.getElementById('j_at_fim').value;
    just.dias=document.getElementById('j_at_dias').value;
    just.obs=document.getElementById('j_at_obs').value;
    setRec(day,nome,'atestado',{ini:just.ini,fim:just.fim,dias:just.dias,obs:just.obs});
    // Marcar automaticamente todos os dias da semana dentro do período
    if(just.ini && just.fim){
      const parseDate = s => { if(!s) return null; const [y,m,d]=s.split('-'); return new Date(y,m-1,d); };
      const iniDate = parseDate(just.ini);
      const fimDate = parseDate(just.fim);
      WEEK_DATES.forEach((wd, di) => {
        if(di === day) return; // já foi salvo acima
        const wdN = new Date(wd.getFullYear(), wd.getMonth(), wd.getDate());
        if(iniDate && fimDate && wdN >= iniDate && wdN <= fimDate){
          setRec(di, nome, 'atestado', {ini:just.ini, fim:just.fim, dias:just.dias, obs:just.obs});
          bridgeSaveByDate(nome, di, 'atestado', {ini:just.ini, fim:just.fim, dias:just.dias, obs:just.obs});
        }
      });
    }
  }else if(tipo==='justificado'){
    just.obs=document.getElementById('j_obs').value;
    just.resp=document.getElementById('j_resp').value;
    setRec(day,nome,'atestado',{obs:'Justificado: '+just.obs});
  }else{
    let motivo=document.getElementById('j_motivo').value;
    if(motivo==='Outro')motivo=document.getElementById('j_outro').value||'Outro';
    just.motivo=motivo;
    just.medida=document.getElementById('j_medida').value;
    just.resp=document.getElementById('j_resp').value;
    just.obs=document.getElementById('j_obs').value;
    setRec(day,nome,'medida',{motivo:just.motivo,acao:just.medida,resp:just.resp,obs:just.obs});
  }
  addJust(nome,just);
  // Bridge para storage por data
  const d=WEEK_DATES[day];
  if(just.tipo==='atestado'){
    bridgeSaveByDate(nome,day,'atestado',{ini:just.ini,fim:just.fim,dias:just.dias,obs:just.obs});
  }else if(just.tipo==='justificado'){
    bridgeSaveByDate(nome,day,'atestado',{obs:'Justificado: '+just.obs});
  }else{
    bridgeSaveByDate(nome,day,'medida',{motivo:just.motivo,acao:just.medida,resp:just.resp,obs:just.obs});
  }
  closeModal('justModal');
  buildMain();refreshPendBadge();
  if(document.getElementById('equipePanel').classList.contains('open'))buildEquipeContent('TODOS');
  showToast('✅ Justificativa registrada!');
  const isJusta=just.medida==='Justa causa';
  if(isJusta)setTimeout(()=>showToast('🚨 ATENÇÃO: JUSTA CAUSA para '+nome+'!'),2500);
  // Sync das abas de faltas, atestados e medidas ao justificar
  if(gToken&&SHEET_ID) setTimeout(()=>{
    syncFaltasSheet().catch(()=>{});
    syncAtestadosSheet().catch(()=>{});
    syncMedidasSheet().catch(()=>{});
  },2000);
}

// ═══════════════════════════════════════════════════
// FICHA DO FUNCIONÁRIO
// ═══════════════════════════════════════════════════
function openFicha(nome){
  const f=EQUIPE.find(x=>x.nome===nome);
  document.getElementById('fichaPanelTitle').textContent=nome;
  const justs=getJusts(nome);
  const faltas=justs.filter(j=>j.tipo==='falta');
  const atests=justs.filter(j=>j.tipo==='atestado');
  const medidas=justs.filter(j=>j.medida&&j.medida!=='Sem medida');
  const temJusta=medidas.some(j=>j.medida==='Justa causa');
  let html='<div style="padding:16px">';
  html+='<div style="background:var(--s2);border-radius:12px;padding:14px;border:1px solid var(--border);margin-bottom:16px">';
  html+='<div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:800">'+nome+'</div>';
  html+='<div style="font-size:12px;color:var(--sub);margin-top:4px">'+(f?f.categoria+' · '+f.turno+(f.horIni?' · '+f.horIni+' às '+f.horFim:''):'')+'</div>';
  if(f&&f.turno==='LICENÇA')html+='<div class="badge badge-licenca" style="margin-top:8px;display:inline-block">🏥 EM LICENÇA</div>';
  if(temJusta)html+='<div class="badge badge-justa" style="margin-top:8px;display:inline-block">🚨 JUSTA CAUSA</div>';
  html+='<div style="display:flex;gap:10px;margin-top:12px">';
  html+='<div style="text-align:center;flex:1"><div style="font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:#e74c3c">'+faltas.length+'</div><div style="font-size:9px;color:var(--sub)">FALTAS</div></div>';
  html+='<div style="text-align:center;flex:1"><div style="font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:#2980b9">'+atests.length+'</div><div style="font-size:9px;color:var(--sub)">ATESTADOS</div></div>';
  html+='<div style="text-align:center;flex:1"><div style="font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:800;color:#e84393">'+medidas.length+'</div><div style="font-size:9px;color:var(--sub)">MEDIDAS</div></div>';
  html+='</div></div>';
  const motivosUnicos=[...new Set(justs.filter(j=>j.motivo).map(j=>j.motivo))];
  if(motivosUnicos.length){
    html+='<div class="ficha-section"><div class="ficha-title">PROGRESSÃO DISCIPLINAR</div>';
    motivosUnicos.forEach(mot=>{
      const {prog,idx,proxima}=getProgAtual(nome,mot);
      const isJusta=proxima==='Justa causa'||idx>=prog.length;
      const steps=prog.map((s,i)=>{let cls='prog-step';if(i<idx)cls+=' done';else if(i===idx)cls+=' current';return '<div class="'+cls+'" title="'+s+'"></div>';}).join('');
      html+='<div class="ficha-entry">';
      html+='<div class="ficha-entry-top"><strong style="font-size:12px">'+mot+'</strong>'+(isJusta?'<span class="badge badge-justa">🚨 JUSTA CAUSA</span>':'<span style="font-size:10px;color:var(--warn)">→ '+proxima+'</span>')+'</div>';
      html+='<div class="prog-bar">'+steps+'</div>';
      html+='</div>';
    });
    html+='</div>';
  }
  if(faltas.length){
    html+='<div class="ficha-section"><div class="ficha-title">❌ FALTAS REGISTRADAS</div>';
    [...faltas].reverse().forEach(j=>{
      html+='<div class="ficha-entry">';
      html+='<div class="ficha-entry-top"><span style="font-weight:700;font-size:13px">'+j.data+'</span><span class="badge badge-falta">'+j.motivo+'</span></div>';
      html+='<div class="ficha-detail">';
      if(j.medida)html+='⚠️ '+j.medida+'<br>';
      if(j.resp)html+='👤 '+j.resp+'<br>';
      if(j.obs)html+='📝 '+j.obs;
      html+='</div></div>';
    });
    html+='</div>';
  }
  if(atests.length){
    html+='<div class="ficha-section"><div class="ficha-title">🏥 ATESTADOS</div>';
    [...atests].reverse().forEach(j=>{
      html+='<div class="ficha-entry">';
      html+='<div class="ficha-entry-top"><span style="font-weight:700;font-size:13px">'+j.data+'</span><span class="badge badge-atestado">'+(j.dias?j.dias+' dia(s)':'atestado')+'</span></div>';
      html+='<div class="ficha-detail">';
      if(j.ini||j.fim)html+='📅 '+(j.ini||'?')+' a '+(j.fim||'?')+'<br>';
      if(j.obs)html+='📝 '+j.obs;
      html+='</div></div>';
    });
    html+='</div>';
  }
  if(!justs.length)html+='<div class="empty">Nenhum registro ainda.</div>';
  html+='</div>';
  document.getElementById('fichaContent').innerHTML=html;
  openPanel('fichaPanel');
}

// ═══════════════════════════════════════════════════
// TABS E MAIN
// ═══════════════════════════════════════════════════
function buildTabs(){
  // Tabs dos dias
  document.getElementById('dayTabs').innerHTML=DAYS.map((d,i)=>{
    const isToday = weekOffset===0 && i===TODAY_IDX;
    return '<button class="dtab'+(i===curDay?' active':'')+'" onclick="setDay('+i+')">'
      +'<span class="dtab-day">'+d+(isToday?' •':'')+'</span>'
      +'<span class="dtab-num">'+WEEK_DAY_NUMS[i]+'</span>'
      +'</button>';
  }).join('');

  // Indicador de semana
  const ind = document.getElementById('weekIndicator');
  const btnAnterior = document.getElementById('btnSemAnterior');
  const btnProxima  = document.getElementById('btnSemProxima');
  if(ind){
    if(weekOffset===0){
      ind.style.display='none';
      if(btnProxima){btnProxima.style.opacity='.35';btnProxima.style.cursor='default';}
    } else {
      const seg=WEEK_DATES[0], dom=WEEK_DATES[6];
      const fmt=d=>d.getDate()+'/'+(d.getMonth()+1);
      const label = weekOffset<0
        ? '◀ SEMANA ANTERIOR: '+fmt(seg)+' – '+fmt(dom)
        : 'SEMANA SEGUINTE: '+fmt(seg)+' – '+fmt(dom)+' ▶';
      ind.textContent=label;
      ind.style.display='block';
      if(btnProxima){btnProxima.style.opacity='1';btnProxima.style.cursor='pointer';}
    }
    if(btnAnterior){
      // Não deixa voltar mais de 8 semanas
      btnAnterior.style.opacity=weekOffset<=-8?'.35':'1';
      btnAnterior.style.cursor=weekOffset<=-8?'default':'pointer';
    }
  }
}
function setDay(i){curDay=i;buildTabs();buildMain();}

function buildSummary(){
  const cnt={presente:0,falta:0,atestado:0,'troca-horario':0,'troca-folga':0,medida:0,'saida-antecipada':0,'banco-horas':0};
  EQUIPE.forEach(f=>{const r=getRec(curDay,f.nome);if(r.status)cnt[r.status]=(cnt[r.status]||0)+1;});
  document.getElementById('presentCount').textContent=cnt.presente+' presentes';
  document.getElementById('summary').innerHTML=
    '<div class="scard"><div class="scard-num c-green">'+cnt.presente+'</div><div class="scard-lbl">Presente</div></div>'+
    '<div class="scard"><div class="scard-num c-red">'+cnt.falta+'</div><div class="scard-lbl">Falta</div></div>'+
    '<div class="scard"><div class="scard-num c-blue">'+cnt.atestado+'</div><div class="scard-lbl">Atestado</div></div>'+
    '<div class="scard"><div class="scard-num c-orange">'+cnt['troca-horario']+'</div><div class="scard-lbl">Troca H.</div></div>'+
    '<div class="scard"><div class="scard-num c-purple">'+cnt['troca-folga']+'</div><div class="scard-lbl">Troca F.</div></div>'+
    '<div class="scard"><div class="scard-num c-pink">'+cnt.medida+'</div><div class="scard-lbl">Discipl.</div></div>'+
    '<div class="scard"><div class="scard-num" style="color:#f39c12">'+cnt['saida-antecipada']+'</div><div class="scard-lbl">Saída Ant.</div></div>'+
    '<div class="scard"><div class="scard-num" style="color:#00b894">'+cnt['banco-horas']+'</div><div class="scard-lbl">Banco H.</div></div>';
}

let curView='escala';
function showView(v){
  curView=v;
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(v==='escala'?'navEscala':'navPend').classList.add('active');
  if(v==='escala')buildMain();
  else buildPendencias();
}
function openTrocas(){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navTrocas').classList.add('active');
  const hoje=new Date();
  document.getElementById('trocasMesFiltro').value=hoje.getMonth();
  document.getElementById('trocasAnoFiltro').value=hoje.getFullYear();
  openPanel('trocasPanel');
  buildTrocasPanel();
  _startTrocasListener();
}

let _trocasListenerActive=false;
function _startTrocasListener(){
  if(_trocasListenerActive||!fbDb)return;
  _trocasListenerActive=true;
  fbDb.ref('trocas').on('value',()=>{
    if(document.getElementById('trocasPanel').classList.contains('open')) buildTrocasPanel();
  });
}

function buildTrocasPanel(){
  const mes=parseInt(document.getElementById('trocasMesFiltro').value);
  const ano=parseInt(document.getElementById('trocasAnoFiltro').value);
  const todosOsMeses = mes === -1;
  const mesesNome=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const el=document.getElementById('trocasContent');
  el.innerHTML='<div class="empty" style="color:var(--sub)">🔄 Carregando...</div>';
  if(!fbDb||!fbConnected){
    el.innerHTML='<div class="empty" style="color:var(--red)">⚠️ Sem conexão com Firebase</div>';
    return;
  }
  fbDb.ref('trocas').once('value').then(snap=>{
    const data=snap.val();
    const trocas=[];
    if(data){
      Object.values(data).forEach(t=>{
        if(!t||!t.trabalhouIso)return;
        const [anoT,mesT]=t.trabalhouIso.split('-').map(Number);
        if(todosOsMeses){
          trocas.push(t); // sem filtro de mês
        } else {
          if(anoT===ano&&mesT-1===mes) trocas.push(t);
        }
      });
    }
    trocas.sort((a,b)=>a.trabalhouIso.localeCompare(b.trabalhouIso));
    const labelPeriodo = todosOsMeses ? 'todos os meses' : mesesNome[mes]+'/'+ano;
    if(trocas.length===0){
      el.innerHTML='<div class="empty">🔄 Nenhuma troca de folga em '+labelPeriodo+'</div>';
      return;
    }
    el.innerHTML='<div style="padding:0 16px 8px;font-size:11px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:1px">'+trocas.length+' troca'+(trocas.length!==1?'s':'')+' — '+labelPeriodo+'</div>'+
    trocas.map(t=>`
      <div style="background:var(--s2);border-radius:14px;padding:13px 15px;border:1px solid #1abc9c33;border-left:3px solid #1abc9c;margin:0 16px 10px;box-shadow:0 2px 8px #00000020">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--text)">${t.nome}</div>
            <div style="font-size:10px;color:var(--sub);margin-top:2px">${t.categoria||''}</div>
          </div>
          <span style="background:#1abc9c22;color:#1abc9c;border:1px solid #1abc9c44;font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px">🔄 TROCA</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:${t.auth?'8':'0'}px">
          <div style="background:var(--s3);border-radius:9px;padding:8px 10px">
            <div style="font-size:9px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">📅 Trabalhou em</div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${t.trabalhouFmt||t.trabalhouIso}</div>
          </div>
          <div style="background:var(--s3);border-radius:9px;padding:8px 10px">
            <div style="font-size:9px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">🏖️ Folga em</div>
            <div style="font-size:13px;font-weight:700;color:#1abc9c">${t.folgaFmt||t.folgaIso||'—'}</div>
          </div>
        </div>
        ${t.auth?`<div style="font-size:11px;color:var(--sub);margin-top:6px">👤 Autorizado por: <strong>${t.auth}</strong></div>`:''}
      </div>
    `).join('');
  }).catch(e=>{
    el.innerHTML='<div class="empty" style="color:var(--red)">❌ Erro: '+e.message+'</div>';
  });
}


function editarTroca(nome,dateStr){
  // Encontra o funcionário e abre o modal de edição
  const f=EQUIPE.find(x=>x.nome===nome);
  if(!f)return;
  // Encontra o dayIdx correspondente à data
  const d=new Date(dateStr+'T12:00:00');
  let dayIdx=-1;
  WEEK_DATES.forEach((wd,i)=>{
    if(wd.toISOString().split('T')[0]===dateStr) dayIdx=i;
  });
  if(dayIdx>=0){
    closePanel('trocasPanel');
    setTimeout(()=>{
      const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+d.toLocaleDateString('pt-BR');
      openFolgaModalById(f,dayIdx,true,folgaKey);
    },350);
  } else {
    showToast('⚠️ Esta data não está na semana atual — não é possível editar');
  }
}

function showEquipe(){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navEquipe').classList.add('active');
  buildEquipeContent('TODOS');openPanel('equipePanel');
}
function showMais(){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navMais').classList.add('active');
  openModal('maisMenu');
}

function buildMain(){
  const d=WEEK_DATES[curDay];
  const full=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  let label = full.charAt(0).toUpperCase()+full.slice(1);
  if(weekOffset<0) label = '📅 '+label;
  else if(weekOffset>0) label = '⏩ '+label;
  document.getElementById('dateLabel').textContent=label;

  // Botão HOJE: aparece quando não está na semana atual
  const btnHoje=document.getElementById('btnHoje');
  if(btnHoje) btnHoje.style.display=weekOffset!==0?'block':'none';

  // Banner read-only para semanas que não são a atual
  let roBar=document.getElementById('readonlyBar');
  if(!roBar){
    roBar=document.createElement('div');
    roBar.id='readonlyBar';
    roBar.style.cssText='background:#f5c84211;border-bottom:1px solid #f5c84233;padding:6px 16px;font-size:11px;color:#c49b00;font-weight:700;text-align:center;display:none';
    document.getElementById('summary').before(roBar);
  }
  if(weekOffset!==0){
    const seg=WEEK_DATES[0],dom=WEEK_DATES[6];
    const fmt=d=>d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();
    roBar.textContent='📅 VISUALIZANDO: '+fmt(seg)+' a '+fmt(dom);
    roBar.style.display='block';
  } else {
    roBar.style.display='none';
  }
  buildSummary();
  if(curView==='pendencias'){buildPendencias();return;}
  const turnos=getTurnos();
  document.getElementById('mainContent').innerHTML=turnos.map(t=>buildTurno(t)).join('<div style="height:8px"></div>');
}

function buildTurno(t){
  const cards=t.membros.map(f=>{
    if(f.turno==='LICENÇA')return buildLicencaCard(f);

    // Verifica se o dia atual é o dia de folga da pessoa
    if(isFolgaSemanal(f,DAYS[curDay])){
      // Checa se há registro de troca de folga salvando-a como presente hoje
      const dateStr=WEEK_DATES[curDay].toLocaleDateString('pt-BR');
      const folgaKey='folga_'+f.id+'_'+curDay+'_'+dateStr;
      const folgaRec=load(folgaKey,null);
      // Se registrou troca e veio trabalhar → mostra card normal (não opaco)
      if(folgaRec&&(folgaRec.tipo==='troca'||folgaRec.tipo==='presente'||folgaRec.tipo==='compra')){
        return buildCard(f); // card normal, não opaco
      }
      return buildFolgaCard(f,curDay);
    }

    // Verifica se hoje é o dia de FOLGA de troca (a data escolhida para compensação)
    const todayIso=WEEK_DATES[curDay].toISOString().split('T')[0];
    const drKey='drec_'+f.nome+'_'+todayIso;
    const drRec=load(drKey,null);
    if(drRec&&drRec.status==='troca-folga'){
      // Mostra card opaco com badge TROCA FOLGA (folga compensatória)
      return buildTrocaFolgaCard(f, drRec);
    }

    return buildCard(f);
  }).join('');
  return '<div class="section"><div class="sec-header"><div class="sec-dot" style="background:'+t.color+'"></div><div class="sec-title" style="color:'+t.color+'">'+t.label+'</div><div class="sec-time">'+t.horario+'</div></div><div class="emp-list">'+cards+'</div></div>';
}

function buildFolgaCard(f, dayIdx){
  const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
  const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+dateStr;
  const folgaRec=load(folgaKey,null);

  // Badge de status conforme registro
  let badgeHtml='';
  let extraInfo='';
  let borderLeft='';

  if(folgaRec){
    if(folgaRec.tipo==='presente'){
      badgeHtml='<span class="badge badge-presente">✅ VEIO TRABALHAR</span>';
      borderLeft='border-left:3px solid #27ae60;';
      if(folgaRec.obs)extraInfo=`<div style="font-size:10px;color:var(--sub);margin-top:2px">📝 ${folgaRec.obs}</div>`;
    } else if(folgaRec.tipo==='compra'){
      badgeHtml='<span class="badge badge-compra-folga">💰 COMPRA FOLGA</span>';
      borderLeft='border-left:3px solid #f5c842;';
      if(folgaRec.compTipo)extraInfo+=`<div style="font-size:10px;color:var(--sub);margin-top:2px">💰 ${folgaRec.compTipo}${folgaRec.compValor?' · '+folgaRec.compValor:''}</div>`;
      if(folgaRec.compAuth)extraInfo+=`<div style="font-size:10px;color:var(--sub)">👤 ${folgaRec.compAuth}</div>`;
    } else if(folgaRec.tipo==='troca'){
      badgeHtml='<span class="badge badge-troca-dom">🔄 TROCA FOLGA</span>';
      borderLeft='border-left:3px solid #1abc9c;';
      if(folgaRec.trocaDiaFmt)extraInfo+=`<div style="font-size:10px;color:var(--sub);margin-top:2px">📅 Folga: ${folgaRec.trocaDiaFmt}${folgaRec.trocaDiaSem?' ('+folgaRec.trocaDiaSem+')':''}</div>`;
      if(folgaRec.trocaAuth)extraInfo+=`<div style="font-size:10px;color:var(--sub)">👤 ${folgaRec.trocaAuth}</div>`;
    } else if(folgaRec.tipo==='falta'){
      badgeHtml='<span class="badge badge-falta">❌ NÃO VEIO</span>';
      borderLeft='border-left:3px solid #e74c3c;';
    }
  } else {
    badgeHtml='<span class="badge badge-vazio">📆 FOLGA</span>';
  }

  // Botões de ação discretos (só ícones pequenos)
  const idSafe=f.id.replace(/'/g,"\\'");
  const actionBtns = folgaRec
    ? `<div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">
        <button onclick="event.stopPropagation();_openFolga('${idSafe}',${dayIdx},true)" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--s3);color:var(--sub);cursor:pointer;font-family:Barlow,sans-serif">✏️ Editar</button>
        <button onclick="event.stopPropagation();_clearFolga('${idSafe}',${dayIdx})" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid #e74c3c33;background:transparent;color:#e74c3c;cursor:pointer;font-family:Barlow,sans-serif">🗑️</button>
      </div>`
    : `<div style="margin-top:6px;text-align:right">
        <button onclick="event.stopPropagation();_openFolga('${idSafe}',${dayIdx},false)" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid #f5c84244;background:transparent;color:#c49b00;cursor:pointer;font-family:Barlow,sans-serif;font-weight:600">+ Registrar ação</button>
      </div>`;

  // Visual igual ao card de folga original — opaco, sem borda pulsante
  return `<div class="emp-card has-status" style="opacity:.55;${borderLeft}">
    <div class="emp-top">
      <div>
        <button class="emp-name-btn" onclick="_openFicha('${idSafe}')">
          <div class="emp-name">${f.nome}</div>
        </button>
        <div class="emp-meta">${f.categoria}</div>
        ${extraInfo}
      </div>
      <div class="emp-badges">${badgeHtml}</div>
    </div>
    ${actionBtns}
  </div>`;
}

// Card para o dia de FOLGA compensatória (dia escolhido na troca)
function buildTrocaFolgaCard(f, drRec){
  const extra=(drRec&&drRec.extra)||{};
  const obs=extra.obs ? extra.obs : 'Folga por troca';
  const todayIso=WEEK_DATES[curDay].toISOString().split('T')[0];
  const trocaDe=extra.trocaDe || '';
  const trabalhouIso=extra.trabData || _ptBrToIso(trocaDe) || todayIso;
  const folgaIso=extra.folgaData || extra.folga || todayIso;
  const trabalhouFmt=trabalhouIso ? _isoToPtBr(trabalhouIso) : trocaDe;
  const idSafe=f.id.replace(/'/g,"\'");
  const workedIsoSafe=String(trabalhouIso||'').replace(/'/g,"\'");
  const folgaIsoSafe=String(folgaIso||todayIso).replace(/'/g,"\'");
  return `<div class="emp-card has-status" style="opacity:.55;border-left:3px solid #1abc9c;">
    <div class="emp-top">
      <div>
        <button class="emp-name-btn" onclick="openFicha('${f.nome.replace(/'/g,"\'")}')">
          <div class="emp-name">${f.nome}</div>
        </button>
        <div class="emp-meta">${f.categoria}</div>
        <div style="font-size:10px;color:#1abc9c;margin-top:3px">🔄 TROCA FOLGA${trabalhouFmt?' · trabalhou em '+trabalhouFmt:''}</div>
        <div style="font-size:10px;color:var(--sub);margin-top:2px">📝 ${obs}</div>
      </div>
      <div class="emp-badges"><span class="badge badge-troca-dom">🔄 TROCA FOLGA</span></div>
    </div>
    <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">
      <button onclick="event.stopPropagation();_editTrocaFolgaComp('${idSafe}','${folgaIsoSafe}','${workedIsoSafe}')" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--s3);color:var(--sub);cursor:pointer;font-family:Barlow,sans-serif">✏️ Editar</button>
      <button onclick="event.stopPropagation();_cancelTrocaFolgaComp('${idSafe}','${folgaIsoSafe}','${workedIsoSafe}')" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid #e74c3c33;background:transparent;color:#e74c3c;cursor:pointer;font-family:Barlow,sans-serif">🗑️</button>
    </div>
  </div>`;
}
function _openFicha(id){const f=EQUIPE.find(x=>x.id===id);if(f)openFicha(f.nome);}
function _openFolga(id,dayIdx,edit){
  const f=EQUIPE.find(x=>x.id===id);
  if(!f)return;
  const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
  const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+dateStr;
  openFolgaModalById(f,dayIdx,edit,folgaKey);
}
function _ptBrToIso(v){
  if(!v) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)){
    const [d,m,y]=v.split('/');
    return `${y}-${m}-${d}`;
  }
  return '';
}
function _isoToPtBr(v){
  if(!v) return '';
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){
    const [y,m,d]=v.split('-');
    return `${d}/${m}/${y}`;
  }
  return v;
}
function _findTrocaOrigemByFolga(id, folgaIso, workedIsoHint){
  const f=EQUIPE.find(x=>x.id===id);
  if(!f)return null;

  const workedIsoNorm=_ptBrToIso(workedIsoHint);
  const folgaIsoNorm=_ptBrToIso(folgaIso);

  const mkOrigin=(workedIso, rec)=>{
    const iso=_ptBrToIso(workedIso);
    if(!iso) return null;
    let dayIdx=-1;
    for(let i=0;i<WEEK_DATES.length;i++){
      if(WEEK_DATES[i].toISOString().split('T')[0]===iso){ dayIdx=i; break; }
    }
    if(dayIdx<0) return null;
    const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
    const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+dateStr;
    return {f,dayIdx,folgaKey,rec:rec||load(folgaKey,null)||null,workedIso:iso,folgaIso:folgaIsoNorm};
  };

  if(workedIsoNorm){
    const byHint=mkOrigin(workedIsoNorm);
    if(byHint) return byHint;
  }

  for(let i=0;i<WEEK_DATES.length;i++){
    const dateStr=WEEK_DATES[i].toLocaleDateString('pt-BR');
    const folgaKey='folga_'+f.id+'_'+i+'_'+dateStr;
    const rec=load(folgaKey,null);
    if(rec&&rec.tipo==='troca'){
      const recFolgaIso=_ptBrToIso(rec.trocaDia);
      if(!folgaIsoNorm || recFolgaIso===folgaIsoNorm){
        return {f,dayIdx:i,folgaKey,rec,workedIso:WEEK_DATES[i].toISOString().split('T')[0],folgaIso:recFolgaIso};
      }
    }
  }

  for(let i=0;i<WEEK_DATES.length;i++){
    const workedIso=WEEK_DATES[i].toISOString().split('T')[0];
    const drKey='drec_'+f.nome+'_'+workedIso;
    const drRec=load(drKey,null);
    if(!drRec || drRec.status!=='troca-folga') continue;
    const ex=drRec.extra||{};
    const recWorkedIso=_ptBrToIso(ex.trabData) || workedIso;
    const recFolgaIso=_ptBrToIso(ex.folgaData) || _ptBrToIso(ex.folga) || _ptBrToIso(ex.folgaEm);
    if((!folgaIsoNorm || recFolgaIso===folgaIsoNorm) && recWorkedIso){
      const byWorked=mkOrigin(recWorkedIso);
      if(byWorked) return byWorked;
    }
  }

  if(folgaIsoNorm){
    const futureDrKey='drec_'+f.nome+'_'+folgaIsoNorm;
    const futureDrRec=load(futureDrKey,null);
    if(futureDrRec && futureDrRec.status==='troca-folga'){
      const ex=futureDrRec.extra||{};
      const recWorkedIso=_ptBrToIso(ex.trabData) || _ptBrToIso(ex.trocaDe);
      const byFuture=mkOrigin(recWorkedIso);
      if(byFuture) return byFuture;
    }
  }
  return null;
}
function _removeTrocaLinks(nome, workedIso, folgaIso){
  const workedDate=new Date(workedIso+'T00:00:00');
  const workedIdx=((workedDate.getDay()+6)%7);
  const workedPt=workedDate.toLocaleDateString('pt-BR');
  const futureDrKey='drec_'+nome+'_'+folgaIso;
  delete _fbCache[futureDrKey];
  if(fbDb&&fbConnected){
    fbDb.ref('presenca/'+WEEK_KEY+'/'+fbEncode(futureDrKey)).remove();
  }
  const workedDrec='drec_'+nome+'_'+workedIso;
  const workedRec=load(workedDrec,null)||{};
  const extra=(workedRec.extra||{});
  delete extra.domTipo;
  delete extra.folgaEm;
  delete extra.folgaTrabalhada;
  if(!extra.obs || String(extra.obs).indexOf('TROCA FOLGA')===0) delete extra.obs;
  setRec(workedIdx,nome,'presente',extra);
  bridgeSaveByDate(nome,workedIdx,'presente',extra);
  const trocaKey=fbEncode('troca_'+nome+'_'+workedIso);
  if(fbDb&&fbConnected){
    fbDb.ref('trocas/'+trocaKey).remove().then(()=>{
      if(document.getElementById('trocasPanel').classList.contains('open')) buildTrocasPanel();
      if(gToken&&SHEET_ID) syncTrocasSheet().catch(()=>{});
    }).catch(()=>{});
  }
}
function _editTrocaFolgaComp(id, folgaIso, workedIsoHint){
  const origem=_findTrocaOrigemByFolga(id, folgaIso, workedIsoHint);
  if(!origem){showToast('⚠️ Não foi possível localizar a troca original para editar');return;}
  _openFolga(id,origem.dayIdx,true);
}
function _cancelTrocaFolgaComp(id, folgaIso, workedIsoHint){
  const origem=_findTrocaOrigemByFolga(id, folgaIso, workedIsoHint);
  if(!origem){showToast('⚠️ Não foi possível localizar a troca original para cancelar');return;}
  if(!confirm('Cancelar esta troca de folga?'))return;
  delete _fbCache[origem.folgaKey];
  if(fbDb&&fbConnected){
    fbDb.ref('presenca/'+WEEK_KEY+'/'+fbEncode(origem.folgaKey)).remove();
  }
  const workedIso=WEEK_DATES[origem.dayIdx].toISOString().split('T')[0];
  _removeTrocaLinks(origem.f.nome, workedIso, folgaIso);
  buildMain();
  refreshPendBadge();
  showToast('🗑️ Troca de folga cancelada');
}
function _clearFolga(id,dayIdx){
  const f=EQUIPE.find(x=>x.id===id);
  if(!f)return;
  const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
  const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+dateStr;
  // Remove do cache em memória
  delete _fbCache[folgaKey];
  // Remove do Firebase
  if(fbDb&&fbConnected){
    fbDb.ref('presenca/'+WEEK_KEY+'/'+fbEncode(folgaKey)).remove();
  }
  setRec(dayIdx,f.nome,'',{});
  buildMain();
  showToast('🗑️ Registro de folga removido');
}

function buildLicencaCard(f){
  return '<div class="emp-card" style="opacity:.5;border-left:3px solid #2980b9"><div class="emp-top"><div><button class="emp-name-btn" onclick="openFicha(\''+f.nome.replace(/'/g,"\\'")+'\')"><div class="emp-name">'+f.nome+'</div></button><div class="emp-meta">'+f.categoria+'</div></div><div class="emp-badges"><span class="badge badge-licenca">🏥 LICENÇA</span></div></div></div>';
}

// Conta quantos dias consecutivos de falta o funcionário teve ANTES do dia atual
function contarFaltasConsecutivas(nome){
  const hoje=new Date();
  let count=0;
  // Verifica dias anteriores ao dia atual (até 30 dias atrás)
  for(let i=1;i<=30;i++){
    const d=new Date(hoje);
    d.setDate(hoje.getDate()-i);
    const key=`drec_${nome}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const rec=load(key,null);
    // Se faltou nesse dia, incrementa
    if(rec&&rec.status==='falta'){
      count++;
    } else if(rec&&rec.status){
      // Teve outro registro (presente, atestado, etc) — para a contagem
      break;
    } else {
      // Sem registro — verifica se era dia de trabalho (não folga)
      const f=EQUIPE.find(x=>x.nome===nome);
      if(!f)break;
      const diaSem=['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()];
      if(isFolgaSemanal(f,diaSem)||f.turno==='LICENÇA'){
        // Era folga ou licença — ignora e continua
        continue;
      }
      // Dia de trabalho sem registro — para a contagem
      break;
    }
  }
  return count;
}

function buildCard(f){
  // getRec já busca drec_ como primário e chave simples como fallback
  const r=getRec(curDay,f.nome);
  const st=r.status;
  const stObj=STATUS.find(s=>s.id===st);
  const pend=getPendencias().find(p=>p.func.nome===f.nome);
  const justs=getJusts(f.nome);
  const temJusta=justs.some(j=>j.medida==='Justa causa');
  const badgeTxt=stObj?(stObj.emoji+' '+stObj.label.toUpperCase()):'SEM REGISTRO';
  const badgeCls=st?'badge-'+st:'badge-vazio';

  // Badge de faltas consecutivas (dias anteriores)
  let faltasBadge='';
  const diasFalta=contarFaltasConsecutivas(f.nome);
  if(diasFalta>=3){
    faltasBadge=`<span class="badge badge-falta-seq3">${diasFalta} FALTAS SEGUIDAS</span>`;
  } else if(diasFalta===2){
    faltasBadge='<span class="badge badge-falta-seq2">2 FALTAS SEGUIDAS</span>';
  } else if(diasFalta===1){
    faltasBadge='<span class="badge badge-falta-seq1">FALTOU ONTEM</span>';
  }

  let extraBadges='';
  if(pend)extraBadges+='<span class="badge badge-pending">'+pend.dias.length+' FALTA</span>';
  if(temJusta)extraBadges+='<span class="badge badge-justa">🚨</span>';
  const btns=STATUS.map(s=>'<button class="sbtn'+(st===s.id?' sel-'+s.id:'')+'" onclick="selectStatus(\''+f.nome.replace(/'/g,"\\'")+'\''+',\''+s.id+'\')">'+s.emoji+'<br><span style="font-size:10px">'+s.label+'</span></button>').join('');

  // Atestado, falta ou troca-folga já salvos → card compacto sem botões e sem destaque
  const atestadoSalvo   = st==='atestado'    && r.extra && (r.extra.ini || r.extra.obs);
  const faltaSalva      = st==='falta'       && r.extra && r.extra._saved;
  const trocaFolgaSalva = st==='troca-folga';

  if(atestadoSalvo || faltaSalva || trocaFolgaSalva){
    const corBorda  = st==='atestado'?'#2980b9':st==='troca-folga'?'#8e44ad':'#e74c3c';
    const badgeCls2 = st==='atestado'?'badge-atestado':st==='troca-folga'?'badge-troca-folga':'badge-falta';
    const ex2 = (r.extra && typeof r.extra==='object') ? r.extra : {};
    const nomeSafe = f.nome.replace(/'/g,"\\'");
    const rawId = f.nome.replace(/ /g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    const saveBtn2 = '<button class="save-btn" onclick="saveRec(\''+nomeSafe+'\',\''+st+'\')">💾 SALVAR</button>';
    const editBtn2 = '<button onclick="editTrocaFolga(\''+nomeSafe+'\'" style="background:none;border:1.5px solid var(--border);color:var(--sub);border-radius:9px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;margin-top:6px;width:100%">✏️ Editar</button>';

    let extraHtml = '';
    if(st==='troca-folga'){
      const fmt=d=>{if(!d)return'';const p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
      const temDados2 = ex2.trabData||ex2.folgaData||ex2.trab||ex2.folga||ex2.trocaDe||(ex2.obs&&ex2.obs.length>0)||ex2._saved;
      const botoes2 = '<div style="display:flex;gap:8px;margin-top:8px">'+
        '<button onclick="editTrocaFolga(\''+nomeSafe+'\')" style="flex:1;background:none;border:1.5px solid #8e44ad;color:#8e44ad;border-radius:9px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">✏️ Editar</button>'+
        '<button onclick="cancelarTrocaFolga(\''+nomeSafe+'\')" style="flex:1;background:none;border:1.5px solid #e74c3c;color:#e74c3c;border-radius:9px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">❌ Cancelar</button>'+
        '</div>';
      if(temDados2){
        let info='🔄 Troca de folga';
        if(ex2.trabData) info+='<br>💼 Trabalhou: '+fmt(ex2.trabData);
        else if(ex2.trab) info+='<br>💼 Trabalhou: '+ex2.trab;
        else if(ex2.trocaDe) info+='<br>📅 Trab. em: '+ex2.trocaDe;
        if(ex2.folgaData) info+='<br>🏖️ Folga em: '+fmt(ex2.folgaData);
        else if(ex2.folga) info+='<br>🏖️ Folga em: '+ex2.folga;
        else if(ex2.folgaEm) info+='<br>🏖️ Folga em: '+ex2.folgaEm;
        if(ex2.quem) info+='<br>👤 '+ex2.quem;
        extraHtml='<div class="saved-info">'+info+botoes2+'</div>';
      } else {
        const ano=new Date().getFullYear();
        const min=ano+'-01-01',max=ano+'-12-31';
        extraHtml='<div class="extra-fields">'+
          '<div class="field-row">'+
            '<div class="field-wrap"><span class="field-label">💼 Vai TRABALHAR no dia</span>'+
            '<input class="field-input" type="date" id="f_tf_trab_'+rawId+'" min="'+min+'" max="'+max+'"></div>'+
            '<div class="field-wrap"><span class="field-label">🏖️ Vai FOLGAR no dia</span>'+
            '<input class="field-input" type="date" id="f_tf_folga_'+rawId+'" min="'+min+'" max="'+max+'"></div>'+
          '</div>'+
          '<div class="field-wrap"><span class="field-label">👤 Autorizado por</span>'+
          '<input class="field-input" id="f_tf_quem_'+rawId+'" placeholder="Nome do gestor..."></div>'+
          saveBtn2+
          '<button onclick="cancelarTrocaFolga(\''+nomeSafe+'\')" style="width:100%;margin-top:6px;background:none;border:1.5px solid #e74c3c;color:#e74c3c;border-radius:9px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">❌ Cancelar troca</button>'+
          '</div>';
      }
    } else {
      extraHtml = buildExtra(f.nome,st,ex2);
    }

    return '<div class="emp-card" id="card_'+f.nome.replace(/ /g,'_')+'" style="opacity:.75;border-left:3px solid '+corBorda+'">'+
      '<div class="emp-top">'+
        '<div><button class="emp-name-btn" onclick="openFicha(\''+nomeSafe+'\')"><div class="emp-name">'+f.nome+'</div></button>'+
        '<div class="emp-meta">'+f.categoria+' · '+(f.horIni||'')+(f.horFim?' às '+f.horFim:'')+'</div></div>'+
        '<div class="emp-badges">'+faltasBadge+'<span class="badge '+badgeCls2+'">'+badgeTxt+'</span>'+extraBadges+'</div>'+
      '</div>'+
      extraHtml+
    '</div>';
  }

  return '<div class="emp-card'+(st?' has-status st-'+st:'')+'" id="card_'+f.nome.replace(/ /g,'_')+'">'+
    '<div class="emp-top">'+
      '<div><button class="emp-name-btn" onclick="openFicha(\''+f.nome.replace(/'/g,"\\'")+'\')" ><div class="emp-name">'+f.nome+'</div></button>'+
      '<div class="emp-meta">'+f.categoria+' · '+(f.horIni||'')+(f.horFim?' às '+f.horFim:'')+'</div></div>'+
      '<div class="emp-badges">'+faltasBadge+'<span class="badge '+badgeCls+'">'+badgeTxt+'</span>'+extraBadges+'</div>'+
    '</div>'+
    '<div class="status-btns">'+btns+'</div>'+
    buildExtra(f.nome,st,r.extra||{})+
    buildSavedInfo(st,r.extra||{})+
  '</div>';
}

function buildExtra(name,st,ex){
  const id=name.replace(/ /g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  if(!st||st==='presente')return '';
  const saveBtn='<button class="save-btn" onclick="saveRec(\''+name.replace(/'/g,"\\'")+'\',\''+st+'\')">💾 SALVAR</button>';
  const editBtn='<button onclick="selectStatus(\''+name.replace(/'/g,"\\'")+'\',\''+st+'\')" style="background:none;border:1.5px solid var(--border);color:var(--sub);border-radius:9px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;margin-top:6px;width:100%">✏️ Editar</button>';

  if(st==='falta'){
    if(ex && ex._saved){
      // Já salvo — mostrar resumo compacto
      return '<div class="saved-info">'+(ex.obs?'⚠️ '+ex.obs:'❌ Falta registrada')+editBtn+'</div>';
    }
    return '<div class="extra-fields"><div class="field-wrap"><span class="field-label">⚠️ Medida disciplinar (opcional)</span><input class="field-input" id="f_falta_'+id+'" placeholder="Ex: Advertência verbal..." value="'+(ex.obs||'')+'"></div>'+saveBtn+'</div>';
  }
  if(st==='atestado'){
    if(ex && (ex.ini || ex.obs)){
      // Já salvo — mostrar resumo compacto
      let info='🏥 Atestado';
      if(ex.ini&&ex.fim) info+='<br>📅 '+ex.ini+' até '+ex.fim;
      if(ex.dias) info+='<br>🔢 '+ex.dias+' dia(s)';
      if(ex.obs) info+='<br>📝 '+ex.obs;
      return '<div class="saved-info">'+info+editBtn+'</div>';
    }
    return '<div class="extra-fields"><div class="field-row"><div class="field-wrap"><span class="field-label">📅 Início</span><input class="field-input" type="date" id="f_at_ini_'+id+'" value="'+(ex.ini||'')+'"></div><div class="field-wrap"><span class="field-label">📅 Fim</span><input class="field-input" type="date" id="f_at_fim_'+id+'" value="'+(ex.fim||'')+'"></div></div><div class="field-wrap"><span class="field-label">🔢 Dias</span><input class="field-input" type="number" min="1" id="f_at_dias_'+id+'" value="'+(ex.dias||'')+'"></div><div class="field-wrap"><span class="field-label">📝 CID / Obs</span><input class="field-input" id="f_at_obs_'+id+'" value="'+(ex.obs||'')+'"></div>'+saveBtn+'</div>';
  }
  if(st==='troca-horario')return '<div class="extra-fields"><div class="field-row"><div class="field-wrap"><span class="field-label">🕐 Novo início</span><input class="field-input" type="time" id="f_thi_'+id+'" value="'+(ex.ini||'')+'"></div><div class="field-wrap"><span class="field-label">🕐 Novo fim</span><input class="field-input" type="time" id="f_thf_'+id+'" value="'+(ex.fim||'')+'"></div></div><div class="field-wrap"><span class="field-label">👤 Com quem</span><input class="field-input" id="f_th_quem_'+id+'" value="'+(ex.quem||'')+'"></div><div class="field-wrap"><span class="field-label">📝 Motivo</span><input class="field-input" id="f_th_obs_'+id+'" value="'+(ex.obs||'')+'"></div>'+saveBtn+'</div>';
  if(st==='troca-folga'){
    const temDados = ex && (ex.trabData||ex.folgaData||ex.trab||ex.folga||ex.trocaDe||(ex.obs&&ex.obs.length>0)||ex._saved);
    if(temDados){
      // Resumo compacto com editBtn
      const fmt=d=>{if(!d)return'';const p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
      let info='🔄 Troca de folga';
      if(ex.trabData) info+='<br>💼 Trabalhou: '+fmt(ex.trabData);
      else if(ex.trab) info+='<br>💼 Trabalhou: '+ex.trab;
      else if(ex.trocaDe) info+='<br>💼 Trabalhou: '+ex.trocaDe;
      if(ex.folgaData) info+='<br>🏖️ Folga em: '+fmt(ex.folgaData);
      else if(ex.folga) info+='<br>🏖️ Folga em: '+ex.folga;
      if(ex.folgaEm) info+='<br>🏖️ Folga em: '+ex.folgaEm;
      if(ex.quem) info+='<br>👤 '+ex.quem;
      return '<div class="saved-info">'+info+editBtn+'</div>';
    }
    // Sem dados: campos para preencher
    const hoje=new Date(),ano=hoje.getFullYear();
    const min=ano+'-01-01', max=ano+'-12-31';
    return `<div class="extra-fields">
      <div class="field-row">
        <div class="field-wrap"><span class="field-label">💼 Dia que VAI TRABALHAR</span>
          <input class="field-input" type="date" id="f_tf_trab_${id}" min="${min}" max="${max}" value="${ex.trabData||''}">
        </div>
        <div class="field-wrap"><span class="field-label">🏖️ Dia que VAI FOLGAR</span>
          <input class="field-input" type="date" id="f_tf_folga_${id}" min="${min}" max="${max}" value="${ex.folgaData||''}">
        </div>
      </div>
      <div class="field-wrap"><span class="field-label">👤 Autorizado por</span>
        <input class="field-input" id="f_tf_quem_${id}" value="${ex.quem||''}" placeholder="Nome do gestor...">
      </div>
      ${saveBtn}
    </div>`;
  }
  if(st==='medida')return '<div class="extra-fields"><div class="field-wrap"><span class="field-label">❌ Motivo</span><input class="field-input" id="f_med_mot_'+id+'" value="'+(ex.motivo||'')+'"></div><div class="field-wrap"><span class="field-label">⚠️ Medida</span><input class="field-input" id="f_med_acao_'+id+'" value="'+(ex.acao||'')+'"></div><div class="field-wrap"><span class="field-label">👤 Registrado por</span><input class="field-input" id="f_med_resp_'+id+'" value="'+(ex.resp||'')+'"></div>'+saveBtn+'</div>';
  if(st==='saida-antecipada')return `<div class="extra-fields">
    <div class="field-row">
      <div class="field-wrap"><span class="field-label">🚪 Saiu às</span><input class="field-input" type="time" id="f_sa_hor_${id}" value="${ex.horSaida||''}"></div>
      <div class="field-wrap"><span class="field-label">🕐 Deveria sair</span><input class="field-input" type="time" id="f_sa_prev_${id}" value="${ex.horPrev||''}"></div>
    </div>
    <div class="field-wrap"><span class="field-label">📝 Justificativa</span>
      <select class="field-input" id="f_sa_just_${id}">
        <option value="Acordo com gestor"${ex.justificativa==='Acordo com gestor'?' selected':''}>Acordo com gestor</option>
        <option value="Motivo pessoal"${ex.justificativa==='Motivo pessoal'?' selected':''}>Motivo pessoal</option>
        <option value="Médico/consulta"${ex.justificativa==='Médico/consulta'?' selected':''}>Médico/consulta</option>
        <option value="Emergência familiar"${ex.justificativa==='Emergência familiar'?' selected':''}>Emergência familiar</option>
        <option value="Sem justificativa"${ex.justificativa==='Sem justificativa'?' selected':''}>Sem justificativa</option>
      </select>
    </div>
    <div class="field-wrap"><span class="field-label">👤 Autorizado por</span><input class="field-input" id="f_sa_auth_${id}" placeholder="Nome do gestor..." value="${ex.autorizadoPor||''}"></div>
    ${saveBtn}
  </div>`;
  if(st==='banco-horas'){
    const hoje=new Date();
    const ano=hoje.getFullYear();
    const mes=String(hoje.getMonth()+1).padStart(2,'0');
    const min=`${ano}-${mes}-01`;
    const max=`${ano}-${mes}-${new Date(ano,hoje.getMonth()+1,0).getDate()}`;
    // Calcula horas automaticamente ao preencher entrada/saída
    return `<div class="extra-fields">
      <div class="field-row">
        <div class="field-wrap">
          <span class="field-label">⏱️ Tipo</span>
          <select class="field-input" id="f_bh_tipo_${id}">
            <option value="CRÉDITO"${ex.tipo==='CRÉDITO'?' selected':''}>➕ CRÉDITO</option>
            <option value="DÉBITO"${ex.tipo==='DÉBITO'?' selected':''}>➖ DÉBITO</option>
          </select>
        </div>
        <div class="field-wrap">
          <span class="field-label">📅 Data do registro</span>
          <input class="field-input" type="date" id="f_bh_data_${id}" min="${min}" max="${max}"
            value="${ex.dataRegistro||''}" style="font-size:14px;padding:10px 12px;cursor:pointer">
        </div>
      </div>
      <div style="background:var(--s1);border-radius:10px;padding:10px 12px;margin-bottom:2px">
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:8px">🕐 PERÍODO TRABALHADO</div>
        <div class="field-row">
          <div class="field-wrap"><span class="field-label">Entrada</span>
            <input class="field-input" type="time" id="f_bh_ini_${id}" value="${ex.horIni||''}"
              oninput="calcBH('${id}')">
          </div>
          <div class="field-wrap"><span class="field-label">Saída</span>
            <input class="field-input" type="time" id="f_bh_fim_${id}" value="${ex.horFim||''}"
              oninput="calcBH('${id}')">
          </div>
        </div>
        <div id="f_bh_calc_${id}" style="text-align:center;margin-top:8px;font-size:13px;font-weight:700;color:var(--accent);min-height:20px">
          ${ex.horIni&&ex.horFim?calcBHDisplay(ex.horIni,ex.horFim):''}
        </div>
      </div>
      <div class="field-row" style="margin-top:8px">
        <div class="field-wrap">
          <span class="field-label">⌛ Horas (manual)</span>
          <input class="field-input" type="number" step="0.5" min="0.5" max="24" id="f_bh_horas_${id}"
            placeholder="Ex: 2.5" value="${ex.horas||''}">
        </div>
        <div class="field-wrap">
          <span class="field-label">📋 Período</span>
          <select class="field-input" id="f_bh_periodo_${id}">
            <option value=""${!ex.periodo?' selected':''}>— Selecionar —</option>
            <option value="Manhã"${ex.periodo==='Manhã'?' selected':''}>🌅 Manhã</option>
            <option value="Tarde"${ex.periodo==='Tarde'?' selected':''}>☀️ Tarde</option>
            <option value="Noite"${ex.periodo==='Noite'?' selected':''}>🌙 Noite</option>
            <option value="Dia todo"${ex.periodo==='Dia todo'?' selected':''}>📅 Dia todo</option>
            <option value="Hora extra"${ex.periodo==='Hora extra'?' selected':''}>⚡ Hora extra</option>
          </select>
        </div>
      </div>
      <div class="field-wrap"><span class="field-label">📝 Motivo / Observação</span>
        <input class="field-input" id="f_bh_obs_${id}" placeholder="Ex: Ficou além do horário, cobertura..." value="${ex.obs||''}">
      </div>
      ${saveBtn}
    </div>`;
  }
  return '';
}

// ─── Helpers Banco de Horas ───
function calcBHDisplay(ini,fim){
  if(!ini||!fim)return '';
  const [ih,im]=ini.split(':').map(Number);
  const [fh,fm]=fim.split(':').map(Number);
  let diff=(fh*60+fm)-(ih*60+im);
  if(diff<0)diff+=24*60;
  const h=Math.floor(diff/60);
  const m=diff%60;
  return `⏱️ ${h}h${m>0?m+'min':''} calculado`;
}
function calcBH(id){
  const ini=(document.getElementById('f_bh_ini_'+id)||{}).value||'';
  const fim=(document.getElementById('f_bh_fim_'+id)||{}).value||'';
  const txt=calcBHDisplay(ini,fim);
  const el=document.getElementById('f_bh_calc_'+id);
  if(el)el.textContent=txt;
  // Auto-preenche campo horas
  if(ini&&fim){
    const [ih,im]=ini.split(':').map(Number);
    const [fh,fm]=fim.split(':').map(Number);
    let diff=(fh*60+fm)-(ih*60+im);
    if(diff<0)diff+=24*60;
    const horasEl=document.getElementById('f_bh_horas_'+id);
    if(horasEl&&!horasEl.value)horasEl.value=(diff/60).toFixed(1);
  }
}

function buildSavedInfo(st,ex){
  if(!st||!Object.keys(ex).length)return '';
  let lines=[];
  // PRESENTE com troca de folga — mostra info da troca
  if(st==='presente'&&ex.domTipo==='troca'&&ex.folgaEm){
    lines.push('🔄 TROCA FOLGA — folga em '+ex.folgaEm);
    if(ex.obs&&!ex.obs.startsWith('TROCA FOLGA'))lines.push('📝 '+ex.obs);
  } else if(st==='presente'){
    return ''; // presente sem info extra → não mostra nada
  }
  if(st==='falta'&&ex.obs)lines.push('⚠️ '+ex.obs);
  if(st==='atestado'){if(ex.ini||ex.fim)lines.push('📅 '+(ex.ini||'?')+' até '+(ex.fim||'?'));if(ex.dias)lines.push('🔢 '+ex.dias+' dia(s)');if(ex.obs)lines.push('📝 '+ex.obs);}
  if(st==='troca-horario'){if(ex.ini||ex.fim)lines.push('🕐 '+(ex.ini||'?')+' às '+(ex.fim||'?'));if(ex.quem)lines.push('👤 '+ex.quem);}
  if(st==='troca-folga'){
    if(ex.trab)lines.push('📅 Trabalhou: '+ex.trab);
    if(ex.folga)lines.push('🏖️ Folga em: '+ex.folga);
    if(ex.quem)lines.push('👤 '+ex.quem);
    if(ex.obs)lines.push('📝 '+ex.obs);
  }
  if(st==='medida'){if(ex.motivo)lines.push('❌ '+ex.motivo);if(ex.acao)lines.push('⚠️ '+ex.acao);if(ex.resp)lines.push('👤 '+ex.resp);}
  if(st==='saida-antecipada'){
    if(ex.horSaida)lines.push('🚪 Saiu às '+ex.horSaida+(ex.horPrev?' (prev. '+ex.horPrev+')':''));
    if(ex.justificativa)lines.push('📝 '+ex.justificativa);
    if(ex.autorizadoPor)lines.push('👤 Auth: '+ex.autorizadoPor);
  }
  if(st==='banco-horas'){
    if(ex.tipo&&ex.horas)lines.push((ex.tipo==='CRÉDITO'?'➕':'➖')+' '+ex.horas+'h — '+ex.tipo);
    if(ex.dataFormatada)lines.push('📅 '+ex.dataFormatada);
    if(ex.periodo)lines.push('🕐 '+ex.periodo);
    if(ex.horIni||ex.horFim)lines.push('⏰ '+(ex.horIni||'?')+' às '+(ex.horFim||'?'));
    if(ex.obs)lines.push('📝 '+ex.obs);
  }
  if(!lines.length)return '';
  return '<div class="saved-info">'+lines.map(l=>'<div>'+l+'</div>').join('')+'</div>';
}

// ═══════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════

function openTrocaFolgaFromCard(name){
  const f=EQUIPE.find(x=>x.nome===name);
  if(!f)return;
  const dayIdx=curDay;
  const workDate=WEEK_DATES[dayIdx];
  const workIso=workDate.toISOString().split('T')[0];
  const dateStr=workDate.toLocaleDateString('pt-BR');
  const diaNome=DAY_NAMES[dayIdx];

  document.getElementById('domFolgaTitle').textContent='TROCA DE FOLGA';
  document.getElementById('domFolgaInfo').innerHTML=
    `<strong>${f.nome}</strong><br>`+
    `${diaNome}, ${dateStr}<br>`+
    `<span style="color:var(--sub)">${f.categoria+' · '+f.turno}</span><br>`+
    `<span style="color:#1abc9c;font-size:11px">🔄 Informe o dia que vai trabalhar e o dia que vai folgar</span>`;
  document.getElementById('dom_fname').value=f.nome;
  document.getElementById('dom_dayidx').value=dayIdx;
  document.getElementById('dom_folgakey').value='folga_'+f.id+'_'+dayIdx+'_'+dateStr;

  ['dom_pres_obs','dom_comp_valor','dom_comp_auth','dom_comp_obs',
   'dom_troca_trab','dom_troca_dia','dom_troca_auth','dom_troca_obs','dom_falta_obs',
   'dom_comp_ini','dom_comp_fim','dom_troca_ini','dom_troca_fim'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('dom_comp_tipo').value='Pagamento em dinheiro';

  const next=new Date(workDate); next.setDate(next.getDate()+1);
  const trabEl=document.getElementById('dom_troca_trab');
  const folgaEl=document.getElementById('dom_troca_dia');
  if(trabEl) trabEl.value=workIso;
  if(folgaEl) folgaEl.value=next.toISOString().split('T')[0];

  setDomTipo('troca');
  openModal('domFolgaModal');
}

function selectStatus(name,newSt){
  const r=getRec(curDay,name);
  const status=r.status===newSt?'':newSt;
  const extra=status===''||status==='presente'?{}:r.extra||{};
  // Quando desmarca (status vazio), remove do Firebase em vez de salvar vazio
  if(status===''){
    const d=WEEK_DATES[curDay];
    const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dkDate=`drec_${name}_${iso}`;
    const wk=getWeekKey(weekOffset);
    delete _fbCache[dkDate]; delete _fbCache[curDay+'_'+name];
    if(fbDb&&fbConnected){
      fbDb.ref('presenca/'+wk+'/'+fbEncode(dkDate)).remove();
      fbDb.ref('presenca/'+wk+'/'+fbEncode(curDay+'_'+name)).remove();
    }
    buildMain(); refreshPendBadge(); buildSummary();
    if(gToken&&SHEET_ID) enqueueSyncCell(name,d.getDate());
    return;
  }

  // Falta, atestado e troca-folga precisam de campos extras
  // Se já tem dados extras, mantém. Se não tem, salva só o status e mostra campos
  if(status==='troca-folga'){
    openTrocaFolgaFromCard(name);
    return;
  }
  if(status==='falta'||status==='atestado'){
    const dadosExistentes = r.status===status ? r.extra||{} : {};
    setRec(curDay,name,status,dadosExistentes);
    buildMain();refreshPendBadge();
    // Scroll para o card para ver os campos
    setTimeout(()=>{
      const card=document.getElementById('card_'+name.replace(/ /g,'_'));
      if(card) card.scrollIntoView({behavior:'smooth',block:'center'});
    },100);
    return;
  }

  setRec(curDay,name,status,extra);
  bridgeSaveByDate(name,curDay,status,extra);
  if(status==='presente')showToast('✅ Presente registrado!');
  else if(!status)showToast('Registro removido');
  buildMain();refreshPendBadge();
}
function cancelarTrocaFolga(name){
  if(!confirm('Cancelar troca de folga de '+name+'?')) return;
  setRec(curDay, name, '', {});
  bridgeSaveByDate(name, curDay, '', {});
  buildMain(); refreshPendBadge();
  showToast('Troca de folga cancelada');
}

function editTrocaFolga(name){
  openTrocaFolgaFromCard(name);
}

function saveRec(name,st){
  const rawId=name.replace(/ /g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  const v=sel=>(document.getElementById(sel)||{}).value||'';
  let ex={};
  if(st==='falta')            ex={obs:v('f_falta_'+rawId), _saved:true};
  if(st==='atestado')         ex={ini:v('f_at_ini_'+rawId),fim:v('f_at_fim_'+rawId),dias:v('f_at_dias_'+rawId),obs:v('f_at_obs_'+rawId), _saved:true};
  if(st==='troca-horario')    ex={ini:v('f_thi_'+rawId),fim:v('f_thf_'+rawId),quem:v('f_th_quem_'+rawId),obs:v('f_th_obs_'+rawId)};
  if(st==='troca-folga'){
    const trabData=v('f_tf_trab_'+rawId);
    const folgaData=v('f_tf_folga_'+rawId);
    const fmt=d=>{if(!d)return'';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
    ex={trabData,folgaData,trab:fmt(trabData),folga:fmt(folgaData),quem:v('f_tf_quem_'+rawId),_saved:true};
  }
  if(st==='medida')           ex={motivo:v('f_med_mot_'+rawId),acao:v('f_med_acao_'+rawId),resp:v('f_med_resp_'+rawId)};
  if(st==='saida-antecipada') ex={horSaida:v('f_sa_hor_'+rawId),horPrev:v('f_sa_prev_'+rawId),justificativa:v('f_sa_just_'+rawId),autorizadoPor:v('f_sa_auth_'+rawId)};
  if(st==='banco-horas'){
    const ini=v('f_bh_ini_'+rawId);
    const fim=v('f_bh_fim_'+rawId);
    // Auto-calcula horas se entrada/saída preenchidas
    let horas=v('f_bh_horas_'+rawId);
    if(ini&&fim&&!horas){
      const [ih,im]=ini.split(':').map(Number);
      const [fh,fm]=fim.split(':').map(Number);
      let diff=(fh*60+fm)-(ih*60+im);
      if(diff<0)diff+=24*60;
      horas=(diff/60).toFixed(1);
    }
    const dataRegistro=v('f_bh_data_'+rawId);
    const fmt=d=>{if(!d)return '';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
    ex={tipo:v('f_bh_tipo_'+rawId),horas,horIni:ini,horFim:fim,dataRegistro,dataFormatada:fmt(dataRegistro),periodo:v('f_bh_periodo_'+rawId),obs:v('f_bh_obs_'+rawId)};
  }
  setRec(curDay,name,st,ex);
  bridgeSaveByDate(name,curDay,st,ex);
  // Se atestado com período, marcar todos os dias da semana dentro do intervalo
  if(st==='atestado' && ex.ini && ex.fim){
    const parseDate = s => { if(!s) return null; const [y,m,d]=s.split('-'); return new Date(y,m-1,d); };
    const iniDate = parseDate(ex.ini);
    const fimDate = parseDate(ex.fim);
    WEEK_DATES.forEach((wd, di) => {
      if(di === curDay) return;
      const wdN = new Date(wd.getFullYear(), wd.getMonth(), wd.getDate());
      if(iniDate && fimDate && wdN >= iniDate && wdN <= fimDate){
        setRec(di, name, 'atestado', ex);
        bridgeSaveByDate(name, di, 'atestado', ex);
      }
    });
  }
  // Se troca-folga, marcar o dia da folga automaticamente na semana atual
  if(st==='troca-folga' && ex.folgaData){
    const parseDate = s => { if(!s) return null; const [y,m,d]=s.split('-'); return new Date(y,m-1,d); };
    const folgaDate = parseDate(ex.folgaData);
    if(folgaDate){
      WEEK_DATES.forEach((wd, di) => {
        if(di === curDay) return;
        const wdN = new Date(wd.getFullYear(), wd.getMonth(), wd.getDate());
        if(folgaDate.getTime() === wdN.getTime()){
          // Marcar o dia de folga como troca-folga (folga compensatória)
          const exFolga = {...ex, tipo:'folga-compensatoria'};
          setRec(di, name, 'troca-folga', exFolga);
          bridgeSaveByDate(name, di, 'troca-folga', exFolga);
        }
      });
    }
  }
  showToast('💾 Salvo!');buildMain();refreshPendBadge();
}

// ═══════════════════════════════════════════════════
// PENDÊNCIAS VIEW
// ═══════════════════════════════════════════════════
function refreshPendBadge(){
  const pends=getPendencias();
  const badge=document.getElementById('pendBadge');
  const total=pends.reduce((a,p)=>a+p.dias.length,0);
  badge.style.display=total>0?'block':'none';
  badge.textContent=total;
}

// Filtro atual do painel de faltas
let _faltasFiltro = 'semana';

function buildPendencias(filtro){
  if(filtro) _faltasFiltro = filtro;
  const f = _faltasFiltro;
  const hoje = new Date();

  // ── Barra de filtros ──────────────────────────────
  const filtros = [
    {k:'hoje',   lbl:'Hoje'},
    {k:'semana', lbl:'Esta semana'},
    {k:'mes',    lbl:'Este mês'},
    {k:'todas',  lbl:'Todas'},
  ];
  const barraFiltros = '<div style="display:flex;gap:6px;padding:10px 16px 6px;flex-wrap:wrap">'
    + filtros.map(x=>`<button class="fbtn${f===x.k?' active':''}" onclick="buildPendencias('${x.k}')">${x.lbl}</button>`).join('')
    + '</div>';

  // ── Coleta todas as faltas conforme filtro ────────
  const entradas = []; // {func, dateStr, dayIdx, iso}

  EQUIPE.forEach(func=>{
    if(func.turno==='LICENÇA') return;

    // Faltas da semana atual (no cache)
    const maxDay = f==='hoje' ? curDay : WEEK_DATES.length - 1;
    const limite = f==='hoje' ? curDay : (f==='semana' ? WEEK_DATES.length-1 : WEEK_DATES.length-1);
    for(let d=0; d<=limite; d++){
      if(func.folga===DAYS[d]) continue;
      const r = getRec(d, func.nome);
      if(r.status!=='falta') continue;
      const dt = WEEK_DATES[d];
      const dateStr = dt.toLocaleDateString('pt-BR');
      const iso = dt.toISOString().split('T')[0];
      // Filtra por mês se necessário
      if(f==='mes' && (dt.getMonth()!==hoje.getMonth()||dt.getFullYear()!==hoje.getFullYear())) continue;
      if(f==='hoje' && d!==curDay) continue;
      if(!entradas.some(e=>e.func.nome===func.nome&&e.dateStr===dateStr))
        entradas.push({func, dateStr, dayIdx:d, iso});
    }

    // Para "mês" e "todas": também busca nas justificativas registradas
    if(f==='mes'||f==='todas'){
      const justs = getJusts(func.nome);
      justs.filter(j=>j.tipo==='falta'&&j.data).forEach(j=>{
        const partes = j.data.split('/');
        if(partes.length<3) return;
        const iso = partes[2]+'-'+partes[1]+'-'+partes[0];
        const dt = new Date(iso);
        if(f==='mes' && (dt.getMonth()!==hoje.getMonth()||dt.getFullYear()!==hoje.getFullYear())) return;
        if(!entradas.some(e=>e.func.nome===func.nome&&e.dateStr===j.data))
          entradas.push({func, dateStr:j.data, dayIdx:-1, iso});
      });
    }
  });

  // ── Ordena por data desc ──────────────────────────
  entradas.sort((a,b)=>b.iso.localeCompare(a.iso));

  // ── Agrupa por funcionário ────────────────────────
  const porFunc = new Map();
  entradas.forEach(e=>{
    if(!porFunc.has(e.func.nome)) porFunc.set(e.func.nome,{func:e.func,dias:[]});
    porFunc.get(e.func.nome).dias.push(e);
  });

  // ── Render ────────────────────────────────────────
  let html = barraFiltros;

  if(!porFunc.size){
    const labels={hoje:'hoje',semana:'esta semana',mes:'este mês',todas:'no histórico'};
    html += '<div class="empty">✅ Nenhuma falta registrada '+(labels[f]||'')+'!</div>';
    document.getElementById('mainContent').innerHTML=html;
    return;
  }

  const totalFaltas = entradas.length;
  html += `<div class="pend-banner">❌ <strong>${totalFaltas} falta(s)</strong> registrada(s)</div>`;

  porFunc.forEach(({func, dias})=>{
    const justs = getJusts(func.nome);
    const temJusta = justs.some(j=>j.medida==='Justa causa');
    html += '<div class="pend-card">';
    const nomeEsc = func.nome.replace(/'/g,"\'");
    html += '<div class="pend-header"><div><button class="emp-name-btn" onclick="openFicha(\'' + nomeEsc + '\')"><div class="pend-name">'+func.nome+(temJusta?' 🚨':'')+'</div></button></div>'
          + '<span class="badge badge-pending">'+dias.length+' FALTA'+(dias.length>1?'S':'')+'</span></div>';
    html += '<div class="pend-meta">'+func.categoria+' · '+func.turno+'</div>';
    html += '<div class="pend-days">';
    dias.forEach(e=>{
      const justified = justs.some(j=>j.data===e.dateStr);
      if(e.dayIdx>=0 && !justified){
        const nJ = func.nome.replace(/'/g,"\'");
        html += '<button class="pend-day" onclick="openJustModal(\'' + nJ + '\',' + e.dayIdx + ')">'+e.dateStr+'</button>';
      } else {
        html += '<span class="pend-day '+(justified?'justificado':'')+'">'+( justified?'✅ ':'')+e.dateStr+'</span>';
      }
    });
    html += '</div>';
    // Progressão disciplinar
    const faltsJust = justs.filter(j=>j.tipo==='falta');
    if(faltsJust.length){
      const motivos=[...new Set(faltsJust.map(j=>j.motivo))];
      motivos.forEach(mot=>{
        const {prog,idx,proxima}=getProgAtual(func.nome,mot);
        const steps=prog.map((s,i)=>{let cls='prog-step';if(i<idx)cls+=' done';else if(i===idx)cls+=' current';return '<div class="'+cls+'" title="'+s+'"></div>';}).join('');
        html+='<div style="margin-top:8px;padding:8px;background:var(--s1);border-radius:8px"><div style="font-size:10px;color:var(--sub);margin-bottom:4px">'+mot+'</div><div class="prog-bar">'+steps+'</div><div style="font-size:11px;color:var(--warn);margin-top:3px">→ '+proxima+'</div></div>';
      });
    }
    html += '</div>';
  });

  document.getElementById('mainContent').innerHTML = html;
}

// ═══════════════════════════════════════════════════
// PAINEL ATESTADOS
// ═══════════════════════════════════════════════════
function openAtestados(){
  buildAtestados('todos');openPanel('atestadoPanel');
}
function buildAtestados(filter){
  const all=getAllAtestados();
  const hoje=new Date();
  document.getElementById('ateFilter').innerHTML=
    '<button class="fbtn'+(filter==='todos'?' active':'')+'" onclick="buildAtestados(\'todos\')">Todos</button>'+
    '<button class="fbtn'+(filter==='ativos'?' active':'')+'" onclick="buildAtestados(\'ativos\')">Ativos</button>'+
    '<button class="fbtn'+(filter==='expirados'?' active':'')+'" onclick="buildAtestados(\'expirados\')">Expirados</button>';
  let items=all;
  if(filter==='ativos')items=all.filter(a=>{if(!a.fim)return true;const fim=new Date(a.fim.split('/').reverse().join('-'));return fim>=hoje;});
  if(filter==='expirados')items=all.filter(a=>{if(!a.fim)return false;const fim=new Date(a.fim.split('/').reverse().join('-'));return fim<hoje;});
  if(!items.length){document.getElementById('ateContent').innerHTML='<div class="empty">Nenhum atestado encontrado.</div>';return;}
  let html='';
  items.forEach(a=>{
    const expired=a.fim&&new Date(a.fim.split('/').reverse().join('-'))<hoje;
    html+='<div class="ate-card">';
    html+='<div class="ate-header"><div><button class="emp-name-btn" onclick="openFicha(\''+a.nome.replace(/'/g,"\\'")+'\')"><div class="ate-name">'+a.nome+'</div></button><div style="font-size:10px;color:var(--sub)">'+a.cat+'</div></div>';
    if(a.fim)html+='<span class="ate-valid '+(expired?'exp':'ok')+'">'+(expired?'Expirado':'Válido')+'</span>';
    html+='</div>';
    html+='<div class="ate-detail">';
    html+='📅 Registrado: <strong>'+a.data+'</strong><br>';
    if(a.ini||a.fim)html+='🗓️ Período: '+(a.ini||'?')+' a '+(a.fim||'?')+' '+(a.dias?'('+a.dias+' dias)':'')+'<br>';
    if(a.obs)html+='📝 '+a.obs;
    html+='</div></div>';
  });
  document.getElementById('ateContent').innerHTML=html;
}

// ═══════════════════════════════════════════════════
// PAINEL DISCIPLINAR
// ═══════════════════════════════════════════════════
function openDisciplinar(){
  buildDisciplinar('todos');openPanel('disciplinarPanel');
}
function buildDisciplinar(filter){
  const byFunc=getAllDisciplinar();
  document.getElementById('discFilter').innerHTML=
    '<button class="fbtn'+(filter==='todos'?' active':'')+'" onclick="buildDisciplinar(\'todos\')">Todos</button>'+
    '<button class="fbtn'+(filter==='justa'?' active':'')+'" onclick="buildDisciplinar(\'justa\')">🚨 Justa Causa</button>'+
    '<button class="fbtn'+(filter==='suspensao'?' active':'')+'" onclick="buildDisciplinar(\'suspensao\')">Suspensão</button>'+
    '<button class="fbtn'+(filter==='advertencia'?' active':'')+'" onclick="buildDisciplinar(\'advertencia\')">Advertência</button>';
  let entries=Object.values(byFunc);
  if(filter==='justa')entries=entries.filter(e=>Object.values(e.byMotivo).some(justs=>justs.some(j=>j.medida==='Justa causa')));
  if(filter==='suspensao')entries=entries.filter(e=>Object.values(e.byMotivo).some(justs=>justs.some(j=>j.medida&&j.medida.includes('Suspensão'))));
  if(filter==='advertencia')entries=entries.filter(e=>Object.values(e.byMotivo).some(justs=>justs.some(j=>j.medida&&j.medida.includes('Advertência'))));
  if(!entries.length){document.getElementById('discContent').innerHTML='<div class="empty">Nenhum registro disciplinar.</div>';return;}
  let html='';
  entries.sort((a,b)=>a.func.nome.localeCompare(b.func.nome)).forEach(({func,byMotivo})=>{
    const allJusts=Object.values(byMotivo).flat();
    const temJusta=allJusts.some(j=>j.medida==='Justa causa');
    html+='<div class="disc-card'+(temJusta?' nivel-5':'')+'">';
    html+='<div class="disc-header"><button class="emp-name-btn disc-name" onclick="openFicha(\''+func.nome.replace(/'/g,"\\'")+'\')">'+func.nome+'</button>'+(temJusta?'<span class="badge badge-justa">🚨 JUSTA CAUSA</span>':'')+'</div>';
    html+='<div style="font-size:10px;color:var(--sub);margin-bottom:8px">'+func.categoria+' · '+func.turno+'</div>';
    Object.entries(byMotivo).forEach(([mot,justs])=>{
      const {prog,idx,proxima}=getProgAtual(func.nome,mot);
      const steps=prog.map((s,i)=>{let cls='prog-step';if(i<idx)cls+=' done';else if(i===idx)cls+=' current';return '<div class="'+cls+'" title="'+s+'"></div>';}).join('');
      html+='<div style="background:var(--s1);border-radius:8px;padding:8px 10px;margin-bottom:6px">';
      html+='<div style="font-size:11px;font-weight:700;margin-bottom:4px">'+mot+' <span style="color:var(--sub);font-weight:400">('+justs.length+'x)</span></div>';
      html+='<div class="prog-bar">'+steps+'</div>';
      html+='<div style="font-size:10px;color:var(--warn);margin-top:3px">→ próxima: <strong>'+proxima+'</strong></div>';
      html+='<div class="disc-detail">';
      justs.slice(-3).reverse().forEach(j=>{html+=(j.data?'📅 '+j.data+' ':'')+(j.medida?'• '+j.medida:'')+(j.resp?' ('+j.resp+')':'')+'<br>';});
      if(justs.length>3)html+='<span style="color:var(--sub)">... e mais '+(justs.length-3)+' registro(s)</span>';
      html+='</div></div>';
    });
    html+='</div>';
  });
  document.getElementById('discContent').innerHTML=html;
}

// ═══════════════════════════════════════════════════
// EQUIPE PANEL
// ═══════════════════════════════════════════════════
function buildEquipeContent(catFilter){
  const cats=['TODOS',...CATS];
  document.getElementById('equipeFilter').innerHTML=cats.map(c=>'<button class="fbtn'+(c===catFilter?' active':'')+'" data-cat="'+c+'" onclick="buildEquipeContent(\''+c+'\')">'+( c==='TODOS'?'Todos':c)+'</button>').join('');
  const filtered=catFilter==='TODOS'?EQUIPE:EQUIPE.filter(f=>f.categoria===catFilter);
  if(!filtered.length){document.getElementById('equipeContent').innerHTML='<div class="empty">Nenhum funcionário nesta categoria.</div>';return;}
  const byCat={};
  filtered.forEach(f=>{(byCat[f.categoria]||(byCat[f.categoria]=[])).push(f);});
  let html='';
  Object.entries(byCat).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([cat,funcs])=>{
    const cor=CAT_COLORS[cat]||'#888';
    html+='<div class="cat-section"><div class="cat-header"><div class="cat-title" style="color:'+cor+'">● '+cat+'</div><div class="cat-count">'+funcs.length+'</div></div>';
    funcs.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f=>{
      const justs=getJusts(f.nome);
      const temJusta=justs.some(j=>j.medida==='Justa causa');
      const pendCount=getPendencias().find(p=>p.func.nome===f.nome)?.dias.length||0;
      html+='<div class="func-card">';
      html+='<div class="func-card-info"><button class="emp-name-btn" onclick="openFicha(\''+f.nome.replace(/'/g,"\\'")+'\')"><div class="func-card-name">'+f.nome+(temJusta?' 🚨':'')+(f.turno==='LICENÇA'?' 🏥':'')+'</div></button>';
      html+='<div class="func-card-meta">'+f.turno+(f.horIni?' · '+f.horIni+' às '+f.horFim:'')+(f.folga?' · Folga: '+f.folga:'')+(pendCount?' · ⏳ '+pendCount+' pend.':'')+'</div></div>';
      html+='<div class="func-card-actions"><button class="icon-btn edit" onclick="openEditFuncModal(\''+f.id+'\')">✏️</button><button class="icon-btn del" onclick="delFunc(\''+f.id+'\')">🗑️</button></div>';
      html+='</div>';
    });
    html+='</div>';
  });
  document.getElementById('equipeContent').innerHTML=html;
}

// ═══════════════════════════════════════════════════
// RELATÓRIO
// ═══════════════════════════════════════════════════
let _reportPeriod='semana';
function openReport(){buildReport(_reportPeriod);openPanel('reportPanel');}
function buildReport(period){
  _reportPeriod=period;
  const totalCnt={presente:0,falta:0,atestado:0,'troca-horario':0,'troca-folga':0,medida:0};
  let fullText='🍽️ *CONTROLE DE PRESENÇA — COCO BAMBU*\n'+'━'.repeat(30)+'\n\n';
  const days=period==='dia'?[curDay]:[0,1,2,3,4,5,6];
  days.forEach(d=>{
    const grupos={presente:[],falta:[],atestado:[],'troca-horario':[],'troca-folga':[],medida:[],folga:[],licenca:[],sem:[]};
    EQUIPE.forEach(f=>{
      if(f.turno==='LICENÇA'){grupos.licenca.push(f.nome);return;}
      if(isFolgaSemanal(f,DAYS[d])){grupos.folga.push(f.nome);return;}
      const r=getRec(d,f.nome);
      (grupos[r.status||'sem']||(grupos['sem'])).push(f.nome);
      Object.keys(totalCnt).forEach(k=>{if(r.status===k)totalCnt[k]++;});
    });
    fullText+='*'+DAY_NAMES[d].toUpperCase()+' '+WEEK_DAY_NUMS[d]+'*\n';
    const sec=(e,l,lista)=>lista.length?e+' *'+l+' ('+lista.length+'):* '+lista.join(', ')+'\n':'';
    fullText+=sec('✅','PRESENTES',grupos.presente)+sec('📆','FOLGAS',grupos.folga)+sec('❌','FALTAS',grupos.falta)+sec('🏥','ATESTADOS',grupos.atestado)+sec('🔄','TROCA HOR.',grupos['troca-horario'])+sec('📅','TROCA FOL.',grupos['troca-folga'])+sec('⚠️','MEDIDA',grupos.medida)+sec('🏥','LICENÇA',grupos.licenca);
    if(grupos.sem.length)fullText+='➖ *SEM REGISTRO ('+grupos.sem.length+'):* '+grupos.sem.join(', ')+'\n';
    fullText+='\n';
  });
  fullText+='━'.repeat(30)+'\n📊 *RESUMO:* ✅'+totalCnt.presente+' | ❌'+totalCnt.falta+' | 🏥'+totalCnt.atestado+' | 🔄'+totalCnt['troca-horario']+' | 📅'+totalCnt['troca-folga']+' | ⚠️'+totalCnt.medida+'\n';
  window._reportText=fullText;
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const previewHtml=fullText.split('\n').map(line=>{const l=esc(line);if(/PRESENTES/.test(l))return '<span style="color:#27ae60">'+l+'</span>';if(/FALTAS/.test(l))return '<span style="color:#e74c3c">'+l+'</span>';if(/ATESTADOS/.test(l))return '<span style="color:#2980b9">'+l+'</span>';return '<span style="color:#8891a8">'+l+'</span>';}).join('\n');
  const sheetsBtn = gToken
    ? `<button class="export-btn" onclick="syncFrequenciaTotal()" style="background:#1a7340;color:#fff;border-color:#1a7340;font-weight:700;font-size:14px;text-align:center;padding:14px">📊 ATUALIZAR PLANILHA AGORA</button>`
      + `<button class="export-btn" onclick="syncFaltasSheet()" style="background:#8b0000;color:#fff;border-color:#8b0000;font-weight:700;font-size:13px;text-align:center;padding:12px">❌ ATUALIZAR ABA FALTAS</button>`
      + `<button class="export-btn" onclick="syncAtestadosSheet()" style="background:#0d47a1;color:#fff;border-color:#0d47a1;font-weight:700;font-size:13px;text-align:center;padding:12px">🏥 ATUALIZAR ABA ATESTADOS</button>`
      + `<button class="export-btn" onclick="syncMedidasSheet()" style="background:#4a148c;color:#fff;border-color:#4a148c;font-weight:700;font-size:13px;text-align:center;padding:12px">⚠️ ATUALIZAR ABA MEDIDAS</button>`
      + `<button class="export-btn" onclick="syncTrocasSheet()" style="background:#1a5276;color:#fff;border-color:#1a5276;font-weight:700;font-size:13px;text-align:center;padding:12px">🔄 ATUALIZAR ABA TROCAS</button>`
      + (SHEET_ID ? `<button class="export-btn" onclick="window.open('https://docs.google.com/spreadsheets/d/${SHEET_ID}','_blank')" style="background:var(--s3);border-color:#27ae6066;color:#27ae60;font-size:13px;text-align:center">🔗 Abrir Planilha Google</button>` : '')
    : `<button class="export-btn" onclick="gLogin()" style="background:#fff;color:#111;font-weight:700;font-size:14px;text-align:center;padding:14px">📊 CONECTAR GOOGLE SHEETS</button>
       <div style="font-size:11px;color:var(--sub);text-align:center;padding:4px 0 6px">Gera planilha com frequência, faltas e trocas de folga</div>`;

  const periods=[{id:'dia',l:'Hoje'},{id:'semana',l:'Semana'}];
  document.getElementById('reportContent').innerHTML=
    '<div style="display:flex;gap:6px;margin-bottom:12px">'+periods.map(p=>'<button onclick="buildReport(\''+p.id+'\')" style="flex:1;padding:8px;border-radius:9px;border:1.5px solid '+(period===p.id?'var(--accent)':'var(--border)')+';background:'+(period===p.id?'var(--accent)':'var(--s3)')+';color:'+(period===p.id?'#111':'var(--sub)')+';font-weight:700;font-family:Barlow Condensed,sans-serif;font-size:13px;cursor:pointer">'+p.l+'</button>').join('')+'</div>'+
    '<div class="export-card"><h3>📊 RESUMO</h3><div class="grid2"><div class="scard"><div class="scard-num c-green">'+totalCnt.presente+'</div><div class="scard-lbl">Presente</div></div><div class="scard"><div class="scard-num c-red">'+totalCnt.falta+'</div><div class="scard-lbl">Falta</div></div><div class="scard"><div class="scard-num c-blue">'+totalCnt.atestado+'</div><div class="scard-lbl">Atestado</div></div><div class="scard"><div class="scard-num c-orange">'+totalCnt['troca-horario']+'</div><div class="scard-lbl">Troca H.</div></div><div class="scard"><div class="scard-num c-purple">'+totalCnt['troca-folga']+'</div><div class="scard-lbl">Troca F.</div></div><div class="scard"><div class="scard-num c-pink">'+totalCnt.medida+'</div><div class="scard-lbl">Discipl.</div></div></div></div>'+
    '<div class="export-card"><h3>📤 EXPORTAR</h3>'+sheetsBtn+
    '<button class="export-btn" onclick="copyReport()" style="background:var(--accent);color:#111;font-weight:700;font-size:14px;text-align:center">📋 COPIAR PARA WHATSAPP</button>'+
    '<button class="export-btn" onclick="resetTotal()" style="color:#fff;background:#c0392b;border-color:#c0392b;font-weight:800;font-size:13px;margin-top:6px">🔐 RESET TOTAL — Apagar tudo</button></div>'+
    '<div class="export-card" style="background:var(--s1)"><h3 style="color:var(--muted)">PRÉVIA</h3><pre style="font-size:10px;white-space:pre-wrap;line-height:1.8;-webkit-user-select:text;user-select:text">'+previewHtml+'</pre></div>';
}
function copyReport(){
  const txt=window._reportText||'';
  const fb=()=>{const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;top:0;left:0;opacity:.01;font-size:16px;width:1px;height:1px';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');showToast('✅ Copiado!');}catch{showToast('⚠️ Selecione o texto manualmente');}document.body.removeChild(ta);};
  navigator.clipboard?.writeText(txt).then(()=>showToast('✅ Copiado! Cole no WhatsApp')).catch(fb)||fb();
}
function clearAll(){
  if(!confirm('Apagar TODOS os registros da semana?\n\nIsso remove os dados do Firebase e de todos os dispositivos.'))return;
  if(fbDb&&fbConnected){
    fbDb.ref('presenca/'+WEEK_KEY).remove()
      .then(()=>showToast('🗑️ Registros apagados de todos os dispositivos!'))
      .catch(()=>showToast('⚠️ Erro ao apagar do Firebase'));
  }
  _limparCacheLocal();
  buildReport(_reportPeriod);buildMain();refreshPendBadge();
}

function resetTotal(){
  // Pede senha
  const senha=prompt('🔐 Digite a senha para apagar TODOS os dados:');
  if(senha===null)return; // cancelou
  if(senha!=='2504'){
    showToast('❌ Senha incorreta!');
    return;
  }
  if(!confirm('⚠️ ATENÇÃO!\n\nIsso vai apagar PERMANENTEMENTE:\n• Todos os registros de presença\n• Todas as trocas de folga\n• Todas as justificativas\n• Todos os atestados\n\nEssa ação não pode ser desfeita!\n\nConfirma o reset completo?'))return;

  setSyncStatus('loading','Apagando todos os dados...');
  const ops=[];

  if(fbDb&&fbConnected){
    // Apaga TUDO do Firebase
    ops.push(fbDb.ref('presenca').remove());
    ops.push(fbDb.ref('trocas').remove());
  }

  Promise.all(ops).then(()=>{
    // Limpa cache em memória completamente
    Object.keys(_fbCache).forEach(k=>delete _fbCache[k]);
    setSyncStatus('ok','🔄 Sync em tempo real ativo');
    showToast('✅ Reset completo! Todos os dados foram apagados.');
    buildMain();
    refreshPendBadge();
    buildSummary();
    if(document.getElementById('trocasPanel').classList.contains('open')) buildTrocasPanel();
  }).catch(e=>{
    setSyncStatus('err','Erro no reset');
    showToast('❌ Erro ao apagar: '+e.message);
  });
}

// ═══════════════════════════════════════════════════
// EXPORT TO SHEETS
// ═══════════════════════════════════════════════════
async function exportToSheets(){
  if(!gToken){showToast('Conecte o Google primeiro');return;}
  const sorted=[...EQUIPE].sort((a,b)=>a.nome.localeCompare(b.nome));
  const today=new Date(),mes=today.toLocaleString('pt-BR',{month:'long'}).toUpperCase(),ano=today.getFullYear(),dataAtual=today.toLocaleDateString('pt-BR');
  const TC=9;
  const rowInfo=['COCO BAMBU RESTAURANTE','','','Atualizado: '+dataAtual,'','','Responsavel: FELIPE H. COSTA','',''];
  const rowTitulo=['CONTROLE DE FREQUENCIA DO EFETIVO - '+ano,...Array(TC-1).fill('')];
  const rowMes=['Mes:','Funcao:','PERIODO:',mes,'','','dia:','dia:','dia:'];
  const rowDias=['Colaborador:','','',...WEEK_DAY_NUMS.map(n=>String(n))];
  const dataRows=sorted.map(f=>{
    const row=[f.nome,f.categoria,f.turno];
    for(let d=0;d<6;d++){
      if(f.turno==='LICENÇA'){row.push('LICENÇA');continue;}
      if(isFolgaSemanal(f,DAYS[d])){row.push('FOLGA');continue;}
      const r=getRec(d,f.nome);
      const map={presente:'OK',falta:'FALTA',atestado:'ATESTADO','troca-horario':'TROCA H.','troca-folga':'TROCA F.',medida:'MEDIDA'};
      row.push(r.status?map[r.status]||'-':'-');
    }
    return row;
  });
  const allRows=[rowInfo,Array(TC).fill(''),rowTitulo,rowMes,rowDias,...dataRows];
  const numRows=allRows.length;
  try{
    showToast('⏳ Exportando...');
    const ok=await ensureEquipeSheet();if(!ok)return;
    const sid=EQUIPE_SHEET_ID;
    const info=await gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+sid+'?fields=sheets.properties');
    const hasFreq=info.sheets?.some(s=>s.properties.title==='Frequencia');
    let sheetId=0;
    if(!hasFreq){const r=await gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+sid+':batchUpdate','POST',{requests:[{addSheet:{properties:{title:'Frequencia'}}}]});sheetId=r.replies[0].addSheet.properties.sheetId;}
    else sheetId=info.sheets.find(s=>s.properties.title==='Frequencia').properties.sheetId;
    await gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+sid+'/values/Frequencia!A1:I'+(numRows+5)+':clear','POST',{});
    await gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+sid+'/values/Frequencia!A1:I'+numRows+'?valueInputOption=RAW','PUT',{values:allRows});
    const rgb=(r,g,b)=>({red:r/255,green:g/255,blue:b/255});
    const cr=(r1,r2,c1,c2,bg,fg,bold,sz,ha)=>({repeatCell:{range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},cell:{userEnteredFormat:{backgroundColor:bg||rgb(255,255,255),textFormat:{bold:!!bold,foregroundColor:fg||rgb(0,0,0),fontSize:sz||10},horizontalAlignment:ha||'CENTER',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'}});
    const mg=(r1,r2,c1,c2)=>({mergeCells:{range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},mergeType:'MERGE_ALL'}});
    const cw=(c1,c2,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:c1,endIndex:c2},properties:{pixelSize:px},fields:'pixelSize'}});
    const rh=(r,px)=>({updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:r,endIndex:r+1},properties:{pixelSize:px},fields:'pixelSize'}});
    const bd=(r1,r2,c1,c2)=>({updateBorders:{range:{sheetId,startRowIndex:r1,endRowIndex:r2,startColumnIndex:c1,endColumnIndex:c2},top:{style:'SOLID',width:1,color:rgb(160,160,160)},bottom:{style:'SOLID',width:1,color:rgb(160,160,160)},left:{style:'SOLID',width:1,color:rgb(160,160,160)},right:{style:'SOLID',width:1,color:rgb(160,160,160)},innerHorizontal:{style:'SOLID',width:1,color:rgb(190,190,190)},innerVertical:{style:'SOLID',width:1,color:rgb(190,190,190)}}});
    const cf=(txt,bg,fg)=>({addConditionalFormatRule:{rule:{ranges:[{sheetId,startRowIndex:5,endRowIndex:5+dataRows.length,startColumnIndex:3,endColumnIndex:9}],booleanRule:{condition:{type:'TEXT_EQ',values:[{userEnteredValue:txt}]},format:{backgroundColor:bg,textFormat:{bold:true,foregroundColor:fg}}}},index:0}});
    const cocoBrown=rgb(101,53,28),cocoGold=rgb(207,160,60),headerYel=rgb(255,192,0),rowAlt=rgb(219,229,241),white=rgb(255,255,255),black=rgb(0,0,0);
    await gFetch('https://sheets.googleapis.com/v4/spreadsheets/'+sid+':batchUpdate','POST',{requests:[
      cw(0,1,200),cw(1,2,110),cw(2,3,105),cw(3,9,68),rh(0,55),rh(1,6),rh(2,28),rh(3,26),rh(4,26),
      mg(0,2,0,3),mg(0,1,3,6),mg(0,1,6,9),mg(2,3,0,9),mg(3,4,3,6),mg(3,4,6,9),
      cr(0,2,0,3,cocoBrown,white,true,13,'LEFT'),cr(0,1,3,6,rgb(245,245,245),rgb(100,100,100),false,9,'RIGHT'),cr(0,1,6,9,rgb(245,245,245),cocoBrown,true,10,'RIGHT'),
      cr(2,3,0,9,cocoGold,white,true,13,'CENTER'),cr(3,4,0,3,headerYel,black,true,11,'CENTER'),cr(3,4,3,9,headerYel,black,true,13,'CENTER'),
      cr(4,5,0,3,cocoBrown,white,true,11,'CENTER'),cr(4,5,3,9,cocoBrown,white,true,12,'CENTER'),
      ...dataRows.map((_,i)=>cr(5+i,6+i,0,9,i%2===0?rowAlt:white,black,false,10,'CENTER')),
      bd(3,5+dataRows.length,0,9),
      cf('OK',rgb(0,176,80),white),cf('FALTA',rgb(255,199,206),rgb(156,0,6)),cf('ATESTADO',rgb(255,235,156),rgb(156,87,0)),
      cf('FOLGA',rgb(217,217,217),rgb(80,80,80)),cf('LICENÇA',rgb(189,215,238),rgb(0,70,127)),
      cf('TROCA H.',rgb(189,215,238),rgb(0,70,127)),cf('TROCA F.',rgb(218,190,255),rgb(80,0,160)),cf('MEDIDA',rgb(255,180,220),rgb(160,0,80)),
    ]});
    showToast('✅ Planilha atualizada!');
    setTimeout(()=>window.open('https://docs.google.com/spreadsheets/d/'+sid,'_blank'),1500);
  }catch(e){console.error(e);showToast('❌ Erro: '+e.message);}
}

// ═══════════════════════════════════════════════════
// MODALS E PAINÉIS
// ═══════════════════════════════════════════════════
function openPanel(id){document.getElementById(id).classList.add('open');}
function closePanel(id){
  document.getElementById(id).classList.remove('open');
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navEscala').classList.add('active');
}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navEscala').classList.add('active');
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}

// ═══════════════════════════════════════════════════
// PAINEL BANCO DE HORAS
// ═══════════════════════════════════════════════════
function openBancoHoras(){buildBancoHoras('todos');openPanel('bancoHorasPanel');}

function calcSaldoBH(nome){
  const hoje=new Date();
  const ano=hoje.getFullYear();
  const mes=hoje.getMonth()+1;
  const totalDias=diasNoMes(ano,mes);
  let saldo=0;
  const registros=[];
  for(let d=1;d<=totalDias;d++){
    const dk=`${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rec=load('drec_'+nome+'_'+dk,null);
    if(rec&&rec.status==='banco-horas'&&rec.extra){
      const h=parseFloat(rec.extra.horas)||0;
      const delta=rec.extra.tipo==='DÉBITO'?-h:h;
      saldo+=delta;
      const data=new Date(ano,mes-1,d);
      registros.push({
        dia:d,
        data:data.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}),
        tipo:rec.extra.tipo||'',
        horas:h,
        delta,
        periodo:rec.extra.periodo||'',
        horIni:rec.extra.horIni||'',
        horFim:rec.extra.horFim||'',
        obs:rec.extra.obs||''
      });
    }
  }
  return {saldo,registros};
}

function buildBancoHoras(filter){
  document.getElementById('bhFilter').innerHTML=
    '<button class="fbtn'+(filter==='todos'?' active':'')+'" onclick="buildBancoHoras(\'todos\')">Todos</button>'+
    '<button class="fbtn'+(filter==='credito'?' active':'')+'" onclick="buildBancoHoras(\'credito\')">➕ Crédito</button>'+
    '<button class="fbtn'+(filter==='debito'?' active':'')+'" onclick="buildBancoHoras(\'debito\')">➖ Débito</button>'+
    '<button class="fbtn'+(filter==='zerado'?' active':'')+'" onclick="buildBancoHoras(\'zerado\')">⚖️ Zerado</button>';

  const dados=EQUIPE.map(f=>{const {saldo,registros}=calcSaldoBH(f.nome);return{func:f,saldo,registros};}).filter(x=>x.registros.length>0);

  let filtered=dados;
  if(filter==='credito')filtered=dados.filter(x=>x.saldo>0);
  if(filter==='debito')filtered=dados.filter(x=>x.saldo<0);
  if(filter==='zerado')filtered=dados.filter(x=>x.saldo===0);

  // Totais gerais
  const totalCredito=dados.reduce((a,x)=>a+(x.saldo>0?x.saldo:0),0);
  const totalDebito=dados.reduce((a,x)=>a+(x.saldo<0?Math.abs(x.saldo):0),0);

  let html=`<div style="display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border)">
    <div class="scard" style="flex:1"><div class="scard-num" style="color:#00b894">+${totalCredito.toFixed(1)}h</div><div class="scard-lbl">Total Crédito</div></div>
    <div class="scard" style="flex:1"><div class="scard-num" style="color:#e74c3c">-${totalDebito.toFixed(1)}h</div><div class="scard-lbl">Total Débito</div></div>
    <div class="scard" style="flex:1"><div class="scard-num" style="color:${totalCredito-totalDebito>=0?'#00b894':'#e74c3c'}">${totalCredito-totalDebito>=0?'+':''}${(totalCredito-totalDebito).toFixed(1)}h</div><div class="scard-lbl">Saldo Geral</div></div>
  </div>`;

  if(!filtered.length){html+='<div class="empty">Nenhum registro de banco de horas.</div>';}
  else{
    filtered.sort((a,b)=>Math.abs(b.saldo)-Math.abs(a.saldo)).forEach(({func,saldo,registros})=>{
      const cor=saldo>0?'#00b894':saldo<0?'#e74c3c':'#8891a8';
      html+=`<div style="background:var(--s2);border-radius:12px;padding:12px 14px;border:1px solid var(--border);margin:0 16px 10px;border-left:3px solid ${cor}">`;
      html+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">`;
      html+=`<button class="emp-name-btn" onclick="openFicha('${func.nome.replace(/'/g,"\\'")}')"><div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700">${func.nome}</div></button>`;
      html+=`<div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:800;color:${cor}">${saldo>0?'+':''}${saldo.toFixed(1)}h</div></div>`;
      html+=`<div style="font-size:10px;color:var(--sub);margin-bottom:8px">${func.categoria} · ${func.turno}</div>`;
      registros.forEach(r=>{
        html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">`;
        html+=`<div>`;
        html+=`<div style="font-size:12px;font-weight:700;color:var(--text)">${r.data}</div>`;
        if(r.periodo)html+=`<div style="font-size:10px;color:var(--sub)">${r.periodo}</div>`;
        if(r.obs)html+=`<div style="font-size:10px;color:var(--sub)">${r.obs}</div>`;
        html+=`</div>`;
        html+=`<div style="text-align:right">`;
        html+=`<div style="color:${r.tipo==='CRÉDITO'?'#00b894':'#e74c3c'};font-weight:800;font-family:Barlow Condensed,sans-serif;font-size:16px">${r.tipo==='CRÉDITO'?'➕':'➖'} ${r.horas}h</div>`;
        if(r.horIni&&r.horFim)html+=`<div style="font-size:10px;color:var(--sub)">${r.horIni}–${r.horFim}</div>`;
        html+=`</div>`;
        html+=`</div>`;
      });
      html+=`</div>`;
    });
  }
  document.getElementById('bhContent').innerHTML=html;
}

// ═══════════════════════════════════════════════════
// FOLGA INTERATIVA — QUALQUER DIA DA SEMANA
// ═══════════════════════════════════════════════════
let _domTipo='';

function openFolgaModalById(f, dayIdx, editMode, folgaKey){
  const folgaDate=WEEK_DATES[dayIdx];
  const dateStr=folgaDate.toLocaleDateString('pt-BR');
  const diaNome=DAY_NAMES[dayIdx];

  document.getElementById('domFolgaTitle').textContent=diaNome.toUpperCase()+' — FOLGA';
  document.getElementById('domFolgaInfo').innerHTML=
    `<strong>${f.nome}</strong><br>`+
    `${diaNome}, ${dateStr}<br>`+
    `<span style="color:var(--sub)">${f.categoria+' · '+f.turno}</span><br>`+
    `<span style="color:#f5c842;font-size:11px">📆 Está de folga — registre o que deseja fazer</span>`;
  document.getElementById('dom_fname').value=f.nome;
  document.getElementById('dom_dayidx').value=dayIdx;
  // guarda a chave de storage no hidden field para usar no save
  document.getElementById('dom_folgakey').value=folgaKey;

  const folgaRec=load(folgaKey,null);
  _domTipo='';

  ['dom_pres_obs','dom_comp_valor','dom_comp_auth','dom_comp_obs',
   'dom_troca_trab','dom_troca_dia','dom_troca_auth','dom_troca_obs','dom_falta_obs',
   'dom_comp_ini','dom_comp_fim','dom_troca_ini','dom_troca_fim'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('dom_comp_tipo').value='Pagamento em dinheiro';

  const proxDia=new Date(folgaDate);proxDia.setDate(proxDia.getDate()+1);
  document.getElementById('dom_troca_trab').value=folgaDate.toISOString().split('T')[0];
  document.getElementById('dom_troca_dia').value=proxDia.toISOString().split('T')[0];

  if(folgaRec&&editMode){
    setDomTipo(folgaRec.tipo);
    if(folgaRec.tipo==='compra'){
      document.getElementById('dom_comp_tipo').value=folgaRec.compTipo||'Pagamento em dinheiro';
      document.getElementById('dom_comp_valor').value=folgaRec.compValor||'';
      document.getElementById('dom_comp_ini').value=folgaRec.ini||'';
      document.getElementById('dom_comp_fim').value=folgaRec.fim||'';
      document.getElementById('dom_comp_auth').value=folgaRec.compAuth||'';
      document.getElementById('dom_comp_obs').value=folgaRec.obs||'';
    } else if(folgaRec.tipo==='troca'){
      document.getElementById('dom_troca_trab').value=folgaRec.trabalhouIso||folgaDate.toISOString().split('T')[0];
      document.getElementById('dom_troca_dia').value=folgaRec.trocaDia||folgaRec.folgaIso||'';
      document.getElementById('dom_troca_ini').value=folgaRec.ini||'';
      document.getElementById('dom_troca_fim').value=folgaRec.fim||'';
      document.getElementById('dom_troca_auth').value=folgaRec.trocaAuth||'';
      document.getElementById('dom_troca_obs').value=folgaRec.obs||'';
    } else if(folgaRec.tipo==='falta'){
      document.getElementById('dom_falta_obs').value=folgaRec.obs||'';
    } else if(folgaRec.tipo==='presente'){
      document.getElementById('dom_pres_obs').value=folgaRec.obs||'';
    }
  } else {
    setDomTipo('');
  }
  openModal('domFolgaModal');
}

function openFolgaModal(nome, dayIdx, editMode=false){
  const f=EQUIPE.find(x=>x.nome===nome);
  if(!f)return;
  const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
  const folgaKey='folga_'+f.id+'_'+dayIdx+'_'+dateStr;
  openFolgaModalById(f,dayIdx,editMode,folgaKey);
}

// Manter alias para compatibilidade do código antigo
function openDomFolgaModal(nome,editMode=false){openFolgaModal(nome,6,editMode);}

function setDomTipo(tipo){
  _domTipo=tipo;
  ['presente','compra','troca','falta'].forEach(t=>{
    document.getElementById('dom_'+t+'_fields').style.display=tipo===t?'block':'none';
    const btn=document.getElementById('domBtn'+t.charAt(0).toUpperCase()+t.slice(1));
    if(btn) btn.className='dom-btn dom-btn-'+t+(tipo===t?' sel':'');
  });
}

function saveDomFolga(){
  if(!_domTipo){showToast('⚠️ Selecione uma opção');return;}
  const nome=document.getElementById('dom_fname').value;
  const dayIdx=parseInt(document.getElementById('dom_dayidx').value)||0;
  const folgaKey=document.getElementById('dom_folgakey').value;
  const folgaDate=WEEK_DATES[dayIdx];
  const dateStr=folgaDate.toLocaleDateString('pt-BR');
  const workedIso=WEEK_DATES[dayIdx].toISOString().split('T')[0];
  const oldRec=load(folgaKey,null);
  const v=id=>(document.getElementById(id)||{}).value||'';
  const fmt=d=>{if(!d)return '';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};

  let rec={tipo:_domTipo,data:dateStr,dayIdx,ts:Date.now()};

  if(_domTipo==='presente'){
    rec.obs=v('dom_pres_obs');
    setRec(dayIdx,nome,'presente',{obs:rec.obs,folgaTrabalhada:true});
    bridgeSaveByDate(nome,dayIdx,'presente',{obs:rec.obs,folgaTrabalhada:true});
  } else if(_domTipo==='compra'){
    rec.compTipo=v('dom_comp_tipo');
    rec.compValor=v('dom_comp_valor');
    rec.ini=v('dom_comp_ini');
    rec.fim=v('dom_comp_fim');
    rec.compAuth=v('dom_comp_auth');
    rec.obs=v('dom_comp_obs');
    setRec(dayIdx,nome,'presente',{domTipo:'compra',compTipo:rec.compTipo,compValor:rec.compValor,obs:rec.obs,folgaTrabalhada:true});
    bridgeSaveByDate(nome,dayIdx,'presente',{domTipo:'compra',compTipo:rec.compTipo,compValor:rec.compValor,obs:rec.obs,folgaTrabalhada:true});
    if(rec.compTipo==='Banco de horas'){
      const bhKey='bh_extra_'+nome+'_'+dateStr;
      const bhVal={tipo:'CRÉDITO',dataFormatada:fmt(folgaDate.toISOString().split('T')[0]),obs:'Compra de folga ('+dateStr+')',horIni:rec.ini,horFim:rec.fim};
      save(bhKey,bhVal);
      pushToFirebase(bhKey,bhVal);
    }
  } else if(_domTipo==='troca'){
    const trabDia=v('dom_troca_trab') || workedIso;
    const trocaDia=v('dom_troca_dia');
    if(!trabDia){showToast('⚠️ Selecione o dia que vai trabalhar');return;}
    if(!trocaDia){showToast('⚠️ Selecione a data da folga');return;}
    if(trabDia===trocaDia){showToast('⚠️ Dia de trabalho e dia de folga não podem ser iguais');return;}
    const fmt2=d=>{const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
    const trabFmt=fmt2(trabDia);
    rec.trabalhouIso=trabDia;
    rec.trabalhouFmt=trabFmt;
    rec.trocaDia=trocaDia;
    rec.trocaDiaFmt=fmt2(trocaDia);
    rec.ini=v('dom_troca_ini');
    rec.fim=v('dom_troca_fim');
    rec.trocaAuth=v('dom_troca_auth');
    rec.obs=v('dom_troca_obs');

    if(oldRec&&oldRec.tipo==='troca'&&oldRec.trocaDia&&oldRec.trocaDia!==trocaDia){
      _removeTrocaLinks(nome, oldRec.trabalhouIso||workedIso, oldRec.trocaDia);
    }

    // 1) DIA DE TRABALHO: marca PRESENTE com obs TROCA FOLGA
    const obsHoje='TROCA FOLGA — folga em '+rec.trocaDiaFmt+(rec.obs?' | '+rec.obs:'');
    if(trabDia===workedIso){
      setRec(dayIdx,nome,'presente',{domTipo:'troca',folgaEm:rec.trocaDiaFmt,obs:obsHoje,folgaTrabalhada:true,trabData:trabDia,folgaData:trocaDia});
      bridgeSaveByDate(nome,dayIdx,'presente',{domTipo:'troca',folgaEm:rec.trocaDiaFmt,obs:obsHoje,folgaTrabalhada:true,trabData:trabDia,folgaData:trocaDia});
    } else {
      const drWorkKey='drec_'+nome+'_'+trabDia;
      const workVal={status:'presente',extra:{domTipo:'troca',folgaEm:rec.trocaDiaFmt,obs:obsHoje,folgaTrabalhada:true,trabData:trabDia,folgaData:trocaDia},ts:Date.now()};
      save(drWorkKey,workVal);
      pushToFirebase(drWorkKey,workVal);
    }

    // 2) DATA ESCOLHIDA: marca como TROCA-FOLGA
    const obsFolga='TROCA FOLGA — trabalhou em '+trabFmt+(rec.obs?' | '+rec.obs:'');
    const drKey='drec_'+nome+'_'+trocaDia;
    const drVal={status:'troca-folga',extra:{obs:obsFolga,trocaDe:trabFmt,trabData:trabDia,folgaData:trocaDia,quem:rec.trocaAuth||''},ts:Date.now()};
    save(drKey,drVal);
    pushToFirebase(drKey,drVal);

    // 3) Salva no nó dedicado /trocas/ para o painel de trocas
    const trocaRecord={
      nome,
      categoria:(EQUIPE.find(x=>x.nome===nome)||{}).categoria||'',
      trabalhouIso:trabDia, trabalhouFmt:trabFmt,
      folgaIso:trocaDia, folgaFmt:rec.trocaDiaFmt,
      auth:rec.trocaAuth||'',
      obs:rec.obs||'',
      ts:Date.now()
    };
    const trocaKey=fbEncode('troca_'+nome+'_'+trabDia);
    if(fbDb&&fbConnected){
      fbDb.ref('trocas/'+trocaKey).set(trocaRecord)
        .then(()=>{
          if(document.getElementById('trocasPanel').classList.contains('open')) buildTrocasPanel();
          if(gToken&&SHEET_ID) syncTrocasSheet().catch(()=>{});
        });
    }

    showToast('✅ Trabalho: '+trabFmt+' · Folga: '+rec.trocaDiaFmt);
    setTimeout(()=>showToast('📅 Troca registrada nos dois dias!'),2200);
  } else if(_domTipo==='falta'){
    rec.obs=v('dom_falta_obs');
    setRec(dayIdx,nome,'falta',{obs:rec.obs,eraNaFolga:true});
    bridgeSaveByDate(nome,dayIdx,'falta',{obs:rec.obs,eraNaFolga:true});
  }

  if(oldRec&&oldRec.tipo==='troca'&&_domTipo!=='troca'&&oldRec.trocaDia){
    _removeTrocaLinks(nome, workedIso, oldRec.trocaDia);
  }

  // Salva o registro de folga no cache E no Firebase
  save(folgaKey, rec);
  pushToFirebase(folgaKey, rec);

  closeModal('domFolgaModal');
  buildMain();
  refreshPendBadge();
  if(_domTipo!=='troca'){
    showToast('✅ Registrado para '+DAY_NAMES[dayIdx]+'!');
  }
  if(_domTipo==='compra')setTimeout(()=>showToast('💰 Compra de folga registrada'+(rec.compValor?' — '+rec.compValor:'')),2500);
}

function clearFolgaRec(nome,dayIdx){
  const f=EQUIPE.find(x=>x.nome===nome);
  const dateStr=WEEK_DATES[dayIdx].toLocaleDateString('pt-BR');
  const key=f?('folga_'+f.id+'_'+dayIdx+'_'+dateStr):('folga_'+nome+'_'+dayIdx+'_'+dateStr);
  delete _fbCache[key];
  if(fbDb&&fbConnected) fbDb.ref('presenca/'+WEEK_KEY+'/'+fbEncode(key)).remove();
  setRec(dayIdx,nome,'',{});
  buildMain();
  showToast('🗑️ Registro removido');
}
function clearDomFolga(nome){clearFolgaRec(nome,6);}

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
document.getElementById('totalPill').textContent=EQUIPE.length+' TOTAL';
buildTabs();buildMain();refreshPendBadge();
// Inicia Firebase para sync em tempo real
setTimeout(initFirebase, 500);

// ═══════════════════════════════════════════════════
// SERVICE WORKER + PWA INSTALL
// ═══════════════════════════════════════════════════
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/escala-garcons/sw.js')
    .then(()=>console.log('SW registrado'))
    .catch(e=>console.warn('SW erro:',e));
}

// Detecta se está rodando como PWA instalada (standalone)
function isPWA(){
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');
}

// Detecta iOS
function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Detecta Android Chrome
function isAndroidChrome(){
  return /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);
}

function dismissInstall(){
  document.getElementById('installBanner').style.display='none';
  // Guarda que o usuário dispensou para não mostrar de novo em 3 dias
  localStorage.setItem('installDismissed', Date.now());
}

// Verifica se deve mostrar o banner (não dispensou recentemente)
function shouldShowInstallBanner(){
  const dismissed = localStorage.getItem('installDismissed');
  if(!dismissed) return true;
  const dias3 = 3 * 24 * 60 * 60 * 1000;
  return (Date.now() - parseInt(dismissed)) > dias3;
}

let _installPrompt = null;

// Android Chrome: intercepta o evento de instalação
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  if(!isPWA() && shouldShowInstallBanner()){
    setTimeout(()=>{
      const banner = document.getElementById('installBanner');
      if(banner) banner.style.display = 'flex';
    }, 1500);
  }
});

// Botão INSTALAR (Android)
document.getElementById('installBtn').addEventListener('click', async () => {
  if(!_installPrompt) return;
  document.getElementById('installBanner').style.display = 'none';
  _installPrompt.prompt();
  const result = await _installPrompt.userChoice;
  _installPrompt = null;
  if(result.outcome === 'accepted') showToast('✅ App instalado! Abra pela tela inicial para tela cheia.');
});

// App instalado com sucesso
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').style.display = 'none';
  document.getElementById('iosBanner').style.display = 'none';
  localStorage.removeItem('installDismissed');
  showToast('✅ App instalado! Abra pela tela inicial.');
});

// iOS: mostra instruções manuais se não estiver em standalone
if(isIOS() && !isPWA() && shouldShowInstallBanner()){
  setTimeout(()=>{
    document.getElementById('iosBanner').style.display = 'block';
  }, 1500);
}

// Se estiver no navegador normal (não PWA), mostra aviso na sync-bar
if(!isPWA()){
  setTimeout(()=>{
    // Mostra toast com dica de instalação após 5s (só uma vez por sessão)
    if(!sessionStorage.getItem('pwaHintShown')){
      sessionStorage.setItem('pwaHintShown','1');
      // Não mostra toast se algum banner já estiver visível
      const bannerVis = document.getElementById('installBanner').style.display !== 'none'
                     || document.getElementById('iosBanner').style.display !== 'none';
      if(!bannerVis && shouldShowInstallBanner() && !isIOS() && !isAndroidChrome()){
        showToast('💡 Instale o app para abrir em tela cheia!');
      }
    }
  }, 5000);
}

/* ===================== MAPA DE ESCALA ===================== */
let _mapaSetor = 'garcom';
let _mapaFiltro = 'escala';
const DIAS_SEMANA = ['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
const DIAS_IDX = {SEG:0,TER:1,QUA:2,QUI:3,SEX:4,SAB:5,DOM:6};

function showMapa(){
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navMapa').classList.add('active');
  const panel = document.getElementById('mapaPanel');
  panel.classList.add('open');
  // Label da semana
  const dates = getWeekDates();
  const fmt = d => d.getDate()+'/'+(d.getMonth()+1);
  document.getElementById('mapaWeekLabel').textContent = fmt(dates[0])+' – '+fmt(dates[6]);
  renderMapa();
}

function closeMapa(){
  document.getElementById('mapaPanel').classList.remove('open');
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('navEscala').classList.add('active');
}

function setMapaSetor(s){
  _mapaSetor=s;
  ['garcom','cumim','bar','outros'].forEach(x=>{
    const el=document.getElementById('mapaTab_'+x);
    if(el) el.classList.toggle('active',x===s);
  });
  renderMapa();
}

function setMapaFiltro(f){
  _mapaFiltro=f;
  ['escala','horarios','domingo'].forEach(x=>{
    const el=document.getElementById('mapaFil_'+x);
    if(el) el.classList.toggle('active',x===f);
  });
  // Legenda só aparece na escala semanal
  document.getElementById('mapaLegenda').style.display = f==='escala'?'flex':'none';
  renderMapa();
}

function _getFuncsSetor(setor){
  const cats = {
    garcom: f => ['GARÇOM','CHEFE DE FILA'].includes(f.categoria),
    cumim:  f => f.categoria === 'CUMIM',
    bar:    f => ['BARMAN','AUXILIAR DE BAR','COPEIRO'].includes(f.categoria),
    outros: f => !['GARÇOM','CHEFE DE FILA','CUMIM','BARMAN','AUXILIAR DE BAR','COPEIRO'].includes(f.categoria)
  };
  return EQUIPE.filter(cats[setor] || (()=>false));
}

function _turnoClass(turno){
  if(turno==='ABERTURA') return 'row-ab';
  if(turno==='INTERCALADO') return 'row-int';
  if(turno==='FECHAMENTO') return 'row-fec';
  if(turno==='LICENÇA') return 'row-lic';
  return 'row-int';
}

function _nomeAbrev(nome){
  // Exceção: JOSE FABRICIO deve aparecer como FABRICIO
  if(nome.startsWith('JOSE FABRICIO')) return 'FABRICIO';
  const parts = nome.trim().split(' ');
  if(parts[0].length <= 9) return parts[0];
  return parts[0].substring(0,8)+'…';
}

function renderMapa(){
  const cont = document.getElementById('mapaConteudo');
  const funcs = _getFuncsSetor(_mapaSetor);
  if(!funcs.length){
    cont.innerHTML = '<div class="empty">Nenhum funcionário neste setor</div>';
    return;
  }

  if(_mapaFiltro === 'escala') {
    cont.innerHTML = renderMapaEscala(funcs);
  } else if(_mapaFiltro === 'horarios') {
    cont.innerHTML = renderMapaHorarios(funcs);
  } else {
    cont.innerHTML = renderMapaDomingo(funcs);
  }
}

function renderMapaEscala(funcs){
  const dates = getWeekDates();
  const ordemTurno = ['ABERTURA','INTERCALADO','FECHAMENTO','LICENÇA','ADMINISTRATIVO'];
  const grupos = {};
  ordemTurno.forEach(t => grupos[t]=[]);
  funcs.forEach(f=>{
    const t = f.turno || 'INTERCALADO';
    if(!grupos[t]) grupos[t]=[];
    grupos[t].push(f);
  });

  const STATUS_CFG = {
    'falta':            {txt:'FALTA', bg:'#e74c3c33',color:'#e74c3c'},
    'atestado':         {txt:'ATES.', bg:'#2980b933',color:'#2980b9'},
    'troca-horario':    {txt:'T.HOR',bg:'#d3540033',color:'#d35400'},
    'troca-folga':      {txt:'T.FOL',bg:'#8e44ad33',color:'#8e44ad'},
    'medida':           {txt:'DISC.', bg:'#e8439333',color:'#e84393'},
    'saida-antecipada': {txt:'S.ANT',bg:'#f39c1233',color:'#f39c12'},
    'banco-horas':      {txt:'B.HOR',bg:'#00b89433',color:'#00b894'},
  };

  let html = '<div class="mapa-tbl-wrap"><table class="mapa-tbl"><thead><tr>';
  DIAS_SEMANA.forEach((d,i) => {
    const dt = dates[i];
    const num = dt ? dt.getDate() : '';
    html += `<th>${d}<br><span style="font-weight:400;color:#5a6480">${num}</span></th>`;
  });
  html += '</tr></thead><tbody>';

  let totalPorDia = [0,0,0,0,0,0,0];
  let primeiroGrupo = true;

  ordemTurno.forEach(turno => {
    const gr = grupos[turno] || [];
    if(!gr.length) return;

    if(!primeiroGrupo){
      html += '<tr class="row-sep"><td colspan="7"></td></tr>';
    }
    primeiroGrupo = false;

    let contPorDia = [0,0,0,0,0,0,0];
    gr.forEach(f => {
      const folgaIdx  = f.folga  ? DIAS_IDX[f.folga]  : -1;
      const folga2Idx = f.folga2 ? DIAS_IDX[f.folga2] : -1;
      const cls = _turnoClass(turno);
      html += `<tr class="${cls}">`;
      DIAS_SEMANA.forEach((_,di) => {
        const isFolga = di === folgaIdx || di === folga2Idx;
        if(turno === 'LICENÇA'){
          html += `<td style="color:#5a6480;font-size:7px">LIC</td>`;
          return;
        }
        if(isFolga){
          html += `<td class="cell-folga">✕</td>`;
          return;
        }
        // Domingo (di===6): verificar folgaDom da semana atual
        if(di === 6){
          const domDate = WEEK_DATES[6];
          const domStr = String(domDate.getDate()).padStart(2,'0')+'/'+String(domDate.getMonth()+1).padStart(2,'0')+'/'+domDate.getFullYear();
          const folgaDomArr = f.folgaDom || [];
          if(folgaDomArr.includes(domStr)){
            html += `<td class="cell-folga">✕</td>`;
            return;
          }
        }
        // Célula normal: lê status do Firebase
        const rec = getRec(di, f.nome);
        const st  = rec && rec.status ? rec.status : '';
        const cfg = STATUS_CFG[st];
        if(cfg){
          html += `<td style="background:${cfg.bg};color:${cfg.color};font-weight:900;font-size:7px">${cfg.txt}</td>`;
        } else {
          html += `<td>${_nomeAbrev(f.nome)}</td>`;
        }
        contPorDia[di]++;
        totalPorDia[di]++;
      });
      html += '</tr>';
    });

    if(turno !== 'LICENÇA'){
      html += '<tr class="row-total"><td>'+turno.substring(0,4)+'.</td>';
      contPorDia.forEach(c => html += `<td>${c}</td>`);
      html += '</tr>';
    }
  });

  html += '<tr class="row-sep"><td colspan="7"></td></tr>';
  html += '<tr class="row-grand"><td>TOTAL</td>';
  totalPorDia.forEach(c => html += `<td>${c}</td>`);
  html += '</tr>';
  html += '</tbody></table></div>';
  html += `<div style="display:flex;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--border)">
    <button class="mapa-edit-btn" onclick="showToast('Em breve: edição da escala')">✏️ Editar escala</button>
  </div>`;
  return html;
}

function renderMapaHorarios(funcs){
  const grupos = {};
  funcs.forEach(f=>{
    if(!f.horIni) return;
    const key = f.horIni+' às '+f.horFim;
    if(!grupos[key]) grupos[key]=[];
    grupos[key].push(_nomeAbrev(f.nome));
  });

  if(!Object.keys(grupos).length) return '<div class="empty">Sem horários cadastrados</div>';

  const sorted = Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0]));
  let html = '<div class="mapa-hor-block">';
  html += `<div class="mapa-hor-header">Horários — ${_setorNome(_mapaSetor)}</div>`;
  sorted.forEach(([time, names])=>{
    html += `<div class="mapa-hor-row">
      <div class="mapa-hor-time">${time}</div>
      <div class="mapa-hor-names">${names.join(' · ')}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function renderMapaDomingo(funcs){
  // Gera os próximos 5 domingos a partir da semana atual
  const hoje = new Date();
  const domingos = [];
  const d = new Date(hoje);
  d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
  for(let i=0;i<5;i++){
    const dd = new Date(d);
    dd.setDate(d.getDate() + i*7);
    domingos.push(dd);
  }
  const fmt = dt => String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear();
  const fmtLabel = dt => dt.getDate()+'/'+(dt.getMonth()+1);

  // Quem não tem folga DOM fixa e não está em licença
  const candidatos = funcs.filter(f=>f.folga!=='DOM' && f.folga2!=='DOM' && f.turno!=='LICENÇA');

  let html = '<div class="mapa-dom-block">';
  html += `<div class="mapa-dom-title">Domingo do mês — ${_setorNome(_mapaSetor)}</div>`;
  html += '<div class="mapa-tbl-wrap"><table class="mapa-dom-tbl"><thead><tr>';
  domingos.forEach(dt => html += `<th>${fmtLabel(dt)}</th>`);
  html += '</tr></thead><tbody>';

  // Colunas: apenas quem FOLGA naquele domingo
  const colunas = domingos.map(dt => {
    const dataStr = fmt(dt);
    return candidatos
      .filter(f => (f.folgaDom||[]).includes(dataStr))
      .map(f => _nomeAbrev(f.nome));
  });
  const maxRows = Math.max(...colunas.map(c=>c.length), 0);

  for(let r=0; r<maxRows; r++){
    html += '<tr>';
    colunas.forEach(col => {
      html += col[r] ? `<td>${col[r]}</td>` : `<td class="vazio">—</td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  // Folgas semanais — tabela com colunas por dia
  const DIAS_FOLGA = ['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
  const colsDias = DIAS_FOLGA.filter(dia => funcs.some(f=>f.folga===dia||f.folga2===dia));
  const colunasFolga = colsDias.map(dia =>
    funcs.filter(f=>f.folga===dia||f.folga2===dia).map(f=>_nomeAbrev(f.nome))
  );
  const maxRowsFolga = Math.max(...colunasFolga.map(c=>c.length), 0);

  html += `<div class="mapa-tbl-wrap" style="margin-top:10px">
    <div style="font-size:9px;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding:0 2px">Folgas semanais</div>
    <table class="mapa-dom-tbl"><thead><tr>`;
  colsDias.forEach(dia => { html += `<th>${dia}</th>`; });
  html += '</tr></thead><tbody>';
  for(let r=0; r<maxRowsFolga; r++){
    html += '<tr>';
    colunasFolga.forEach(col => {
      html += col[r] ? `<td>${col[r]}</td>` : `<td class="vazio"></td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  html += '</div>';
  return html;
}




// ═══════════════════════════════════════════════════════════════
// SISTEMA DE FREELANCES — CICLO FIXO DE 8 DIÁRIAS + PAGAMENTOS
// Dados salvos em:
// freelances/{id}
// freelances_slots/{id}/{ordem}
// freelances_payments/{id}/{paymentId}
// legado lido de freelances_freq para migração automática
// ═══════════════════════════════════════════════════════════════

let _flFiltro = 'hoje';
let _flSub    = 'lista';
let _flCache  = {};
let _flSlotsCache = {};
let _flPayCache   = {};
let _flLegacyFreq = {};

function _flMetaDiarias(fl){
  return Math.max(8, parseInt(fl?.totalDiarias || fl?.dias || 8) || 8);
}
function _flTotalDiarias(fl){
  return _flMetaDiarias(fl);
}
function _flCamposTotais(fl){
  return Math.max(_flMetaDiarias(fl), parseInt(fl?.totalCampos || fl?.totalDiarias || fl?.dias || 8) || 8);
}
function _flEnsureSlots(flId, total=8){
  total = Math.max(1, parseInt(total)||8);
  if(!_flSlotsCache[flId]) _flSlotsCache[flId] = {};
  for(let i=1;i<=total;i++){
    if(!_flSlotsCache[flId][i]) _flSlotsCache[flId][i] = {ordem:i, data:'', status:'', ts:0};
  }
}
function _flSlots(flId){
  const fl = _flCache[flId];
  const total = _flCamposTotais(fl||{});
  _flEnsureSlots(flId, total);
  return Array.from({length:total},(_,ix)=>_flSlotsCache[flId][ix+1]||{ordem:ix+1,data:'',status:'',ts:0});
}
function _flPersistAllSlots(flId){
  if(!(fbDb&&fbConnected)) return;
  const payload = {};
  Object.keys(_flSlotsCache[flId]||{}).forEach(k=>{
    const n = Number(k);
    if(!n) return;
    payload[n] = _flSlotsCache[flId][n] || {ordem:n,data:'',status:'',ts:0};
  });
  fbDb.ref('freelances_slots/'+flId).set(payload).catch(e=>console.warn('FL slots sync:',e));
}
function _flRecalcCampos(flId){
  const fl = _flCache[flId]; if(!fl) return;
  const meta = _flMetaDiarias(fl);
  const slots = _flSlots(flId);
  const extras = slots.filter(s=>s.status==='falta' || s.status==='folga').length;
  let totalDesejado = meta + extras;
  let atual = _flCamposTotais(fl);
  _flEnsureSlots(flId, atual);
  if(totalDesejado > atual){
    _flEnsureSlots(flId, totalDesejado);
    atual = totalDesejado;
  }else if(totalDesejado < atual){
    for(let ordem=atual; ordem>totalDesejado; ordem--){
      const s = (_flSlotsCache[flId]||{})[ordem];
      if(s && (s.data || s.status)){
        totalDesejado = ordem;
        break;
      }
      if(_flSlotsCache[flId]) delete _flSlotsCache[flId][ordem];
      if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+flId+'/'+ordem).remove().catch(()=>{});
    }
    atual = totalDesejado;
  }
  if((fl.totalCampos||meta)!==atual){
    fl.totalCampos = atual;
    _salvarFlFirebase(fl);
  }
  _flPersistAllSlots(flId);
}
function _flPayments(flId){ return Object.values(_flPayCache[flId]||{}).sort((a,b)=>(a.data||'').localeCompare(b.data||'') || (a.ts||0)-(b.ts||0)); }
function _flWorkedCount(flId){ return _flSlots(flId).filter(s=>s.status==='presente').length; }
function _flFilledCount(flId){ return _flSlots(flId).filter(s=>s.status).length; }
function _flPagamentoPorSlot(fl){
  const valorDia = Number(fl?.valor)||0;
  const pagos = _flPayments(fl.id).reduce((s,p)=>s + (Number(p.valor)||0), 0);
  let restante = +pagos.toFixed(2);
  const mapa = {};
  _flSlots(fl.id).forEach(s=>{
    if(s.status!=='presente'){
      mapa[s.ordem] = {valorDia, pago:0, status:'nao-aplica'};
      return;
    }
    const pago = Math.max(0, Math.min(valorDia, +restante.toFixed(2)));
    restante = Math.max(0, +(restante - pago).toFixed(2));
    const status = pago>=valorDia ? 'pago' : (pago>0 ? 'parcial' : 'pendente');
    mapa[s.ordem] = {valorDia, pago:+pago.toFixed(2), status};
  });
  return mapa;
}
function _flPendenciasPagamento(fl){
  const mapa = _flPagamentoPorSlot(fl);
  return _flSlots(fl.id).filter(s=>s.status==='presente' && (mapa[s.ordem]?.pago||0) < (Number(fl.valor)||0));
}
function _flWorkedCount(flId){ return _flSlots(flId).filter(s=>s.status==='presente').length; }
function _flFilledCount(flId){ return _flSlots(flId).filter(s=>s.status).length; }
function _flAtualizarFechamento(flId){
  const fl = _flCache[flId]; if(!fl) return;
  const fechado = _flWorkedCount(flId) >= _flMetaDiarias(fl);
  if(fechado && !fl.encerradoEm){ fl.encerradoEm = Date.now(); _salvarFlFirebase(fl); }
  if(!fechado && fl.encerradoEm){ delete fl.encerradoEm; _salvarFlFirebase(fl); }
}
function _flResumoPagamento(fl){
  const flId = fl.id;
  const worked = _flWorkedCount(flId);
  const valorDia = Number(fl.valor)||0;
  const totalTrabalhado = worked * valorDia;
  const totalPago = _flPayments(flId).reduce((s,p)=>s + (Number(p.valor)||0), 0);
  const saldo = Math.max(0, +(totalTrabalhado - totalPago).toFixed(2));
  return {worked, valorDia, totalTrabalhado:+totalTrabalhado.toFixed(2), totalPago:+totalPago.toFixed(2), saldo};
}
function _flPrimeiroPagamentoPendente(fl){
  const pays = _flPayments(fl.id);
  return _flWorkedCount(fl.id)>0 && !pays.some(p=>p.tipo==='primeiro-dia');
}
function _flQuitacaoPendente(fl){
  const resumo = _flResumoPagamento(fl);
  return _flWorkedCount(fl.id)>=_flMetaDiarias(fl) && resumo.saldo>0;
}
function _flFmtDiaSemana(iso){
  if(!iso) return '—';
  const d = new Date(iso+'T12:00:00');
  const dias=['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
  return dias[d.getDay()];
}
function _fmtMoney(v){ return Number(v||0).toFixed(2).replace('.',','); }
function _isoHoje(){ return new Date().toISOString().split('T')[0]; }

function openFreelance(){
  closeModal('maisMenu');
  _carregarFreelancesFirebase().then(()=>{
    _renderAlertas();
    buildFlContent();
  });
  openPanel('freelancePanel');
}

async function _carregarFreelancesFirebase(){
  if(!fbDb||!fbConnected){ _flCache={}; _flSlotsCache={}; _flPayCache={}; _flLegacyFreq={}; return; }
  try{
    const [snapFl, snapSlots, snapPay, snapLegacy] = await Promise.all([
      fbDb.ref('freelances').once('value'),
      fbDb.ref('freelances_slots').once('value'),
      fbDb.ref('freelances_payments').once('value'),
      fbDb.ref('freelances_freq').once('value')
    ]);
    _flCache = snapFl.val() || {};
    _flSlotsCache = snapSlots.val() || {};
    _flPayCache = snapPay.val() || {};
    _flLegacyFreq = {};
    const leg = snapLegacy.val() || {};
    Object.entries(leg).forEach(([enc,v])=>{
      const k = fbDecode(enc);
      if(k && k.includes('_')) _flLegacyFreq[k] = v || {};
      _fbCache['flfreq_'+k] = v || {};
    });
    Object.values(_flCache).forEach(fl=>{
      if(!fl || !fl.id) return;
      const totalPadrao = _flMetaDiarias(fl);
      const mudouPacote = Number(fl.dias||fl.totalDiarias||0) !== totalPadrao;
      fl.dias = totalPadrao;
      fl.totalDiarias = totalPadrao;
      fl.totalCampos = Math.max(_flCamposTotais(fl), totalPadrao);
      _flEnsureSlots(fl.id, fl.totalCampos);
      _migrarFreelanceLegado(fl.id);
      if(!_flPayCache[fl.id]) _flPayCache[fl.id] = {};
      if(mudouPacote) _salvarFlFirebase(fl);
    });
  }catch(e){
    console.warn('FL load:',e);
    _flCache={}; _flSlotsCache={}; _flPayCache={}; _flLegacyFreq={};
  }
}

function _migrarFreelanceLegado(flId){
  const slots = _flSlots(flId);
  if(slots.some(s=>s.data || s.status)) return;
  const prefix = flId+'_';
  const legado = Object.entries(_flLegacyFreq)
    .filter(([k,v])=>k.startsWith(prefix) && v && (v.status||'')!=='')
    .map(([k,v])=>({
      data:k.slice(prefix.length),
      status:v.status||'',
      ts:v.ts||Date.now()
    }))
    .sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  if(!legado.length) return;
  legado.slice(0, slots.length).forEach((item, idx)=>{
    const ordem = idx+1;
    _flSlotsCache[flId][ordem] = {ordem, data:item.data, status:item.status, ts:item.ts||Date.now()};
    if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+flId+'/'+ordem).set(_flSlotsCache[flId][ordem]);
  });
}

function _salvarFlFirebase(fl){
  if(!fbDb||!fbConnected) return;
  fbDb.ref('freelances/'+fl.id).set(fl).catch(e=>console.warn('FL save:',e));
}
function _saveFlSlot(flId, ordem, slot){
  if(!_flSlotsCache[flId]) _flSlotsCache[flId] = {};
  _flSlotsCache[flId][ordem] = slot;
  if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+flId+'/'+ordem).set(slot).catch(e=>console.warn('FL slot save:',e));
}
function _removeFlSlot(flId, ordem){
  if(_flSlotsCache[flId]) _flSlotsCache[flId][ordem] = {ordem, data:'', status:'', ts:0};
  if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+flId+'/'+ordem).set({ordem, data:'', status:'', ts:0}).catch(()=>{});
}
function _saveFlPayment(flId, pay){
  if(!_flPayCache[flId]) _flPayCache[flId] = {};
  _flPayCache[flId][pay.id] = pay;
  if(fbDb&&fbConnected) fbDb.ref('freelances_payments/'+flId+'/'+pay.id).set(pay).catch(e=>console.warn('FL pay save:',e));
}
function _removeFlPayment(flId, payId){
  if(_flPayCache[flId]) delete _flPayCache[flId][payId];
  if(fbDb&&fbConnected) fbDb.ref('freelances_payments/'+flId+'/'+payId).remove().catch(()=>{});
}

function _flDataFim(fl){
  const dataIso = fl.dataIni || _isoHoje();
  const ini = new Date(dataIso+'T12:00:00');
  const fim = new Date(ini);
  fim.setDate(ini.getDate() + (_flTotalDiarias(fl) - 1));
  return fim;
}
function _fmtData(iso){
  if(!iso) return '';
  const [a,m,d] = iso.split('-');
  return d+'/'+m+'/'+a;
}
function _diasUsadosMes(fl){
  const hoje = new Date();
  const ym = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  return _flSlots(fl.id).filter(s=>s.data && s.data.startsWith(ym)).length;
}
function _flStatus(fl){
  const hojeIso = _isoHoje();
  const slots = _flSlots(fl.id);
  const isHoje = slots.some(s=>s.data===hojeIso);
  const isPrimeiro = _flPrimeiroPagamentoPendente(fl) && slots.some(s=>s.ordem===1 && s.data===hojeIso && s.status==='presente');
  const isUltimo = _flQuitacaoPendente(fl) && slots.some(s=>s.data===hojeIso);
  const encerrado = _flWorkedCount(fl.id) >= _flMetaDiarias(fl);
  const ultrapassou = _diasUsadosMes(fl) > 8;
  return {isHoje,isPrimeiro,isUltimo,expirou:encerrado,ultrapassou,diasUsados:_diasUsadosMes(fl),ini:new Date((fl.dataIni||hojeIso)+'T12:00:00'),fim:_flDataFim(fl)};
}
function _flPassaFiltro(fl, filtro){
  if(filtro==='todos') return true;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const seg=new Date(hoje); seg.setDate(hoje.getDate()-(hoje.getDay()||7)+1);
  const dom=new Date(seg); dom.setDate(seg.getDate()+6);
  const slots = _flSlots(fl.id).filter(s=>s.data);
  const datas = slots.length ? slots.map(s=>new Date(s.data+'T12:00:00')) : [new Date((fl.dataIni||_isoHoje())+'T12:00:00')];
  if(filtro==='hoje') return datas.some(d=>d.toDateString()===hoje.toDateString()) || _flWorkedCount(fl.id)<_flMetaDiarias(fl);
  if(filtro==='semana') return datas.some(d=>d>=seg&&d<=dom) || _flWorkedCount(fl.id)<_flMetaDiarias(fl);
  if(filtro==='mes') return datas.some(d=>d.getMonth()===hoje.getMonth()&&d.getFullYear()===hoje.getFullYear()) || _flWorkedCount(fl.id)<_flMetaDiarias(fl);
  return true;
}

function setFlFiltro(f){
  _flFiltro=f;
  document.querySelectorAll('#flFiltroBar .fbtn').forEach((b,i)=>{
    b.classList.toggle('active',['hoje','semana','mes','todos'][i]===f);
  });
  buildFlContent();
}
function setFlSub(s){
  _flSub=s;
  ['lista','primeiro','ultimo','pendentes','frequencia','financeiro'].forEach(k=>{
    const map={lista:'Lista',primeiro:'Primeiro',ultimo:'Ultimo',pendentes:'Pendentes',frequencia:'Freq',financeiro:'Financeiro'};
    const el=document.getElementById('flSub'+map[k]);
    if(el) el.classList.toggle('active',k===s);
  });
  buildFlContent();
}

function _renderAlertas(){
  const div = document.getElementById('flAlertas');
  if(!div) return;
  if(_flSub!=='pendentes'){
    div.innerHTML='';
    div.style.display='none';
    return;
  }
  const alerts = [];
  Object.values(_flCache).forEach(fl=>{
    if(!fl||!fl.id) return;
    const resumo = _flResumoPagamento(fl);
    if(_flPrimeiroPagamentoPendente(fl)) alerts.push({tipo:'primeiro',fl,valor:Math.min(resumo.valorDia,resumo.saldo||resumo.valorDia)});
    if(_flQuitacaoPendente(fl)) alerts.push({tipo:'ultimo',fl,valor:resumo.saldo});
  });
  if(!alerts.length){
    div.style.display='none';
    div.innerHTML='';
    return;
  }
  div.style.display='block';
  div.innerHTML = `<div style="padding:10px 14px 0"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px">Alertas de pagamento</div></div>` + alerts.map(a=>{
    const cor = a.tipo==='primeiro'?'#27ae60':'#f5c842';
    const icon= a.tipo==='primeiro'?'💰':'💳';
    const txt = a.tipo==='primeiro'
      ? `<strong>${a.fl.nome}</strong> — registrar pagamento do 1º dia (R$ ${_fmtMoney(a.valor)})`
      : `<strong>${a.fl.nome}</strong> — quitar saldo final (R$ ${_fmtMoney(a.valor)})`;
    return `<div style="background:${cor}18;border-left:3px solid ${cor};padding:9px 13px;margin:6px 14px;border-radius:8px;font-size:12px;color:${cor};display:flex;gap:8px;align-items:center">
      <span style="font-size:16px">${icon}</span><span>${txt}</span>
    </div>`;
  }).join('');
}

function buildFlContent(){
  const el = document.getElementById('flContent');
  if(!el) return;
  const fls = Object.values(_flCache)
    .filter(fl=>fl&&fl.id&&_flPassaFiltro(fl,_flFiltro))
    .sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));
  if(_flSub==='lista') _renderFlLista(el, fls);
  else if(_flSub==='primeiro') _renderFlPagamento(el, fls, 'primeiro');
  else if(_flSub==='ultimo') _renderFlPagamento(el, fls, 'ultimo');
  else if(_flSub==='pendentes') _renderFlPendentes(el, fls);
  else if(_flSub==='financeiro') _renderFlFinanceiro(el, fls);
  else _renderFlFrequencia(el, fls);
}

function _renderFlLista(el, fls){
  if(!fls.length){ el.innerHTML='<div class="empty">Nenhum freelance encontrado.</div>'; return; }
  el.innerHTML = fls.map(fl=>{
    const resumo = _flResumoPagamento(fl);
    const total = _flCamposTotais(fl);
    const filled = _flFilledCount(fl.id);
    const primeiro = _flPrimeiroPagamentoPendente(fl);
    const quitacao = _flQuitacaoPendente(fl);
    const bordaCor = quitacao?'#f5c842':primeiro?'#27ae60':'#a855f7';
    const payMap = _flPagamentoPorSlot(fl);
    const slotsHtml = _flSlots(fl.id).map(s=>{
      const cor = s.status==='presente'?'#27ae60':s.status==='falta'?'#e74c3c':s.status==='folga'?'#7a85a3':'var(--s3)';
      const tx = s.data ? `${_flFmtDiaSemana(s.data)}<br>${s.data.split('-')[2]}/${s.data.split('-')[1]}` : `#${s.ordem}<br>—`;
      const p = payMap[s.ordem]||{};
      const badgeTxt = s.status==='presente' ? (p.status==='pago'?'💳 PAGO':(p.status==='parcial'?'🟡 PARCIAL':'⏳ PEND.')) : '';
      return `<div style="min-width:60px;background:${cor};border:1px solid var(--border);border-radius:10px;padding:6px 4px;text-align:center;font-size:10px;font-weight:700;color:${s.status?'#fff':'var(--sub)'}">${tx}${badgeTxt?`<div style="font-size:8px;margin-top:4px;opacity:.95">${badgeTxt}</div>`:''}</div>`;
    }).join('');
    return `<div style="background:var(--s2);border-radius:14px;padding:13px 15px;border:1px solid var(--border);border-left:3px solid ${bordaCor};margin:0 14px 10px;box-shadow:0 2px 8px #00000020">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700">${fl.nome}</div>
          <div style="font-size:10px;color:var(--sub);margin-top:2px">${fl.funcao} · ${resumo.worked}/${total} presenças · ${filled}/${total} campos usados</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button onclick="openFlFreqModal('${fl.id}')" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">📅</button>
          <button onclick="openFlPayModal('${fl.id}')" style="background:none;border:1px solid #f5c84244;color:#f5c842;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">💳</button>
          <button onclick="openEditarFreelance('${fl.id}')" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">✏️</button>
          <button onclick="excluirFreelance('${fl.id}')" style="background:none;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">🗑️</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">VALOR/DIA</div><div style="font-size:12px;font-weight:700">R$ ${_fmtMoney(fl.valor)}</div></div>
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">PAGO</div><div style="font-size:12px;font-weight:700;color:#27ae60">R$ ${_fmtMoney(resumo.totalPago)}</div></div>
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">SALDO</div><div style="font-size:12px;font-weight:700;color:${resumo.saldo?'#f5c842':'#7a85a3'}">R$ ${_fmtMoney(resumo.saldo)}</div></div>
      </div>
      <div style="display:flex;gap:6px;overflow:auto;padding-bottom:4px;margin-bottom:8px">${slotsHtml}</div>
      <div style="font-size:10px;color:var(--sub)">${primeiro?'💰 Falta registrar o pagamento do 1º dia. ':''}${quitacao?'💳 Ciclo fechado com saldo pendente. ':''}${fl.auth?('Autorizado por '+fl.auth):''}</div>
    </div>`;
  }).join('');
}

function _renderFlPagamento(el, fls, tipo){
  const lista = fls.filter(fl=> tipo==='primeiro' ? _flPrimeiroPagamentoPendente(fl) : _flQuitacaoPendente(fl));
  const total = lista.reduce((s,fl)=>{
    const resumo = _flResumoPagamento(fl);
    return s + (tipo==='primeiro' ? Math.min(resumo.valorDia, resumo.saldo||resumo.valorDia) : resumo.saldo);
  }, 0);
  const cor = tipo==='primeiro' ? '#27ae60' : '#f5c842';
  const titulo = tipo==='primeiro' ? '💰 PAGAMENTO DO 1º DIA PENDENTE' : '💳 QUITAÇÃO FINAL PENDENTE';
  if(!lista.length){
    el.innerHTML=`<div style="text-align:center;padding:30px 20px;color:var(--sub)"><div style="font-size:32px;margin-bottom:8px">${tipo==='primeiro'?'💰':'💳'}</div><div style="font-size:13px">Nenhum pagamento pendente nessa etapa</div></div>`;
    return;
  }
  el.innerHTML = `<div style="background:${cor}18;border:1px solid ${cor}44;border-radius:12px;padding:12px 16px;margin:6px 14px 12px;text-align:center"><div style="font-size:10px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${titulo}</div><div style="font-size:28px;font-weight:800;color:${cor};font-family:'Barlow Condensed',sans-serif">R$ ${_fmtMoney(total)}</div><div style="font-size:10px;color:var(--sub);margin-top:2px">${lista.length} freelance(s)</div></div>`+
    lista.map(fl=>{
      const resumo = _flResumoPagamento(fl);
      const valor = tipo==='primeiro' ? Math.min(resumo.valorDia, resumo.saldo||resumo.valorDia) : resumo.saldo;
      return `<div style="background:var(--s2);border-radius:12px;padding:12px 14px;border:1px solid ${cor}33;margin:0 14px 8px;display:flex;align-items:center;gap:10px">
        <div style="flex:1"><div style="font-weight:700;font-size:14px">${fl.nome}</div><div style="font-size:10px;color:var(--sub)">${fl.funcao} · ${_flWorkedCount(fl.id)}/${_flTotalDiarias(fl)} presenças</div></div>
        <button onclick="openFlPayModal('${fl.id}','${tipo}')" style="background:${cor}18;border:1px solid ${cor}44;color:${cor};border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer">R$ ${_fmtMoney(valor)}</button>
      </div>`;
    }).join('');
}


function _renderFlPendentes(el, fls){
  const lista = fls.filter(fl=>_flPendenciasPagamento(fl).length>0);
  if(!lista.length){
    el.innerHTML=`<div style="text-align:center;padding:30px 20px;color:var(--sub)"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="font-size:13px">Nenhuma diária pendente de pagamento</div></div>`;
    return;
  }
  el.innerHTML = lista.map(fl=>{
    const pend = _flPendenciasPagamento(fl);
    const mapa = _flPagamentoPorSlot(fl);
    const valorPendente = pend.reduce((s,x)=> s + Math.max(0,(Number(fl.valor)||0) - (mapa[x.ordem]?.pago||0)), 0);
    const chips = pend.map(s=>`<div style="background:#f5c84218;border:1px solid #f5c84244;border-radius:9px;padding:6px 8px;min-width:78px;text-align:center"><div style="font-size:9px;color:var(--sub)">${_flFmtDiaSemana(s.data)} ${s.data?('· '+s.data.split('-')[2]+'/'+s.data.split('-')[1]):''}</div><div style="font-size:11px;font-weight:800;color:#f5c842">R$ ${_fmtMoney(Math.max(0,(Number(fl.valor)||0)-(mapa[s.ordem]?.pago||0)))}</div></div>`).join('');
    return `<div style="background:var(--s2);border-radius:12px;padding:12px 14px;border:1px solid #f5c84233;margin:0 14px 10px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px"><div><div style="font-weight:700;font-size:14px">${fl.nome}</div><div style="font-size:10px;color:var(--sub)">${fl.funcao} · ${pend.length} diária(s) pendente(s)</div></div><button onclick="openFlPayModal('${fl.id}','pendentes')" style="background:#f5c84218;border:1px solid #f5c84244;color:#f5c842;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer">R$ ${_fmtMoney(valorPendente)}</button></div><div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div></div>`;
  }).join('');
}


function _flResumoGeral(fls){
  return fls.reduce((acc,fl)=>{
    const r = _flResumoPagamento(fl);
    acc.trabalhado += r.totalTrabalhado;
    acc.pago += r.totalPago;
    acc.saldo += r.saldo;
    acc.presencas += r.worked;
    if(r.saldo>0) acc.comSaldo += 1;
    if((_flFilledCount(fl.id) >= _flTotalDiarias(fl)) && r.saldo<=0) acc.quitados += 1;
    if(_flFilledCount(fl.id) < _flTotalDiarias(fl)) acc.emAndamento += 1;
    return acc;
  }, {trabalhado:0,pago:0,saldo:0,presencas:0,comSaldo:0,quitados:0,emAndamento:0});
}

function iniciarNovoPacoteFreelance(flId){
  const fl = _flCache[flId]; if(!fl) return;
  const resumo = _flResumoPagamento(fl);
  if(resumo.saldo>0){ showToast('⚠️ Quite o saldo antes de abrir um novo pacote'); return; }
  const prox = {...fl};
  prox.id = 'fl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  prox.dataIni = _isoHoje();
  prox.criadoEm = Date.now();
  delete prox.encerradoEm;
  _flCache[prox.id] = prox;
  _flEnsureSlots(prox.id, _flTotalDiarias(prox));
  _flPayCache[prox.id] = {};
  _salvarFlFirebase(prox);
  if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+prox.id).set(_flSlotsCache[prox.id]);
  setFlSub('lista');
  buildFlContent();
  showToast('✅ Novo pacote criado para '+prox.nome);
}

function _renderFlFinanceiro(el, fls){
  if(!fls.length){ el.innerHTML='<div class="empty">Nenhum freelance encontrado.</div>'; return; }
  const g = _flResumoGeral(fls);
  const topo = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:0 14px 12px">
      <div style="background:#27ae6018;border:1px solid #27ae6044;border-radius:12px;padding:12px;text-align:center"><div style="font-size:10px;color:#27ae60;font-weight:800">TRABALHADO</div><div style="font-size:22px;font-weight:800;color:#27ae60;font-family:'Barlow Condensed',sans-serif">R$ ${_fmtMoney(g.trabalhado)}</div></div>
      <div style="background:#2980b918;border:1px solid #2980b944;border-radius:12px;padding:12px;text-align:center"><div style="font-size:10px;color:#2980b9;font-weight:800">PAGO</div><div style="font-size:22px;font-weight:800;color:#2980b9;font-family:'Barlow Condensed',sans-serif">R$ ${_fmtMoney(g.pago)}</div></div>
      <div style="background:#f5c84218;border:1px solid #f5c84244;border-radius:12px;padding:12px;text-align:center"><div style="font-size:10px;color:#f5c842;font-weight:800">SALDO</div><div style="font-size:22px;font-weight:800;color:#f5c842;font-family:'Barlow Condensed',sans-serif">R$ ${_fmtMoney(g.saldo)}</div></div>
      <div style="background:#a855f718;border:1px solid #a855f744;border-radius:12px;padding:12px;text-align:center"><div style="font-size:10px;color:#a855f7;font-weight:800">EM ANDAMENTO</div><div style="font-size:22px;font-weight:800;color:#a855f7;font-family:'Barlow Condensed',sans-serif">${g.emAndamento}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14px 12px">
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--sub)">COM SALDO</div><div style="font-size:18px;font-weight:800">${g.comSaldo}</div></div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--sub)">QUITADOS</div><div style="font-size:18px;font-weight:800">${g.quitados}</div></div>
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--sub)">PRESENÇAS</div><div style="font-size:18px;font-weight:800">${g.presencas}</div></div>
    </div>`;
  const lista = fls.map(fl=>{
    const r = _flResumoPagamento(fl);
    const fechado = _flFilledCount(fl.id) >= _flTotalDiarias(fl);
    const statusTxt = r.saldo>0 ? '⏳ saldo pendente' : (fechado ? '✅ quitado' : '🟣 em andamento');
    const statusCor = r.saldo>0 ? '#f5c842' : (fechado ? '#27ae60' : '#a855f7');
    const lastPay = _flPayments(fl.id).slice(-1)[0];
    return `<div style="background:var(--s2);border-radius:12px;padding:12px 14px;border:1px solid var(--border);margin:0 14px 10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px">${fl.nome}</div><div style="font-size:10px;color:var(--sub)">${fl.funcao} · ${_flWorkedCount(fl.id)}/${_flTotalDiarias(fl)} presenças</div></div><div style="font-size:11px;font-weight:800;color:${statusCor};text-transform:uppercase">${statusTxt}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">TRABALHADO</div><div style="font-size:12px;font-weight:700">R$ ${_fmtMoney(r.totalTrabalhado)}</div></div>
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">PAGO</div><div style="font-size:12px;font-weight:700;color:#27ae60">R$ ${_fmtMoney(r.totalPago)}</div></div>
        <div style="background:var(--s3);border-radius:9px;padding:7px 9px;text-align:center"><div style="font-size:9px;color:var(--sub)">SALDO</div><div style="font-size:12px;font-weight:700;color:${r.saldo?'#f5c842':'#7a85a3'}">R$ ${_fmtMoney(r.saldo)}</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="openFlPayModal('${fl.id}')" style="background:#f5c84218;border:1px solid #f5c84244;color:#f5c842;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer">💳 Pagamentos</button>
        <button onclick="copiarResumoFreelance('${fl.id}')" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer">📋 Resumo</button>
        ${fechado ? `<button onclick="iniciarNovoPacoteFreelance('${fl.id}')" style="background:#27ae6018;border:1px solid #27ae6044;color:#27ae60;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer">🆕 Novo pacote</button>` : ``}
      </div>
      <div style="font-size:10px;color:var(--sub);margin-top:8px">${lastPay ? ('Último pagamento: '+_fmtData(lastPay.data)+' · R$ '+_fmtMoney(lastPay.valor)) : 'Sem pagamento registrado ainda'}</div>
    </div>`;
  }).join('');
  el.innerHTML = topo + lista;
}

function _renderFlFrequencia(el, fls){
  if(!fls.length){ el.innerHTML='<div class="empty">Nenhum freelance encontrado.</div>'; return; }
  el.innerHTML = fls.map(fl=>{
    const total = _flCamposTotais(fl);
    const payMap = _flPagamentoPorSlot(fl);
    const slotsHtml = _flSlots(fl.id).map(s=>{
      const bg = s.status==='presente'?'#27ae60':s.status==='falta'?'#e74c3c':s.status==='folga'?'#7a85a3':'var(--s2)';
      const cor = s.status?'#fff':'var(--text)';
      const linha1 = s.data ? _flFmtDiaSemana(s.data) : `${s.ordem}º DIA`;
      const linha2 = s.data ? `${s.data.split('-')[2]}/${s.data.split('-')[1]}` : '—';
      const p = payMap[s.ordem]||{};
      const linha3 = s.status==='presente' ? (p.status==='pago'?'💳':(p.status==='parcial'?'🟡':'⏳')) : (s.status==='falta'?'❌':s.status==='folga'?'🏖️':'—');
      return `<div onclick="toggleFlSlot('${fl.id}',${s.ordem},this)" style="background:${bg};border:1px solid var(--border);border-radius:11px;padding:8px 6px;text-align:center;cursor:pointer;min-width:56px;transition:.15s"><div style="font-size:8px;color:${s.status?'#fff':'var(--sub)'};font-weight:700">${linha1}</div><div style="font-size:14px;font-weight:800;color:${cor};margin-top:2px">${linha2}</div><div style="font-size:9px;margin-top:3px;color:${s.status?'#fff':'var(--sub)'}">${linha3}</div></div>`;
    }).join('');
    return `<div style="background:var(--s2);border-radius:14px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid #a855f7;margin:0 14px 10px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px"><div><div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700">${fl.nome}</div><div style="font-size:10px;color:var(--sub)">${fl.funcao} · pacote automático de ${total} campos</div></div><button onclick="openFlFreqModal('${fl.id}')" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">DETALHE</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${slotsHtml}</div>
      <div style="margin-top:8px;font-size:10px;color:var(--sub)">Toque no campo vazio para informar a data trabalhada. Pode ser hoje ou retroativa. Ciclo: presente → falta → folga → limpar.</div>
    </div>`;
  }).join('');
}

function _flEscolherDataSlot(slots, ordem){
  const hoje = _isoHoje();
  let data = prompt('Informe a data desse dia trabalhado no formato AAAA-MM-DD.\nDeixe em branco para usar hoje.', hoje);
  if(data===null) return null;
  data = String(data||'').trim() || hoje;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){
    showToast('⚠️ Data inválida. Use AAAA-MM-DD');
    return null;
  }
  const ja = slots.find(s=>s.ordem!==ordem && s.data===data);
  if(ja){
    showToast('⚠️ Esse freelance já foi lançado nessa data em outro campo');
    return null;
  }
  return data;
}

function toggleFlSlot(flId, ordem, btn){
  const slots = _flSlots(flId);
  const atual = slots.find(s=>s.ordem===ordem) || {ordem,data:'',status:'',ts:0};
  const ciclo = ['', 'presente','falta','folga'];
  let prox = ciclo[(ciclo.indexOf(atual.status)+1)%ciclo.length];
  let data = atual.data || '';
  if(!atual.status && !atual.data){
    const escolhida = _flEscolherDataSlot(slots, ordem);
    if(escolhida===null) return;
    data = escolhida;
    prox = 'presente';
  }
  if(prox==='') data='';
  const novo = {ordem, data, status:prox, ts:Date.now()};
  _saveFlSlot(flId, ordem, novo);
  _flRecalcCampos(flId);
  _flAtualizarFechamento(flId);
  const bg = prox==='presente'?'#27ae60':prox==='falta'?'#e74c3c':prox==='folga'?'#7a85a3':'var(--s2)';
  btn.style.background=bg;
  btn.querySelectorAll('div')[0].textContent = data ? _flFmtDiaSemana(data) : `${ordem}º DIA`;
  btn.querySelectorAll('div')[1].textContent = data ? `${data.split('-')[2]}/${data.split('-')[1]}` : '—';
  btn.querySelectorAll('div')[2].textContent = prox==='presente'?'✅':prox==='falta'?'❌':prox==='folga'?'🏖️':'—';
  btn.querySelectorAll('div').forEach((d,ix)=>{ d.style.color=prox?'#fff':(ix===0||ix===2?'var(--sub)':'var(--text)'); });
  _renderAlertas();
  showToast(prox ? '✅ '+prox.charAt(0).toUpperCase()+prox.slice(1) : '— Registro removido');
}

function openFlFreqModal(flId){
  const fl = _flCache[flId]; if(!fl) return;
  const resumo = _flResumoPagamento(fl);
  document.getElementById('flFreqTitulo').textContent='📅 '+fl.nome;
  const payMap = _flPagamentoPorSlot(fl);
  const linhas = _flSlots(fl.id).map(s=>{
    const cor=s.status==='presente'?'#27ae60':s.status==='falta'?'#e74c3c':s.status==='folga'?'#7a85a3':'var(--sub)';
    const icon=s.status==='presente'?'✅':s.status==='falta'?'❌':s.status==='folga'?'🏖️':'—';
    const p = payMap[s.ordem]||{};
    const pagamento = s.status==='presente' ? (p.status==='pago'?'💳 Pago':(p.status==='parcial'?`🟡 Parcial R$ ${_fmtMoney(p.pago)}`:'⏳ Pendente')) : '';
    return `<div style="display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);gap:8px"><div style="width:42px;font-size:11px;color:var(--sub);font-weight:800">${s.ordem}º</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${s.data?_fmtData(s.data):'Sem data lançada'}</div><div style="font-size:10px;color:var(--sub)">${s.data?_flFmtDiaSemana(s.data):'Aguardando marcação'}${pagamento?(' · '+pagamento):''}</div></div><div style="font-size:13px;color:${cor};font-weight:700">${icon} ${s.status||'vazio'}</div></div>`;
  }).join('');
  document.getElementById('flFreqContent').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px"><div style="background:#27ae6018;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#27ae60">${resumo.worked}</div><div style="font-size:9px;color:var(--sub)">PRESENTES</div></div><div style="background:#f5c84218;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#f5c842">R$ ${_fmtMoney(resumo.totalPago)}</div><div style="font-size:9px;color:var(--sub)">PAGO</div></div><div style="background:#a855f718;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#a855f7">R$ ${_fmtMoney(resumo.saldo)}</div><div style="font-size:9px;color:var(--sub)">SALDO</div></div></div><div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">${linhas}</div><div style="margin-top:12px;display:flex;gap:8px"><button class="btn-cancel" onclick="closeModal('flFreqModal')">FECHAR</button><button class="btn-confirm" onclick="openFlPayModal('${fl.id}')">💳 PAGAMENTOS</button></div>`;
  openModal('flFreqModal');
}

function openFlPayModal(flId, foco=''){
  const fl = _flCache[flId]; if(!fl) return;
  const resumo = _flResumoPagamento(fl);
  const eventos = _flPayments(fl.id).map(p=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font-size:12px;font-weight:700">${p.tipo==='primeiro-dia'?'💰 1º dia':p.tipo==='quitacao'?'💳 quitação':'🟣 antecipação'}</div><div style="font-size:10px;color:var(--sub)">${_fmtData(p.data)}${p.obs?(' · '+p.obs):''}</div></div><div style="font-size:13px;font-weight:800;color:#27ae60">R$ ${_fmtMoney(p.valor)}</div><button onclick="excluirFlPagamento('${fl.id}','${p.id}')" style="background:none;border:1px solid #e74c3c44;color:#e74c3c;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">🗑️</button></div>`).join('') || `<div style="padding:14px 10px;color:var(--sub);text-align:center;font-size:12px">Nenhum pagamento registrado.</div>`;
  document.getElementById('flFreqTitulo').textContent='💳 '+fl.nome;
  document.getElementById('flFreqContent').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px"><div style="background:#27ae6018;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#27ae60">R$ ${_fmtMoney(resumo.totalTrabalhado)}</div><div style="font-size:9px;color:var(--sub)">TRABALHADO</div></div><div style="background:#2980b918;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#2980b9">R$ ${_fmtMoney(resumo.totalPago)}</div><div style="font-size:9px;color:var(--sub)">PAGO</div></div><div style="background:#f5c84218;border-radius:9px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#f5c842">R$ ${_fmtMoney(resumo.saldo)}</div><div style="font-size:9px;color:var(--sub)">SALDO</div></div></div>
    <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:12px">
      <button class="export-btn" onclick="registrarFlPagamentoRapido('${fl.id}','primeiro-dia')" style="margin-bottom:0;${foco==='primeiro'?'border-color:#27ae60;color:#27ae60':''}">💰 Registrar pagamento do 1º dia (R$ ${_fmtMoney(Math.min(Number(fl.valor)||0, resumo.saldo||Number(fl.valor)||0))})</button>
      <button class="export-btn" onclick="registrarFlPagamentoRapido('${fl.id}','antecipacao')" style="margin-bottom:0">🟣 Registrar antecipação</button>
      <button class="export-btn" onclick="registrarFlPagamentoRapido('${fl.id}','quitacao')" style="margin-bottom:0;${foco==='ultimo'?'border-color:#f5c842;color:#f5c842':''}">💳 Quitar restante (R$ ${_fmtMoney(resumo.saldo)})</button>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">${eventos}</div>
    <div style="margin-top:12px;display:flex;gap:8px"><button class="btn-cancel" onclick="closeModal('flFreqModal')">FECHAR</button><button class="btn-confirm" onclick="copiarResumoFreelance('${fl.id}')">📋 COPIAR RESUMO</button></div>`;
  openModal('flFreqModal');
}
function registrarFlPagamentoRapido(flId, tipo){
  const fl = _flCache[flId]; if(!fl) return;
  const resumo = _flResumoPagamento(fl);
  let valor = 0;
  let obs = '';
  if(tipo==='primeiro-dia'){
    if(!_flPrimeiroPagamentoPendente(fl)){ showToast('ℹ️ Primeiro dia já registrado'); return; }
    valor = Math.min(Number(fl.valor)||0, resumo.saldo||Number(fl.valor)||0);
  }else if(tipo==='quitacao'){
    if(resumo.saldo<=0){ showToast('ℹ️ Sem saldo pendente'); return; }
    valor = resumo.saldo;
  }else{
    const v = prompt('Valor da antecipação:', String(Number(fl.valor)||0).replace('.',','));
    if(v===null) return;
    valor = parseFloat(String(v).replace(',','.'))||0;
    if(valor<=0){ showToast('⚠️ Valor inválido'); return; }
    obs = prompt('Observação da antecipação (opcional):','') || '';
  }
  const pay = {id:'pay_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), data:_isoHoje(), valor:+valor.toFixed(2), tipo, obs, ts:Date.now()};
  _saveFlPayment(flId, pay);
  _flAtualizarFechamento(flId);
  _renderAlertas();
  openFlPayModal(flId);
  buildFlContent();
  showToast('✅ Pagamento registrado');
}
function excluirFlPagamento(flId, payId){
  if(!confirm('Excluir este pagamento?')) return;
  _removeFlPayment(flId, payId);
  _renderAlertas();
  openFlPayModal(flId);
  buildFlContent();
  showToast('🗑️ Pagamento removido');
}


function copiarResumoFreelance(flId){
  const fl = _flCache[flId]; if(!fl) return;
  const mapa = _flPagamentoPorSlot(fl);
  const resumo = _flResumoPagamento(fl);
  const linhas = _flSlots(fl.id).map(s=>{
    const base = `${s.ordem}º dia | ${s.data?_fmtData(s.data):'—'} | ${s.status||'vazio'}`;
    if(s.status!=='presente') return base;
    const p = mapa[s.ordem]||{};
    const pg = p.status==='pago'?'PAGO':(p.status==='parcial'?`PARCIAL R$ ${_fmtMoney(p.pago)}`:'PENDENTE');
    return `${base} | ${pg}`;
  }).join('\n');
  const txt = `FREELANCE: ${fl.nome}
FUNÇÃO: ${fl.funcao}
VALOR/DIA: R$ ${_fmtMoney(fl.valor)}
PRESENTES: ${resumo.worked}/${_flTotalDiarias(fl)}
TOTAL TRABALHADO: R$ ${_fmtMoney(resumo.totalTrabalhado)}
TOTAL PAGO: R$ ${_fmtMoney(resumo.totalPago)}
SALDO: R$ ${_fmtMoney(resumo.saldo)}
STATUS: ${resumo.saldo>0?'PENDENTE':'QUITADO'}

${linhas}`;
  navigator.clipboard?.writeText(txt).then(()=>showToast('📋 Resumo copiado')).catch(()=>showToast('⚠️ Não foi possível copiar'));
}

function openNovoFreelance(){
  document.getElementById('flModalTitle').textContent='NOVO FREELANCE';
  document.getElementById('fl_id').value='';
  document.getElementById('fl_nome').value='';
  document.getElementById('fl_funcao').value='GARÇOM';
  document.getElementById('fl_dias').value='8';
  document.getElementById('fl_valor').value='';
  document.getElementById('fl_auth').value='';
  document.getElementById('fl_data_ini').value=_isoHoje();
  openModal('flModal');
}
function openEditarFreelance(id){
  const fl=_flCache[id]; if(!fl)return;
  document.getElementById('flModalTitle').textContent='EDITAR FREELANCE';
  document.getElementById('fl_id').value=fl.id;
  document.getElementById('fl_nome').value=fl.nome;
  document.getElementById('fl_funcao').value=fl.funcao;
  document.getElementById('fl_data_ini').value=fl.dataIni||_isoHoje();
  document.getElementById('fl_dias').value='8';
  document.getElementById('fl_valor').value=fl.valor;
  document.getElementById('fl_auth').value=fl.auth||'';
  openModal('flModal');
}
function salvarFreelance(){
  const nome = document.getElementById('fl_nome').value.trim().toUpperCase();
  const funcao=document.getElementById('fl_funcao').value;
  const dataIni=document.getElementById('fl_data_ini').value || _isoHoje();
  const dias=8;
  const valor=parseFloat(document.getElementById('fl_valor').value)||0;
  const auth=document.getElementById('fl_auth').value.trim();
  const idExist=document.getElementById('fl_id').value;
  if(!nome){showToast('⚠️ Informe o nome'); return;}
  if(valor<=0){showToast('⚠️ Informe o valor por dia'); return;}
  const id = idExist || 'fl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  const fl = {id, nome, funcao, dataIni, dias, totalDiarias:dias, valor, auth, criadoEm:idExist?(_flCache[idExist]?.criadoEm||Date.now()):Date.now()};
  _flCache[id]=fl;
  _flEnsureSlots(id, dias);
  _salvarFlFirebase(fl);
  if(fbDb&&fbConnected) fbDb.ref('freelances_slots/'+id).set(_flSlotsCache[id]);
  closeModal('flModal');
  _renderAlertas();
  buildFlContent();
  showToast('✅ Freelance salvo com pacote automático de '+dias+' campos');
}
function excluirFreelance(id){
  if(!confirm('Excluir este freelance?')) return;
  delete _flCache[id]; delete _flSlotsCache[id]; delete _flPayCache[id];
  if(fbDb&&fbConnected){
    fbDb.ref('freelances/'+id).remove();
    fbDb.ref('freelances_slots/'+id).remove();
    fbDb.ref('freelances_payments/'+id).remove();
  }
  buildFlContent();
  showToast('🗑️ Freelance removido');
}


function _setorNome(s){
  return {garcom:'Garçons',cumim:'Cumins',bar:'Bar',outros:'Outros'}[s]||s;
}


/* Módulo Uniformes Firebase — isolado.
   Não altera módulos antigos. Usa apenas /uniformes_estoque e leitura opcional de /equipe_oficial/atual/funcionarios. */
window.UNIFORMES_FB_CONFIG = {
  apiKey: "AIzaSyDN1vAjDz3snXGWTSMbMWz1XDPovyc8ufXw",
  authDomain: "coco-bambu-presenca.firebaseapp.com",
  databaseURL: "https://coco-bambu-presenca-default-rtdb.firebaseio.com",
  projectId: "coco-bambu-presenca",
  storageBucket: "coco-bambu-presenca.firebasestorage.app",
  messagingSenderId: "928977354796",
  appId: "1:928977354796:web:b62bfc7900fd67e3ec9189"
};

window.UniformesFirebase = {
  enabled:false,
  db:null,
  root:'uniformes_estoque',
  async init(){
    try{
      if(!window.firebase || !firebase.database) return false;
      const name='uniformes-estoque-isolado';
      let app;
      try{ app=firebase.app(name); }catch(e){ app=firebase.initializeApp(window.UNIFORMES_FB_CONFIG,name); }
      this.db=app.database();
      this.enabled=true;
      return true;
    }catch(e){
      console.warn('Uniformes Firebase indisponível:', e);
      return false;
    }
  },
  listenState(cb){
    if(!this.enabled || !this.db) return false;
    this.db.ref(this.root).on('value', snap => cb(snap.val() || null));
    return true;
  },
  async saveState(state){
    if(!this.enabled || !this.db) return false;
    const payload = Object.assign({}, state, { atualizadoEm:new Date().toISOString() });
    await this.db.ref(this.root).set(payload);
    return true;
  },
  listenFuncionarios(cb){
    if(!this.enabled || !this.db) return false;
    const state = {escala:[], freelancers:[], freelances:[]};
    const emit = () => {
      const norm = (obj, fonte) => (Array.isArray(obj) ? obj : (obj ? Object.values(obj) : [])).map(x => Object.assign({}, x, {fonte}));
      cb([...norm(state.escala,'escala'), ...norm(state.freelancers,'freelance'), ...norm(state.freelances,'freelance')]);
    };
    this.db.ref('equipe_oficial/atual/funcionarios').on('value', snap=>{ state.escala=snap.val()||[]; emit(); });
    this.db.ref('freelancers').on('value', snap=>{ state.freelancers=snap.val()||[]; emit(); });
    this.db.ref('freelances').on('value', snap=>{ state.freelances=snap.val()||{}; emit(); });
    return true;
  }
};

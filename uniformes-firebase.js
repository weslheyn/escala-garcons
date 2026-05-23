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
    this.db.ref('equipe_oficial/atual/funcionarios').on('value', snap=>{
      const v=snap.val();
      cb(Array.isArray(v) ? v : (v ? Object.values(v) : []));
    });
    return true;
  }
};

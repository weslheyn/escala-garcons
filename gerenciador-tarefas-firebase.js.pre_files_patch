/* Gerenciador de Tarefas Firebase — módulo isolado.
   Usa somente /gerenciador_tarefas e não altera módulos existentes. */
window.GT_FB_CONFIG = {
  apiKey: "AIzaSyDN1vAjDz3snXGWTSMbMWz1XDPovyc8ufXw",
  authDomain: "coco-bambu-presenca.firebaseapp.com",
  databaseURL: "https://coco-bambu-presenca-default-rtdb.firebaseio.com",
  projectId: "coco-bambu-presenca",
  storageBucket: "coco-bambu-presenca.firebasestorage.app",
  messagingSenderId: "928977354796",
  appId: "1:928977354796:web:b62bfc7900fd67e3ec9189"
};

window.GerenciadorTarefasFirebase = {
  enabled:false,
  db:null,
  async init(){
    try{
      if(!window.firebase || !firebase.database) return false;
      const name = 'gerenciador-tarefas-isolado';
      let app;
      try{ app = firebase.app(name); }
      catch(e){ app = firebase.initializeApp(window.GT_FB_CONFIG, name); }
      this.db = app.database();
      this.enabled = true;
      return true;
    }catch(e){
      console.warn('Gerenciador de Tarefas Firebase indisponível:', e);
      return false;
    }
  },
  listen(cb){
    if(!this.enabled || !this.db) return false;
    this.db.ref('gerenciador_tarefas').on('value', snap => cb(snap.val() || null));
    return true;
  },
  async saveAll(data){
    if(!this.enabled || !this.db) return false;
    await this.db.ref('gerenciador_tarefas').set(data || {});
    return true;
  },
  async update(path, value){
    if(!this.enabled || !this.db || !path) return false;
    await this.db.ref('gerenciador_tarefas/' + path).update(value || {});
    return true;
  },
  async set(path, value){
    if(!this.enabled || !this.db || !path) return false;
    await this.db.ref('gerenciador_tarefas/' + path).set(value);
    return true;
  },
  async remove(path){
    if(!this.enabled || !this.db || !path) return false;
    await this.db.ref('gerenciador_tarefas/' + path).remove();
    return true;
  }
};

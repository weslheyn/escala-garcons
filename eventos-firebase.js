/* Eventos Firebase — módulo isolado.
   Não altera a estrutura antiga do app. Só usa o caminho oficial /eventos_premium quando Firebase compat estiver disponível. */
window.EVENTOS_FB_CONFIG = {
  apiKey: "AIzaSyDN1vAjDz3snXGWTSMbMWz1XDPovyc8ufXw",
  authDomain: "coco-bambu-presenca.firebaseapp.com",
  databaseURL: "https://coco-bambu-presenca-default-rtdb.firebaseio.com",
  projectId: "coco-bambu-presenca",
  storageBucket: "coco-bambu-presenca.firebasestorage.app",
  messagingSenderId: "928977354796",
  appId: "1:928977354796:web:b62bfc7900fd67e3ec9189"
};
window.EventosFirebase = {
  enabled:false,
  db:null,
  async init(){
    try{
      if(!window.firebase || !firebase.database) return false;
      const name='eventos-premium-isolado';
      let app;
      try{ app=firebase.app(name); }catch(e){ app=firebase.initializeApp(window.EVENTOS_FB_CONFIG,name); }
      this.db=app.database(); this.enabled=true; return true;
    }catch(e){ console.warn('Eventos Firebase indisponível:',e); return false; }
  },
  async saveAll(eventos){
    if(!this.enabled||!this.db) return false;
    const obj={}; eventos.forEach(e=>obj[e.id]=e);
    await this.db.ref('eventos_premium/eventos').set(obj);
    return true;
  },
  async saveEvento(evento){
    if(!this.enabled||!this.db||!evento||!evento.id) return false;
    await this.db.ref('eventos_premium/eventos/'+evento.id).update(evento);
    return true;
  },

  listen(cb){
    if(!this.enabled||!this.db) return false;
    this.db.ref('eventos_premium/eventos').on('value',snap=>{
      const v=snap.val();
      cb(v?Object.values(v):[]);
    });
    return true;
  },
  listenClientes(cb){
    if(!this.enabled||!this.db) return false;
    this.db.ref('clientes_cadastro').on('value',snap=>{
      const v=snap.val(); cb(v?Object.values(v):[]);
    });
    return true;
  },
  async saveClienteCadastro(cliente){
    if(!this.enabled||!this.db||!cliente) return false;
    const id=cliente.id || ('cli_'+Date.now().toString(36));
    await this.db.ref('clientes_cadastro/'+id).set(Object.assign({},cliente,{id,atualizadoEm:new Date().toISOString()}));
    return true;
  },
  async deleteClienteCadastro(id){
    if(!this.enabled||!this.db||!id) return false;
    await this.db.ref('clientes_cadastro/'+id).remove();
    return true;
  },
  async deleteEvento(id){
    if(!this.enabled||!this.db||!id) return false;
    await this.db.ref('eventos_premium/eventos/'+id).remove();
    return true;
  }
};

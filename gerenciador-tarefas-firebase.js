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
  storage:null,
  altStorage:null,
  async init(){
    try{
      if(!window.firebase || !firebase.database) return false;
      const name = 'gerenciador-tarefas-isolado';
      let app;
      try{ app = firebase.app(name); }
      catch(e){ app = firebase.initializeApp(window.GT_FB_CONFIG, name); }
      this.db = app.database();
      this.storage = null;
      if(firebase.storage){
        try{ this.storage = app.storage('gs://' + (window.GT_FB_CONFIG.storageBucket||'')); }
        catch(e){
          try{ this.storage = app.storage(); }
          catch(err){ console.warn('Firebase Storage indisponível:', err); }
        }
        // Compatibilidade: alguns projetos Firebase antigos usam appspot.com; projetos novos podem usar firebasestorage.app.
        // Mantemos os dois para evitar upload travado por bucket incorreto.
        try{ this.altStorage = app.storage('gs://coco-bambu-presenca.appspot.com'); }catch(_){ this.altStorage=null; }
      }
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
  },
  async uploadBlob(path, blob, contentType){
    return this.uploadBlobProgress(path, blob, contentType, null);
  },
  async uploadBlobProgress(path, blob, contentType, onProgress){
    if(!this.enabled || !this.storage || !path || !blob) return null;
    const doUpload=(storageSvc)=>new Promise((resolve,reject)=>{
      const ref=storageSvc.ref().child(path);
      const task=ref.put(blob,{contentType:contentType||blob.type||'application/octet-stream'});
      task.on('state_changed',
        snap=>{
          try{
            const pct=snap.totalBytes?Math.round((snap.bytesTransferred/snap.totalBytes)*100):0;
            if(typeof onProgress==='function') onProgress(Math.max(1,Math.min(100,pct)), snap);
          }catch(_){}
        },
        err=>reject(err),
        async()=>{
          try{
            const url=await task.snapshot.ref.getDownloadURL();
            if(typeof onProgress==='function') onProgress(100, task.snapshot);
            resolve({url, path});
          }catch(e){reject(e);}
        }
      );
    });
    try{ return await doUpload(this.storage); }
    catch(e){
      console.warn('Upload no bucket principal falhou, tentando bucket alternativo...', e);
      if(this.altStorage){ return await doUpload(this.altStorage); }
      throw e;
    }
  },
  async deleteStorage(path){
    if(!this.enabled || !this.storage || !path) return false;
    try{ await this.storage.ref().child(path).delete(); return true; }catch(e){ console.warn('Falha ao excluir arquivo do Storage',e); return false; }
  }
};

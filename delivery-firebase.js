(function(){
  const cfg={
    apiKey:"AIzaSyDN1vAjDz3snXGWTSMbMWz1XDPovyc8ufXw",
    authDomain:"coco-bambu-presenca.firebaseapp.com",
    databaseURL:"https://coco-bambu-presenca-default-rtdb.firebaseio.com",
    projectId:"coco-bambu-presenca",
    storageBucket:"coco-bambu-presenca.firebasestorage.app",
    messagingSenderId:"928977354796",
    appId:"1:928977354796:web:b62bfc7900fd67e3ec9189"
  };
  let db=null;
  try{
    const app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg,'deliveryModule');
    db=app.database();
  }catch(e){console.warn('Delivery Firebase indisponível',e)}
  const safeKey=s=>String(s||'').replace(/[.#$\[\]/]/g,'_');
  window.DeliveryFirebase={
    isReady(){return !!db},
    async saveDay(date,payload){if(!db)return false;await db.ref('delivery/dias/'+safeKey(date)).set(payload);return true},
    async saveDays(days){if(!db)return false;const updates={};Object.entries(days||{}).forEach(([date,payload])=>updates['delivery/dias/'+safeKey(date)]=payload);if(Object.keys(updates).length)await db.ref().update(updates);return true},
    async loadDay(date){if(!db)return null;const s=await db.ref('delivery/dias/'+safeKey(date)).once('value');return s.val()},
    async listDays(){if(!db)return {};const s=await db.ref('delivery/dias').once('value');return s.val()||{}},
    async saveMonth(month,payload){if(!db)return false;await db.ref('delivery/meses/'+safeKey(month)).set(payload);return true},
    async loadMonth(month){if(!db)return null;const s=await db.ref('delivery/meses/'+safeKey(month)).once('value');return s.val()},
    async listMonths(){if(!db)return {};const s=await db.ref('delivery/meses').once('value');return s.val()||{}},
    async saveImportMeta(key,meta){if(!db)return false;await db.ref('delivery/importacoes/'+safeKey(key)).set(meta);return true},
    async saveRegions(regions){if(!db)return false;await db.ref('delivery/config/regioes').set(regions||[]);return true},
    async loadRegions(){if(!db)return null;const s=await db.ref('delivery/config/regioes').once('value');return s.val()},
    async saveGeoCache(cache){if(!db)return false;await db.ref('delivery/config/geocache').set(cache||{});return true},
    async loadGeoCache(){if(!db)return {};const s=await db.ref('delivery/config/geocache').once('value');return s.val()||{}}
  };
})();

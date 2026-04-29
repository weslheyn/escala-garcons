
/* =========================================================
   OVERRIDE FINAL — WhatsApp do Mapa por SETOR (29/04)
   Mantém mapa/frequência e troca apenas o texto copiado.
========================================================= */
(function(){
  function _zapNormFinal(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  }
  function _zapSetorFinal(f){
    const c=_zapNormFinal(f&&f.categoria);
    const g=_zapNormFinal((f&&f.grupoEscala)||(f&&f.grupo)||(f&&f.setor));
    const n=_zapNormFinal(f&&f.nome);
    if(c.includes('GERENTE') || g.includes('GERENCIA')) return 'GERENCIA';
    if(c.includes('MAITRE') || c.includes('MAÎTRE') || g.includes('MAITRE') || g.includes('MAITRES')) return 'MAITRE';
    if(c.includes('CHEFE DE FILA') || n.includes('CHEFE DE FILA')) return 'CHEFE DE FILA';
    if(c==='GARCOM' || c.includes('GARCOM') || c.includes('GARÇOM') || g.includes('GARCOM') || g.includes('EQUIPE VASTO')) return 'GARÇONS';
    if(c.includes('CUMIM') || g.includes('CUMIM')) return 'CUMINS';
    if(c.includes('RECEPCIONISTA') || g.includes('RECEP')) return 'RECEPÇÃO';
    if(c.includes('ACESSO') || g.includes('CONTROLE DE ACESSO')) return 'CONTROLADOR DE ACESSO';
    if(c.includes('ENCANTADORA') || g.includes('BRINQUEDOTECA')) return 'MONITORAS';
    if(c.includes('ASG') || c.includes('LIMPEZA') || g.includes('GOVERNANCA') || g.includes('GOVERNANCA')) return 'AUX DE LIMPEZA';
    if(c.includes('BARMAN') || c.includes('COPEIRO') || c.includes('AUXILIAR DE BAR') || g.includes('BAR')) return 'BAR';
    return '';
  }
  function _zapTurnoFinal(f){
    const t=_zapNormFinal(f&&f.turno);
    const g=_zapNormFinal((f&&f.grupoEscala)||(f&&f.grupo));
    if(t.includes('FECHA') || g.includes('FECHA')) return 'FECHAMENTO';
    if(t.includes('ABERT') || g.includes('ABERT') || g.includes(' ABRE') || g.endsWith('ABRE')) return 'ABERTURA';
    if(t.includes('INTER')) return 'INTERCALADO';
    return '';
  }
  function _zapNomeFinal(nome){
    const raw=String(nome||'').replace(/\(CHEFE DE FILA\)/gi,'').trim().replace(/\s+/g,' ');
    const n=_zapNormFinal(raw);
    const mapa=[
      ['WESLHEYN','Weslheyn'],['WESLEY','Wesley'],['TAIZA','Taiza'],['FABIO','Fabio'],['THIAGO','Thiago'],['EDMAGNA','Edimagna'],
      ['RICKSON','Rickson'],['WILLIAM','Willian'],['ALEXANDRE','Alexandre'],
      ['SAMUEL','Samuel'],['ELEN','Elen'],['ELLEN','Ellen'],['FABIELLY','Fabielly'],['ANA LUCIA','Ana Lucia'],['FABRICIA','Fabrícia'],['ANDRE','André'],['JOSE FABRICIO','Fabrício'],['IGOR FERREIRA','Igor'],['MARINA','Marina'],['CAMILA','Camila'],['PATRICIA','Patricia'],['CAIO','Caio'],['FERNANDO','Fernando'],['PAULO','Paulo'],['KLEBER','Kleber'],['MIGUEL','Miguel'],
      ['JOAO GUILHERME','Guilherme'],['GEORGE','George'],['ADRIAN','Adrian'],['FELIPE','Dias'],['EDLANE','Edlane'],['ANA FLAVIA','Ana Flávia'],['LETICIA','Letícia'],['LUCAS','Lucas'],['ISMAEL','Ismael'],['EDUARDO','Eduardo'],
      ['GABRIELA PAIXAO','Gabriela'],['NATHALIA','Nathalia'],['ISRAEL','Israel'],
      ['BRUNA DAS GRACAS','Bruna'],['FLAVIA','Flavia'],['KARINE','Karine'],['JESSICA','Jessica'],
      ['DANIEL SOARES','Daniel'],['EVANDRO','Evandro'],['RAQUEL','Raquel'],['FABIOLA','Fabiola'],['JORGE','Jorge'],
      ['DANIELLE','Danielle'],['LARISSA','Larissa'],['NELYNE','Nelyne'],['LEONILSON','Leonilson'],['MARLON','Marlon'],['RHAI','Rhai'],['FRANCISCO','Francisco'],['DANIEL RIBEIRO','Daniel'],['ADALBERTO','Adalberto']
    ];
    for(const [k,v] of mapa){ if(n.includes(k)) return v; }
    const small=new Set(['de','da','do','dos','das','e']);
    return raw.toLowerCase().split(' ').filter(Boolean).map((w,i)=>small.has(w)&&i>0?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  }
  function _zapTrabalhaFinal(f, di){
    try{
      if(typeof _mapaTrabalhaDia==='function') return !!_mapaTrabalhaDia(f,di).trabalha;
    }catch(e){}
    try{
      const turno=String(f.turno||'').toUpperCase();
      if(turno.includes('LICEN')) return false;
      const rec=typeof getRec==='function'?getRec(di,f.nome):null;
      if(rec && rec.status){
        const st=String(rec.status).toLowerCase();
        if(['falta','atestado','folga','troca-folga','licenca','licença','medida'].includes(st)) return false;
        if(st==='presente') return true;
      }
      if(typeof _mapaFolgaEscala==='function' && _mapaFolgaEscala(f,di)) return false;
      return true;
    }catch(e){return true;}
  }
  function _zapLinhaSimples(rotulo, lista){
    return rotulo+': '+(lista||[]).filter(Boolean).join(' e ');
  }
  function _zapLinhaMonitoras(rotulo, lista){
    lista=(lista||[]).filter(Boolean);
    return rotulo+': '+(lista.length?lista.join(' e ')+' ('+lista.length+')':'');
  }
  function _zapBlocoLista(rotulo, lista){
    lista=(lista||[]).filter(Boolean);
    return lista.length ? (rotulo+': ('+lista.length+')\n'+lista.join('\n')) : (rotulo+': (0)');
  }
  window._gerarTextoEquipeDiaMapa=function(){
    const di=(typeof curDay==='number'?curDay:0);
    const data=(typeof WEEK_DATES!=='undefined'&&WEEK_DATES&&WEEK_DATES[di])?WEEK_DATES[di]:new Date();
    const nomesDia=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
    const cab='📋 Escala – '+(nomesDia[di]||'')+' ('+String(data.getDate()).padStart(2,'0')+'/'+String(data.getMonth()+1).padStart(2,'0')+')';
    const setores=['GERENCIA','MAITRE','CHEFE DE FILA','GARÇONS','CUMINS','RECEPÇÃO','CONTROLADOR DE ACESSO','MONITORAS','AUX DE LIMPEZA','BAR'];
    const turnos=['ABERTURA','INTERCALADO','FECHAMENTO'];
    const g={}; setores.forEach(s=>g[s]={ABERTURA:[],INTERCALADO:[],FECHAMENTO:[]});
    (window.EQUIPE||EQUIPE||[]).forEach(f=>{
      if(!_zapTrabalhaFinal(f,di)) return;
      const setor=_zapSetorFinal(f); if(!setor||!g[setor]) return;
      const turno=_zapTurnoFinal(f); if(!turnos.includes(turno)) return;
      const nome=_zapNomeFinal(f.nome); if(nome&&!g[setor][turno].includes(nome)) g[setor][turno].push(nome);
    });
    const out=[cab,''];
    setores.forEach(setor=>{
      out.push(setor+':');
      const b=g[setor];
      if(['GARÇONS','CUMINS','AUX DE LIMPEZA','BAR'].includes(setor)){
        out.push(_zapBlocoLista('Abertura',b.ABERTURA)); out.push('');
        out.push(_zapBlocoLista('Intercalado',b.INTERCALADO)); out.push('');
        out.push(_zapBlocoLista('Fechamento',b.FECHAMENTO)); out.push('');
      }else if(setor==='MONITORAS'){
        out.push(_zapLinhaMonitoras('Abertura',b.ABERTURA));
        out.push(_zapLinhaMonitoras('Intercalado',b.INTERCALADO));
        out.push(_zapLinhaMonitoras('Fechamento',b.FECHAMENTO)); out.push('');
      }else if(setor==='MAITRE'){
        out.push(_zapLinhaSimples('Abertura inter',b.ABERTURA));
        out.push(_zapLinhaSimples('Intercalado',b.INTERCALADO));
        out.push(_zapLinhaSimples('Fechamento',b.FECHAMENTO)); out.push('');
      }else{
        out.push(_zapLinhaSimples('Abertura',b.ABERTURA));
        out.push(_zapLinhaSimples('Intercalado',b.INTERCALADO));
        out.push(_zapLinhaSimples('Fechamento',b.FECHAMENTO)); out.push('');
      }
    });
    return out.join('\n').replace(/\n{4,}/g,'\n\n\n').trim();
  };
  window.copyMapaEquipeDia=function(){
    const texto=window._gerarTextoEquipeDiaMapa();
    const ok=function(){ if(typeof showToast==='function') showToast('📋 Escala copiada no formato correto'); };
    if(navigator.clipboard&&window.isSecureContext){ navigator.clipboard.writeText(texto).then(ok).catch(()=>_fallback(texto,ok)); }
    else _fallback(texto,ok);
  };
  function _fallback(texto,ok){ const ta=document.createElement('textarea'); ta.value=texto; ta.style.cssText='position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand('copy'); ok&&ok();}catch(e){alert(texto);} document.body.removeChild(ta); }
})();

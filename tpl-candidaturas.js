/* TPL: INICIO BLOQUE NUEVO [Subida candidatura → Storage(Firebase) o Cloudinary + Firestore + Formspree con timeouts] */
(function(){
  'use strict';

  function q(id){ return document.getElementById(id); }
  function safeName(name){ return String(name||'').replace(/[^\w.\-\u00C0-\u024F]+/g,'_').slice(0,140); }
  function iso(){ return new Date().toISOString().replace(/[:.]/g,'-'); }
  function setStatus(msg, ok){
    var el = q('tpl-estado'); if (!el) return;
    el.textContent = msg;
    el.className = 'tpl-note ' + (ok ? 'tpl-ok' : 'tpl-error');
  }
  function getAll(fd, k){ return fd.getAll(k).filter(Boolean); }
  function getText(fd,k){ var v=getAll(fd,k); return !v.length?'':(v.length===1?String(v[0]):v.map(String).join(', ')); }

  function withTimeout(promise, ms, label){
    let timer; const err = new Error((label||'Operación')+' tardó demasiado');
    const t = new Promise((_,rej)=> timer=setTimeout(()=>rej(err), ms));
    return Promise.race([promise.finally(()=>clearTimeout(timer)), t]);
  }

  async function uploadFirebase(st, base, file, prefix){
    if (!(file instanceof File) || !file.size) return { path:'', url:'' };
    if (file.size > 10*1024*1024) throw new Error('El archivo "'+file.name+'" supera 10MB.');
    const path = `${base}/${prefix}-${safeName(file.name||'doc')}`;
    await withTimeout(st.ref(path).put(file, { contentType: file.type || 'application/octet-stream' }), 30000, 'Subida Firebase');
    return { path, url:'' };
  }

  async function uploadCloudinary(cloud, preset, folder, file){
    if (!(file instanceof File) || !file.size) return '';
    const body = new FormData();
    body.append('upload_preset', preset);
    body.append('file', file);
    if (folder) body.append('folder', folder);
    const res = await withTimeout(fetch(`https://api.cloudinary.com/v1_1/${cloud}/upload`, { method:'POST', body }), 30000, 'Subida Cloudinary');
    if (!res.ok) throw new Error('Cloudinary error '+res.status);
    const data = await res.json();
    return data.secure_url || data.url || '';
  }

  document.addEventListener('DOMContentLoaded', function(){
    var form = q('tpl-form-auxiliares');
    if (!form) return;

    var submitBtn = q('tpl-submit');
    var cvHidden  = q('tpl-cvUrl');
    var tiHidden  = q('tpl-tituloUrl');

    form.addEventListener('submit', function(ev){
      if (!ev.defaultPrevented) ev.preventDefault();
      if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }
      setStatus('Preparando envío…', false);

      (async function(){
        const fd = new FormData(form);
        const cvFile     = fd.get('cv');
        const tituloFile = fd.get('titulo');
        const dniFile    = fd.get('dni'); // opcional
        const otrosFiles = getAll(fd,'otros').filter(f=>f instanceof File && f.size>0);

        const payloadBase = {
          createdAt: (window.firebase && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : null,
          estado: 'pendiente',
          nombre: getText(fd,'nombre'),
          email:  getText(fd,'_replyto') || getText(fd,'email'),
          telefono: getText(fd,'telefono'),
          ciudad: getText(fd,'ciudad'),
          cp: getText(fd,'cp'),
          disponibilidad: getText(fd,'disponibilidad'),
          links: getText(fd,'links')
        };

        let used = 'none';
        let docExtra = { cvPath:'', tituloPath:'', dniPath:'', otrosPaths:[], cvUrl:'', tituloUrl:'', dniUrl:'', otrosUrls:[] };

        // ---- INTENTO A) FIREBASE STORAGE
        try{
          if (!window.firebase || !firebase.apps.length) throw new Error('Firebase no inicializado');
          if (!firebase.auth || !firebase.storage || !firebase.firestore) throw new Error('SDKs Firebase incompletos');

          const auth = firebase.auth();
          const st   = firebase.storage();

          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          if (!auth.currentUser) await withTimeout(auth.signInAnonymously(), 15000, 'Login anónimo');
          const uid = auth.currentUser && auth.currentUser.uid || 'anon';
          const base = `candidaturas/${uid}/${iso()}`;

          setStatus('Subiendo documentos a servidor seguro…', false);
          const cvRes     = await uploadFirebase(st, base, cvFile, 'cv');
          const tiRes     = await uploadFirebase(st, base, tituloFile, 'titulo');
          const dniRes    = await uploadFirebase(st, base, dniFile, 'dni');

          const otrosPaths = [];
          for (let i=0;i<otrosFiles.length;i++){
            const p = `${base}/otros/${safeName(otrosFiles[i].name)}`;
            await withTimeout(st.ref(p).put(otrosFiles[i], { contentType: otrosFiles[i].type || 'application/octet-stream' }), 30000, 'Subida Firebase (otros)');
            otrosPaths.push(p);
          }

          docExtra = { ...docExtra, cvPath: cvRes.path, tituloPath: tiRes.path, dniPath: dniRes.path, otrosPaths };
          used = 'firebase';
        }catch(e1){
          console.warn('Firebase Storage falló o no disponible:', e1 && e1.message);

          // ---- INTENTO B) CLOUDINARY
          try{
            const cloud = form.dataset.cloudinaryName;
            const preset= form.dataset.cloudinaryPreset;
            if (!cloud || !preset) throw new Error('Cloudinary sin configurar');

            setStatus('Subiendo documentos (Cloudinary)…', false);
            const folder = `thepetslovers/candidaturas/${iso()}`;
            const cvUrl     = await uploadCloudinary(cloud, preset, folder, cvFile);
            const tituloUrl = await uploadCloudinary(cloud, preset, folder, tituloFile);
            const dniUrl    = await uploadCloudinary(cloud, preset, folder, dniFile);
            const otrosUrls = [];
            for (let i=0;i<otrosFiles.length;i++){
              otrosUrls.push(await uploadCloudinary(cloud, preset, folder, otrosFiles[i]));
            }

            docExtra = { ...docExtra, cvUrl, tituloUrl, dniUrl, otrosUrls };
            if (cvHidden) cvHidden.value = cvUrl || '';
            if (tiHidden) tiHidden.value = tituloUrl || '';
            used = 'cloudinary';
          }catch(e2){
            console.warn('Cloudinary no disponible:', e2 && e2.message);
            used = 'none';
          }
        }

        // ---- Guardar en Firestore (si existe)
        try{
          if (window.firebase && firebase.firestore){
            const db = firebase.firestore();
            const doc = { ...payloadBase, ...docExtra };
            await withTimeout(db.collection('candidaturas').add(doc), 15000, 'Guardar en Firestore');
          }
        }catch(e3){
          console.warn('Firestore no disponible:', e3 && e3.message);
        }

        // ---- Enviar a Formspree (texto + rutas/URLs)
        try{
          const action = form.getAttribute('action') || '';
          if (/^https:\/\/formspree\.io\//.test(action)){
            const mfd = new FormData();
            fd.forEach((v,k)=>{ if (!(v instanceof File)) mfd.append(k,v); });
            if (docExtra.cvPath) mfd.append('cvPath', docExtra.cvPath);
            if (docExtra.tituloPath) mfd.append('tituloPath', docExtra.tituloPath);
            if (docExtra.dniPath) mfd.append('dniPath', docExtra.dniPath);
            if (docExtra.cvUrl) mfd.append('cvUrl', docExtra.cvUrl);
            if (docExtra.tituloUrl) mfd.append('tituloUrl', docExtra.tituloUrl);
            if (docExtra.dniUrl) mfd.append('dniUrl', docExtra.dniUrl);
            (docExtra.otrosPaths||[]).forEach((p,i)=> mfd.append('otrosPath_'+(i+1), p));
            (docExtra.otrosUrls||[]).forEach((u,i)=> mfd.append('otrosUrl_'+(i+1), u));
            if (!mfd.get('_subject')) mfd.append('_subject', '[TPL] Nueva candidatura');

            await withTimeout(fetch(action, { method:'POST', body:mfd, headers:{'Accept':'application/json'} }), 15000, 'Formspree');
          }
        }catch(_ignore){}

        const okMsg = form.dataset.success || '¡Candidatura enviada con éxito! 🐾';
        if (used === 'firebase') setStatus(okMsg + ' (archivos en servidor seguro)', true);
        else if (used === 'cloudinary') setStatus(okMsg + ' (archivos en Cloudinary)', true);
        else setStatus('Enviado sin adjuntos (no se pudo subir archivos).', true);

        try{ form.reset(); }catch(_){}
        const red = form.dataset.redirect;
        if (red) setTimeout(()=>{ window.location.href = red; }, 1000);

      })().catch(err=>{
        console.error(err);
        setStatus('No se pudo enviar. ' + (err && err.message ? err.message : ''), false);
      }).finally(()=>{
        if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
      });
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */

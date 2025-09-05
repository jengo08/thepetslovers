/* TPL: INICIO BLOQUE NUEVO [Subida candidatura → Storage + Firestore + aviso Formspree] */
(function(){
  'use strict';

  // --- Dependencias requeridas en la página:
  // firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js, firebase-storage-compat.js
  if (!window.firebase || !firebase.apps.length) {
    console.warn('TPL candidaturas: Firebase no está inicializado en esta página.');
    return;
  }

  var auth = firebase.auth();
  var db   = firebase.firestore();
  var st   = firebase.storage();

  function safeName(name){ return String(name||'').replace(/[^\w.\-\u00C0-\u024F]+/g,'_').slice(0,140); }
  function iso(){ return new Date().toISOString().replace(/[:.]/g,'-'); }
  function setStatus(msg, ok){
    var el = document.getElementById('tpl-estado');
    if (!el) return;
    el.textContent = msg;
    el.className = 'tpl-note ' + (ok ? 'tpl-ok' : 'tpl-error');
  }

  document.addEventListener('DOMContentLoaded', function(){
    var form = document.getElementById('tpl-form-auxiliares');
    if (!form) return;

    var submitBtn = document.getElementById('tpl-submit');
    var cvHidden  = document.getElementById('tpl-cvUrl');
    var tiHidden  = document.getElementById('tpl-tituloUrl');

    form.addEventListener('submit', function(ev){
      if (!ev.defaultPrevented) ev.preventDefault();
      if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }
      setStatus('Subiendo documentos…', false);

      (async function(){
        try{
          // 1) Sesión anónima
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          if (!auth.currentUser) await auth.signInAnonymously();
          var uid = auth.currentUser.uid;

          // 2) Datos + ficheros
          var fd = new FormData(form);
          var cvFile     = fd.get('cv');
          var tituloFile = fd.get('titulo');
          var dniFile    = fd.get('dni'); // opcional si lo añades en el futuro
          var otrosFiles = fd.getAll('otros').filter(function(f){ return f instanceof File && f.size>0; });

          var base = 'candidaturas/' + uid + '/' + iso();

          async function upload(file, path){
            if (!(file instanceof File) || !file.size) return '';
            // Límite orientativo de 10MB (mismo que Rules). Aviso local rápido.
            if (file.size > 10 * 1024 * 1024) {
              throw new Error('El archivo "' + file.name + '" supera 10MB.');
            }
            var ref = st.ref(path);
            await ref.put(file, { contentType: file.type || 'application/octet-stream' });
            return path; // no getDownloadURL: lectura solo para admin
          }

          var cvPath     = await upload(cvFile,     base + '/cv-'     + safeName(cvFile && cvFile.name || 'documento'));
          var tituloPath = await upload(tituloFile, base + '/titulo-' + safeName(tituloFile && tituloFile.name || 'documento'));
          var dniPath    = await upload(dniFile,    base + '/dni-'    + safeName(dniFile && dniFile.name || 'documento'));

          var otrosPaths = [];
          for (var i=0;i<otrosFiles.length;i++){
            var p = base + '/otros/' + safeName(otrosFiles[i].name);
            await st.ref(p).put(otrosFiles[i], { contentType: otrosFiles[i].type || 'application/octet-stream' });
            otrosPaths.push(p);
          }

          if (cvHidden) cvHidden.value = cvPath || '';
          if (tiHidden) tiHidden.value = tituloPath || '';

          // 3) Construir doc Firestore (campos principales + rutas)
          function getField(name){ var v = fd.getAll(name); return !v.length ? '' : (v.length===1 ? String(v[0]) : v.map(String).join(', ')); }
          var email = getField('_replyto') || getField('email') || '';
          var payload = {
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            estado: 'pendiente',
            // Campos principales que tu admin lista:
            nombre: getField('nombre') || '',
            email:  email,
            telefono: getField('telefono') || '',
            ciudad: getField('ciudad') || '',
            cp:     getField('cp') || '',
            disponibilidad: getField('disponibilidad') || '',
            links:  getField('links') || '',
            // Rutas de ficheros (solo admin podrá leer/descargar)
            cvPath: cvPath || '',
            tituloPath: tituloPath || '',
            dniPath: dniPath || '',
            otrosPaths: otrosPaths
          };

          await db.collection('candidaturas').add(payload);

          // 4) Enviar copia a Formspree (solo texto, añadimos paths informativos)
          var action = form.getAttribute('action') || '';
          if (/^https:\/\/formspree\.io\//.test(action)){
            var mailFD = new FormData();
            // Añadimos solo campos NO archivo
            fd.forEach(function(v,k){ if (!(v instanceof File)) mailFD.append(k, v); });
            // Anexamos rutas para referencia en el correo
            if (cvPath) mailFD.append('cvPath', cvPath);
            if (tituloPath) mailFD.append('tituloPath', tituloPath);
            if (dniPath) mailFD.append('dniPath', dniPath);
            for (var j=0;j<otrosPaths.length;j++){ mailFD.append('otrosPath_'+(j+1), otrosPaths[j]); }
            // Asunto de respaldo
            if (!mailFD.get('_subject')) mailFD.append('_subject', '[TPL] Nueva candidatura');
            try{
              await fetch(action, { method:'POST', body: mailFD, headers: { 'Accept': 'application/json' } });
            }catch(_){ /* ignoramos fallo de email, los datos ya están en Firestore */ }
          }

          setStatus(form.dataset.success || '¡Candidatura enviada con éxito! 🐾', true);
          try{ form.reset(); }catch(_){}
          // 5) Redirigir si lo has configurado en data-redirect
          var red = form.dataset.redirect;
          if (red) setTimeout(function(){ window.location.href = red; }, 1200);

        }catch(err){
          console.error(err);
          setStatus('No se pudo enviar. ' + (err && err.message ? err.message : 'Inténtalo de nuevo.'), false);
        }finally{
          if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
        }
      })();
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */

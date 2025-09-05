/* TPL: INICIO BLOQUE NUEVO [Subida de documentos candidatura → Firebase Storage + Firestore (compat)] */
(function(){
  // Requiere que en ESTA página tengas firebase-app-compat, auth-compat, firestore-compat y storage-compat cargados.

  // 1) Init Firebase (no rompe si ya está iniciado)
  if (!firebase.apps.length){
    const firebaseConfig = {
      apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
      authDomain: "thepetslovers-c1111.firebaseapp.com",
      projectId: "thepetslovers-c1111",
      storageBucket: "thepetslovers-c1111.appspot.com",
      messagingSenderId: "415914577533",
      appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
      measurementId: "G-FXPD69KXBG"
    };
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db   = firebase.firestore();
  const st   = firebase.storage();

  // Helpers
  function safeName(name){ return String(name||'').replace(/[^\w.\-\u00C0-\u024F]+/g,'_').slice(0,140); }
  function iso(){ return new Date().toISOString().replace(/[:.]/g,'-'); }
  function val(fd, k){ const v = fd.getAll(k); if (!v.length) return ''; return v.length===1 ? String(v[0]) : v.map(String).join(', '); }

  // 2) Conectar el formulario marcado
  document.addEventListener('DOMContentLoaded', ()=>{
    const form = document.querySelector('form[data-tpl-candidatura]');
    if (!form) return;

    form.addEventListener('submit', async (ev)=>{
      if (!ev.defaultPrevented) ev.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      if (btn){ btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'Enviando…'; }

      try{
        // 2.1) Sesión anónima para tener UID y poder escribir
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        if (!auth.currentUser) await auth.signInAnonymously();
        const uid = auth.currentUser.uid;

        const fd = new FormData(form);

        // 2.2) Subidas (si existen)
        const base = `candidaturas/${uid}/${iso()}`;
        async function putIf(file, path){
          if (!(file instanceof File) || !file.size) return '';
          const ref = st.ref(path);
          await ref.put(file, { contentType: file.type || 'application/octet-stream' });
          // ¡OJO! No intentamos getDownloadURL aquí porque las reglas de lectura son solo para admin.
          return path;
        }

        const cvFile     = fd.get('cv');
        const tituloFile = fd.get('titulo');
        const dniFile    = fd.get('dni');
        const otrosFiles = fd.getAll('otros').filter(f => f instanceof File && f.size>0);

        const cvPath     = await putIf(cvFile,     `${base}/cv-${safeName(cvFile?.name||'doc')}`);
        const tituloPath = await putIf(tituloFile, `${base}/titulo-${safeName(tituloFile?.name||'doc')}`);
        const dniPath    = await putIf(dniFile,    `${base}/dni-${safeName(dniFile?.name||'doc')}`);

        const otrosPaths = [];
        for (const f of otrosFiles){
          const p = `${base}/otros/${safeName(f.name)}`;
          await st.ref(p).put(f, { contentType: f.type || 'application/octet-stream' });
          otrosPaths.push(p);
        }

        // 2.3) Datos top-level (como espera tu panel)
        const payload = {
          // Básicos (ajusta los names del form si hace falta)
          nombre: val(fd,'nombre') || val(fd,'name') || '',
          email:  val(fd,'email')  || '',
          telefono: val(fd,'telefono') || val(fd,'tel') || '',
          ciudad: val(fd,'ciudad') || '',
          cp:     val(fd,'cp')     || '',
          disponibilidad: val(fd,'disponibilidad') || '',
          links:  val(fd,'links')  || val(fd,'linkedin') || val(fd,'portfolio') || '',
          // Estado + fechas
          estado: 'pendiente',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          // Archivos (tu admin usa cvPath/tituloPath; cvUrl/tituloUrl quedan en blanco)
          cvPath,     tituloPath,     dniPath,
          cvUrl: '',  tituloUrl: '',  dniUrl: '',
          otrosPaths
        };

        await db.collection('candidaturas').add(payload);

        alert('¡Candidatura enviada con éxito! 🐾');
        try{ form.reset(); }catch(_){}
      }catch(err){
        console.error(err);
        alert('No se pudo enviar. Revisa la conexión o inténtalo de nuevo.');
      }finally{
        if (btn){ btn.disabled = false; btn.textContent = btn.dataset.t || 'Enviar'; }
      }
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */

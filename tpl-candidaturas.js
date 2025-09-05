/* TPL: INICIO BLOQUE NUEVO [Subida de documentos de candidatura a Firebase Storage + alta en Firestore] */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// Requiere que definas window.__TPL_FIREBASE_CONFIG en algún script global (no lo toco aquí)
const app = getApps().length ? getApp() : initializeApp(window.__TPL_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);
const st   = getStorage(app);

// Utilidad para crear rutas únicas
function safeName(name){
  return String(name||'').replace(/[^\w.\-\u00C0-\u024F]+/g,'_').slice(0,140);
}
function nowStamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

// Busca cualquier <form data-tpl-candidatura> y conecta el flujo
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form[data-tpl-candidatura]');
  if (!form) return;

  // Intercepción submit
  form.addEventListener('submit', async (ev) => {
    // Si ya hay otro handler de validación tuyo, no lo rompo:
    // si quiere continuar, que no llame ev.preventDefault() previamente.
    if (!ev.defaultPrevented) ev.preventDefault();

    // Deshabilito botón para evitar dobles envíos
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.originalText = submitBtn.textContent; submitBtn.textContent = 'Enviando…'; }

    try{
      // Garantiza sesión anónima para poder escribir en Storage/Firestore
      await ensureAuth();

      // Colecta datos del formulario (excepto archivos)
      const fd = new FormData(form);
      const data = {};
      for (const [k,v] of fd.entries()){
        if (v instanceof File) continue; // Los archivos los tratamos más abajo
        // Si hay campos repetidos (checkbox[]) convierto a array
        if (data[k] !== undefined){
          data[k] = Array.isArray(data[k]) ? data[k].concat(String(v)) : [data[k], String(v)];
        } else {
          data[k] = String(v);
        }
      }

      // Archivos esperados (no obligo; subo lo que exista)
      const filesSpec = [
        { name: 'cv',        label: 'CV' },
        { name: 'titulo',    label: 'Titulo' },
        { name: 'dni',       label: 'DNI' },
        // "otros" puede ser multiple: <input type="file" name="otros" multiple>
        { name: 'otros',     label: 'Otros', multiple: true },
      ];

      const user = auth.currentUser;
      const basePath = `candidaturas/${user.uid}/${nowStamp()}`;
      const uploaded = { cvPath:null, tituloPath:null, dniPath:null, otrosPaths:[] };

      for (const spec of filesSpec){
        if (spec.multiple){
          const fs = fd.getAll(spec.name).filter(f => f instanceof File && f.size>0);
          for (const f of fs){
            const path = `${basePath}/${spec.name}/${safeName(f.name)}`;
            await uploadBytes(sRef(st, path), f, { contentType: f.type || 'application/octet-stream' });
            uploaded.otrosPaths.push(path);
          }
        } else {
          const f = fd.get(spec.name);
          if (f instanceof File && f.size>0){
            const path = `${basePath}/${spec.name}-${safeName(f.name)}`;
            await uploadBytes(sRef(st, path), f, { contentType: f.type || 'application/octet-stream' });
            if (spec.name === 'cv') uploaded.cvPath = path;
            if (spec.name === 'titulo') uploaded.tituloPath = path;
            if (spec.name === 'dni') uploaded.dniPath = path;
          }
        }
      }

      // Alta en Firestore
      const payload = {
        uid: user.uid,
        status: 'recibida',
        createdAt: serverTimestamp(),
        form: data,     // todos tus campos texto/select/etc.
        files: uploaded // rutas en Storage (solo admin podrá leer/descargar)
      };
      await addDoc(collection(db, 'candidaturas'), payload);

      // Mensaje final no intrusivo
      alert('¡Candidatura enviada! Te contactaremos pronto 🐾');
      try { form.reset(); } catch(e){}
    } catch(err){
      console.error(err);
      alert('No se pudo enviar la candidatura. Revisa conexión o inténtalo de nuevo.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.originalText || 'Enviar'; }
    }
  });
});

async function ensureAuth(){
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (u) => {
      try{
        if (!u) await signInAnonymously(auth);
        resolve();
      } catch(e){ reject(e); }
    });
  });
}
/* TPL: FIN BLOQUE NUEVO */

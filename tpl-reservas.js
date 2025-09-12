/* TPL: INICIO BLOQUE NUEVO [reservas.js — v3 estable con auto-relleno + EmailJS + Firestore] */
(function(){
  const $  = (s,c)=> (c||document).querySelector(s);
  const $$ = (s,c)=> Array.from((c||document).querySelectorAll(s));
  const t  = (id)=> (document.getElementById(id)?.value||'').trim();
  const st = (id)=> (document.getElementById(id)?.selectedOptions?.[0]?.text || document.getElementById(id)?.value || '').trim();
  const set = (id,v)=>{ const el=document.getElementById(id); if(el && v!=null && v!==''){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); } };

  function overlay(msg, href){
    let ov = $('#tpl-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id='tpl-overlay';
      ov.className='tpl-overlay on';
      ov.innerHTML = '<div class="tpl-modal"><p></p><button type="button" class="tpl-btn" id="tpl-ov-accept">Aceptar</button></div>';
      document.body.appendChild(ov);
    }
    ov.querySelector('p').textContent = msg || 'Tu reserva se ha enviado correctamente.';
    ov.classList.add('on');
    ov.querySelector('#tpl-ov-accept').onclick = ()=> location.href = href || 'perfil.html';
  }

  // -------- Login inline (si no hay sesión) --------
  function renderInlineLogin(){
    const host = $('#tpl-inline-login'); if(!host) return;
    host.innerHTML = `
      <div class="tpl-login-card">
        <h3 class="tpl-login-title">Accede aquí mismo</h3>
        <div class="tpl-socials">
          <button type="button" class="tpl-btn-social" id="tpl-google-btn"><i class="fa-brands fa-google"></i> Continuar con Google</button>
        </div>
        <form class="tpl-login-form" id="tpl-inline-form" novalidate>
          <input type="email" name="email" placeholder="Email" required autocomplete="email"/>
          <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password"/>
          <button type="submit" class="tpl-btn">Iniciar sesión</button>
          <button type="button" class="tpl-btn-outline" id="tpl-reset">¿Has olvidado la contraseña?</button>
          <p class="tpl-login-msg" aria-live="polite"></p>
        </form>
      </div>
    `;
    const form=$('#tpl-inline-form'), msg=$('.tpl-login-msg',host);
    $('#tpl-google-btn').addEventListener('click', async ()=>{
      try{ await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
      catch(e){ msg.textContent = e?.message || 'No se pudo iniciar con Google.'; }
    });
    form.addEventListener('submit', async (e)=>{
      e.preventDefault(); msg.textContent='Accediendo…';
      try{ await firebase.auth().signInWithEmailAndPassword(form.email.value.trim(), form.password.value); location.reload(); }
      catch(e){ msg.textContent=e?.message||'No se pudo iniciar sesión.'; }
    });
    $('#tpl-reset').addEventListener('click', async ()=>{
      const email=form.email.value.trim(); if(!email){ msg.textContent='Escribe tu email arriba.'; return; }
      try{ await firebase.auth().sendPasswordResetEmail(email); msg.textContent='Te enviamos un enlace para restablecer.'; }
      catch(e){ msg.textContent=e?.message||'No se pudo enviar el email.'; }
    });
  }

  // -------- Leer perfil + mascotas (Firestore) --------
  async function readOwner(uid){
    const db=firebase.firestore();
    const tries=[['users',uid],['tpl_propietarios',uid],['propietarios',uid],['owners',uid]];
    for(const [col,id] of tries){
      try{ const s=await db.collection(col).doc(id).get(); if(s.exists) return {...s.data(),_id:s.id}; }catch(_){}
    }
    return null;
  }
  async function readPets(uid){
    const db=firebase.firestore(); const out=[];
    try{ const sub=await db.collection('users').doc(uid).collection('mascotas').get(); sub.forEach(d=>out.push({id:d.id,...d.data()})); }catch(_){}
    if(!out.length){
      for(const col of ['tpl_mascotas','mascotas','pets']){
        try{ const q=await db.collection(col).where('uid','==',uid).get(); if(!q.empty) q.forEach(d=>out.push({id:d.id,...d.data()})); }catch(_){}
      }
    }
    return out;
  }
  function fillOwnerForm(o){
    if(!o) return;
    set('firstName', o.nombre||o.firstName||o.givenName||'');
    set('lastName',  o.apellidos||o.lastName||o.surname||'');
    set('email',     o.email||o.correo||'');
    set('phone',     o.telefono||o.tel||'');
    set('location',  o.direccion||o.address||'');
    set('postalCode',o.cp||o.postalCode||'');
    const ccaa=(o.ccaa||o.CCAA||'').toString().toLowerCase();
    if(ccaa && document.getElementById('region') && $$('#region option').some(x=>x.value===ccaa)) document.getElementById('region').value=ccaa;
  }
  function setupPetSelector(pets){
    const sel=document.getElementById('tpl-pet-select'); if(!sel) return;
    sel.innerHTML='<option value="">— Selecciona —</option>';
    pets.forEach(p=>{
      const name=(p.nombre||p.name||p.alias||`Mascota-${p.id||''}`).toString();
      const opt=document.createElement('option');
      opt.value=p.id||name; opt.textContent=name; opt.dataset.pet=JSON.stringify(p); sel.appendChild(opt);
    });
    if(pets.length===1){
      sel.value=sel.options[1].value;
      sel.closest('.booking-field')?.classList.add('tpl-hide');
      apply(JSON.parse(sel.options[1].dataset.pet));
    }
    sel.addEventListener('change',()=>{ const o=sel.selectedOptions[0]; try{apply(JSON.parse(o.dataset.pet||'{}'));}catch(_){}});

    function apply(p){
      set('petName_1', p.nombre||p.name||p.alias||'');
      const sp=(p.especie||p.species||'').toString().toLowerCase();
      if(sp && document.getElementById('species')) document.getElementById('species').value = sp.includes('gat')?'gato': sp.includes('perr')?'perro':'otros';
      const h=document.getElementById('petsListHidden'); if(h) h.value = document.getElementById('petName_1').value;
    }
    document.getElementById('petName_1')?.addEventListener('input', ()=>{ const h=document.getElementById('petsListHidden'); if(h) h.value=document.getElementById('petName_1').value.trim(); });
  }

  // -------- Resumen rápido --------
  function recalc(){
    const ok = !!t('startDate') && !!t('endDate');
    const base = ok ? 30 : 0; // placeholder
    const dep  = base * 0.2;
    const f = (n)=> n ? n.toFixed(2)+' €' : '—';
    const sub = document.getElementById('sumSubtotal'), de = document.getElementById('sumDeposit');
    if(sub) sub.value = f(base);
    if(de)  de.value  = f(dep);
    // Para correo
    const lines=[];
    lines.push(`Servicio: ${st('service')}`);
    lines.push(`Fechas: ${t('startDate')} a ${t('endDate')}`);
    lines.push(`Hora: ${t('start')} a ${t('end')}`);
    if(t('petName_1')) lines.push(`Mascota: ${t('petName_1')} (${t('species')})`);
    lines.push(`Dirección: ${t('location')} · CP: ${t('postalCode')} · CCAA: ${st('region')}`);
    if(document.getElementById('summaryField')) document.getElementById('summaryField').value = lines.join(' | ');
  }

  // -------- Envío --------
  async function sendEmailJS(payload){
    const cfg=window.TPL_EMAILJS||{};
    if(!window.emailjs) return false;
    const SERVICE=cfg.serviceId||cfg.service;
    const TEMPLATE=cfg.templateId|| (cfg.templates && (cfg.templates.reserva||cfg.templates.booking)) || cfg.template;
    const USER=cfg.publicKey||cfg.userId;
    if(!SERVICE||!TEMPLATE||!USER) return false;
    const adminTo = cfg.admin||cfg.adminEmail||'gestion@thepetslovers.es';
    await emailjs.send(SERVICE, TEMPLATE, {...payload, to_email: payload.to_email||adminTo}, USER);
    if((payload.owner_email||'').includes('@')){
      await emailjs.send(SERVICE, TEMPLATE, {...payload, to_email: payload.owner_email, reply_to: payload.owner_email}, USER);
    }
    return true;
  }
  async function saveFirestore(payload){
    try{
      if(!firebase?.firestore) return false;
      const db=firebase.firestore();
      if(firebase.firestore.FieldValue) payload._createdAt=firebase.firestore.FieldValue.serverTimestamp();
      const ref=await db.collection('reservas').add(payload);
      return !!ref?.id;
    }catch(_){ return false; }
  }

  function attachSubmit(){
    const form=document.getElementById('bookingForm'); if(!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault(); e.stopImmediatePropagation();
      const btn=document.getElementById('tpl-submit'); const old=btn?.textContent; if(btn){ btn.disabled=true; btn.textContent='Enviando…'; }

      const u = firebase?.auth?.().currentUser || null;
      const payload={
        _tipo:'reserva',_estado:'enviada',_page:location.href,
        servicio: st('service'), servicio_val: t('service'),
        fecha_inicio: t('startDate'), fecha_fin: t('endDate'),
        hora_inicio: t('start'), hora_fin: t('end'),
        tipo_animal: t('species'),
        mascotas: t('petsListHidden') || t('petName_1'),
        owner_nombre_only: t('firstName'),
        owner_apellidos:   t('lastName'),
        owner_nombre:      `${t('firstName')} ${t('lastName')}`.trim(),
        owner_email:       t('email'), owner_telefono: t('phone'),
        owner_direccion:   t('location'), owner_cp: t('postalCode'), owner_ccaa: st('region'),
        subtotal: (document.getElementById('sumSubtotal')?.value||'').replace('—','0'),
        deposito: (document.getElementById('sumDeposit')?.value||'').replace('—','0'),
        resumen:  document.getElementById('summaryField')?.value || '',
        reserva_id: `R-${Date.now().toString(36)}-${Math.floor(Math.random()*1e4).toString().padStart(4,'0')}`
      };
      if(u){ payload._uid=u.uid; payload._email=u.email||null; }

      await Promise.allSettled([
        saveFirestore({...payload,
          Servicio: payload.servicio, Fecha_inicio: payload.fecha_inicio, Fecha_fin: payload.fecha_fin,
          Hora_inicio: payload.hora_inicio, Hora_fin: payload.hora_fin, Mascotas_lista: payload.mascotas
        }),
        sendEmailJS(payload)
      ]);

      overlay(form.dataset.tplSuccess||'Tu reserva se ha enviado.', form.dataset.tplRedirect||'perfil.html');

      try{
        const uid=(u?.uid)||'default';
        localStorage.setItem(`tpl.udb.${uid}.lastReservation`, JSON.stringify({
          Servicio: payload.servicio, Fecha_inicio: payload.fecha_inicio, Fecha_fin: payload.fecha_fin, _estado:'enviada', Mascotas_lista: payload.mascotas
        }));
      }catch(_){}

      if(btn){ btn.disabled=false; btn.textContent=old; }
    }, true);
  }

  // -------- Arranque --------
  document.addEventListener('DOMContentLoaded', ()=>{
    const wall=document.getElementById('tpl-auth-wall'), form=document.getElementById('bookingForm');

    // Recalcular en cambios
    ['service','startDate','endDate','start','end','species','petName_1','location','postalCode','region'].forEach(id=>{
      const el=document.getElementById(id); if(el){ el.addEventListener('change',recalc); el.addEventListener('input',recalc); }
    });

    if(typeof firebase==='undefined' || !firebase.auth){
      wall?.classList.remove('tpl-hide'); form?.classList.add('tpl-hide'); renderInlineLogin(); return;
    }

    firebase.auth().onAuthStateChanged(async (user)=>{
      if(user){
        wall?.classList.add('tpl-hide'); form?.classList.remove('tpl-hide');
        try{
          const [owner,pets]=await Promise.all([readOwner(user.uid), readPets(user.uid)]);
          fillOwnerForm(owner); setupPetSelector(pets||[]); recalc();
        }catch(_){ recalc(); }
      }else{
        renderInlineLogin();
        wall?.classList.remove('tpl-hide'); form?.classList.add('tpl-hide');
      }
    });

    attachSubmit();
  });
})();
/* TPL: FIN BLOQUE NUEVO */

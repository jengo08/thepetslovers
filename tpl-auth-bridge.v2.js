/* TPL · Auth bridge v2 (DOM clásico reserva.html) */
(function(){
  const hasFirebase = !!(window.firebase && firebase.auth && firebase.firestore);
  if (!hasFirebase){ console.warn('[TPL] Falta Firebase.'); return; }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const authWall = document.getElementById('authWall');
  const form     = document.getElementById('bookingForm');
  const petsList = document.getElementById('petsList');

  const show = el => el && (el.style.display='block');
  const hide = el => el && (el.style.display='none');

  function setFormDisabled(disabled){
    if (!form) return;
    form.classList.toggle('disabled', !!disabled);
    form.querySelectorAll('input,select,textarea,button').forEach(el=>{
      if (el.id==='btnBack') return;
      el.disabled = !!disabled;
    });
  }

  function fillProfile(p){
    const $ = id => document.getElementById(id);
    if (!$('fullName')) return;
    $('fullName').value   = p?.fullName   || '';
    $('email').value      = p?.email      || '';
    $('phone').value      = p?.phone      || '';
    $('address').value    = p?.address    || '';
    $('postalCode').value = p?.postalCode || '';
    $('region').value     = p?.region     || '';
  }

  function renderPets(pets){
    petsList.innerHTML = '';
    if (!pets || !pets.length){
      petsList.innerHTML = `<p class="muted">No tienes mascotas guardadas todavía.</p>`;
      return;
    }
    const sixMs = 1000*60*60*24*30.4375*6;
    pets.forEach(p=>{
      const isPuppy = p?.birth ? (Date.now()-new Date(p.birth).getTime()) <= sixMs : false;
      const row = document.createElement('div');
      row.className = 'pet-item';
      row.innerHTML = `
        <label style="display:flex;align-items:center;gap:.6rem;">
          <input type="checkbox" name="pets" value="${p.id||p.name}" data-species="${p.species||''}" data-ispuppy="${isPuppy?'1':'0'}">
          <span><strong>${p.name}</strong> · <span class="muted">${p.species||'—'}</span></span>
        </label>
        ${isPuppy ? '<span class="badge">Cachorro ≤6m</span>' : ''}`;
      petsList.appendChild(row);
    });
  }

  // Estado global mínimo por si lo usa el otro script
  window.TPL_SESSION = { user:null, profile:null, pets:[] };

  auth.onAuthStateChanged(async(user)=>{
    window.TPL_SESSION.user = user || null;
    if (!user){ show(authWall); setFormDisabled(true); return; }
    hide(authWall); setFormDisabled(false);

    try{
      const snap = await db.collection('propietarios').doc(user.uid).get();
      const profile = snap.exists ? snap.data() : null;
      window.TPL_SESSION.profile = profile;
      window.TPL_SESSION.pets = profile?.pets || [];
      fillProfile(profile||{});
      renderPets(window.TPL_SESSION.pets);
    }catch(e){ console.error('[TPL] Perfil error', e); }
  });

  // Botones del muro (abre auth del sitio si lo tienes; aquí son placeholders)
  document.getElementById('btnLogin')?.addEventListener('click', ()=> {
    // Aquí puedes abrir tu modal de login propio si lo tienes
    // Si no, deja que el usuario navegue a tu /login.html
    alert('Abre tu modal o página de inicio de sesión.');
  });
  document.getElementById('btnRegister')?.addEventListener('click', ()=> {
    alert('Abre tu modal o página de registro.');
  });

  // CTA Atrás
  document.getElementById('btnBack')?.addEventListener('click', ()=>{
    if (document.referrer) history.back(); else location.href='servicios.html';
  });
})();

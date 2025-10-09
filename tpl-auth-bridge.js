/*
  TPL · Auth bridge + Perfil → Autorrelleno y mascotas
  - Muestra/oculta el muro de login según sesión
  - Modal mínimo para login/registro (sin redirección)
  - Carga perfil (propietarios/{uid}) y mascotas → window.TPL_SESSION
*/
(function(){
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Estado global mínimo
  window.TPL_SESSION = { user: null, profile: null, pets: [] };

  // UI refs
  const authWall = document.getElementById('authWall');
  const formWrap = document.getElementById('reservaForm');
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const ctaStart = document.getElementById('ctaStart');

  const show = el => el && (el.style.display = 'block');
  const hide = el => el && (el.style.display = 'none');

  function setDisabledForm(disabled){
    formWrap?.setAttribute('data-disabled', disabled ? 'true' : 'false');
    [...formWrap.querySelectorAll('input,select,textarea,button')].forEach(el => {
      if (el.id === 'btnBack') return; // permitir atrás
      if (el.closest('#authWall')) return;
      el.disabled = !!disabled;
    });
  }

  function fillProfile(profile){
    document.getElementById('fullName').value = profile?.fullName || '';
    document.getElementById('email').value = profile?.email || '';
    document.getElementById('phone').value = profile?.phone || '';
    document.getElementById('address').value = profile?.address || '';
    document.getElementById('postalCode').value = profile?.postalCode || '';
    document.getElementById('region').value = profile?.region || '';
  }

  function renderPets(pets){
    const wrap = document.getElementById('petsList');
    wrap.innerHTML = '';
    if (!pets || !pets.length) {
      wrap.innerHTML = `<p class="muted">No tienes mascotas guardadas todavía.</p>`;
      return;
    }
    pets.forEach(p => {
      const isPuppy = (() => {
        if (!p.birth) return false;
        const sixMonthsMs = 1000*60*60*24*30.4375*6;
        const birth = new Date(p.birth).getTime();
        return (Date.now() - birth) <= sixMonthsMs;
      })();
      const div = document.createElement('div');
      div.className = 'pet-item';
      div.innerHTML = `
        <label style="display:flex; align-items:center; gap:.6rem;">
          <input type="checkbox" name="pets" value="${p.id || p.name}" data-species="${p.species || ''}" data-ispuppy="${isPuppy ? '1':'0'}" />
          <span><strong>${p.name}</strong> · <span class="muted">${p.species || '—'}</span></span>
        </label>
        ${isPuppy ? '<span class="badge">Cachorro ≤6m</span>' : ''}
      `;
      wrap.appendChild(div);
    });
  }

  // Modal muy simple para login/registro
  const modal = document.createElement('dialog');
  modal.innerHTML = `
    <form method="dialog" style="min-width:320px; max-width:420px; border:none; padding:0;">
      <div style="padding:1rem;">
        <h3 style="margin:0 0 .5rem; font-weight:700; font-family:Montserrat, sans-serif;">Accede a tu cuenta</h3>
        <div style="display:grid; gap:.5rem;">
          <input id="mEmail" type="email" placeholder="Email" required />
          <input id="mPass" type="password" placeholder="Contraseña" required />
        </div>
        <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:.75rem;">
          <button class="btn">Cancelar</button>
          <button id="mDoLogin" class="btn primary" value="login">Iniciar sesión</button>
          <button id="mDoRegister" class="btn" value="register">Crear cuenta</button>
        </div>
        <p id="mError" class="muted" style="color:#ef4444; display:none; margin-top:.5rem;"></p>
      </div>
    </form>`;
  document.body.appendChild(modal);

  // Escuchar auth
  auth.onAuthStateChanged(async(user) => {
    window.TPL_SESSION.user = user || null;
    if (!user) {
      show(authWall); setDisabledForm(true);
      return;
    }
    hide(authWall); setDisabledForm(false);

    // Cargar perfil + mascotas
    try {
      const doc = await db.collection('propietarios').doc(user.uid).get();
      const profile = doc.exists ? doc.data() : null;
      window.TPL_SESSION.profile = profile;
      window.TPL_SESSION.pets = profile?.pets || [];
      fillProfile(profile||{});
      renderPets(window.TPL_SESSION.pets);
    } catch(err){ console.error('Perfil error', err); }
  });

  // CTA empezar → scroll al formulario
  ctaStart?.addEventListener('click', () => {
    document.getElementById('fsServicio')?.scrollIntoView({behavior:'smooth'});
  });

  // Abrir modal desde el muro
  btnLogin?.addEventListener('click', ()=> modal.showModal());
  btnRegister?.addEventListener('click', ()=> modal.showModal());

  // Acciones modal
  modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.close(); });
  modal.querySelector('#mDoLogin')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const email = modal.querySelector('#mEmail').value.trim();
    const pass = modal.querySelector('#mPass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); modal.close(); }
    catch(err){ const m = modal.querySelector('#mError'); m.textContent = err.message; m.style.display='block'; }
  });
  modal.querySelector('#mDoRegister')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const email = modal.querySelector('#mEmail').value.trim();
    const pass = modal.querySelector('#mPass').value;
    try { await auth.createUserWithEmailAndPassword(email, pass); modal.close(); }
    catch(err){ const m = modal.querySelector('#mError'); m.textContent = err.message; m.style.display='block'; }
  });

  // Cookie mini modal
  const ckKey = 'tpl_ck_ok';
  if (!localStorage.getItem(ckKey)) {
    const mini = document.getElementById('cookieMini');
    if (mini) {
      mini.style.display='block';
      document.getElementById('acceptCookies').onclick = ()=>{
        localStorage.setItem(ckKey, '1');
        mini.style.display='none';
      };
    }
  }
})();

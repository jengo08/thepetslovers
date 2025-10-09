/*
TPL · Auth bridge + Perfil → Autorrelleno y mascotas
- Muestra/oculta el muro de login según sesión
- Login/Registro mínimos en modal sin redirección
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


// Simple modal
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


})();

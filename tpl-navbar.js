<!-- TPL: INICIO BLOQUE NUEVO [tpl-navbar.js] -->
<script>
// Inyecta el navbar maestro y aplica la lógica de sesión
(function(){
  function isLoggedIn(){
    // 1) Firebase Auth (si está presente en tu proyecto)
    try{
      if (window.firebase?.auth) {
        // devolvemos un "possibly logged" para no bloquear el UI; onAuthStateChanged ajusta luego
        return !!window.firebase.auth().currentUser;
      }
    }catch(e){}

    // 2) Señales personalizadas (si las usas en tu app)
    if (window.tplIsLogged === true) return true;

    // 3) LocalStorage simple (por si gestionas sesión manualmente)
    if (localStorage.getItem('tplAuth') === '1') return true;

    return false;
  }

  function hideSignOutButtons(){
    // Oculta botones de "Cerrar sesión" con alta tolerancia (sin cambiar HTML existente)
    const candidates = new Set([
      ...document.querySelectorAll('[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'),
      ...Array.from(document.querySelectorAll('a,button')).filter(el => {
        const t = (el.textContent || el.innerText || '').trim().toLowerCase();
        return t === 'cerrar sesión' || t === 'cerrar sesion' || t.includes('logout') || t.includes('sign out');
      })
    ]);
    candidates.forEach(el => { el.style.display = 'none'; el.setAttribute('aria-hidden','true'); });

    // Opcional: también puede ocultar "Iniciar sesión" si ya hay sesión
    const loginBtns = Array.from(document.querySelectorAll('[data-action="login"], .login-button, a[href*="login"], a[href*="iniciar-sesion"]'));
    loginBtns.forEach(el => { el.style.display = 'none'; el.setAttribute('aria-hidden','true'); });
  }

  function afterInject(){
    if (isLoggedIn()){
      hideSignOutButtons();
    }

    // Si hay Firebase, ajustamos con el estado real en cuanto lo sepamos
    try{
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged(function(user){
          if (user) {
            hideSignOutButtons();
          }
        });
      }
    }catch(e){}
  }

  // Inyección del navbar maestro
  function injectNavbar(){
    const mount = document.getElementById('tpl-navbar');
    if (!mount) return;

    fetch('tpl-navbar.html', { cache: 'no-cache' })
      .then(r => r.text())
      .then(html => {
        mount.outerHTML = html;
        // Espera un ciclo para que el DOM del navbar exista
        requestAnimationFrame(afterInject);
      })
      .catch(err => console.error('Error cargando navbar:', err));
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  } else {
    injectNavbar();
  }
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

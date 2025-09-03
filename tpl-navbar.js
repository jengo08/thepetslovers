/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js — RESCATE SIMPLE y ESTABLE] */
(function(){
  // 👉 Ajusta esta ruta si tu perfil se llama distinto
  var PROFILE_URL = 'mi-perfil.html';

  // --- HTML del navbar (igual que Index, con “¿Necesitas ayuda?”)
  var NAV_HTML =
    '<nav class="navbar">'
    + '  <div class="logo"><a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a></div>'
    + '  <a href="index.html" class="home-button">Inicio</a>'
    + '  <ul class="nav-links">'
    + '    <li><a href="como-funciona.html">Cómo funciona</a></li>'
    + '    <li><a href="servicios.html">Servicios</a></li>'
    + '    <li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>'
    + '    <li><a href="ayuda.html">¿Necesitas ayuda?</a></li>'
    + '  </ul>'
    + '  <a class="login-button" href="iniciar-sesion.html">Iniciar sesión</a>'
    + '</nav>';

  // --- Montaje: crea #tpl-navbar si no existe y pinta la barra
  function mountNavbar(){
    try{
      var host = document.getElementById('tpl-navbar');
      if(!host){
        host = document.createElement('div');
        host.id = 'tpl-navbar';
        document.body.insertBefore(host, document.body.firstChild || null);
      }
      host.innerHTML = NAV_HTML;
      markActiveLink();
      applySessionUI(); // pinta “Mi perfil” si ya estabas logueada
    }catch(e){ console.error('TPL navbar mount error:', e); }
  }

  // --- Marca el enlace activo con aria-current
  function markActiveLink(){
    try{
      var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      var nodes = document.querySelectorAll('.navbar a[href]');
      for(var i=0;i<nodes.length;i++){
        var a = nodes[i];
        var f = (a.getAttribute('href')||'').split('#')[0].toLowerCase();
        if(f && f === here){ a.setAttribute('aria-current','page'); }
      }
    }catch(e){}
  }

  // --- Heurística de sesión (sin romper si no hay Firebase)
  function isLoggedIn(){
    try{
      // 1) Firebase guarda el usuario en localStorage con claves “firebase:authUser:…”
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('firebase:authUser:')===0){
          var v = localStorage.getItem(k);
          if(v && v.indexOf('"uid":') !== -1) return true;
        }
      }
      // 2) Flag propio por si tu login lo usa
      if(localStorage.getItem('tplAuth')==='1') return true;
    }catch(e){}
    return false;
  }

  // --- Oculta cualquier “Cerrar sesión” que pueda haber
  function hideLogoutEverywhere(){
    try{
      var elems = [].slice.call(document.querySelectorAll(
        '[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'
      ));
      // también por texto
      [].slice.call(document.querySelectorAll('.navbar a, .navbar button')).forEach(function(el){
        var t=(el.textContent||'').trim().toLowerCase();
        if(t==='cerrar sesión'||t==='cerrar sesion'||t.indexOf('logout')>-1||t.indexOf('sign out')>-1){
          elems.push(el);
        }
      });
      elems.forEach(function(el){ el.style.display='none'; el.setAttribute('aria-hidden','true'); });
    }catch(e){}
  }

  // --- Aplica el estado al botón derecho
  function setLoginButton(logged){
    try{
      var btn = document.querySelector('.navbar .login-button');
      if(!btn) return;
      if(logged){
        btn.textContent = 'Mi perfil';
        btn.setAttribute('href', PROFILE_URL);
        btn.setAttribute('aria-label','Ir a mi perfil');
      }else{
        btn.textContent = 'Iniciar sesión';
        btn.setAttribute('href', 'iniciar-sesion.html');
        btn.setAttribute('aria-label','Iniciar sesión');
      }
    }catch(e){}
  }

  function applySessionUI(){
    hideLogoutEverywhere();
    setLoginButton(isLoggedIn());

    // Si hay Firebase en la página, nos sincronizamos en tiempo real SIN romper nada
    try{
      if(window.firebase && firebase.auth){
        var a = firebase.auth();
        a.onAuthStateChanged(function(u){
          setLoginButton(!!u);
          hideLogoutEverywhere();
          try{
            if(u){ localStorage.setItem('tplAuth','1'); }
            else { localStorage.removeItem('tplAuth'); }
          }catch(e){}
        });
      }
    }catch(e){}
  }

  // --- Arranque (defer hace que el DOM ya esté listo)
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', mountNavbar);
  }else{
    mountNavbar();
  }
})();
 /* TPL: FIN BLOQUE NUEVO */

/*!
 * TPL · auth-bridge
 * - Asegura login antes de interactuar con reservas
 * - Recuerda parámetros para volver a /reservas.html tras login
 * Requisitos: Firebase compat (app+auth) cargado previamente
 */

(function(){
  const RETURN_KEY = "tpl.return.afterLogin";
  const STATE_KEY  = "tpl.port.state";

  function readPortParams(){
    const p = new URLSearchParams(location.search), o = {};
    [
      "service","svc","date","start","end",
      "startDate","endDate","pets","region","notes"
    ].forEach(k=>{
      const v = p.get(k);
      if(v) o[k]=v;
    });
    return o;
  }

  function rememberReturn(){
    try{
      sessionStorage.setItem(RETURN_KEY, "/reservas.html"+location.search+location.hash);
      const state = readPortParams();
      if(Object.keys(state).length){
        sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      }
    }catch(_){}
  }

  function popState(){
    try{
      const raw = sessionStorage.getItem(STATE_KEY);
      if(!raw) return null;
      sessionStorage.removeItem(STATE_KEY);
      return JSON.parse(raw);
    }catch(_){ return null; }
  }

  // Expuesto globalmente para que lo pueda invocar reservas u otras páginas
  window.__TPL_AUTH_BRIDGE__ = {
    ensureLogged: function(opts){
      opts = opts||{};
      const loginUrl = opts.loginUrl || "/login.html";
      try{
        if(!window.firebase || !firebase.auth) return true; // no podemos verificar, dejar pasar
        const u = firebase.auth().currentUser;
        if(u) return true;
        rememberReturn();
        const next = encodeURIComponent("/reservas.html");
        location.href = loginUrl + "?next=" + next;
        return false;
      }catch(_){ return true; }
    },
    getPortState: popState
  };
})();

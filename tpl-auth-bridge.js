// Puerta de sesión + portado de parámetros (service,date,start,end,pets,region,notes)
(function(){
  const RETURN_KEY = "tpl.return.afterLogin";
  const STATE_KEY  = "tpl.port.state";

  function readPortParams(){
    const p = new URLSearchParams(location.search);
    const o = {};
    ["service","svc","date","start","end","pets","region","notes","startDate","endDate"].forEach(k=>{
      const v = p.get(k); if(v) o[k]=v;
    });
    return o;
  }

  function rememberReturn(){
    const url = location.pathname + location.search + location.hash;
    sessionStorage.setItem(RETURN_KEY, url);
    const state = readPortParams();
    if(Object.keys(state).length){
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
  }

  function applyPortState(){
    try{
      const raw = sessionStorage.getItem(STATE_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      sessionStorage.removeItem(STATE_KEY);
      return obj;
    }catch(_){ return null; }
  }

  window.__TPL_AUTH_BRIDGE__ = {
    ensureLogged: function({loginUrl="/login.html"}={}){
      try{
        if(!window.firebase || !firebase.auth) return true;
        const u = firebase.auth().currentUser;
        if(u) return true;
        rememberReturn();
        location.href = loginUrl + "?next=reservas";
        return false;
      }catch(_){ return true; }
    },
    getPortState: applyPortState
  };
})();

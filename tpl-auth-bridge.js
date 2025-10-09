<script>
(function(){
  var RETURN_KEY = "tpl.return.afterLogin";
  var STATE_KEY  = "tpl.port.state";

  function readPortParams(){
    var p = new URLSearchParams(location.search), o = {};
    ["service","svc","date","start","end","startDate","endDate","pets","region","notes"]
      .forEach(function(k){ var v=p.get(k); if(v) o[k]=v; });
    return o;
  }

  function rememberReturn(){
    try{
      sessionStorage.setItem(RETURN_KEY, "/reservas.html" + location.search + location.hash);
      var state = readPortParams();
      if(Object.keys(state).length){
        sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      }
    }catch(_){}
  }

  function popState(){
    try{
      var raw = sessionStorage.getItem(STATE_KEY);
      if(!raw) return null;
      sessionStorage.removeItem(STATE_KEY);
      return JSON.parse(raw);
    }catch(_){ return null; }
  }

  window.__TPL_AUTH_BRIDGE__ = {
    ensureLogged: function(opts){
      opts = opts || {};
      var loginUrl = opts.loginUrl || "/login.html";
      try{
        if(!window.firebase || !firebase.auth) return true;
        var u = firebase.auth().currentUser;
        if(u) return true;
        rememberReturn();
        // Siempre con .html
        var next = encodeURIComponent("/reservas.html");
        location.href = loginUrl + "?next=" + next;
        return false;
      }catch(_){ return true; }
    },
    getPortState: popState
  };
})();
</script>

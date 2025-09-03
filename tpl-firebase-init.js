<!-- TPL: INICIO BLOQUE NUEVO [tpl-firebase-init.js] -->
<script>
// Reemplaza con tu config real
window.tplFirebaseInit = function(){
  if (!window.firebase) { console.error('Firebase SDK no cargado'); return; }
  var firebaseConfig = {
    apiKey: "XXX",
    authDomain: "XXX.firebaseapp.com",
    projectId: "XXX",
    appId: "1:XXX:web:XXX"
  };
  if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
};
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

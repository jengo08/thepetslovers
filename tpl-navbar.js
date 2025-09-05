/* TPL Reserva – sin Formspree; Firestore opcional + email a gestión + confirmación */
(function(){
  var FORM_ID = 'bookingForm';          // tu formulario de reservas
  var OK_REDIRECT = 'index.html';       // botón Aceptar te lleva aquí
  var MSG_SENDING = 'Subiendo archivos (si aplica) y guardando datos. Puede tardar unos segundos.';
  var MSG_DONE = 'Ya hemos registrado tu reserva. Nos pondremos en contacto contigo lo antes posible para encontrar el cuidador que mejor se adapte a tus necesidades.';

  // Usa el overlay ya estilizado en tu CSS (.tpl-form-overlay / .tpl-form-card)
  function ensureOverlay(){
    var id='tpl-form-overlay', el=document.getElementById(id);
    if (el) return el;
    el=document.createElement('div'); el.id=id; el.className='tpl-form-overlay';
    el.innerHTML = [
      '<div class="tpl-form-card">',
        '<div class="tpl-form-spinner"></div>',
        '<h3>Procesando…</h3>',
        '<p id="tpl-form-msg"></p>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    return el;
  }
  function showOverlay(text){
    var ov = ensureOverlay();
    var msg = ov.querySelector('#tpl-form-msg'); if (msg) msg.textContent = text || '';
    ov.classList.add('show');
  }
  function hideOverlay(){
    var ov = document.getElementById('tpl-form-overlay');
    if (ov) ov.classList.remove('show');
  }
  function showFinalDialog(){
    // Reutilizo el mismo overlay pero con CTA
    var ov = ensureOverlay();
    var card = ov.querySelector('.tpl-form-card');
    card.innerHTML = [
      '<div class="tpl-form-spinner" style="display:none"></div>',
      '<h3>¡Reserva registrada!</h3>',
      '<p style="margin:6px 0 12px">'+MSG_DONE+'</p>',
      '<button id="tpl-accept" class="cta-button" type="button" style="width:100%">Aceptar</button>'
    ].join('');
    ov.classList.add('show');
    var btn = card.querySelector('#tpl-accept');
    if (btn) btn.addEventListener('click', function(){ location.href = OK_REDIRECT; });
  }

  async function saveFirestoreCopy(payload){
    try{
      if (typeof firebase==='undefined' || !firebase.firestore) return;
      var db = firebase.firestore();
      var auth = firebase.auth ? firebase.auth() : null;
      var u = auth && auth.currentUser ? auth.currentUser : null;
      payload._page = location.href;
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      if (u){ payload._uid = u.uid; payload._email = u.email || null; }
      await db.collection('reservas').add(payload);
    }catch(e){ console.warn('No se pudo guardar en Firestore', e); }
  }

  function formToObject(form){
    var fd = new FormData(form), obj = {};
    fd.forEach(function(v,k){ obj[k]=v; });
    return obj;
  }

  function attach(){
    var form = document.getElementById(FORM_ID);
    if (!form) return;

    // Si aún tienes action="https://formspree..." da igual: preventDefault lo anula
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      showOverlay(MSG_SENDING);

      // 1) Guardar copia (si hay Firebase)
      try{ await saveFirestoreCopy(formToObject(form)); }catch(_){}

      // 2) Enviar email a gestión (EmailJS)
      try{
        if (!window.TPL_MAIL || !TPL_MAIL.sendReserva) throw new Error('TPL_MAIL no disponible');
        await TPL_MAIL.sendReserva(form);
      }catch(err){
        console.warn('EmailJS reserva falló:', err);
        // seguimos mostrando el OK al usuario igualmente
      }

      // 3) Confirmación y CTA a inicio
      hideOverlay();
      showFinalDialog();
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();

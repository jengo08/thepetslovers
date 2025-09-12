<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reserva · The Pets Lovers</title>

  <!-- 1) CANONICAL HOST: unificamos sesión -->
  <script>
  (function(){
    var CANON = 'www.thepetslovers.es';
    if (location.hostname && location.hostname !== CANON) {
      location.replace(location.protocol + '//' + CANON + location.pathname + location.search + location.hash);
    }
  })();
  </script>

  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Poppins:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">

  <style>
    .booking-wrapper{ max-width: 980px; margin: 120px auto 60px; padding: 20px; background: #fff; border:1px solid #eee; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.05);}
    .booking-header{ text-align:center; margin-bottom: 18px; }
    .booking-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
    .booking-field{ display:flex; flex-direction:column; gap:6px; }
    .booking-field label{ font-weight:700; font-size:.95rem; color: var(--color-texto); }
    .booking-field input, .booking-field select, .booking-field textarea{ padding:10px 12px; border:1px solid #ddd; border-radius:8px; font-family:var(--fuente-texto); }
    .booking-actions{ display:flex; gap:12px; justify-content:center; margin-top: 16px; flex-wrap: wrap; }
    .note{ font-size:.95rem; color:#666; text-align:center; margin: 10px 0 0; }
    .auth-wall{ padding:14px; border:1px dashed #bbb; border-radius:10px; text-align:center; background:#fafafa; margin-bottom:16px; }
    .auth-wall strong{ color: var(--color-texto); }
    .disabled{ opacity:.6; pointer-events:none; }
    .booking-field[hidden]{ display:none !important; }
    .tpl-visitas-only{ display:none !important; }
    .tpl-visitas-on .tpl-visitas-only{ display:block !important; }
    .summary-panel{ margin-top: 16px; background:#fafafa; border:1px solid #eee; border-radius:10px; padding:16px; }
    .summary-grid{ display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:center; }
    .summary-row{ display:contents; }
    .summary-label{ color:#555; }
    .summary-value{ font-weight:700; color: var(--color-texto); text-align:right; }
    .summary-muted{ color:#999; font-weight:400; }
    .summary-total{ border-top:1px solid #e7e7e7; margin-top:8px; padding-top:8px; font-size:1.05rem; }
    .tpl-addr-wrap{ position: relative; }
    .tpl-addr-suggest{ position:absolute; inset:auto 0 0 0; transform: translateY(calc(100% + 6px)); background:#fff; border:1px solid #ddd; border-radius:10px; box-shadow: 0 6px 18px rgba(0,0,0,.08); z-index: 999; max-height: 240px; overflow:auto; display:none; }
    .tpl-addr-item{ padding:10px 12px; cursor:pointer; }
    .tpl-addr-item:hover, .tpl-addr-item:focus{ background:#f5f7f8; outline:none; }
    .tpl-actions{ display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:12px; width:100%; }
    .tpl-actions .tpl-spacer{ display:block; }
    .tpl-actions .tpl-help{ font-size:.9rem; padding:8px 10px; border:2px solid var(--color-principal); color:var(--color-principal); background:#fff; border-radius:8px; justify-self:end; }
    .travel-bubble{ display:none; margin-top:6px; padding:10px 12px; border:1px dashed #bbb; border-radius:10px; background:#f9f9f9; color:#666; text-align:left;}
    .tpl-section{ margin-top: 18px; }
    .tpl-section h2{ margin: 6px 0 8px; font-size:1.15rem; }

    /* Panel diagnóstico */
    .tpl-diag{margin:8px 0 16px;padding:10px;border:1px dashed #bbb;border-radius:10px;background:#fcfffc}
    .tpl-diag h3{margin:0 0 8px;font-size:1rem}
    .tpl-chip{display:inline-block;margin:3px 6px 0 0;padding:4px 8px;border-radius:999px;font-size:.85rem;border:1px solid #e0e0e0;background:#fff}
    .ok{color:#137333;border-color:#cdeccd;background:#effaf0}
    .ko{color:#a50e0e;border-color:#f5cccc;background:#fff5f5}
  </style>
</head>
<body>

  <!-- Navbar unificada (inyectada) -->
  <div id="tpl-navbar">
    <noscript>
      <nav class="navbar">
        <div class="logo">
          <a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a>
        </div>
        <a href="index.html" class="home-button">Inicio</a>
        <ul class="nav-links">
          <li><a href="como-funciona.html">Cómo funciona</a></li>
          <li><a href="servicios.html">Servicios</a></li>
          <li><a href="index.html#contactanos">Contáctanos</a></li>
          <li><a href="index.html#hazte-cuidador">Conviértete en cuidador</a></li>
        </ul>
        <a class="login-button" href="#iniciar-sesion">Iniciar sesión</a>
      </nav>
    </noscript>
  </div>

  <div class="booking-wrapper">
    <div class="booking-header">
      <h1>Reserva tu servicio</h1>
      <p>Selecciona el servicio y la fecha. Para completar la reserva es necesario iniciar sesión y tener los datos de tu mascota guardados.</p>
    </div>

    <!-- Panel de diagnóstico -->
    <div class="tpl-diag" id="tplDiag" hidden>
      <h3>Diagnóstico reservas</h3>
      <div id="tplDiagOut"></div>
    </div>
    <div class="booking-actions" style="justify-content:flex-start;margin-top:-10px;margin-bottom:10px">
      <button type="button" class="tpl-btn-outline" id="btnDiag" style="border:1px solid #339496;border-radius:999px;padding:8px 12px;background:#fff;color:#339496">
        🔎 Ejecutar diagnóstico
      </button>
    </div>

    <!-- Muro de autenticación -->
    <div id="authWall" class="auth-wall">
      <p><strong>Para reservar debes estar registrada o iniciar sesión.</strong></p>
      <p class="note">Cuando accedas, el formulario se activará automáticamente.</p>
      <div id="tpl-inline-login"></div>
    </div>

    <!-- Formulario de reserva -->
    <form
      id="bookingForm"
      class="disabled"
      novalidate
      data-tpl-type="reserva"
      data-tpl-success="Tu reserva se ha enviado. Podrás ver su estado (enviada, en revisión o aceptada) en tu panel."
      data-tpl-redirect="perfil.html"
      data-tpl-wait="800"
    >
      <!-- =================== DATOS DEL SERVICIO =================== -->
      <section class="tpl-section" aria-labelledby="sec-servicio">
        <h2 id="sec-servicio">Datos del servicio</h2>
        <div class="booking-grid">
          <div class="booking-field">
            <label for="service">Servicio</label>
            <select id="service" name="Servicio" required>
              <option value="">Elige un servicio…</option>
              <option value="visitas">Visitas a domicilio (gatos)</option>
              <option value="paseos">Paseos</option>
              <option value="guarderia">Guardería de día</option>
              <option value="alojamiento">Alojamiento (por día)</option>
              <option value="bodas">Bodas y servicios exclusivos</option>
              <option value="postquirurgico">Postquirúrgico</option>
              <option value="transporte">Transporte</option>
              <option value="exoticos">Exóticos</option>
            </select>
          </div>

          <div class="booking-field">
            <label for="startDate">Fecha de inicio</label>
            <input type="date" id="startDate" name="Fecha_inicio" required>
          </div>
          <div class="booking-field">
            <label for="endDate">Fecha de fin</label>
            <input type="date" id="endDate" name="Fecha_fin" required>
          </div>

          <div class="booking-field">
            <label for="start">Hora de inicio</label>
            <input type="time" id="start" name="Hora_inicio" required>
          </div>
          <div class="booking-field">
            <label for="end">Hora de fin</label>
            <input type="time" id="end" name="Hora_fin" required>
          </div>

          <div class="booking-field" id="fieldNumPets">
            <label for="numPets">Nº de mascotas</label>
            <select id="numPets" name="N_mascotas">
              <option value="1">1</option><option value="2">2</option>
              <option value="3">3</option><option value="4">4</option>
              <option value="5">5</option><option value="6+">6+</option>
            </select>
            <input type="number" id="numPetsExact" name="N_mascotas_exactas" min="6" step="1" placeholder="Indica cuántas" style="display:none;margin-top:6px;">
          </div>

          <div class="booking-field" id="fieldSpecies">
            <label for="species">Tipo de animal</label>
            <select id="species" name="Tipo_animal">
              <option value="perro">Perro</option>
              <option value="gato">Gato</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <!-- SOLO para visitas (gatos) -->
          <div class="booking-field tpl-visitas-only" id="fieldVisitDuration" hidden>
            <label for="visitDuration">Duración de la visita (gatos)</label>
            <select id="visitDuration" name="Visita_duracion">
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
            </select>
          </div>
          <div class="booking-field tpl-visitas-only" id="fieldVisitDaily" hidden>
            <label for="visitDaily">Visitas diarias</label>
            <select id="visitDaily" name="Visitas_diarias">
              <option value="1">1 visita/día</option>
              <option value="2">2 visitas/día (2ª es medicación)</option>
            </select>
          </div>

          <div class="booking-field" id="fieldIsPuppy">
            <label for="isPuppy">¿Es cachorro (≤ 6 meses)?</label>
            <select id="isPuppy" name="Cachorro" disabled title="Se calcula automáticamente según la edad de tu mascota">
              <option value="no" selected>No</option>
              <option value="si">Sí</option>
            </select>
          </div>
        </div>
      </section>

      <!-- =================== MASCOTAS (NOMBRES) =================== -->
      <section class="tpl-section" aria-labelledby="sec-mascotas">
        <h2 id="sec-mascotas">Mascotas</h2>
        <div class="booking-grid" id="petsContainer"></div>
        <datalist id="tplPetNamesList"></datalist>
      </section>

      <!-- =================== DATOS DE LA PERSONA =================== -->
      <section class="tpl-section" aria-labelledby="sec-titular">
        <h2 id="sec-titular">Datos de la persona titular</h2>
        <div class="booking-grid">
          <div class="booking-field">
            <label for="firstName">Nombre</label>
            <input type="text" id="firstName" name="Nombre" placeholder="Tu nombre" autocomplete="given-name" required>
          </div>
          <div class="booking-field">
            <label for="lastName">Apellidos</label>
            <input type="text" id="lastName" name="Apellidos" placeholder="Tus apellidos" autocomplete="family-name" required>
          </div>

          <div class="booking-field" style="grid-column: 1 / -1;">
            <label for="location">Dirección</label>
            <div class="tpl-addr-wrap">
              <input type="text" id="location" name="Direccion" placeholder="Calle y número, piso…" autocomplete="street-address" required>
              <div id="tplAddrSuggest" class="tpl-addr-suggest" role="listbox" aria-label="Sugerencias de direcciones"></div>
            </div>
          </div>

          <div class="booking-field">
            <label for="region">Comunidad Autónoma</label>
            <select id="region" name="CCAA" required>
              <option value="" disabled hidden>Selecciona tu CCAA…</option>
              <option value="madrid" selected>Comunidad de Madrid</option>
              <option value="andalucia">Andalucía</option>
              <option value="aragon">Aragón</option>
              <option value="asturias">Asturias</option>
              <option value="baleares">Illes Balears</option>
              <option value="canarias">Canarias</option>
              <option value="cantabria">Cantabria</option>
              <option value="castilla-la-mancha">Castilla-La Mancha</option>
              <option value="castilla-y-leon">Castilla y León</option>
              <option value="cataluna">Cataluña</option>
              <option value="valenciana">Comunitat Valenciana</option>
              <option value="extremadura">Extremadura</option>
              <option value="galicia">Galicia</option>
              <option value="la-rioja">La Rioja</option>
              <option value="melilla">Melilla</option>
              <option value="murcia">Región de Murcia</option>
              <option value="navarra">Navarra</option>
              <option value="euskadi">País Vasco</option>
              <option value="ceuta">Ceuta</option>
              <option value="nacional">Solo festivos nacionales</option>
            </select>
          </div>
          <div class="booking-field">
            <label for="postalCode">Código Postal</label>
            <input type="text" id="postalCode" name="CP" placeholder="Ej. 28001" inputmode="numeric" pattern="[0-9]{5}" autocomplete="postal-code" required>
          </div>

          <div class="booking-field">
            <label for="email">Email</label>
            <input type="email" id="email" name="Email" placeholder="Tu correo electrónico" autocomplete="email">
          </div>
          <div class="booking-field">
            <label for="phone">Teléfono</label>
            <input type="tel" id="phone" name="Telefono" placeholder="Tu número de teléfono" autocomplete="tel">
          </div>

          <div class="booking-field" style="grid-column: 1 / -1;">
            <label>¿Por dónde prefieres que contactemos?</label>
            <div>
              <label><input type="radio" name="Preferencia_contacto" value="telefono"> Teléfono</label>
              <label style="margin-left:12px;"><input type="radio" name="Preferencia_contacto" value="whatsapp"> WhatsApp</label>
              <label style="margin-left:12px;"><input type="radio" name="Preferencia_contacto" value="email"> Email</label>
              <label style="margin-left:12px;"><input type="radio" name="Preferencia_contacto" value="cualquiera" checked> Cualquiera</label>
            </div>
          </div>

          <div class="booking-field">
            <label for="contactTime">¿A qué hora prefieres que te contactemos?</label>
            <input type="time" id="contactTime" name="Hora_preferida_contacto">
          </div>

          <div class="booking-field" style="grid-column: 1 / -1;">
            <label for="needTravel">¿Necesitas desplazamiento?</label>
            <select id="needTravel" name="Desplazamiento">
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
            <div id="travelBubble" class="travel-bubble">
              <i class="fa-solid fa-circle-info"></i>
              El desplazamiento se cobrará cuando asignemos al cuidador/a más cercano y adecuado.
              <br>Este importe quedará <strong>pendiente</strong> en la factura final.
            </div>
          </div>

          <div class="booking-field" style="grid-column: 1 / -1;">
            <label for="notes">Notas (opcional)</label>
            <textarea id="notes" name="Notas" rows="3" placeholder="Rutinas, medicación, instrucciones…"></textarea>
          </div>
        </div>
      </section>

      <!-- Resumen / Desglose -->
      <div class="summary-panel" id="summary">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <strong>Desglose preliminar</strong>
        </div>
        <div class="summary-grid">
          <div class="summary-row">
            <div class="summary-label">Precio base</div>
            <div class="summary-value"><span id="sumBase">—</span> €</div>
          </div>
          <div class="summary-row" id="rowVisit1" style="display:none;">
            <div class="summary-label">1ª visita (60/90)</div>
            <div class="summary-value"><span id="sumVisit1">0.00</span> €</div>
          </div>
          <div class="summary-row" id="rowVisit2" style="display:none;">
            <div class="summary-label">2ª visita (medicación)</div>
            <div class="summary-value"><span id="sumVisit2">0.00</span> €</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Suplementos por mascotas</div>
            <div class="summary-value"><span id="sumPets">0.00</span> €</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Festivos (auto)</div>
            <div class="summary-value"><span id="sumFestivo">0.00</span> €</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Días especiales (auto)</div>
            <div class="summary-value"><span id="sumSenalado">0.00</span> €</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Desplazamiento</div>
            <div class="summary-value"><span id="sumTravel" class="summary-muted">pendiente</span></div>
          </div>
          <div class="summary-row" id="rowBono" style="display:none;">
            <div class="summary-label">Bono guardería (descuento)</div>
            <div class="summary-value">−<span id="sumBono">0.00</span> €</div>
          </div>
          <div class="summary-row summary-total">
            <div class="summary-label">Subtotal (sin desplazamiento)</div>
            <div class="summary-value"><span id="sumSubtotal">—</span> €</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Depósito a retener</div>
            <div class="summary-value"><span id="sumDeposit">—</span> €</div>
          </div>
        </div>
        <p class="note" style="margin-top:10px;">
          Este cálculo es orientativo. El importe por kilometraje se añade al confirmar el cuidador más cercano.
          El depósito se retiene (autorización) y se captura tras aceptar la reserva.
        </p>
      </div>

      <!-- Campos ocultos para email -->
      <input type="hidden" name="Desglose" id="summaryField">
      <input type="hidden" name="Mascotas_lista" id="petsListHidden">

      <div class="booking-actions tpl-actions">
        <span class="tpl-spacer" aria-hidden="true"></span>
        <button type="submit" class="cta-button">Solicitar reserva</button>
        <a class="tpl-help" href="ayuda.html#reservas" aria-label="Centro de ayuda">Centro de ayuda</a>
      </div>

      <p class="note">Tras enviar, te llamaremos para conocernos y confirmar detalles. La primera visita con el cuidador es gratuita.</p>
    </form>
  </div>

  <!-- Footer unificado (inyectado) -->
  <div id="tpl-footer">
    <noscript>…</noscript>
  </div>

  <!-- Mini-injectors -->
  <script src="tpl-navbar.js" defer></script>
  <script src="tpl-footer.js" defer></script>

  <!-- Firebase SDK compat -->
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics-compat.js"></script>
  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
      authDomain: "thepetslovers-c1111.firebaseapp.com",
      projectId: "thepetslovers-c1111",
      storageBucket: "thepetslovers-c1111.appspot.com",
      messagingSenderId: "415914577533",
      appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
      measurementId: "G-FXPD69KXBG"
    };
    if (typeof firebase !== 'undefined') {
      if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
      if (firebase.analytics) { try { firebase.analytics(); } catch(e){} }
      try{ firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(_){}
    }
  </script>

  <!-- EmailJS -->
  <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
  <script>
    window.TPL_EMAILJS = {
      serviceId: 'service_odjqrfl',
      templateId: 'template_rao5n0c',
      publicKey:  'L2xAATfVuHJwj4EIV'
    };
    (function(){
      const cfg = window.TPL_EMAILJS || {};
      if (window.emailjs && (cfg.publicKey||cfg.userId)) {
        try{ emailjs.init({ publicKey: cfg.publicKey || cfg.userId }); }catch(_){}
      }
    })();
  </script>

  <!-- Lógica de reservas (externo) -->
  <script src="reservas.js" defer></script>
</body>
</html>

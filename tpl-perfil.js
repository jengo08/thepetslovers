/* TPL: INICIO BLOQUE NUEVO [Estado mínimo del perfil: sin almacenamiento aún] */
(function(){
  'use strict';

  // ⚠️ Aún SIN integración de datos. Solo placeholders.
  // Próximos pasos: leer Firestore y/o tu fuente de datos, y usar Cloudinary SOLO para fotos de mascotas.

  // Helpers de DOM
  const $ = (sel) => document.querySelector(sel);
  const show = (el) => { if (el) el.hidden = false; };
  const hide = (el) => { if (el) el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

  document.addEventListener('DOMContentLoaded', () => {
    // ------- OWNER -------
    // Estado inicial: incompleto
    setOwnerIncomplete();

    // ------- PETS -------
    setPetsEmpty();

    // ------- BOOKINGS -------
    setBookingsEmpty();

    // Botones (navegación simple: las páginas se crearán en siguientes pasos)
    const ownerFillBtn = $('#tpl-owner-fill');
    const ownerEditBtn = $('#tpl-owner-edit');
    const petAddBtn    = $('#tpl-pet-add');

    // (Sin listeners especiales: ya son <a href="...">)
    // Cuando conectemos datos, aquí mostraremos/ocultaremos Fill/Edit según corresponda.
  });

  function setOwnerIncomplete(){
    setText('#tpl-owner-nombre', '—');
    setText('#tpl-owner-telefono', '—');
    setText('#tpl-owner-zona', '—');
    setText('#tpl-owner-email', '—');

    const status = $('#tpl-owner-status');
    if (status){
      status.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Incompleto';
    }
    // Mostrar "Rellenar", ocultar "Editar"
    const fill = $('#tpl-owner-fill'); const edit = $('#tpl-owner-edit');
    if (fill) fill.style.display = '';
    if (edit) edit.style.display = 'none';
  }

  function setOwnerComplete(mock){
    // Ejemplo (lo usaremos cuando haya datos reales)
    setText('#tpl-owner-nombre', mock?.nombre || 'Tu nombre');
    setText('#tpl-owner-telefono', mock?.telefono || '—');
    setText('#tpl-owner-zona', mock?.zona || '—');
    setText('#tpl-owner-email', mock?.email || '—');

    const status = $('#tpl-owner-status');
    if (status){
      status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Completo';
    }
    const fill = $('#tpl-owner-fill'); const edit = $('#tpl-owner-edit');
    if (fill) fill.style.display = 'none';
    if (edit) edit.style.display = '';
  }

  function setPetsEmpty(){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    $('#tpl-pets-status').innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Ninguna';
    if (empty) empty.style.display = 'flex';
    hide(list);
  }

  function renderPets(pets){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    if (!Array.isArray(pets) || pets.length === 0) return setPetsEmpty();

    if (empty) empty.style.display = 'none';
    if (list){
      list.innerHTML = '';
      pets.forEach(p => {
        const item = document.createElement('div');
        item.className = 'tpl-pet-item';
        item.innerHTML = `
          <img class="tpl-pet-thumb" alt="Foto de ${escapeHtml(p.nombre||'mascota')}" src="${escapeAttr(p.foto||'images/pet-placeholder.png')}">
          <div>
            <div><strong>${escapeHtml(p.nombre||'Sin nombre')}</strong> · ${escapeHtml(p.especie||'')}</div>
            <div style="color:#666;font-size:.9rem">${escapeHtml(p.raza||'')} ${p.edad ? ('· ' + escapeHtml(p.edad)) : ''}</div>
          </div>
        `;
        list.appendChild(item);
      });
      show(list);
      $('#tpl-pets-status').innerHTML = `<i class="fa-solid fa-paw"></i> ${pets.length} ${pets.length===1?'mascota':'mascotas'}`;
    }
  }

  function setBookingsEmpty(){
    $('#tpl-bookings-status').innerHTML = '<i class="fa-regular fa-circle"></i> Sin reservas';
    show($('#tpl-bookings-empty'));
    hide($('#tpl-bookings-list'));
  }

  // Utilidades de escape
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g, '&quot;'); }

  // Exponer helpers para futuras integraciones (opcional)
  window.__TPL_PERFIL__ = {
    setOwnerComplete,
    renderPets
    // Más adelante: renderBookings, setBookings...
  };

  // --------- NOTAS PARA LA SIGUIENTE ENTREGA ---------
  // Cloudinary (solo fotos): usaremos unsigned uploads desde la página de mascota,
  // guardando la URL resultante (p.ej., en Firestore). Nada de storage local.
  // Variables que prepararemos:
  //   const CLOUD_NAME   = 'TU_CLOUD_NAME';
  //   const UPLOAD_PRESET= 'TU_UNSIGNED_PRESET';
  // Con eso, subiremos la imagen de la mascota y traeremos la URL para pintar aquí.
})();
/* TPL: FIN BLOQUE NUEVO */

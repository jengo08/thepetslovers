/* TPL: INICIO BLOQUE NUEVO [Perfil: estado owner + mascotas + logout real] */
(function(){
  'use strict';

  // -------- Helpers DOM --------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

  // -------- Owner (placeholder básico) --------
  function setOwnerIncomplete(){
    setText('#tpl-owner-nombre', '—');
    setText('#tpl-owner-telefono', '—');
    setText('#tpl-owner-zona', '—');
    setText('#tpl-owner-email', '—');
    const status = $('#tpl-owner-status');
    if (status){ status.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Incompleto'; }
    const fill = $('#tpl-owner-fill'); const edit = $('#tpl-owner-edit');
    if (fill) fill.style.display = '';
    if (edit) edit.style.display = 'none';
  }

  // -------- Mascotas --------
  function iconBySpecies(sp){
    const v = (sp||'').toLowerCase();
    if (v.includes('perro')) return 'fa-dog';
    if (v.includes('gato'))  return 'fa-cat';
    if (v.includes('exó') || v.includes('exo')) return 'fa-dove';
    return 'fa-paw';
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function setPetsEmpty(){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    if (empty){ empty.style.display = 'flex'; empty.hidden = false; }
    hide(list);
    const st = $('#tpl-pets-status');
    if (st) st.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Ninguna';
  }

  function renderPets(pets){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    const status = $('#tpl-pets-status');

    if (!Array.isArray(pets) || pets.length===0){ setPetsEmpty(); return; }

    // Ocultar el vacío con doble control
    if (empty){ empty.style.display='none'; empty.hidden = true; }
    show(list, 'block');
    list.innerHTML = '';

    pets.forEach((p, idx) => {
      const nombre  = escapeHtml(p?.nombre || 'Sin nombre');
      const especie = escapeHtml(p?.especie || '');
      const raza    = escapeHtml(p?.raza || p?.tipoExotico || '');
      const edad    = escapeHtml(p?.edad || '');
      const foto    = (p && typeof p.foto === 'string') ? p.foto : '';

      const item = document.createElement('div');
      item.className = 'tpl-pet-item';

      if (foto){
        const img = document.createElement('img');
        img.className = 'tpl-pet-thumb';
        img.src = foto;
        img.alt = `Foto de ${nombre}`;
        item.appendChild(img);
      } else {
        const ic = document.createElement('div');
        ic.className = 'tpl-pet-icon';
        ic.innerHTML = `<i class="fa-solid ${iconBySpecies(especie)}" aria-hidden="true"></i>`;
        item.appendChild(ic);
      }

      const meta = document.createElement('div');
      meta.className = 'tpl-pet-meta';
      const nm = document.createElement('div');
      nm.className = 'tpl-pet-name';
      nm.textContent = nombre;
      const sub = document.createElement('div');
      sub.className = 'tpl-pet-sub';
      const parts = [especie, raza, edad && ('Edad: ' + edad)].filter(Boolean);
      sub.textContent = parts.join(' · ');
      meta.appendChild(nm); meta.appendChild(sub);
      item.appendChild(meta);

      // Enlace Editar (abajo-dcha de la tarjeta)
      const edit = document.createElement('a');
      edit.href = `tpl-mascota.html?edit=${idx}`;
      edit.className = 'tpl-pet-edit';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar a ${nombre}`);
      item.appendChild(edit);

      list.appendChild(item);
    });

    if (status){
      const n = pets.length;
      status.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${n} ${n===1?'mascota':'mascotas'}`;
    }
  }

  function loadPetsAndRender(){
    let saved = [];
    try{ saved = JSON.parse(sessionStorage.getItem('tpl.pets') || '[]'); } catch(_){}
    renderPets(saved);
  }

  // -------- Logout "real" --------
  function setupLogout(){
    const btn = $('#tpl-logout');
    if (!btn) return;
    btn.addEventListener('click', (ev)=>{
      ev.preventDefault();
      try{
        // Limpiar sessionStorage de la app
        sessionStorage.removeItem('tpl.pets');
        sessionStorage.removeItem('tpl.owner');
        // Por si acaso, limpiar todo el sessionStorage
        sessionStorage.clear();
      }catch(_){}
      try{
        // Limpiar posibles tokens locales habituales
        localStorage.removeItem('tpl.auth');
        localStorage.removeItem('tpl.user');
        localStorage.removeItem('tpl.session');
      }catch(_){}
      try{
        // Intento de limpiar cookies del dominio
        const cookies = document.cookie ? document.cookie.split(';') : [];
        cookies.forEach(c=>{
          const eq = c.indexOf('=');
          const name = (eq>-1 ? c.substring(0,eq) : c).trim();
          if (name){
            document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/;`;
          }
        });
      }catch(_){}
      // Redirigir a inicio
      location.assign('index.html');
    });
  }

  // -------- Inicio --------
  document.addEventListener('DOMContentLoaded', ()=>{
    setOwnerIncomplete();
    setPetsEmpty();         // estado base
    loadPetsAndRender();    // si hay mascotas, ocultará el vacío

    setupLogout();
  });

  // Safari bfcache: al volver desde tpl-mascota.html
  window.addEventListener('pageshow', (e)=>{ if (e.persisted) loadPetsAndRender(); });

  // Exponer por si se usa externamente
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, { renderPets });
})();
 /* TPL: FIN BLOQUE NUEVO */

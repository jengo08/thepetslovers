/* TPL: INICIO BLOQUE NUEVO [Lógica: preview + razas dinámicas + condicionales + guardado temporal + anti-upload-overlay] */
(function(){
  'use strict';

  // Catálogos compactos
  const DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Bulldog Inglés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Dóberman","Rottweiler","Husky Siberiano","Malamute de Alaska","Cocker Spaniel","Springer Spaniel","Schnauzer Mini","Schnauzer Mediano","Schnauzer Gigante","Bichón Maltés","Bichón Frisé","Cavalier King Charles","Galgo Español","Podenco","Carlino / Pug","Akita Inu","Shiba Inu","Basenji","Weimaraner","Setter Irlandés","Samoyedo","Shar Pei","Pit Bull Terrier","American Staffordshire","Staffordshire Bull Terrier","Bull Terrier","Whippet","Cane Corso","Mastín Español","Mastín Napolitano","San Bernardo","Gran Danés","Terranova","Corgi","Jack Russell Terrier","Fox Terrier","Teckel / Dachshund","Pastor Belga Malinois","Pastor Australiano","Braco Alemán","Perdiguero de Burgos"];
  const CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Cornish Rex","Devon Rex","Birmano","Bombay","Manx","Himalayo","Oriental","Angora Turco","Van Turco","Savannah","American Shorthair","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];

  // Helpers
  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  // Canvas → DataURL (ligero)
  function resizeToDataURL(file, maxW=256, maxH=256, cb){
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW/img.width, maxH/img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cb(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Almacenamiento temporal
  function getPets(){
    try{ return JSON.parse(sessionStorage.getItem('tpl.pets')||'[]'); }
    catch(e){ return []; }
  }
  function savePets(arr){ sessionStorage.setItem('tpl.pets', JSON.stringify(arr||[])); }

  // ===== Cortafuegos anti “upload overlay” global =====
  // Si algún script global intenta interceptar cambio de <input type="file"> o submit del form,
  // paramos la propagación en fase de captura.
  document.addEventListener('change', function(e){
    const t = e.target;
    if (t && t.id === 'foto'){
      e.stopImmediatePropagation();
      e.stopPropagation();
      // NO preventDefault aquí para no bloquear seleccionar archivo.
    }
  }, true);

  document.addEventListener('submit', function(e){
    const t = e.target;
    if (t && t.id === 'tpl-pet-form'){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      // El propio handler del form (más abajo) gestionará el guardado y la redirección.
    }
  }, true);

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', () => {
    const form = byId('tpl-pet-form');
    const avatarBox = byId('avatarBox');
    const fileInput = byId('foto');
    const preview = byId('preview');

    const especie = byId('especie');
    const raza = byId('raza');
    const breedList = byId('tpl-breed-list');
    const labelRaza = byId('label-raza');

    const microchip = byId('microchip');
    const microchipNo = byId('microchip_no_tiene');

    const srvVisitas = byId('srv-visitas');
    const otraChk = byId('srv-otra');
    const otraDetalle = byId('otra-detalle');
    const rowCamaras = byId('row-camaras');
    const camaras = byId('camaras');

    const seguroVet = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum = byId('seguroVetNum');

    const seguroRC = byId('seguroRC');

    // Preview + overlay texto
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      preview.src = f ? URL.createObjectURL(f) : 'images/pet-placeholder.png';
      avatarBox.classList.toggle('has-image', !!f);
    });

    // Microchip "No tiene"
    function updateMicrochipState(){
      if (microchipNo.checked){
        microchip.value = 'No tiene';
        microchip.setAttribute('disabled','disabled');
      } else {
        if (microchip.value === 'No tiene') microchip.value = '';
        microchip.removeAttribute('disabled');
      }
    }
    microchipNo.addEventListener('change', updateMicrochipState);
    updateMicrochipState();

    // Especie -> razas/tipos (sin campo “tipo” aparte)
    function updateBreedList(){
      const v = especie.value;
      if (v === 'Perro'){
        labelRaza.textContent = 'Raza *';
        setOpts(breedList, DOG_BREEDS);
      } else if (v === 'Gato'){
        labelRaza.textContent = 'Raza *';
        setOpts(breedList, CAT_BREEDS);
      } else if (v === 'Exótico'){
        labelRaza.textContent = 'Especie (exóticos) *';
        setOpts(breedList, EXOTIC_TYPES);
      } else {
        labelRaza.textContent = 'Raza / Tipo *';
        setOpts(breedList, []);
      }
    }
    especie.addEventListener('change', updateBreedList);
    updateBreedList();

    // Servicios: “Otra…” detalle habilitado solo si marcado
    otraChk.addEventListener('change', ()=>{
      otraDetalle.disabled = !otraChk.checked;
      if (!otraChk.checked) otraDetalle.value = '';
    });

    // Si incluye “Visitas a domicilio” -> mostrar cámaras
    srvVisitas.addEventListener('change', ()=>{
      const checked = srvVisitas.checked;
      rowCamaras.hidden = !checked;
      camaras.required = checked;
      if (!checked) camaras.value = '';
    });

    // Seguro vet: detalles solo si “Sí”
    function toggleSeguroVet(){
      const yes = seguroVet.value === 'Sí';
      seguroVetData.hidden = !yes;
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value = ''; seguroVetNum.value = ''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // Submit (guardado local y vuelta a perfil)
    form.addEventListener('submit', (ev) => {
      ev.preventDefault(); // por si acaso
      // Validación mínima: al menos un servicio
      const servicios = Array.from(form.querySelectorAll('input[name="servicios"]:checked')).map(i=>i.value);
      if (!servicios.length){
        alert('Por favor, selecciona al menos un tipo de servicio.');
        return;
      }

      const fd = new FormData(form);
      const mascota = {
        nombre: (fd.get('nombre')||'').toString().trim(),
        microchip: (byId('microchip_no_tiene').checked ? 'No tiene' : (fd.get('microchip')||'').toString().trim()),
        especie: (fd.get('especie')||'').toString(),
        raza: (fd.get('raza')||'').toString().trim(),
        edad: (fd.get('edad')||'').toString().trim(),
        peso: (fd.get('peso')||'').toString().trim(),
        esterilizado: (fd.get('esterilizado')||'').toString(),
        vacunas: (fd.get('vacunas')||'').toString(),
        salud: (fd.get('salud')||'').toString(),
        tratamiento: (fd.get('tratamiento')||'').toString(),
        comidas: (fd.get('comidas')||'').toString(),
        salidas: (fd.get('salidas')||'').toString(),
        tamano: (fd.get('tamano')||'').toString(),
        clinica: (fd.get('clinica')||'').toString(),
        hospitalPref: (fd.get('hospitalPref')||'').toString(),
        comportamiento: (fd.get('comportamiento')||'').toString(),
        descripcion: (fd.get('descripcion')||'').toString(),

        // Servicios
        servicios,
        otraDetalle: (fd.get('otraDetalle')||'').toString(),
        desde: (fd.get('desde')||'').toString(),
        hasta: (fd.get('hasta')||'').toString(),
        prioridad: (fd.get('prioridad')||'').toString(),
        camaras: byId('row-camaras').hidden ? '' : (fd.get('camaras')||'').toString(),

        // Extras
        fotos: (fd.get('fotos')||'').toString(),
        seguroVet: (fd.get('seguroVet')||'').toString(),
        seguroVetComp: (seguroVet.value==='Sí') ? (byId('seguroVetComp').value||'') : '',
        seguroVetNum: (seguroVet.value==='Sí') ? (byId('seguroVetNum').value||'') : '',
        seguroRC: (fd.get('seguroRC')||'').toString(),

        // Foto
        foto: ''
      };

      // Validación fechas coherentes
      if (mascota.desde && mascota.hasta && mascota.desde > mascota.hasta){
        alert('La fecha "desde" no puede ser posterior a "hasta".');
        return;
      }

      if (!mascota.nombre || !mascota.especie || !mascota.raza){
        alert('Completa nombre, especie y raza/tipo.');
        return;
      }

      const files = fileInput.files;
      const done = (dataUrl) => {
        mascota.foto = dataUrl || 'images/pet-placeholder.png';
        const arr = getPets(); arr.push(mascota); savePets(arr);
        location.assign('perfil.html'); // sin overlays ni esperas
      };
      if (files && files[0]) resizeToDataURL(files[0], 256, 256, done);
      else done('');
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */

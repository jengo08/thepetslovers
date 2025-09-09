/* TPL: INICIO BLOQUE NUEVO [Lógica de Mascota: preview + razas + guardado temporal] */
(function(){
  'use strict';

  const DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Bulldog Inglés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Dóberman","Rottweiler","Husky Siberiano","Malamute de Alaska","Cocker Spaniel","Springer Spaniel","Schnauzer Mini","Schnauzer Mediano","Schnauzer Gigante","Bichón Maltés","Bichón Frisé","Cavalier King Charles","Galgo Español","Podenco","Carlino / Pug","Akita Inu","Shiba Inu","Basenji","Weimaraner","Setter Irlandés","Samoyedo","Shar Pei","Pit Bull Terrier","American Staffordshire","Staffordshire Bull Terrier","Bull Terrier","Whippet","Cane Corso","Mastín Español","Mastín Napolitano","San Bernardo","Gran Danés","Lebrel Afgano","Terranova","Corgi","Jack Russell Terrier","Fox Terrier","Teckel / Dachshund","Alano Español","Pastor Belga Malinois","Pastor Australiano","Airedale Terrier","Braco Alemán","Grifón Korthals","Perdiguero de Burgos"];
  const CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Cornish Rex","Devon Rex","Birmano","Bombay","Manx","Himalayo","Oriental","Angora Turco","Van Turco","Savannah","American Shorthair","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];

  const $ = (sel, root=document) => root.querySelector(sel);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

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

  function getPets(){
    try{ return JSON.parse(sessionStorage.getItem('tpl.pets')||'[]'); }
    catch(e){ return []; }
  }
  function savePets(arr){ sessionStorage.setItem('tpl.pets', JSON.stringify(arr||[])); }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('#tpl-pet-form');
    const especie = $('#especie');
    const raza = $('#raza');
    const datalist = $('#tpl-breed-list');
    const labelRaza = $('#label-raza');
    const rowExotico = $('#row-exotico');
    const tipoExotico = $('#tipoExotico');
    const fileInput = $('#foto');
    const preview = $('#preview');

    // Preview inmediata
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      preview.src = f ? URL.createObjectURL(f) : 'images/pet-placeholder.png';
    });

    // Especie -> listas
    especie.addEventListener('change', () => {
      const v = especie.value;
      if (v === 'Perro') { labelRaza.textContent = 'Raza'; setOpts(datalist, DOG_BREEDS); rowExotico.hidden = true; }
      else if (v === 'Gato') { labelRaza.textContent = 'Raza'; setOpts(datalist, CAT_BREEDS); rowExotico.hidden = true; }
      else if (v === 'Exótico') { labelRaza.textContent = 'Especie / Tipo (si procede)'; setOpts(datalist, []); rowExotico.hidden = false; }
      else { labelRaza.textContent = 'Raza / Tipo'; setOpts(datalist, []); rowExotico.hidden = true; }
    });

    // Guardar
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const mascota = {
        nombre: (fd.get('nombre')||'').toString().trim(),
        especie: (fd.get('especie')||'').toString(),
        tipoExotico: (fd.get('tipoExotico')||'').toString(),
        raza: (fd.get('raza')||'').toString(),
        sexo: (fd.get('sexo')||'').toString(),
        edad: (fd.get('edad')||'').toString(),
        peso: (fd.get('peso')||'').toString(),
        esterilizado: (fd.get('esterilizado')||'').toString(),
        vacunas: (fd.get('vacunas')||'').toString(),
        microchip: (fd.get('microchip')||'').toString(),
        tamano: (fd.get('tamano')||'').toString(),
        comportamiento: (fd.get('comportamiento')||'').toString(),
        salud: (fd.get('salud')||'').toString(),
        foto: ''
      };

      if (!mascota.nombre || !mascota.especie){
        alert('Por favor, completa al menos Nombre y Especie.');
        return;
      }

      const files = fileInput.files;
      const done = (dataUrl) => {
        mascota.foto = dataUrl || 'images/pet-placeholder.png';
        const arr = getPets(); arr.push(mascota); savePets(arr);
        location.assign('perfil.html');
      };
      if (files && files[0]) resizeToDataURL(files[0], 256, 256, done);
      else done('');
    });

    // Estado inicial
    especie.dispatchEvent(new Event('change'));
  });
})();
/* TPL: FIN BLOQUE NUEVO */

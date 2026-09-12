/* ==========================================================================
   responsive.js - Repositorio de TecnoVilladiego
   --------------------------------------------------------------------------
   1) Menú de navegación móvil: botón hamburguesa accesible + drawer.
   2) Detección automática de los colores del tema eXeLearning para que el
      menú móvil coincida con el aspecto de tu sitio (Android / iOS).
   JavaScript nativo (sin dependencias).
   ========================================================================== */

'use strict';

/* Interruptor de colores automáticos:
   - true  -> el menú móvil toma los colores de la cabecera de tu tema.
   - false -> se respetan los colores fijados a mano en responsive.css
              (variables --tv-* del bloque "COLORES EDITABLES").            */
var TV_AUTO_COLORES = true;


/* ==========================================================================
   1. COLORES AUTOMÁTICOS
   ========================================================================== */

function tvParseColor(str) {
  /* Convierte "rgb(r, g, b)" o "rgba(r, g, b, a)" en {r,g,b,a} o null. */
  var m = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/.exec(str || '');
  if (!m) return null;
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: m[4] === undefined ? 1 : parseFloat(m[4])
  };
}

function tvLuminancia(c) {
  /* Luminancia relativa (WCAG) para decidir texto claro u oscuro. */
  function f(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function tvHex(c) {
  function h(v) {
    var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? '0' + s : s;
  }
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

function tvMezclar(c, blanco, t) {
  /* Mezcla el color c con blanco en proporción t (0..1). */
  return {
    r: c.r + (255 - c.r) * t,
    g: c.g + (255 - c.g) * t,
    b: c.b + (255 - c.b) * t
  };
}

function tvDetectarColores() {
  if (!TV_AUTO_COLORES) return;

  /* Color de fondo del tema: se busca en la cabecera (#header o
     #headerContent). Si es blanco o transparente se conservan los
     valores por defecto de responsive.css. */
  var ids = ['header', 'headerContent'];
  var bg = null;
  for (var i = 0; i < ids.length && !bg; i++) {
    var el = document.getElementById(ids[i]);
    if (!el) continue;
    var c = tvParseColor(getComputedStyle(el).backgroundColor);
    if (c && c.a > 0.85) {
      var casiBlanco = c.r >= 242 && c.g >= 242 && c.b >= 242;
      if (!casiBlanco) bg = c;
    }
  }
  if (!bg) return;

  var oscuro = tvLuminancia(bg) < 0.35;      /* ¿cabecera oscura? */
  var texto = oscuro ? '#ffffff' : '#17324d';
  var subBg = tvHex(tvMezclar(bg, 255, oscuro ? 0.12 : 0.35));
  var root = document.documentElement.style;

  root.setProperty('--tv-menu-bg', tvHex(bg));
  root.setProperty('--tv-menu-text', texto);
  root.setProperty('--tv-menu-sub-bg', subBg);
  root.setProperty('--tv-menu-line', oscuro ? 'rgba(255,255,255,0.18)' : 'rgba(127,140,155,0.25)');
  root.setProperty('--tv-menu-accent', tvHex(bg));
  root.setProperty('--tv-menu-accent-bg', 'rgba(' + bg.r + ',' + bg.g + ',' + bg.b + ',0.16)');
  root.setProperty('--tv-btn-bg', tvHex(bg));
  root.setProperty('--tv-btn-bar', texto);
  root.setProperty('--tv-pill-next', tvHex(bg));

  if (window.console && console.log) {
    console.log('PWA: colores del menú móvil adaptados al tema (' + tvHex(bg) + ')');
  }
}


/* ==========================================================================
   2. MENÚ HAMBURGUESA
   ========================================================================== */

function initResponsiveNav() {
  var nav = document.getElementById('siteNav');
  if (!nav || nav.getAttribute('data-responsive') === 'on') return;
  nav.setAttribute('data-responsive', 'on');

  /* --- Botón hamburguesa --- */
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'navToggle';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-label', 'Abrir menú de navegación');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'siteNav');
  btn.innerHTML = '<span class="nav-toggle-bar"></span>' +
                  '<span class="nav-toggle-bar"></span>' +
                  '<span class="nav-toggle-bar"></span>';

  /* --- Fondo oscurecido --- */
  var backdrop = document.createElement('div');
  backdrop.id = 'navBackdrop';
  backdrop.className = 'nav-backdrop';
  backdrop.hidden = true;

  /* Inserción en el DOM */
  var content = document.getElementById('content') || document.body;
  content.insertBefore(btn, content.firstChild);
  document.body.appendChild(backdrop);

  /* --- Apertura / cierre --- */
  function isOpen() {
    return document.body.classList.contains('nav-open');
  }

  function setOpen(open) {
    document.body.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    backdrop.hidden = !open;
  }

  btn.addEventListener('click', function () {
    setOpen(!isOpen());
  });

  backdrop.addEventListener('click', function () {
    setOpen(false);
  });

  /* Cerrar al pulsar un enlace del menú (navegación) */
  nav.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('a')) setOpen(false);
  });

  /* Cerrar con la tecla Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      btn.focus();
    }
  });

  /* Cerrar automáticamente al pasar a escritorio */
  var mq = window.matchMedia('(min-width: 1025px)');
  var onChange = function (ev) {
    if (ev.matches) setOpen(false);
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', onChange);
  } else if (mq.addListener) {
    mq.addListener(onChange); /* Safari antiguo */
  }

  /* Exponer por si el tema eXeLearning quiere sincronizarse */
  window.tvCloseNav = function () { setOpen(false); };
}

function initResponsive() {
  try { tvDetectarColores(); } catch (e) { /* sin color automático */ }
  initResponsiveNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResponsive);
} else {
  initResponsive();
}

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
  /* Convierte "rgb(r, g, b)", "rgba(r, g, b, a)" o "#rgb/#rrggbb" en {r,g,b,a} o null. */
  str = (str || '').trim();
  var m = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/.exec(str);
  if (!m) {
    var h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str);
    if (!h) return null;
    var x = h[1];
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    return {
      r: parseInt(x.substr(0, 2), 16),
      g: parseInt(x.substr(2, 2), 16),
      b: parseInt(x.substr(4, 2), 16),
      a: 1
    };
  }
  return {
    r: parseInt(m[1], 10),
    g: parseInt(m[2], 10),
    b: parseInt(m[3], 10),
    a: m[4] === undefined ? 1 : parseFloat(m[4])
  };
}

function tvReglaDeclarada(selector, prop) {
  /* Devuelve el valor DECLARADO para `prop` en la primera regla cuyo
     selector coincide con `selector`, recorriendo las hojas de estilo
     en orden de documento (las hojas del tema van antes que
     responsive.css, así se lee la paleta original del tema aunque el
     drawer la sobrescriba después). Evita valores transparentes y
     funciones var() de la propia capa responsiva. */
  function limpia(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  var objetivo = limpia(selector);
  for (var k = 0; k < document.styleSheets.length; k++) {
    var reglas = null;
    try { reglas = document.styleSheets[k].cssRules; } catch (e) { continue; } /* cross-origin */
    if (!reglas) continue;
    for (var i = 0; i < reglas.length; i++) {
      var r = reglas[i];
      if (r.type !== 1 || !r.selectorText || !r.style) continue;
      var sels = r.selectorText.split(',');
      var coincide = false;
      for (var j = 0; j < sels.length; j++) {
        if (limpia(sels[j]) === objetivo) { coincide = true; break; }
      }
      if (!coincide) continue;
      var v = r.style.getPropertyValue(prop);
      if (!v) continue;
      v = v.trim();
      if (!v || v === 'transparent' || v.indexOf('var(') === 0 || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(v)) continue;
      return v;
    }
  }
  return null;
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

function tvPonerColores(root, bg, texto, subBg, accent, origen) {
  root.setProperty('--tv-menu-bg', tvHex(bg));
  root.setProperty('--tv-menu-text', tvHex(texto));
  if (subBg) root.setProperty('--tv-menu-sub-bg', tvHex(subBg));
  root.setProperty('--tv-menu-line', 'rgba(' + accent.r + ',' + accent.g + ',' + accent.b + ',0.35)');
  root.setProperty('--tv-menu-accent', tvHex(accent));
  root.setProperty('--tv-menu-accent-bg', 'rgba(' + accent.r + ',' + accent.g + ',' + accent.b + ',0.15)');
  root.setProperty('--tv-btn-bg', tvHex(bg));
  root.setProperty('--tv-btn-bar', tvHex(texto));
  root.setProperty('--tv-pill-next', tvHex(accent));
  root.setProperty('--tv-pill-prev', tvHex(tvMezclar(accent, 255, 0.25)));

  /* La barra de estado de Android sigue al tema (si existe la meta). */
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tvHex(accent));

  if (window.console && console.log) {
    console.log('PWA: colores del menú móvil adaptados al tema (' + tvHex(bg) + ')' + (origen ? ' [' + origen + ']' : ''));
  }
}

function tvDetectarColores() {
  if (!TV_AUTO_COLORES) return;
  var root = document.documentElement.style;

  /* Plan A: color de fondo de la cabecera (#header o #headerContent). */
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
  if (bg) {
    var oscuro = tvLuminancia(bg) < 0.35;      /* ¿cabecera oscura? */
    var texto = oscuro ? '#ffffff' : '#17324d';
    texto = { r: parseInt(texto.slice(1, 3), 16), g: parseInt(texto.slice(3, 5), 16), b: parseInt(texto.slice(5, 7), 16) };
    var subBg = tvHex(tvMezclar(bg, 255, oscuro ? 0.12 : 0.35));
    subBg = { r: parseInt(subBg.slice(1, 3), 16), g: parseInt(subBg.slice(3, 5), 16), b: parseInt(subBg.slice(5, 7), 16) };
    var accent = oscuro ? tvMezclar(bg, 255, 0.25) : bg;
    tvPonerColores(root, bg, texto, subBg, accent, 'cabecera');
    return;
  }

  /* Plan B (temas con cabecera transparente, p. ej. "escolares"):
     copiar la paleta del propio menú del tema (#siteNav). Como el
     drawer sobrescribe esos colores en móvil, se leen las DECLARACIONES
     originales del CSS del tema (nav.css), no el valor computado. */
  var nav = document.getElementById('siteNav');
  if (!nav) return;

  var nbg = tvParseColor(tvReglaDeclarada('#siteNav a', 'background-color') || '');
  if (!nbg || nbg.a < 0.85) return;
  if (nbg.r >= 242 && nbg.g >= 242 && nbg.b >= 242) return;  /* nav blanco: nada que adaptar */

  var ntx = tvParseColor(tvReglaDeclarada('#siteNav a', 'color') || '') || { r: 0, g: 0, b: 0 };

  /* Acento: el borde del enlace del menú (el color fuerte del tema);
     si fuera demasiado claro, se oscurece un poco. */
  var accent = tvParseColor(tvReglaDeclarada('#siteNav a', 'border-bottom-color') || '');
  if (accent && tvLuminancia(accent) > 0.52) accent = tvMezclar(accent, { r: 0, g: 0, b: 0 }, 0.45);
  if (!accent) accent = tvLuminancia(nbg) < 0.35 ? tvMezclar(nbg, 255, 0.3) : { r: 18, g: 82, b: 145 };

  /* Fondo de los submenús: el que use el propio tema para el 2º nivel. */
  var subBg = tvParseColor(tvReglaDeclarada('#siteNav ul ul a', 'background-color') || '');
  if (subBg && (subBg.a < 0.85 || (subBg.r >= 250 && subBg.g >= 250 && subBg.b >= 250))) subBg = null;

  tvPonerColores(root, nbg, ntx, subBg, accent, 'navegacion');
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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
preparar_pwa.py - Repositorio de TecnoVilladiego
=================================================
Convierte un sitio exportado desde eXeLearning en PWA completa y responsiva.

Este script sustituye a preparar_responsive.py: hace TODO en una pasada.

QUE HACE
---------
1. Copia a la carpeta del sitio los archivos de soporte que falten
   (manifest.json, sw.js, offline.html, responsive.css, responsive.js,
   apple-touch-icon.png y la carpeta icons/) tomándolos de la carpeta
   donde esté este script. Tu favicon.ico y tus paginas no se sobrescriben.
2. En cada pagina .html anade:
   - viewport con viewport-fit=cover (si falta)
   - enlaces a los iconos (favicon PNG y apple-touch-icon)
   - <link rel="manifest"> y metas theme-color / apple-mobile-web-app-*
   - <meta name="format-detection" content="telephone=no">
   - enlaces a responsive.css y responsive.js
   - el registro del Service Worker antes de </body>
3. Crea una copia .bak de cada pagina antes de modificarla.
4. Es seguro ejecutarlo varias veces: no duplica nada.

COMO USARLO (tras generar un sitio nuevo con eXeLearning)
---------------------------------------------------------
1. Deja la carpeta del paquete pwa-tecnovilladiego donde la tengas
   (contiene este script junto a manifest.json, sw.js, etc.).
2. Ejecuta, apuntando a la carpeta del sitio exportado:

       py preparar_pwa.py --ruta "C:\\ruta\\a\\mi\\sitio"     (Windows)
       python3 preparar_pwa.py --ruta /ruta/a/mi/sitio        (Linux/Mac)

   Si ejecutas el script dentro del propio paquete sin --ruta, procesa
   el paquete como si fuera el sitio.

3. Opciones:
       --simular      muestra lo que haria SIN modificar nada
       --recursivo    procesa tambien las subcarpetas
       --actualizar   sobrescribe los archivos de soporte existentes
                      (util si has recibido versiones nuevas del paquete)
"""

import argparse
import os
import re
import shutil
import sys

# --- Archivos de soporte que el sitio necesita -----------------------------
SOPORTE = [
    'manifest.json',
    'sw.js',
    'offline.html',
    'responsive.css',
    'responsive.js',
    'apple-touch-icon.png',
]
CARPETA_ICONOS = 'icons'
NUNCA_TOCAR = {'favicon.ico'}   # el del usuario se respeta siempre

# --- Fragmentos que se anaden a las paginas --------------------------------
HEAD_MARK = '<!-- PWA + diseno responsivo TecnoVilladiego (anadido automaticamente) -->'
FAVICON32 = '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png" />'
FAVICON16 = '<link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16x16.png" />'
APPLE_TOUCH = '<link rel="apple-touch-icon" href="apple-touch-icon.png" />'
MANIFEST = '<link rel="manifest" href="manifest.json" />'
THEME = '<meta name="theme-color" content="#125291" />'
APPNAME = '<meta name="application-name" content="TecnoVilladiego" />'
MOBILEWEB = '<meta name="mobile-web-app-capable" content="yes" />'
APPLECAP = '<meta name="apple-mobile-web-app-capable" content="yes" />'
APPLEBAR = '<meta name="apple-mobile-web-app-status-bar-style" content="default" />'
APPLETITLE = '<meta name="apple-mobile-web-app-title" content="TecnoVilladiego" />'
FMT = '<meta name="format-detection" content="telephone=no" />'
VIEWPORT_FULL = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
RCSS = '<link rel="stylesheet" type="text/css" href="responsive.css" />'
RJS = '<script type="text/javascript" src="responsive.js" defer="defer"></script>'

SW_MARK = '/* Registro del Service Worker (PWA).'  # debe coincidir con index.html

PAGINAS_OMITIDAS = {'offline.html'}   # utilidad autonoma, no necesita nada

META_TAG_RE = re.compile(r'<meta[^>]*viewport[^>]*>', re.I)
CONTENT_RE = re.compile(r'content\s*=\s*(["\'])(.*?)\1', re.I | re.S)
HEAD_END_RE = re.compile(r'</head\s*>', re.I)
BODY_END_RE = re.compile(r'</body\s*>', re.I)


def read_file(path):
    """Lee preservando saltos de linea. Devuelve (contenido, encoding)."""
    for enc in ('utf-8', 'latin-1'):
        try:
            with open(path, 'r', encoding=enc, newline='') as f:
                return f.read(), enc
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError('b', b'', 0, 1, 'codificacion no reconocida')


def calcula_prefijo(path, base):
    """Ruta relativa para SUBIR de la pagina a la raiz del sitio.

    Pagina en la raiz -> '' (los enlaces quedan como 'responsive.css').
    Pagina en subcarpeta -> '../' (enlaces '../responsive.css', etc.),
    para que el diseno responsivo y la PWA funcionen tambien ahi."""
    rel = os.path.relpath(os.path.dirname(os.path.abspath(path)), base)
    if rel == '.':
        return ''
    profundidad = rel.replace(os.sep, '/').strip('/').count('/') + 1
    return '../' * profundidad


def _prefija(frag, prefijo):
    """Anade el prefijo relativo a los href/src de un fragmento."""
    if not prefijo:
        return frag
    return frag.replace('href="', 'href="' + prefijo).replace('src="', 'src="' + prefijo)


def write_file(path, contenido, enc):
    with open(path, 'w', encoding=enc, newline='') as f:
        f.write(contenido)


# ---------------------------------------------------------------------------
# 1. COPIA DE ARCHIVOS DE SOPORTE
# ---------------------------------------------------------------------------

def copiar_soporte(origen, destino, actualizar, simular):
    """Copia a `destino` los archivos que falten. Devuelve (copiados, ya_estaban)."""
    copiados, ya = [], 0
    print('\n--- Archivos de soporte ---')
    for nombre in SOPORTE:
        src = os.path.join(origen, nombre)
        dst = os.path.join(destino, nombre)
        if not os.path.isfile(src):
            print('  [FALTA]      %s no esta junto al script; se omite' % nombre)
            continue
        if os.path.isfile(dst) and not actualizar:
            ya += 1
            continue
        if not simular:
            shutil.copy2(src, dst)
        copiados.append(nombre)
        print('  [%s] %s' % ('SIMULADO' if simular else 'COPIADO', nombre))
    # Carpeta de iconos
    src_icons = os.path.join(origen, CARPETA_ICONOS)
    dst_icons = os.path.join(destino, CARPETA_ICONOS)
    if os.path.isdir(src_icons):
        if os.path.isdir(dst_icons) and not actualizar:
            ya += 1
        else:
            if not simular:
                if os.path.isdir(dst_icons):
                    shutil.rmtree(dst_icons)
                shutil.copytree(src_icons, dst_icons)
            copiados.append(CARPETA_ICONOS + '/')
            print('  [%s] %s (%d archivos)'
                  % ('SIMULADO' if simular else 'COPIADO', CARPETA_ICONOS + '/',
                     len(os.listdir(src_icons))))
    elif not os.path.isdir(dst_icons):
        print('  [AVISO]      no encuentro la carpeta %s junto al script' % CARPETA_ICONOS)
    print('  -> %d copiados, %d ya estaban (usa --actualizar para sobrescribir)'
          % (len(copiados), ya))
    return copiados


# ---------------------------------------------------------------------------
# 2. MODIFICACION DE PAGINAS
# ---------------------------------------------------------------------------

def fix_viewport(html):
    """Anade viewport-fit=cover al meta viewport si falta."""
    if 'viewport-fit' in html:
        return html, False
    m = META_TAG_RE.search(html)
    if not m:
        return html, False
    tag = m.group(0)

    def repl(cm):
        val = cm.group(2)
        if 'viewport-fit' in val:
            return cm.group(0)
        nuevo = val.rstrip().rstrip(',').rstrip() + ', viewport-fit=cover'
        return 'content=%s%s%s' % (cm.group(1), nuevo, cm.group(1))

    new_tag = CONTENT_RE.sub(repl, tag, count=1)
    if new_tag != tag:
        return html.replace(tag, new_tag, 1), True
    return html, False


def build_head_block(html, nl, prefijo=''):
    """Lineas PWA/responsive que faltan en el <head> (con rutas relativas)."""
    partes = [HEAD_MARK]
    if 'icons/favicon-32x32.png' not in html:
        partes += [_prefija(FAVICON32, prefijo), _prefija(FAVICON16, prefijo),
                   _prefija(APPLE_TOUCH, prefijo)]
    if 'manifest.json' not in html:
        partes.append(_prefija(MANIFEST, prefijo))
    if 'theme-color' not in html:
        partes += [THEME, APPNAME, MOBILEWEB, APPLECAP, APPLEBAR, APPLETITLE]
    if 'format-detection' not in html:
        partes.append(FMT)
    if not META_TAG_RE.search(html):
        partes.append(VIEWPORT_FULL)
    if 'responsive.css' not in html:
        partes.append(_prefija(RCSS, prefijo))
    if 'responsive.js' not in html:
        partes.append(_prefija(RJS, prefijo))
    if len(partes) == 1:
        return ''
    return nl.join(partes) + nl


def build_sw_block(nl, prefijo=''):
    """Script de registro del Service Worker (identico al de index.html)."""
    registro = "('%ssw.js', { scope: '%s' })" % (prefijo, prefijo or './')
    lineas = [
        '<script type="text/javascript">',
        '//<![CDATA[',
        SW_MARK,
        '   Se registra en cuanto el DOM esta listo, sin esperar el evento "load",',
        '   para que recursos externos lentos no retrasen la instalacion. */',
        "(function () {",
        "  if (!('serviceWorker' in navigator)) return;",
        "  function registerSW() {",
        "    navigator.serviceWorker.register" + registro,
        "      .then(function (registration) {",
        "        console.log('PWA: Service Worker registrado. Ambito: ' + registration.scope);",
        "      })",
        "      .catch(function (error) {",
        "        console.log('PWA: Error al registrar el Service Worker: ' + error);",
        "      });",
        "  }",
        "  if (document.readyState === 'loading') {",
        "    document.addEventListener('DOMContentLoaded', registerSW);",
        "  } else {",
        "    registerSW();",
        "  }",
        "})();",
        '//]]>',
        '</script>',
    ]
    return nl.join(lineas) + nl


def process_page(path, simular, base):
    nombre = os.path.basename(path)
    if nombre.lower() in PAGINAS_OMITIDAS:
        print('  [OMITIDA]    %s (pagina de utilidad)' % nombre)
        return 'omitida'
    try:
        html, enc = read_file(path)
    except (UnicodeDecodeError, OSError) as e:
        print('  [ERROR]      %s (%s)' % (nombre, e))
        return 'error'

    prefijo = calcula_prefijo(path, base)
    extra = '' if not prefijo else ' (subcarpeta: +%s)' % prefijo
    original = html
    cambios = []

    html, c = fix_viewport(html)
    if c:
        cambios.append('viewport')

    if not HEAD_END_RE.search(html) or not BODY_END_RE.search(html):
        print('  [OMITIDA]    %s (estructura no reconocida)' % nombre)
        return 'omitida'

    nl = '\r\n' if '\r\n' in html else '\n'

    bloque = build_head_block(html, nl, prefijo)
    if bloque:
        m = HEAD_END_RE.search(html)
        html = html[:m.start()] + bloque + html[m.start():]
        cambios.append('cabecera PWA')

    if 'serviceWorker.register' not in html and 'sw.js' not in html:
        m = BODY_END_RE.search(html)
        html = html[:m.start()] + build_sw_block(nl, prefijo) + html[m.start():]
        cambios.append('service worker')

    if html == original:
        print('  [OK]         %s (ya era PWA)' % nombre)
        return 'ok'

    if simular:
        print('  [SIMULADA]   %s -> %s%s' % (nombre, ' + '.join(cambios), extra))
        return 'modificada'

    try:
        shutil.copy2(path, path + '.bak')
        write_file(path, html, enc)
    except OSError as e:
        print('  [ERROR]      %s (%s)' % (nombre, e))
        return 'error'
    print('  [MODIFICADA] %s -> %s%s' % (nombre, ' + '.join(cambios), extra))
    return 'modificada'


# ---------------------------------------------------------------------------
# 3. PROGRAMA PRINCIPAL
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description='Convierte un sitio eXeLearning en PWA completa y responsiva.')
    ap.add_argument('--ruta', default=None,
                    help='carpeta del sitio (por defecto: la carpeta de este script)')
    ap.add_argument('--recursivo', action='store_true',
                    help='procesa tambien las subcarpetas')
    ap.add_argument('--simular', action='store_true',
                    help='no modifica nada, solo muestra lo que haria')
    ap.add_argument('--actualizar', action='store_true',
                    help='sobrescribe los archivos de soporte ya existentes')
    args = ap.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    base = os.path.abspath(args.ruta) if args.ruta else script_dir

    print('=' * 62)
    print('PWA + Diseno responsivo - Repositorio de TecnoVilladiego')
    print('Sitio:  %s' % base)
    print('Modo:   %s' % ('SIMULACION (no se modifica nada)' if args.simular else 'REAL'))
    print('=' * 62)

    if not os.path.isdir(base):
        print('\n[DETENIDO] La carpeta %s no existe.' % base)
        sys.exit(1)

    # Comprobar que los archivos de soporte estan junto al script
    faltan = [n for n in SOPORTE if not os.path.isfile(os.path.join(script_dir, n))]
    if faltan:
        print('\n[DETENIDO] Este script debe estar en la carpeta del paquete')
        print('pwa-tecnovilladiego, junto a: %s.' % ', '.join(faltan))
        sys.exit(1)

    copiados = copiar_soporte(script_dir, base, args.actualizar, args.simular)

    # Recoger paginas
    if args.recursivo:
        paginas = []
        for raiz, _dirs, archivos in os.walk(base):
            for a in archivos:
                if a.lower().endswith('.html'):
                    paginas.append(os.path.join(raiz, a))
    else:
        paginas = [os.path.join(base, a) for a in sorted(os.listdir(base))
                   if a.lower().endswith('.html')]
        # Aviso: .html en subcarpetas que no se van a procesar
        subcarpetas = []
        for raiz, _dirs, archivos in os.walk(base):
            if raiz != base and any(a.lower().endswith('.html') for a in archivos):
                subcarpetas.append(os.path.relpath(raiz, base))
        if subcarpetas:
            print('\n[AVISO] Hay paginas en subcarpetas: %s' % ', '.join(sorted(subcarpetas)))
            print('        Esas paginas tambien necesitan el diseno responsivo')
            print('        y la PWA: ejecuta de nuevo con --recursivo.')

    if not paginas:
        print('\nNo he encontrado archivos .html en %s' % base)
        sys.exit(1)

    print('\n--- Paginas (%d) ---' % len(paginas))
    contadores = {'modificada': 0, 'ok': 0, 'omitida': 0, 'error': 0}
    for p in paginas:
        estado = process_page(p, args.simular, base)
        contadores[estado] += 1

    print('\n' + '-' * 62)
    print('Resumen: %d modificadas | %d ya eran PWA | %d omitidas | %d errores'
          % (contadores['modificada'], contadores['ok'],
             contadores['omitida'], contadores['error']))
    if (contadores['modificada'] or copiados) and not args.simular:
        print('\nSiguiente paso: sube al servidor la carpeta del sitio completa.')
        print('La primera visita registrara el Service Worker; desde ahi, la app')
        print('funcionara sin conexion y se podra instalar en movil y tablet.')
    print('')


if __name__ == '__main__':
    main()

# Repositorio de TecnoVilladiego

Portal principal del dominio `angelmicelti.github.io`.

## Convivencia con otras aplicaciones del dominio

En `https://angelmicelti.github.io/<carpeta>/` se publican aplicaciones de
otros repositorios de esta cuenta (p. ej. `/NumerosMetalicos/`, `/Reducciones/`)
y, en subcarpetas propias (2ESO, 3ESO, 4ESO, CYR, DOC, HER, PROY), las
unidades didácticas. Reglas para que nada interfiera con nada:

1. **Identidad del portal**: solo las páginas de la raíz declaran favicon,
   manifiesto y metas de nombre (`preparar_pwa.py` solo añade identidad al
   sitio raíz). Las páginas de subcarpetas no imponen favicon ni nombre.
2. **Service worker del portal**: `sw.js` solo intercepta la raíz y las
   carpetas de `CARPETAS_DEL_PORTAL`; cualquier otra ruta (apps de otros
   repos) pasa de largo. Nueva app publicada desde otro repo queda
   automáticamente fuera de su alcance.
3. **Cachés por prefijo**: cada PWA (portal incluido) solo borra de la Cache
   Storage las cachés con su propio prefijo (`tecnovilladiego-`,
   `tv-<app>-`, etc.). Nunca usar "borrar todas las cachés" en un SW de este
   origen: destruiría las de las demás apps.
4. **Apps de otros repositorios**: cada una debe declarar su propio favicon
   en su página principal y, si tiene service worker, registrarlo con ámbito
   relativo (`./sw.js`) y limpiar solo sus cachés (prefijo propio).

## Utilidades

- `preparar_pwa.py`: convierte un sitio eXeLearning en PWA responsiva.
  Con `--ruta <carpeta>` prepara una unidad didáctica (sin identidad propia);
  sin `--ruta`, trabaja sobre el portal raíz (con identidad completa).

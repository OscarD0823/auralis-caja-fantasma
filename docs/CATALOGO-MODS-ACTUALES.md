# Catálogo de módulos actuales

Revisión en la colección del juego: 17 de noviembre de 2026.

La colección contiene **102 módulos y 831 variantes normales**. Cada variante guarda el nivel recibido, de 1 a 17, y su estado Brillante (Shiny). Brillante no aparece como otro módulo duplicado. Los registros anteriores conservan sus identificadores, intentos y fechas; si no tenían nivel, se muestran como «Sin nivel».

## Comprobación en el juego

Se recorrieron completos los nueve estilos de armas y las seis piezas de armadura, sin pasar a la siguiente lista hasta terminar la anterior. Se contrastaron los nombres, el orden de las filas, las casillas y sus clases, reutilizando los símbolos comprobados en las fichas.

| Pieza | Módulos | Variantes |
| --- | ---: | ---: |
| Arma, nueve estilos | 36 | 184 |
| Casco | 10 | 89 |
| Superior | 10 | 140 |
| Prenda inferior | 11 | 118 |
| Zapatos | 8 | 112 |
| Guantes | 9 | 96 |
| Máscara | 18 | 92 |
| **Total** | **102** | **831** |

La referencia pública está en [mod-collection-order.json](../catalog/mod-collection-order.json). Solo contiene nombres, orden y cantidades. La revisión corrigió el orden de los estilos de armas, la posición de Escudo duradero en Superior y el nombre Amplificación de arma en Guantes. El nombre anterior, Amplificador de municiones, sigue funcionando en la búsqueda. La clase que muestra la ficha actual se llama Violencia.

## Módulos del mapa acuático

- **Carga de precisión / Precision Load**, prenda inferior: 11 variantes. Es un módulo distinto del anterior Carga de precisión / Precision Charge; ambos conservan sus filas y su progreso por separado.
- **Mejora de torreta / Turret Enhancement**, guantes: 11 variantes.

Ambos están confirmados en el [anuncio oficial del 21 de octubre](https://www.oncehuman.game/news/update/20261021/40780_1317280.html) y se observaron en la colección del juego. Las fichas de [Precision Load](https://oncehuman.th.gl/db/mods/mod_9321) y [Turret Enhancement](https://oncehuman.th.gl/db/mods/mod_9524) permiten contrastar sus variantes. Los sufijos anunciados para S5 no se incorporan como si ya estuvieran disponibles en esta revisión.

## Archivos y validación

- [shiny-mods.json](../catalog/shiny-mods.json) contiene las 809 variantes normales de la fuente base y los alias de sus antiguos registros Brillantes.
- [abyss-mods.json](../catalog/abyss-mods.json) agrega las 22 variantes acuáticas, sin inventar identificadores del juego.
- El generador de la fuente base descarta el sistema antiguo y fusiona los equivalentes normales y Brillantes. Los módulos acuáticos y el orden comprobado se mantienen en archivos separados para conservarlos al regenerar.

```powershell
pnpm run catalog:shiny
pnpm test
```

Las comprobaciones verifican los 102 módulos de la referencia, sus cantidades y orden, la conservación de los alias anteriores, los niveles, las correcciones y la sincronización. No se importaron los niveles personales observados durante la revisión.

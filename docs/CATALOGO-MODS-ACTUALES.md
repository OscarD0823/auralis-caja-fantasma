# Catálogo de módulos actuales

Revisión de la colección el 17 de noviembre de 2026. Variantes de S5 contrastadas el 18 de noviembre.

La colección contiene **102 módulos y 871 variantes normales**. Cada variante guarda el nivel recibido, de 1 a 17, y su estado Brillante (Shiny). Los registros anteriores conservan sus identificadores, intentos y fechas. Si no tenían nivel, se muestran como «Sin nivel».

## Comprobación en el juego

Se recorrieron completos los nueve estilos de armas y las seis piezas de armadura, sin pasar a la siguiente lista hasta terminar la anterior. Se contrastaron los nombres, el orden de las filas, las casillas y sus clases, reutilizando los símbolos comprobados en las fichas.

| Pieza | Módulos | Variantes |
| --- | ---: | ---: |
| Arma, nueve estilos | 36 | 184 |
| Casco | 10 | 109 |
| Superior | 10 | 160 |
| Prenda inferior | 11 | 118 |
| Zapatos | 8 | 112 |
| Guantes | 9 | 96 |
| Máscara | 18 | 92 |
| **Total** | **102** | **871** |

La referencia de las 831 variantes anteriores a S5 contiene nombres, orden y cantidades. La revisión corrigió el orden de los estilos de armas, la posición de Escudo duradero en Superior y el nombre Amplificación de arma en Guantes. El nombre anterior, Amplificador de municiones, sigue funcionando en la búsqueda. La clase que muestra la ficha actual se llama Violencia. [Orden de la colección](../catalog/mod-collection-order.json)

## Módulos del mapa acuático

- **Carga de precisión / Precision Load**, prenda inferior: 11 variantes. Es un módulo distinto del anterior Carga de precisión / Precision Charge; ambos conservan sus filas y su progreso por separado.
- **Mejora de torreta / Turret Enhancement**, guantes: 11 variantes.

Ambos se observaron en la colección del juego. [Anuncio oficial del 21 de octubre](https://www.oncehuman.game/news/update/20261021/40780_1317280.html) · [Precision Load](https://oncehuman.th.gl/db/mods/mod_9321) · [Turret Enhancement](https://oncehuman.th.gl/db/mods/mod_9524)

## Variantes de Resonancia discordante

Los diez módulos de Casco y los diez de Superior tienen dos variantes nuevas cada uno. Sus clases son **Ritmo** y **Energía de aberración de Ritmo**, con los equivalentes ingleses **Rhythm** y **Rhythm Deviant Energy**. El filtro **Mostrar → Nuevas · Resonancia discordante** reúne las 40 variantes. [Anuncio de S5](https://www.oncehuman.game/news/update/20261118/40780_1319892.html)

## Archivos y validación

- [shiny-mods.json](../catalog/shiny-mods.json) contiene las 809 variantes normales de la fuente base y los alias de sus antiguos registros Brillantes.
- [abyss-mods.json](../catalog/abyss-mods.json) agrega las 22 variantes acuáticas, sin inventar identificadores del juego.
- [resonance-mod-variants.json](../catalog/resonance-mod-variants.json) recoge los sufijos y los totales observados de Casco y Superior en S5.
- El generador de la fuente base descarta el sistema antiguo y fusiona los equivalentes normales y Brillantes. Los módulos acuáticos y el orden comprobado se mantienen en archivos separados para conservarlos al regenerar.

```powershell
pnpm run catalog:shiny
pnpm test
```

Las comprobaciones verifican los 102 módulos de la referencia, sus cantidades y orden, la conservación de los alias anteriores, los niveles, las correcciones y la sincronización. No se importaron los niveles personales observados durante la revisión.

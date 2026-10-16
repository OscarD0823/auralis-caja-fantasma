# Caja Fantasma 1.22.2 · Cofre fluido y animaciones ligeras

Actualización para Windows, Android y web del 10 de octubre de 2026.

- Apertura en vídeo local H.264 a 60 FPS, sin audio ni bucle. Conserva el cofre detallado, el módulo, la tapa y el fantasma sin renderizar el modelo pesado durante el inicio.
- El fantasma emerge y se retira de forma continua; se eliminaron las pausas de la trayectoria y de la grabación anterior.
- El cofre junto a los puntos usa los acabados del mismo modelo con cerca de un 95 % menos de elementos. Mantiene la tapa y el fantasma; cambiar puntos no vuelve a dibujar sus acabados.
- Las animaciones decorativas se pausan fuera de pantalla, en segundo plano y detrás de la apertura. Si falla el vídeo o se prefiere reducir movimiento, se muestra una imagen y se entra al menú.
- La web no intenta guardar respuestas parciales del vídeo en su caché. La nueva versión renueva la caché de interfaz sin borrar el progreso.

No cambia el cálculo de puntos, el historial de cajas, los personajes, los módulos ni el protocolo de sincronización. Los datos personales y las grabaciones de pruebas no se incluyen en los instaladores ni se publican.

**Para actualizar:** instala sobre la versión anterior, sin desinstalar. Windows dispone del actualizador firmado; Android pide aceptar la instalación. En la web, vuelve a abrir la página para recibir la interfaz nueva. Exportar un respaldo local sigue siendo recomendable.

[Descargas](https://github.com/OscarD0823/auralis-caja-fantasma/releases/latest) · [Web](https://oscard0823.github.io/auralis-caja-fantasma/) · [Verificación de rendimiento](../RENDIMIENTO-ANIMACIONES.md)

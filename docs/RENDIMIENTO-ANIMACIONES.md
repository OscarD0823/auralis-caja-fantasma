# Optimización del cofre · 1.22.2

- Apertura: vídeo local MP4 H.264 Baseline, 640 × 640, 60 FPS, 7,6 segundos, sin audio ni bucle (1.056.464 bytes). Grabado del modelo original; conserva módulo, tapa y fantasma.
- El fantasma sale y se aleja con una trayectoria continua, sin desacelerar y detenerse en cada tramo. La grabación avanza las animaciones pausadas a un tiempo exacto por fotograma, conservando los retrasos propios de brazos, cola y partículas; no reinicia animaciones con un retraso negativo.
- El inicio no monta el modelo 3D detrás del vídeo. Si falla la reproducción o está activado «reducir movimiento», muestra una imagen y continúa sin bloquear la aplicación.
- Cofre junto a los puntos: caras y tapa reales con acabados precalculados del mismo modelo. 134 elementos frente a 2.630 en la versión detallada (~95 % menos).
- El cofre pequeño se pausa fuera de pantalla, con la aplicación oculta y mientras se reproduce la apertura. Cambiar los puntos no vuelve a renderizar sus acabados.
- No cambia el guardado, los contadores reales ni la sincronización de dispositivos.

## Verificación

`pnpm lint`, `pnpm test`, `pnpm build` y `node scripts/benchmark-chest.mjs`.

Reproducción real en el laboratorio aislado: iniciar `pnpm dev --host 127.0.0.1 --port 1427` y ejecutar `node scripts/check-opening-playback.mjs`. Comprueba vídeo, pausa en segundo plano, salida al menú, fallback, movimiento reducido y pausa del cofre pequeño fuera de pantalla; usa solamente datos simulados.

Web de producción: compilar con `VITE_WEB_BASE=/auralis-caja-fantasma/`, servir con `vite preview` usando la misma base en el puerto 1428 y ejecutar `node scripts/check-web-release.mjs`. Comprueba la apertura y el cofre del contador a 1320 × 850, la caché activa, una respuesta parcial MP4 de 1.024 bytes (206) y la conservación de un punto ficticio al recargar. Usa un perfil temporal sin datos personales. También admite la URL pública de GitHub Pages.

El benchmark usa un perfil aislado de Edge a 390 × 844 y CPU limitada ×4. No abre datos personales; sus tiempos no son FPS de un teléfono real. Algunos motores headless no informan de capas GPU.

Comparación visual: `node scripts/render-chest-preview.mjs --mobile`.

Regenerar acabados: `pnpm chest:surfaces`. Regenerar apertura: `pnpm chest:video --ffmpeg <ruta-a-ffmpeg>`. FFmpeg solo se utiliza durante la preparación; no se incluye en ningún instalador ni se ejecuta en el teléfono.

## Prueba en Android físico

Probado en un Samsung SM-S721B con una APK de prueba firmada con el certificado existente. La instalación se hizo sobre la aplicación anterior, sin desinstalarla. Las compilaciones privadas conservaron temporalmente el número 1.22.1; la publicación usa 1.22.2.

La grabación muestra el módulo, apertura, salida del fantasma y paso automático al menú. Se comparó el respaldo personal antes y después: recompensas, actividad, cajas, personajes y módulos permanecieron iguales. También se comprobó que otro reinicio conservaba el intento actual.

| Medida de esta ejecución | Anterior, con grabación | Optimizada, con grabación | Optimizada, sin grabación |
| --- | ---: | ---: | ---: |
| Cuadros nativos con retraso (`gfxinfo`) | 62,22 % | 1,91 % | 2,22 % |
| Memoria PSS en la última muestra | 655 MiB | 294 MiB | 302 MiB |

Son muestras de apertura y entrada al menú, no los FPS del vídeo ni una garantía para todos los teléfonos. La grabación añade carga y el evento cambió de estado entre pruebas; no es un benchmark controlado que aísle exclusivamente el cofre.

Las cifras de la tabla corresponden a la primera optimización (vídeo a 30 FPS). La revisión siguiente está codificada a 60 FPS: el renderizador comprobó que no hay fotogramas consecutivos idénticos entre el 51 % y el 87 % de la apertura. FFmpeg tampoco detectó pausas de 120 ms o más entre los segundos 4 y 6,6, donde antes se congelaba la salida del fantasma. Esto verifica el archivo generado; no equivale a medir 60 FPS en todos los dispositivos.

Prueba física de esta revisión el 10 de octubre: apertura y llegada automática al menú con grabación; `gfxinfo` informó de 528 cuadros nativos y 5 con retraso (0,95 %), percentil 50 de 5 ms y percentil 90 de 18 ms. Última muestra PSS: 285 MiB. Son medidas de la interfaz nativa durante esa ejecución, no del decodificador de vídeo. Se conservó la misma firma y no se sobrescribieron los instaladores publicados.

Los respaldos privados antes y después de instalar y probar esta revisión coinciden exactamente en recompensas, eliminaciones, actividad, cajas, módulos, personajes y base manual. Sus valores e historiales personales no se distribuyen. La conexión para obtener los respaldos solo leyó el progreso y se desactivó al terminar.

Para repetir la comprobación: obtener primero un respaldo reciente por el puente del teléfono y guardarlo como `respaldo-telefono-antes.json` dentro de una carpeta privada de `Entrega/`. Ejecutar `node scripts/check-android-chest.mjs --output <carpeta> --label <nombre>`, añadiendo `--record` para grabar. El script reinicia únicamente la app para probar la apertura; no instala, importa, borra ni edita recompensas. Los respaldos y grabaciones quedan fuera del repositorio público.

Para construir otra APK de prueba sin sobrescribir el instalador publicado: `powershell -File scripts/build-android.ps1 -OutputDirectory <carpeta-privada>`.

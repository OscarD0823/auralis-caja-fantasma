# Caja Fantasma · Guía técnica y funciones

Aplicación para Windows, Android y navegador creada por [OscarD0823](https://github.com/OscarD0823). Registra las recompensas reclamadas hasta obtener la Caja Fantasma, muestra la Rueda Visional pública y aprende del historial personal de cajas.

Repositorio del proyecto comunitario: <https://github.com/OscarD0823/auralis-caja-fantasma>

La versión web gratuita está preparada para GitHub Pages y su alcance de guardado está documentado en [`docs/VERSION-WEB-GRATUITA.md`](docs/VERSION-WEB-GRATUITA.md). La auditoría del catálogo moderno se encuentra en [`docs/CATALOGO-MODS-ACTUALES.md`](docs/CATALOGO-MODS-ACTUALES.md).

## Descargas organizadas

La carpeta [`Programa`](Programa/) reúne el instalador `.exe` de Windows, la APK firmada para Android ARM64, instrucciones de instalación y una copia de la licencia.

## Funciones

- Windows guarda al cerrar la ventana, con «Guardar y salir», antes de actualizar y al recibir el aviso de apagado, reinicio o cierre de sesión. Los cambios recibidos del teléfono se incluyen en el respaldo. La X conserva el funcionamiento en segundo plano; el botón termina la aplicación. Un corte de energía o cierre forzado puede interrumpir un cambio todavía no guardado.
- Recompensas Pro con valores configurables: jefes de monolito, silos y Desafío de Manibus de Endless Dream valen 1; Guerra Pro y Manibus de Manibus valen 2.
- Endless Dream incluye Invasión de Zona Onírica y Soñador de Luz, Soñador Profundo y Soñador Eterno; cada uno vale 1.
- División Visión con Lunar / Lunar Revelry, Abismo de Gravedad / Gravity Abyss y Progenie Aberrante / Aberrant Progeny, además de un editor para ruedas futuras. Cada rueda posee una ficha visual con imagen, descripción y estado. OscarD0823 selecciona la rueda pública desde el modo desarrollador; los demás usuarios reciben esa selección sin controles para alterar el ciclo.
- Abismo de Gravedad incluye Ballena (1) y Plataformas (4).
- Progenie Aberrante permanece desactivada con Araña, Antena y Grandulón; sus opciones no suman mientras el evento esté desactivado.
- La caja puede marcarse en cualquier momento. Se guarda automáticamente fecha, hora, puntos, número de recompensas, origen y desglose.
- Historial de rondas debajo de los contadores de recompensas: conserva el total del intento, muestra el conteo parcial desde el último corte y registra fecha, motivo, recompensas, puntos y desglose. El botón “Guardar ronda” está junto a los botones de llegada de la caja. Cada inicio de evento archiva la ronda anterior y reinicia solo ese conteo parcial. Cada tarjeta muestra tanto lo realizado hoy como su acumulado histórico.
- Resumen diario de puntos, cantidad de actividades y últimos días, acompañado por un ranking histórico que ordena jefes y recompensas desde que comenzó a usarse la aplicación.
- Menú principal Personajes para hasta 12 perfiles: cada uno conserva por separado su intento, porcentaje estimado e historial de cajas. Los datos existentes se mantienen en “Personaje principal” y la aplicación siempre abre en modo Solitario.
- Modo Equipo para seleccionar dos o más personajes. Su contador propio comienza en cero y cada recompensa registrada suma simultáneamente al intento individual de todos los integrantes; cambiar o reiniciar el conteo del equipo no borra esos puntos personales.
- Barra comparativa visible al tener más de un personaje, con los puntos, porcentaje estimado y progreso de cada uno.
- Cuando una caja llega por correo de Plataformas, las actividades hechas durante la última hora no se atribuyen a la caja anterior: permanecen contadas en el intento nuevo.
- Las estadísticas comienzan en cero: no se precargan las 16 salidas de la hoja ni se presentan como historial de una persona nueva.
- Carga manual de valores históricos aproximados. Se combinan únicamente con las cajas confirmadas de esa persona, pero permanecen separados y no inventan fechas.
- El administrador configura la espera y la duración de la Rueda Visional; el valor inicial es 30 minutos de espera y 30 minutos activa. También puede establecer un retraso visual de 0 a 300.000 milisegundos entre el cierre del evento y la presentación del contador siguiente sin modificar el horario real.
- Ajuste directo del contador por fase, minutos y segundos, visible únicamente para el administrador verificado. La sincronización inicial de Gravedad parte de su cierre a las 4:52:30 p. m. de Colombia del 10 de septiembre de 2026.
- Gravedad emite un aviso de voz anticipado configurable. La app funciona minimizada en la bandeja e inicia con Windows.
- Contador flotante movible, siempre visible, escalable entre 20 % y 150 % y con posición recordada. Toda su configuración se concentra en la pestaña Caja; Visión queda reservada para las ruedas publicadas. El área transparente de la Ballena usa una escala independiente de 20 % a 100 % y nunca supera el ancho de la ventana. El tiempo del Riftwalker puede conservar tamaño y estilo propios, esconderse o usar **Solo rayo**, donde el haz muestra el tiempo y pierde longitud e intensidad conforme avanza. La Ballena también puede ocultarse por completo sin desactivar el contador principal. Puede usar la forma automática propia de cada evento o un diseño rectangular, cuadrado, vertical o redondo; el reloj principal admite lectura digital, compacta o mediante anillo, y el nombre se muestra en español, inglés o con un texto personalizado. Funciona sobre juegos en ventana o pantalla completa sin bordes; Windows no permite garantizar superposición sobre pantalla completa exclusiva.
- El contador flotante permanece en modo pasivo por defecto: oculta el agarre y la X y deja pasar los clics al juego. Solo se vuelve interactivo después de pulsar “Abrir configuración” en Caja; al terminar el ajuste, cambiar de sección, ocultar o minimizar la aplicación, vuelve a ser transparente para el ratón.
- Historial de cambios incluido dentro del programa, visible únicamente para la cuenta propietaria verificada.
- Apartado Mods Brillantes con búsqueda bilingüe por nombre, variante, estilo, ranura o ID; contador individual de duplicados nivel 17 fallidos y colección de Brillantes conseguidos.
- Catálogo local completo del sistema actual con 1.618 registros exactos: 809 módulos normales y sus 809 versiones Brillantes. Los 207 registros del sistema anterior ya no se distribuyen ni aparecen en los filtros. Los seguimientos personales creados previamente se conservan.
- Filtros por estilo de arma o pieza de armadura y por nivel actual. Todos los módulos progresan desde Nivel 1 hasta Nivel 17; la versión especial se muestra como Brillante. Hora punta con Estrella descendente está incluida como combinación exacta y siguen disponibles los nombres personalizados para incorporaciones futuras.
- Respaldo e importación JSON. La web conserva además una segunda copia personal en IndexedDB, solicita almacenamiento persistente cuando el usuario lo decide y mantiene en caché la interfaz para abrir sin conexión. Un aviso al entrar permite instalarla cuando el navegador lo admite o consultar instrucciones para PC y celular. Se puede cerrar sin perder la ayuda en Dispositivos; en iPhone, se usa Compartir → Añadir a pantalla de inicio.
- Dos cuadros de tiempo en Windows, web y Android: evento principal y próxima Ballena/duración activa. La configuración es compacta y adapta las opciones a la plataforma. Los indicadores PC, Web y Móvil muestran los dispositivos que han comunicado con el puente durante los últimos 30 segundos.
- Windows mantiene una sola instancia: volver a abrirlo desde Inicio, búsqueda o un acceso directo muestra la ventana existente. El arranque automático en segundo plano no roba el foco. Los indicadores conectados usan anillos, señales secuenciadas y trazas de datos; los desconectados permanecen quietos. La animación es decorativa, no una medición del volumen transferido.
- Apertura animada con una llave que encaja en la esquina de la caja, cierres mecánicos, tapa articulada y luz interior. Puede omitirse con un clic y respeta la preferencia de movimiento reducido.
- Al arrancar, los respaldos se combinan por identificadores y marcadores de eliminación, incluso si ambas copias tienen igual número de registros. El puente, los clientes y el guardado automático de rondas esperan a que termine esa recuperación.
- Sincronización bidireccional PC–Web–Android sin Firebase ni nube personal: Windows muestra una sola IP, un solo puerto y un código de seis números para conectar simultáneamente la página y Android. El modo **Sincronización en vivo** combina historiales y rechaza que una copia vacía o atrasada borre otra más completa. Los datos personales no se suben a GitHub.
- Interfaz principal seleccionable en 12 idiomas: español, inglés, portugués, francés, alemán, italiano, polaco, turco, ruso, japonés, coreano y chino simplificado. Los textos especializados no traducidos usan inglés como fallback seguro.
- Accesos cruzados en Dispositivos: Android ofrece la descarga de Windows y la página; la web ofrece Windows y APK; Windows ofrece APK y la página. Las descargas siempre abren la publicación estable más reciente para evitar enlaces rotos al cambiar de versión.
- Apertura cinematográfica con geometría independiente de la caja: el emblema espectral original vuela y gira hasta encajar en la ranura de una esquina; la energía llega a los cierres, la tapa se abre por su bisagra y aparece un holograma. No se dividen imágenes para imitar la apertura ni se usa un motor 3D. Respeta movimiento reducido y puede omitirse.
- La imagen de la recompensa conserva la caja y muestra una cantidad de 17.
- Barra ambiental: Lunar activa usa la referencia de la luna roja con figuras de ojos rojos; Simbiosis activa usa la referencia de criaturas transformadas; Gravedad activa alterna sus dos escenas de ciudad y objetos suspendidos.
- Secuencia especial de la Ballena, exclusiva de la ventana flotante de Abismo de Gravedad: desde el minuto 15 llega nadando por la izquierda, cruza el contador y se coloca debajo sin un marco de fondo. El jefe usa un recorte transparente optimizado; cola, cuerpo, cabeza, núcleo y rayo se animan como elementos separados mientras entra y dispara. El rayo azul funciona como barra y reloj propio durante los 15 minutos restantes del evento más 5 minutos adicionales; al llegar a cero se apaga y la Ballena continúa nadando hasta salir por la derecha. Un minuto después se guarda automáticamente la ronda de puntos. El contador principal y la Ballena no proyectan marcos ni sombras grises exteriores.
- Rendimiento adaptativo: el reloj, la lectura del estado y la sincronización reducen su frecuencia cuando la interfaz no está visible, y la nueva imagen transparente de la Ballena reemplaza dos capturas de varios megabytes.

## Catálogo compartido

El archivo [`catalog/visions.json`](catalog/visions.json) es la fuente pública de recompensas, ruedas y sincronización opcional del contador. PC y Android lo comprueban al abrir, al recuperar el foco, al volver Internet y cada 30 segundos incluso si la ventana principal está oculta. Usan GitHub Raw sin caché y, si ese servicio falla, consultan de forma limitada la API pública de GitHub. Si `catalogVersion` es superior a la copia local, los demás equipos reciben las opciones nuevas; si el administrador sincroniza otra vez los tiempos de esa misma versión, la fecha de publicación más reciente también los reemplaza. El botón «Sincronizar con todos», reservado al propietario, publica en una operación la fase, su hora absoluta, los minutos de espera y actividad y la transición al cierre en milisegundos; el ciclo continúa correctamente aunque el PC haya estado apagado.

La APK reutiliza la interfaz y el núcleo Tauri, conserva sus datos personales en el teléfono y recibe la configuración pública desde GitHub o desde el PC conectado. Puede intercambiar los datos personales directamente con el PC, sin Firebase, nube ni cuentas, mientras Windows esté en ejecución y ambos dispositivos compartan una red local o USB tethering; la interfaz Android puede permanecer en segundo plano. La implementación, sus límites y las pruebas están documentados en [`docs/ANDROID-Y-SINCRONIZACION.md`](docs/ANDROID-Y-SINCRONIZACION.md).

Existe un único instalador para todos. En `Configuración > Editor de OscarD0823`, el modo desarrollador permanece bloqueado hasta que GitHub CLI confirma que la sesión activa pertenece exactamente a `OscarD0823`, propietario del repositorio. Otra cuenta no puede habilitar el editor y el servidor repite la verificación antes de cada publicación.

El botón de acceso abre el inicio de sesión web de GitHub CLI. La aplicación no recibe ni guarda la contraseña o el token. Una vez verificada la cuenta propietaria, el editor permite preparar como borrador la rueda pública, los tiempos, el objetivo y todas las recompensas. Nada se envía mientras se escribe: el botón “Guardar todo” valida y publica el conjunto completo mediante una sola operación. Las pruebas validan la estructura del catálogo sin bloquear valores que el propietario haya editado legítimamente.

El modo desarrollador incluye un laboratorio visual que reutiliza la misma interfaz del contador flotante. Permite simular espera, evento activo, transición al cierre, disparo o salida de la Ballena y probar forma, reloj, idioma, nombre personalizado, tamaño de ventana, tamaño de adicionales y tamaño/estilo del reloj del Riftwalker sin publicar esos estados de prueba. Las herramientas y el apartado Cambios solo aparecen cuando se verifica la cuenta propietaria; la pantalla de acceso no expone el editor. El editor del catálogo también conserva el nombre en español e inglés de cada rueda futura.

## Actualizaciones

El actualizador sigue el patrón de [Fortuna Real](https://github.com/OscarD0823/auralis-fortuna-real): Windows y Android consultan el mismo `latest.json` en GitHub Releases al abrir, cada 15 minutos, al volver Internet y al recuperar el foco. Windows descarga el instalador, verifica su firma, lo instala y vuelve a abrir la aplicación. Android descarga la APK desde la app, verifica su SHA-256 y entrega el paquete firmado al instalador del sistema; Android exige que la persona confirme esa pantalla y puede solicitar una sola vez el permiso «Instalar apps desconocidas». No es necesario buscar ni descargar manualmente las versiones siguientes. Sin Internet, el programa inicia normalmente con los datos locales.

La clave privada y su contraseña DPAPI permanecen fuera del repositorio, en el perfil local de Windows. El repositorio contiene únicamente la clave pública necesaria para verificar instalaciones.

## Auditoría del instalador

El paquete NSIS instala el ejecutable de Caja Fantasma y genera su desinstalador. No incorpora otros programas, servicios, controladores, extensiones ni telemetría. Las imágenes y el código de la interfaz están empacados dentro del ejecutable. Si Windows no dispone de Microsoft Edge WebView2, el instalador descarga únicamente el bootstrapper oficial de Microsoft, necesario para mostrar la aplicación. La revisión detallada está en [`AUDITORIA-INSTALADOR.md`](AUDITORIA-INSTALADOR.md).

## Desarrollo

Requisitos para Windows: Node.js 24, pnpm 11, Rust estable con destino MSVC, Visual Studio Build Tools y WebView2. Para Android se requiere además JDK, Android SDK, Build Tools, NDK y el destino Rust `aarch64-linux-android`.

```powershell
pnpm install
pnpm run catalog:shiny
pnpm run lint
pnpm test
pnpm run desktop
```

Para crear el instalador firmado en el equipo autorizado:

```powershell
pnpm run installer
```

Los artefactos quedan en `Entrega/`. Para publicar una versión, incrementa la versión en `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` y `src/model.ts`, actualiza las notas y crea primero la APK firmada en `Programa/Android/`. Después ejecuta:

```powershell
./scripts/build-installer.ps1 -Publish
```

La publicación se detiene si falta la APK de esa misma versión. El script adjunta Windows, Android y `latest.json` en un solo Release para impedir que los dos actualizadores queden desalineados.

## Privacidad

La aplicación no recopila telemetría, contraseñas ni información del juego. Solo consulta el nombre de la sesión local de GitHub para proteger el editor, y se conecta al repositorio oficial para sincronizar el catálogo y buscar actualizaciones. El historial personal no se publica; cuando se activa la conexión PC–Android se transmite únicamente dentro de la dirección privada elegida por la persona.

## Licencia

MIT © 2026 OscarD0823 para el código. Consulta el [aviso comunitario](AVISO-COMUNITARIO.md) sobre marcas e imágenes de referencia.

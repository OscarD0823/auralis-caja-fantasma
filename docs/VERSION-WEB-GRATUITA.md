# Versión web gratuita

## Opción preparada: GitHub Pages

La interfaz se publica como un sitio estático en `https://oscard0823.github.io/auralis-caja-fantasma/`. El flujo `.github/workflows/web-pages.yml` ejecuta las mismas validaciones del programa, compila con la ruta correcta del repositorio y publica el resultado después de cada cambio en `main` o cuando se ejecuta manualmente.

GitHub Pages está disponible sin costo para este repositorio público. No se configura dominio de pago, base de datos, Worker, Firebase ni otro servicio facturable.

La versión web escribe el estado principal en `localStorage` y mantiene una segunda copia recuperable en IndexedDB. Un Service Worker conserva en caché la interfaz para que pueda abrir sin conexión. El botón **Proteger almacenamiento** solicita al navegador que no elimine esos datos bajo presión de espacio. El respaldo JSON continúa siendo importante ante un borrado manual de los datos del sitio.

## Instalar la página

En Dispositivos aparece **Instalar aplicación** cuando el navegador ofrece esa función. También puedes usar la opción de instalación del menú de Chrome o Edge. En iPhone, abre la página en Safari y usa **Compartir → Añadir a pantalla de inicio**. La instalación abre la misma página en una ventana independiente: no crea una cuenta ni cambia el lugar de guardado de los datos.

La caché incluye la pantalla inicial, su código y los iconos. Los módulos cargados por separado y las imágenes quedan disponibles sin conexión después de haberlos abierto con Internet. La sincronización necesita un anfitrión local activo (PC o Android); la instalación no elimina los permisos de acceso a dispositivos que pueda exigir el navegador. La actualización renueva la caché de interfaz, no el historial guardado.

## Sincronización sin nube

Windows funciona como concentrador local entre las tres aplicaciones:

1. GitHub Pages sirve únicamente los archivos públicos de la aplicación.
2. La aplicación de Windows abre un único puente local que reconoce tanto las solicitudes HTTP de la página como la conexión directa de Android.
3. Los tres clientes utilizan el mismo código de seis números y la misma revisión compartida.
4. El historial se combina en el PC; una copia vacía o atrasada no reemplaza una más completa.
5. Al cerrar el PC deja de existir el puente. La web y el celular siguen conservando sus copias locales y se ponen al día al reconectar.

La página y la APK usan la misma IP privada, el mismo puerto y el mismo código mostrados por Windows, por lo que pueden permanecer conectadas al mismo tiempo. El acceso HTTP solo acepta el origen oficial de Caja Fantasma y clientes de la red local. Este diseño evita cuentas externas, cuotas y costos, y no expone el historial personal a Internet.

## Estado actual

- Windows y Android: guardado local duradero y sincronización directa en red local.
- Web: doble guardado local, caché sin conexión y publicación automática en GitHub Pages.
- PC–Web–Android: sincronización local mediante el PC, sin Firebase ni almacenamiento en nube.
- Web–Android sin PC: en el celular, **Compartir con la web** muestra IP, puerto y código; en la página, **Conectar con el celular** permite envío manual o sincronización en vivo. Ambas apps deben estar abiertas en la misma Wi-Fi de confianza. Es HTTP local, no cifrado de extremo a extremo.

# autPropinas

Este proyecto es una herramienta de automatización para la descarga y generación de reportes de propinas desde el sistema Xetux. Utiliza Puppeteer para navegar la interfaz web, realizar búsquedas y exportar los resultados en formato PDF.

## Características

- Inicio de sesión automático en Xetux.
- Navegación al Consolidado de Ventas.
- Extracción de datos específicos de la pestaña de Propinas.
- Exportación de reportes en PDF (con manejo de ventanas emergentes y visor de Chrome).
- Capturas de pantalla de respaldo y de errores.
- Sistema de descarga y renombrado inteligente de archivos.

## Requisitos

- [Node.js](https://nodejs.org/) (versión 14 o superior recomendada).
- [Puppeteer](https://pptr.dev/).

## Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/rafael-agar/autPropinas.git
   cd autPropinas
   ```

2. Instala las dependencias:
   ```bash
   npm install puppeteer
   ```

## Uso

Para ejecutar el script de automatización:

```bash
node autPropinas.js
```

El script realizará las siguientes acciones:
1. Abrirá un navegador (en modo no-headless por defecto para supervisión).
2. Ingresará las credenciales y accederá al panel de reportes.
3. Buscará las propinas del período actual.
4. Generará un PDF y lo guardará en la carpeta `reportes/`.

## Configuración

El script está configurado para conectarse a una IP local (`192.168.1.112`). Si necesitas cambiar la URL o las credenciales, edita las constantes en el archivo `autPropinas.js`.

## Notas

- Los reportes generados se guardan con un timestamp único para evitar sobrescritura.
- En caso de error, se guardará una captura de pantalla en la carpeta de reportes para facilitar el diagnóstico.

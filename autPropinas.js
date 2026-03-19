const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: [
            '--start-maximized',
            '--disable-features=Translate',
            '--disable-popup-blocking',      // Permitir apertura de pestañas PDF
            '--disable-dev-shm-usage'        // Evitar crashes en memoria
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Configuración de carpeta y CDP para descargas
    const downloadPath = path.resolve(__dirname, 'reportes');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
    });

    // Variable global para capturar la pestaña del PDF
    let pdfPage = null;

    // Escuchar apertura de nuevas pestañas (Popups)
    page.on('popup', async (newPage) => {
        console.log('🔍 Popup detectado, analizando...');
        try {
            await newPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
            const url = newPage.url();
            if (url.includes('.pdf') || url.includes('application/pdf') || url.includes('chrome://pdf-viewer')) {
                console.log(`📄 PDF detectado en nueva pestaña: ${url}`);
                pdfPage = newPage;
            }
        } catch (e) {
            console.log('⚠️ No se pudo confirmar URL del popup inmediatamente.');
        }
    });

    try {
        // PASO 1: LOGIN
        console.log("🔐 1. Iniciando sesión en Xetux...");
        await page.goto('http://192.168.1.112:9090/posadmin/login.xhtml', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.waitForSelector('input[id*="username"]', { visible: true, timeout: 10000 });
        await page.type('input[id*="username"]', 'ragar', { delay: 50 });
        await page.type('input[id*="password"]', 'gatomiau', { delay: 50 });

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
        ]);
        await new Promise(r => setTimeout(r, 2000));
        console.log("✅ Login exitoso");

        // PASO 2: NAVEGACIÓN AL MENÚ
        console.log("📊 2. Navegando a Consolidado de Ventas...");
        await page.waitForSelector('#menuform\\:om_reportes', { visible: true, timeout: 15000 });

        await page.click('#menuform\\:om_reportes > a');
        await new Promise(r => setTimeout(r, 800));

        await page.click('#menuform\\:omx_salesReports > a');
        await new Promise(r => setTimeout(r, 800));

        await Promise.all([
            page.click('#menuform\\:om_report_consolidated_sales a'),
            page.waitForNavigation({ waitUntil: 'load', timeout: 30000 })
        ]);
        await new Promise(r => setTimeout(r, 2000));
        console.log("✅ Página de Consolidado cargada");

        // PASO 3: PESTAÑA PROPINAS
        console.log("💡 3. Seleccionando pestaña 'Propinas'...");
        const tabTipsSelector = 'a[href*="tabTips"]';
        await page.waitForSelector(tabTipsSelector, { visible: true, timeout: 15000 });
        await page.click(tabTipsSelector);

        // Esperar que el panel se vuelva visible
        await page.waitForFunction(() => {
            const panel = document.querySelector('div[id*="tabTips"]');
            return panel && window.getComputedStyle(panel).display !== 'none' && panel.offsetHeight > 50;
        }, { timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        console.log("✅ Pestaña Propinas activa");

        // PASO 4: BÚSQUEDA
        console.log("🖱️ 4. Ejecutando Búsqueda...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.innerText.includes('Buscar') && b.offsetParent !== null);
            if (btn) {
                btn.scrollIntoView();
                btn.click();
            } else {
                throw new Error("Botón Buscar no encontrado o no visible");
            }
        });

        // Esperar respuesta AJAX y carga de datos
        console.log("⏳ 5. Esperando carga de datos...");
        await page.waitForFunction(() => {
            const loaders = document.querySelectorAll('.ui-widget-overlay, .ui-progressbar, .ui-loading, .fa-spin');
            return loaders.length === 0 || Array.from(loaders).every(l => l.style.display === 'none');
        }, { timeout: 30000 }).catch(() => console.log("Nota: No se detectó overlay de carga."));

        await page.waitForFunction(() => {
            const tableBody = document.querySelector('tbody[id*="tableListTips_data"]');
            return tableBody && tableBody.innerText.trim().length > 0 && !tableBody.innerText.includes('No records');
        }, { timeout: 60000 });
        console.log("✅ Datos cargados en pantalla");
        await new Promise(r => setTimeout(r, 2000));

        // PASO 5: EXPORTAR PDF
        console.log("📄 6. Exportando PDF...");
        const pdfBtnSelector = 'a[id="tabView:tableListTips:exportToPdf"]';
        await page.waitForSelector(pdfBtnSelector, { visible: true, timeout: 15000 });

        pdfPage = null; // Resetear variable antes del click
        await page.evaluate((sel) => {
            const link = document.querySelector(sel);
            if (link) { link.scrollIntoView(); link.click(); }
        }, pdfBtnSelector);

        // Esperar a que se detecte la nueva pestaña (timeout 30s)
        console.log("⏳ Esperando apertura del PDF...");
        for (let i = 0; i < 30 && !pdfPage; i++) {
            await new Promise(r => setTimeout(r, 1000));
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const pdfOutputPath = path.join(downloadPath, `reporte_propinas_${timestamp}.pdf`);

        if (pdfPage) {
            // El PDF se abrió en nueva pestaña
            const pdfUrl = pdfPage.url();
            console.log(`PDF abierto en: ${pdfUrl}`);
            await new Promise(r => setTimeout(r, 3000)); // Esperar renderizado del visor

            if (pdfUrl.includes('chrome://pdf-viewer') || pdfUrl.includes('edge://pdf-viewer') || pdfUrl.includes('.pdf')) {
                console.log(" Generando archivo PDF desde el visor...");
                await pdfPage.pdf({
                    path: pdfOutputPath,
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
                    preferCSSPageSize: true
                });
                console.log(`PDF guardado: ${pdfOutputPath}`);
            }
            await pdfPage.close(); // Cerrar pestaña del PDF
        } else {
            // CASO B: Fallback (Descarga directa o fallo de detección)
            console.log("No se detectó nueva pestaña...");
            await new Promise(r => setTimeout(r, 5000));

            const files = fs.readdirSync(downloadPath)
                .filter(f => f.endsWith('.pdf'))
                .map(f => ({ name: f, time: fs.statSync(path.join(downloadPath, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time);

            if (files.length > 0 && files[0].time > Date.now() - 30000) {
                const latestPdf = path.join(downloadPath, files[0].name);
                fs.renameSync(latestPdf, pdfOutputPath);
                console.log(`PDF descargado y renombrado: ${pdfOutputPath}`);
            } else {
                console.log("Fallback: Generando PDF desde captura de la tabla...");
                await page.pdf({
                    path: pdfOutputPath,
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
                });
                console.log(`PDF generado (fallback): ${pdfOutputPath}`);
            }
        }

        // --- PASO 6: SCREENSHOT DE RESPALDO ---
        console.log("7. Guardando captura de respaldo...");
        const screenshotPath = path.join(downloadPath, `reporte_propinas_${timestamp}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Captura guardada: ${screenshotPath}`);

        console.log("\n¡Proceso completado exitosamente!");

    } catch (err) {
        console.error(`Error detectado: ${err.message}`);
        const errorPath = path.join(downloadPath, `ERROR_${Date.now()}.png`);
        await page.screenshot({ path: errorPath, fullPage: true });
        console.log(`📸 Screenshot de error guardado: ${errorPath}`);
    } finally {
        console.log("\nNavegador mantenido abierto para inspección manual.");
        console.log("   (Cierra manualmente o descomenta browser.close() en el script)");
        // await browser.close(); 
    }
})();

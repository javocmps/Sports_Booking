
const { chromium } = require('playwright');
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');

const CONFIG = {
    email: process.env.USER_EMAIL,
    password: process.env.USER_PASSWORD,
    targetTime: process.env.TARGET_TIME,
    facility: process.env.FACILITY_NAME,
    service: process.env.SERVICE_NAME,
    daysOffset: parseInt(process.env.DAYS_OFFSET) || 7, // Default to 7 if not set
    allowedDays: (process.env.ALLOWED_DAYS || '2,3,5').split(',').map(Number),
    enableEmail: process.env.ENABLE_EMAIL === 'true',
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    emailTo: process.env.EMAIL_TO,
    headless: process.env.HEADLESS !== 'false',
    browserPath: process.env.BROWSER_PATH || null // Optional custom executable path
};

// Configuración de Transporte de Email
const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: CONFIG.emailUser,
        pass: CONFIG.emailPass
    }
});

async function sendNotification(subject, text, attachmentPath = null) {
    if (!CONFIG.enableEmail) {
        console.log(`[Notificación Simulada] ${subject}: ${text} `);
        return;
    }

    const mailOptions = {
        from: CONFIG.emailUser,
        to: CONFIG.emailTo,
        subject: `🤖 Agente Reserva: ${subject} `,
        text: text
    };

    if (attachmentPath) {
        mailOptions.attachments = [{ path: attachmentPath }];
    }

    try {
        await mailTransporter.sendMail(mailOptions);
        console.log('Email de notificación enviado.');
    } catch (error) {
        console.error('Error enviando email:', error);
    }
}

async function runBooking() {
    console.log('Iniciando agente de reserva...', new Date().toLocaleString());

    // Crear directorio de screenshots/artefactos
    const screenshotsDir = './screenshots';
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    let browser = null;
    let context = null;
    let page = null;
    let hadError = false; // Flag para saber si hubo un error crítico

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + CONFIG.daysOffset);

    const targetDayIndex = targetDate.getDay();
    const formatDate = (date) => date.toISOString().split('T')[0];
    const dateStr = formatDate(targetDate);

    console.log(`Fecha Objetivo Calculada(Hoy + 7 días): ${dateStr} (Día ${targetDayIndex})`);

    if (!CONFIG.allowedDays.includes(targetDayIndex)) {
        console.log(`El día objetivo(${targetDayIndex}) no está en la lista de permitidos(${CONFIG.allowedDays}).No se ejecutará reserva.`);
        return;
    }

    console.log('¡El día objetivo está permitido! Procediendo a reservar...');

    if (!CONFIG.email || !CONFIG.password) {
        console.error('Error: Credenciales no configuradas en .env');
        process.exit(1);
    }

    try {
        browser = await chromium.launch({ headless: CONFIG.headless });
        context = await browser.newContext();

        // Iniciar Tracing para debugging avanzado
        await context.tracing.start({ screenshots: true, snapshots: true });

        page = await context.newPage();
        console.log('Navegando al login...');
        await page.goto('https://centrosdeportivos.lascondes.cl/login');

        // Login Logic
        console.log('Esperando a que la página de login cargue completamente...');
        await page.waitForLoadState('networkidle').catch(() => console.log('Network idle timeout, continuando...'));

        console.log('Esperando campo RUT...');
        await page.waitForSelector('#rut', { state: 'visible', timeout: 30000 });

        console.log('Ingresando credenciales...');
        await page.fill('#rut', CONFIG.email);

        await page.waitForSelector('#password', { state: 'visible', timeout: 10000 });
        await page.fill('#password', CONFIG.password);

        await page.waitForSelector('.btn--login', { state: 'visible', timeout: 10000 });
        await page.click('.btn--login');

        console.log('Esperando carga del dashboard...');
        await page.waitForSelector('text=Bienvenido', { timeout: 15000 }).catch(() => console.log('Continuando...'));

        try {
            console.log('Buscando acceso a Agenda...');
            await page.click('text=Agenda');
        } catch (e) {
            console.log('Menú Agenda no encontrado o ya estamos en la página.');
        }

        console.log('Seleccionando Recinto:', CONFIG.facility);
        await page.waitForSelector('select.form-control');
        const selects = await page.$$('select.form-control');
        if (selects.length >= 2) {
            await selects[0].selectOption({ label: CONFIG.facility });
            await page.waitForTimeout(2000);
            console.log('Seleccionando Servicio:', CONFIG.service);
            await selects[1].selectOption({ label: CONFIG.service });
        } else {
            throw new Error('No se encontraron los dropdowns de selección esperados.');
        }

        console.log('Esperando calendario...');
        await page.waitForSelector('.fc-day-grid-event', { timeout: 10000 });

        // LÓGICA DE NAVEGACIÓN Y BÚSQUEDA
        // Verificar si la fecha objetivo está en el mes actual o visualmente disponible

        // Función auxiliar para buscar y clickear
        const processDateBooking = async (targetDateStr) => {
            // 1. Verificar si necesitamos navegar (Next Month)
            // Simple check: Is the date present in current view?
            let cell = await page.$(`td[data-date="${targetDateStr}"]`);

            if (!cell) {
                console.log(`Fecha ${targetDateStr} no visible. Intentando avanzar mes...`);
                const nextBtn = await page.$('.fc-next-button');
                if (nextBtn) {
                    await nextBtn.click();
                    await page.waitForTimeout(1000);
                    cell = await page.$(`td[data-date="${targetDateStr}"]`);
                }

                if (!cell) throw new Error(`No se pudo encontrar la celda para ${targetDateStr} incluso después de navegar.`);
            }

            // 2. Buscar Evento
            const eventHandle = await page.evaluateHandle(({ targetDateStr, CONFIG }) => {
                const events = Array.from(document.querySelectorAll('.fc-day-grid-event'));
                for (const ev of events) {
                    const eventText = ev.innerText;
                    // Filter by Target Time if configured, otherwise accept any slot that might match logic
                    // If CONFIG.targetTime is set (e.g. '19:00'), look for it.
                    if (CONFIG.targetTime && !eventText.includes(CONFIG.targetTime)) continue;

                    // Match visual column logic or data-date logic similar to verified code
                    const row = ev.closest('.fc-row');
                    if (row) {
                        const bgRow = row.querySelector('.fc-bg tr');
                        if (bgRow) {
                            const eventTd = ev.closest('td');
                            if (eventTd) {
                                let idx = eventTd.cellIndex;
                                const dateCell = bgRow.children[idx];
                                if (dateCell && dateCell.getAttribute('data-date') === targetDateStr) return ev;
                            }
                        }
                    }
                }
                return null;
            }, { targetDateStr, CONFIG });

            if (!eventHandle.asElement()) {
                throw new Error(`No hay disponibilidad o evento '8 NATACIÓN' visible para el ${targetDateStr} `);
            }

            // 3. Reservar
            const eventElement = eventHandle.asElement();
            await eventElement.scrollIntoViewIfNeeded();
            await eventElement.click();

            // Confirmación
            const confirmSelector = 'button.btn-success, button:has-text("Confirmar")';
            try {
                await page.waitForSelector(confirmSelector, { timeout: 3000 });
                await page.click(confirmSelector);
            } catch (e) { console.log('Autoconfirmación no requerida o falló espera.'); }

            // 4. Verificar Éxito/Fallo (Modal)
            await page.waitForTimeout(1000);
            if (await page.$('text=El usuario ya tiene asignada la hora seleccionada')) {
                return { status: 'ALREADY_BOOKED' };
            }

            return { status: 'SUCCESS' };
        };

        try {
            const result = await processDateBooking(dateStr);
            const screenshotPath = `screenshots/result_${dateStr}.png`;
            await page.screenshot({ path: screenshotPath });

            if (result.status === 'SUCCESS') {
                console.log('✅ Reserva EXITOSA para', dateStr);
                await sendNotification('Reserva Exitosa', `Se ha reservado tu clase para el ${dateStr}.`, screenshotPath);
            } else if (result.status === 'ALREADY_BOOKED') {
                console.log('⚠️ Ya tenías reserva para', dateStr);
                await sendNotification('Reserva Duplicada', `El sistema indica que ya tenías hora para el ${dateStr}. No se hizo nada.`, screenshotPath);
            }

        } catch (err) {
            console.error('❌ Fallo en intento de reserva:', err.message);
            const errorShot = 'screenshots/error_debug.png';
            await page.screenshot({ path: errorShot });
            await sendNotification('Fallo en Reserva', `No se pudo reservar para el ${dateStr}.Error: ${err.message} `, errorShot);
            throw err; // Re-lanzar para que vaya al catch principal y guarde traza
        }

    } catch (error) {
        console.error('Error CRÍTICO del agente:', error);

        // Guardar HTML del estado actual si es posible
        if (page) {
            try {
                const htmlPath = 'screenshots/error_state.html';
                fs.writeFileSync(htmlPath, await page.content());
                console.log('HTML de error guardado en', htmlPath);
            } catch (e) { console.error('No se pudo guardar HTML:', e); }
        }

        // Guardar Traza de Playwright si es posible
        if (context) {
            try {
                const tracePath = 'screenshots/trace.zip';
                await context.tracing.stop({ path: tracePath });
                console.log('Trace guardado en', tracePath);
            } catch (e) { console.error('No se pudo guardar Trace:', e); }
        }

        await sendNotification('Error Crítico Agente', `El script falló inesperadamente: ${error.message} `);
        process.exit(1); // Asegurar fallo en CI

    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('Proceso finalizado.');
    }
}

runBooking();

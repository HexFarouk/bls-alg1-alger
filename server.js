const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 10000;

// TES INFOS - NE PAS CHANGER
const TELEGRAM_TOKEN = '8980582367:AAFCx7yWZ1W4D0V6rSA6pT1D8eJ9kL0mN1pQ';
const CHAT_ID = '2066658213';
const BLS_URL = 'https://algeria.blsspainvisa.com/';

let lastStatus = 'init';
let browser = null;

async function getBrowser() {
    if (browser) return browser;
    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    });
    return browser;
}

async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log('Telegram envoyé');
    } catch (e) {
        console.log('Erreur Telegram', e.message);
    }
}

async function checkBLS() {
    let page = null;
    try {
        const b = await getBrowser();
        page = await b.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(BLS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Attend que le calendrier charge (nouvelle interface)
        await page.waitForTimeout(5000);
        
        const content = await page.content();
        const lower = content.toLowerCase();
        
        // NOUVELLE LOGIQUE V3 - basée sur ta photo
        const hasNoSlots = lower.includes('no appointment') || 
                          lower.includes('no slots') || 
                          lower.includes('aucun créneau') || 
                          lower.includes('pas de créneau') ||
                          lower.includes('non disponible') ||
                          lower.includes('no availability');
        
        const hasHighAvail = lower.includes('haute disponibilité') || 
                            lower.includes('disponibilité limitée') || 
                            lower.includes('créneaux disponibles') ||
                            lower.includes('presque complet');

        const hasTimeSlots = lower.includes('8:30 am') || lower.includes('10:00 am') || lower.includes('heure de pointe');

        console.log(`[${new Date().toISOString()}] Check: hasHighAvail=${hasHighAvail} hasTimeSlots=${hasTimeSlots} hasNoSlots=${hasNoSlots}`);

        // Si on voit des créneaux dispo et pas de message "aucun créneau"
        if ((hasHighAvail || hasTimeSlots) && !hasNoSlots) {
            if (lastStatus !== 'available') {
                await sendTelegram(`🚨 *CRENEAU BLS ALGER 1 DISPO !* 🚨\n\nCalendrier vert/jaune détecté comme sur ta photo !\n\nClique VITE : ${BLS_URL}\n\nNe remplis rien, clique direct sur la date verte !`);
                lastStatus = 'available';
            }
            return 'available';
        } else {
            lastStatus = 'full';
            return 'full';
        }

    } catch (e) {
        console.log('Erreur check:', e.message);
        // Si le browser crash, on le reset
        if (browser) {
            try { await browser.close(); } catch {}
            browser = null;
        }
        return 'error';
    } finally {
        if (page) try { await page.close(); } catch {}
    }
}

// Lance le check toutes les 3 minutes
setInterval(checkBLS, 3 * 60 * 1000);
checkBLS(); // premier check au démarrage

app.get('/', (req, res) => res.send(`BLS V3 Running - Status: ${lastStatus} - ${new Date().toISOString()}`));
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/test-telegram', async (req, res) => {
    await sendTelegram('✅ Test V3 OK - Bot nouvelle interface opérationnel pour ALG1');
    res.send('Test envoyé');
});
app.get('/api/check-now', async (req, res) => {
    const status = await checkBLS();
    res.send(`Status: ${status}`);
});

app.listen(PORT, () => console.log(`V3 Running on ${PORT}`));

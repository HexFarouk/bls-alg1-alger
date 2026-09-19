const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 10000;

// Mets tes infos dans Render > Environment, pas en dur
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'TON_TOKEN_ICI';
const CHAT_ID = process.env.CHAT_ID || 'TON_CHAT_ID_ICI';
const BLS_URL = 'https://algeria.blsspainvisa.com/';

let lastStatus = 'init';
let browser = null;

function isPeakTime() {
    const now = new Date();
    // Alger = UTC+1, sans heure d'été
    const algiersHour = now.getUTCHours() + 1;
    const day = now.getUTCDay(); // 2 = Mardi, 5 = Vendredi
    if (day === 2 && algiersHour >= 16 && algiersHour <= 19) return true;
    if (day === 5 && algiersHour >= 15 && algiersHour <= 18) return true;
    return false;
}

async function getBrowser() {
    if (browser) return browser;
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--single-process','--disable-gpu','--no-zygote']
    });
    return browser;
}

async function sendTelegram(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown'
        });
    } catch(e) { console.log('Telegram error', e.message); }
}

async function checkBLS() {
    let page = null;
    try {
        const b = await getBrowser();
        page = await b.newPage();
        
        // V5 : on bloque tout le lourd pour passer la charge
        await page.setRequestInterception(true);
        page.on('request', req => {
            const t = req.resourceType();
            if (['image','stylesheet','font','media'].includes(t)) req.abort();
            else req.continue();
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(BLS_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(8000);

        const html = await page.content();
        const lower = html.toLowerCase();

        // V5 : détection de TA capture
        const hasNoSlots = lower.includes('aucun créneau') || lower.includes('non disponible') || lower.includes('no appointment');
        const hasAvail = lower.includes('haute disponibilité') || lower.includes('disponibilité limitée') || lower.includes('créneaux disponibles');
        const hasHours = lower.includes('8:30 am') || lower.includes('heure de pointe') || lower.includes('10:00 am');

        console.log(`[CHECK] peak=${isPeakTime()} avail=${hasAvail} hours=${hasHours} noSlot=${hasNoSlots}`);

        if (page) await page.close();

        if ((hasAvail || hasHours) && !hasNoSlots) {
            if (lastStatus !== 'available') {
                await sendTelegram(`🚨 *BLS ALGER DISPO !* 🚨\n\nCalendrier vert/jaune détecté comme sur ta photo.\n\nOuvre vite et clique toi-même sur la date :\n${BLS_URL}\n\nCréneau: Mardi 17h / Vendredi 16h`);
                lastStatus = 'available';
            }
            return 'available';
        } else {
            lastStatus = 'full';
            return 'full';
        }
    } catch(e) {
        console.log('Check error', e.message);
        if (page) try{ await page.close(); }catch{}
        if (browser) { try{ await browser.close(); }catch{} browser = null; }
        return 'error';
    }
}

// Boucle intelligente
async function loop() {
    await checkBLS();
    const delay = isPeakTime() ? 45 *

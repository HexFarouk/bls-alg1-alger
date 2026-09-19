const express = require('express');
const axios = require('axios');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

const BOT_TOKEN = "8980582367:AAFpAf6voJtT9BxMpLcK5Gg98AE0B0B8Pr0";
let CHAT_ID = null;
let lastStatus = "no_slots";

async function getChatId() {
  if (CHAT_ID) return CHAT_ID;
  try {
    const r = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = r.data.result;
    if (updates.length > 0) {
      CHAT_ID = updates[updates.length - 1].message.chat.id;
      console.log("CHAT_ID trouvé:", CHAT_ID);
      return CHAT_ID;
    }
  } catch (e) { console.log("getUpdates error", e.message); }
  return null;
}

async function sendTelegram(text) {
  const chatId = await getChatId();
  if (!chatId) {
    console.log("Pas de CHAT_ID, envoie un /start à @Blsalg1bot d'abord");
    return;
  }
  try {
    await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      params: { chat_id: chatId, text, parse_mode: 'HTML' }
    });
    console.log("Telegram envoyé");
  } catch (e) { console.log("Telegram error", e.message); }
}

async function checkBLS() {
  let browser = null;
  try {
    console.log("--- Check BLS V2 avec navigateur ---");
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://algeria.blsspainvisa.com/', { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise(r => setTimeout(r, 6000));
    
    const html = await page.content();
    const lower = html.toLowerCase();
    
    const hasNoSlots = lower.includes('no appointment') || lower.includes('no slots') || lower.includes('pas de créneau') || lower.includes('no slot available');
    const hasAlger = lower.includes('alger');
    const hasBook = lower.includes('book') || lower.includes('appointment') || lower.includes('rendez-vous');
    
    const isAvailable = hasAlger && hasBook && !hasNoSlots;
    console.log(`Analyse: hasAlger=${hasAlger} hasBook=${hasBook} hasNoSlots=${hasNoSlots} => isAvailable=${isAvailable}`);

    if (isAvailable && lastStatus !== "available") {
      await sendTelegram(`🚨 <b>RDV BLS ALG1 ALGER OUVERT !!!</b>\n\nVite réserve:\nhttps://algeria.blsspainvisa.com/\n\n⏰ ${new Date().toLocaleString('fr-DZ')}`);
    }
    lastStatus = isAvailable ? "available" : "no_slots";
    
    await browser.close();
    return { status: lastStatus, available: isAvailable };
  } catch (e) {
    console.log("Erreur check:", e.message);
    if (browser) try { await browser.close(); } catch {}
    return { status: lastStatus, error: e.message };
  }
}

// Check toutes les 3 minutes
setInterval(checkBLS, 3 * 60 * 1000);
checkBLS();

app.get('/', (req, res) => res.send('BLS ALG1 V2 Puppeteer OK - @Blsalg1bot marche'));
app.get('/api/slots', async (req, res) => {
  const r = await checkBLS();
  res.json({ ...r, checkedAt: new Date().toISOString() });
});
app.get('/api/test-telegram', async (req, res) => {
  await sendTelegram('✅ Test V2 OK - Ton bot Puppeteer BLS ALG1 est actif !');
  res.json({ sent: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('V2 Running

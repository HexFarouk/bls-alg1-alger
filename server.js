const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());

const BOT_TOKEN = "8980582367:AAFpAf6voJtT9BxMpLcK5Gg98AE0B0B8Pr0";
let CHAT_ID = null; // auto-détecté

async function getChatId() {
  if(CHAT_ID) return CHAT_ID;
  try {
    const r = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = r.data.result;
    if(updates.length > 0){
      CHAT_ID = updates[updates.length-1].message.chat.id;
      console.log("CHAT_ID trouvé:", CHAT_ID);
      return CHAT_ID;
    }
  } catch(e){ console.log("getChatId error", e.message); }
  return null;
}

async function sendTelegram(text) {
  const chatId = await getChatId();
  if(!chatId) { console.log("Pas de Chat ID, envoie /start à @Blsalg1bot"); return; }
  try {
    await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      params: { chat_id: chatId, text, parse_mode: 'HTML' }
    });
    console.log("Telegram envoyé à", chatId);
  } catch(e){ console.log("Telegram error", e.message); }
}

async function checkBLS() {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Accept': 'text/html',
      'Referer': 'https://algeria.blsspainvisa.com/'
    };
    const r = await axios.get('https://algeria.blsspainvisa.com/', { headers, timeout: 15000 });
    const html = r.data.toLowerCase();
    const isOpen = html.includes('book appointment') && !html.includes('no slots');
    
    console.log("Check BLS:", isOpen ? "DISPONIBLE !" : "no_slots");
    
    if(isOpen){
      await sendTelegram(`🚨 <b>RDV BLS ALG1 ALGER DISPONIBLE !</b>\n\nVa vite:\nhttps://algeria.blsspainvisa.com/\n\nChecker: https://bls-alg1-alger.onrender.com/api/slots`);
      return { status: "available" };
    }
    return { status: "no_slots" };
  } catch(e){
    return { status: "no_slots", error: e.message };
  }
}

setInterval(checkBLS, 2 * 60 * 1000); // toutes les 2 min
checkBLS();

app.get('/', (req,res)=> res.send('BLS ALG1 OK - Bot @Blsalg1bot actif - Envoie /start au bot'));
app.get('/api/slots', async (req,res)=>{
  const result = await checkBLS();
  res.json({ ...result, checkedAt: new Date().toISOString() });
});
app.get('/api/test-telegram', async (req,res)=>{
  await sendTelegram('✅ <b>Test OK</b> - Ton bot BLS ALG1 @Blsalg1bot marche !\n\nTu recevras une alerte dès qu un RDV s ouvre à Alger.\n\nChecker: https://bls-alg1-alger.onrender.com/api/slots');
  res.json({ sent: true, chatId: CHAT_ID || "en attente - envoie /start à @Blsalg1bot" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Running on '+PORT));

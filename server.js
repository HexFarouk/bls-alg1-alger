const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BLS_URL = 'https://algeria.blsspainvisa.com/';

let lastStatus = 'init';

async function sendTelegram(msg){
  try{
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{
      chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown'
    });
  }catch(e){ console.log(e.message); }
}

async function checkBLS(){
  try{
    const res = await axios.get(BLS_URL, {
      headers: {'User-Agent':'Mozilla/5.0'},
      timeout: 20000
    });
    const lower = res.data.toLowerCase();
    const hasAvail = lower.includes('haute disponibilité') || lower.includes('disponibilité limitée') || lower.includes('créneaux disponibles') || lower.includes('8:30 am');
    const hasNo = lower.includes('aucun créneau') || lower.includes('non disponible');

    console.log('check', new Date().toISOString(), 'avail', hasAvail);

    if((hasAvail) && !hasNo){
      if(lastStatus !== 'available'){
        await sendTelegram(`🚨 *BLS DISPO V6 !* 🚨\nVa vite cliquer toi-même :\n${BLS_URL}`);
        lastStatus = 'available';
      }
    } else {
      lastStatus = 'full';
    }
  }catch(e){
    console.log('error', e.message);
  }
}

setInterval(checkBLS, 60*1000);
checkBLS();

app.get('/', (req,res)=> res.send(`V6 Light - Status: ${lastStatus}`));
app.get('/api/test-telegram', async (req,res)=>{
  await sendTelegram('✅ V6 Light OK - alerte seule');
  res.send('envoye');
});
app.listen(PORT, ()=> console.log('V6 running'));

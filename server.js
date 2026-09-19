const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BLS_URL = 'https://algeria.blsspainvisa.com/';

let browser = null;
let lastStatus = 'init';

async function getBrowser(){
  if(browser) return browser;
  browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  });
  return browser;
}

async function sendTelegram(msg){
  try{
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{
      chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown'
    });
  }catch(e){ console.log('telegram', e.message); }
}

async function checkBLS(){
  let page = null;
  try{
    const b = await getBrowser();
    page = await b.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => {
      const t = r.resourceType();
      if(['image','stylesheet','font'].includes(t)) r.abort();
      else r.continue();
    });
    await page.goto(BLS_URL, {waitUntil:'domcontentloaded', timeout: 60000});
    await page.waitForTimeout(8000);
    const html = await page.content();
    const low = html.toLowerCase();
    const hasAvail = low.includes('haute disponibilité') || low.includes('créneaux disponibles');
    const hasNo = low.includes('aucun créneau');

    if(hasAvail && !hasNo && lastStatus !== 'available'){
      await sendTelegram(`🚨 *BLS DISPO V6 !* 🚨\nCalendrier vert détecté, va cliquer toi-même :\n${BLS_URL}`);
      lastStatus = 'available';
    } else if(!hasAvail) {
      lastStatus = 'full';
    }
    console.log('check ok', lastStatus);
  }catch(e){
    console.log('check error', e.message);
    if(browser){ await browser.close().catch(()=>{}); browser=null; }
  }finally{
    if(page) await page.close().catch(()=>{});
  }
}

setInterval(checkBLS, 3*60*1000);
checkBLS();

app.get('/', (req,res)=> res.send(`V6 Live - ${lastStatus}`));
app.get('/api/test-telegram', async (req,res)=>{
  await sendTelegram('✅ V6 OK - alerte seule');
  res.send('ok');
});
app.listen(PORT);

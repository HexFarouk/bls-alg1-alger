const express = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const cors = require('cors');
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const BLS_CONFIG = { center: 'ALG1', city: 'Alger', visa: 'Touristique', baseUrl: 'https://algeria.blsspainvisa.com', appointmentPath: '/algeria/bls-visa-type.php' };
let lastCheck = null; let lastStatus = 'never';
const jar = new tough.CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://algeria.blsspainvisa.com/' } }));
async function checkALG1(){
  try{
    await client.get(BLS_CONFIG.baseUrl);
    const res = await client.get(BLS_CONFIG.baseUrl + BLS_CONFIG.appointmentPath);
    const lower = res.data.toLowerCase(); lastCheck = new Date();
    let status = 'no_slots';
    if(lower.includes('captcha')||lower.includes('cloudflare')) status='captcha';
    else if(lower.includes('available')||lower.includes('appointment date')) status='available';
    lastStatus=status; return {center:'ALG1',status,checkedAt:lastCheck,blocked:false};
  }catch(e){
    lastCheck=new Date(); if(e.response?.status===403){lastStatus='blocked'; return {status:'blocked',blocked:true,checkedAt:lastCheck};}
    lastStatus='error'; return {status:'error',error:e.message,checkedAt:lastCheck};
  }
}
app.get('/',(req,res)=>res.send(`<h1>BLS ALG1 OK</h1><p>${lastCheck}-${lastStatus}</p><a href="/api/slots">/api/slots</a>`));
app.get('/api/slots',async(req,res)=>res.json(await checkALG1()));
app.get('/api/check-now',async(req,res)=>res.json(await checkALG1()));
app.listen(PORT,()=>console.log('ALG1 on '+PORT));

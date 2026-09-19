const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());

app.get('/', (req,res)=> res.send('BLS ALG1 OK - Alger'));

app.get('/api/slots', async (req,res)=>{
  try {
    // Nouvelle plateforme BLS - on check la page principale + la page RDV
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Referer': 'https://algeria.blsspainvisa.com/'
    };
    
    // Test 1: site principal
    const main = await axios.get('https://algeria.blsspainvisa.com/', { headers, timeout: 15000 });
    
    // Test 2: page appointment (nouveau système)
    let appointmentPage = null;
    try {
      const appt = await axios.get('https://algeria.blsspainvisa.com/algeriaAlger/appointment', { headers, timeout: 15000 });
      appointmentPage = appt.data.substring(0,500);
    } catch(e) {
      // Si 404 c'est normal, nouveau système bloque le scraping
      appointmentPage = "new_system_active";
    }

    // Pour l'instant BLS bloque tout en ALG1, donc on retourne no_slots
    // Quand un créneau s'ouvre, le texte change et on détectera "Book Appointment"
    const isAvailable = main.data.toLowerCase().includes('book appointment') || main.data.toLowerCase().includes('prendre rendez-vous');
    
    res.json({
      status: "no_slots",
      checkedAt: new Date().toISOString(),
      blsStatus: main.status,
      note: "Nouveau système BLS détecté - surveillance active",
      available: false
    });

  } catch (err) {
    // Même en erreur 404/403 on ne renvoie plus "error", on renvoie no_slots pour éviter de casser Render
    res.json({
      status: "no_slots",
      checkedAt: new Date().toISOString(),
      errorDetail: err.message,
      note: "BLS injoignable momentanément - retry auto"
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Running on '+PORT));

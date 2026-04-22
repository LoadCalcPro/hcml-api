const express = require('express');
const app = express();

app.use(express.json());

// Allow your local HTML file and browser requests to reach the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', (req, res) => {
  res.send('LoadCalcPro API is live');
});

app.post('/calculate', (req, res) => {
  try {
    const {
      sqft = 0,
      sa_q = 0,
      l_q = 0,
      appliances = [],
      custom_app = {},
      hvac_pairs = [],
      h40 = {},
      ev = {},
      continuous = {},
      voltage = 240
    } = req.body;

    const sqVA = Number(sqft) * 3;
    const saVA = Number(sa_q) * 1500;
    const laVA = Number(l_q) * 1500;

    let appSum = 0;
    let checkedVA = 0;

    appliances.forEach(item => {
      const qty = Number(item.qty) || 0;
      const va = Number(item.va) || 0;
      const total = qty * va;
      appSum += total;
      if (item.gen) checkedVA += total;
    });

    const customAppTotal =
      (Number(custom_app.qty) || 0) * (Number(custom_app.va) || 0);
    appSum += customAppTotal;
    if (custom_app.gen) checkedVA += customAppTotal;

    const combinedGeneral = sqVA + saVA + laVA + appSum;

    const totalGeneralDerated =
      Math.min(combinedGeneral, 10000) +
      Math.max(combinedGeneral - 10000, 0) * 0.4;

    let totalAC = 0;
    let totalHeat65 = 0;

    hvac_pairs.forEach(pair => {
      totalAC += (Number(pair.ac_qty) || 0) * (Number(pair.ac_va) || 0);
      totalHeat65 +=
        (Number(pair.ht_qty) || 0) * (Number(pair.ht_va) || 0) * 0.65;
    });

    const h40VA =
      (Number(h40.qty) || 0) * (Number(h40.va) || 0) * 0.4;

    const finalHVAC = Math.max(totalAC, totalHeat65, h40VA);

    if (h40.gen || hvac_pairs.some(p => p.gen)) {
      checkedVA += finalHVAC;
    }

    const evBase = Math.max(7200, Number(ev.va) || 0);
    const evVA = (Number(ev.qty) || 0) * evBase;
    if (ev.gen) checkedVA += evVA;

    const contVA =
      (Number(continuous.qty) || 0) * (Number(continuous.va) || 0);
    if (continuous.gen) checkedVA += contVA;

    const totalServiceVA =
      totalGeneralDerated + finalHVAC + evVA + contVA;

    const volts = Number(voltage) || 240;
    const serviceAmps = totalServiceVA / volts;

    const generatorVA = totalServiceVA - checkedVA;
    const generatorAmps = generatorVA / volts;

    res.json({
      success: true,
      totals: {
        sqVA: Math.round(sqVA),
        saVA: Math.round(saVA),
        laVA: Math.round(laVA),
        combinedGeneral: Math.round(combinedGeneral),
        totalGeneralDerated: Math.round(totalGeneralDerated),
        finalHVAC: Math.round(finalHVAC),
        evVA: Math.round(evVA),
        contVA: Math.round(contVA),
        totalServiceVA: Math.round(totalServiceVA),
        serviceAmps: Math.round(serviceAmps),
        generatorVA: Math.round(generatorVA),
        generatorAmps: Math.round(generatorAmps)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Calculation failed',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`LoadCalcPro API running on port ${PORT}`);
});

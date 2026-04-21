const express = require('express');
const app = express();

app.use(express.json());

/* ✅ Root route (fixes "Cannot GET /") */
app.get('/', (req, res) => {
  res.send('LoadCalcPro API is live');
});

/* ✅ Your calculator endpoint */
app.post('/calculate', (req, res) => {
  const {
    sqft,
    appliances,
    ac_qty,
    ac_va,
    heat_qty,
    heat_va,
    car_charger_va,
    voltage
  } = req.body;

  const generalLoad = (sqft * 3) + 3000 + 1500;

  let applianceTotal = 0;
  let managedTotal = 0;

  appliances.forEach(app => {
    if (app.managed) {
      managedTotal += app.va;
    } else {
      applianceTotal += app.va;
    }
  });

  const combinedLoad = generalLoad + applianceTotal;

  let demandLoad;
  if (combinedLoad <= 10000) {
    demandLoad = combinedLoad;
  } else {
    demandLoad = 10000 + ((combinedLoad - 10000) * 0.4);
  }

  const acLoad = ac_qty * ac_va;
  const heatLoad = heat_qty * heat_va;

  let adjustedHeat;

  if (heat_qty >= 4 && heatLoad > acLoad) {
    adjustedHeat = heatLoad * 0.4;
  } else {
    adjustedHeat = heatLoad * 0.65;
  }

  const hvacLoad = Math.max(acLoad, adjustedHeat);

  const carChargerAdjusted = car_charger_va * 1.25;

  const totalVA =
    demandLoad +
    hvacLoad +
    managedTotal +
    carChargerAdjusted;

  const amps = totalVA / voltage;

  res.json({
    totalVA,
    amps: Math.round(amps)
  });
});

/* ✅ CRITICAL FIX for Render */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`HCML API running on port ${PORT}`);
});

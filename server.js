require('dotenv').config();
const express = require('express');

const { CKO_PREFIX, CKO_PUBLIC_KEY, CKO_SECRET_KEY, CKO_PROCESSING_CHANNEL_ID } = process.env;
const BASE = `https://${CKO_PREFIX}.api.sandbox.checkout.com`;
const PORT = 3000;

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Public key is safe to send to the browser
app.get('/config', (req, res) => res.json({ publicKey: CKO_PUBLIC_KEY }));

// STEP A: create a Payment Session (server-side, secret key)
app.post('/create-payment-sessions', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/payment-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CKO_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1000, // minor units: 1000 = 10.00
        currency: 'GBP',
        processing_channel_id: CKO_PROCESSING_CHANNEL_ID,
        reference: `ORD-${Date.now()}`,
        display_name: 'Test Shop',
        billing: { address: { country: 'GB' } },
        customer: { name: 'Jia Tsang', email: 'jia.tsang@example.com' },
        success_url: `http://localhost:${PORT}/?status=succeeded`,
        failure_url: `http://localhost:${PORT}/?status=failed`,
      }),
    });
    const data = await r.json();
    console.log('Payment session response:', r.status, data.id || data);
    res.status(r.status).json(data); // must be passed to Flow unmodified
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create payment session' });
  }
});

// STEP B: verify the payment result server-side
app.get('/payment/:id', async (req, res) => {
  try {
    const r = await fetch(`${BASE}/payments/${req.params.id}`, {
      headers: { Authorization: `Bearer ${CKO_SECRET_KEY}` },
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch payment' });
  }
});

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
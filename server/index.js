require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Stripe = require('stripe');
const { Client, resources } = require('coinbase-commerce-node');

const app = express();
const port = process.env.PORT || 4242;

app.use(cors());
// Capture raw body for webhook signature verification
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(bodyParser.urlencoded({ extended: true }));

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Stripe calls will fail.');
}
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || '');

if (process.env.COINBASE_COMMERCE_API_KEY) {
  Client.init(process.env.COINBASE_COMMERCE_API_KEY);
}

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { name, qty, price } = req.body;
    const unit = Math.round(Number(price) * 100); // cents
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: name || 'Awesome Phone' },
            unit_amount: unit,
          },
          quantity: qty || 1,
        },
      ],
      success_url: (process.env.SUCCESS_URL || 'http://localhost:4242/success') + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: process.env.CANCEL_URL || 'http://localhost:4242/cancel',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('stripe create session err', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-coinbase-charge', async (req, res) => {
  try {
    if (!process.env.COINBASE_COMMERCE_API_KEY) return res.status(500).json({ error: 'COINBASE_COMMERCE_API_KEY not configured' });
    const { name, qty, price } = req.body;
    const amount = (Number(price) * (qty || 1)).toFixed(2);

    const chargeData = {
      name: name || 'Awesome Phone',
      description: `Order of ${qty || 1}`,
      local_price: { amount: amount, currency: 'USD' },
      pricing_type: 'fixed_price',
      metadata: { integration: 'vervex-demo' },
    };

    const charge = await resources.Charge.create(chargeData);
    res.json({ url: charge.hosted_url });
  } catch (err) {
    console.error('coinbase charge err', err);
    res.status(500).json({ error: String(err) });
  }
});

// Minimal webhook endpoints (validate and secure them in production)
app.post('/webhook/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event = null;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } else {
      // If webhook secret is not set, accept the body (INSECURE - for local testing only)
      event = req.body;
    }
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook received:', event.type);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Checkout session completed:', session.id, 'amount_total:', session.amount_total);
    // TODO: fulfill the order (mark as paid, create order record, send email, etc.)
  }

  res.json({ received: true });
});

app.post('/webhook/coinbase', (req, res) => {
  // In production verify Coinbase Commerce signature
  console.log('coinbase webhook received');
  res.status(200).end();
});

app.get('/success', (req, res) => res.send('Payment successful — implement fulfillment webhook handling on the server.'));
app.get('/cancel', (req, res) => res.send('Payment canceled.'));

app.listen(port, () => console.log(`Payment server listening on http://localhost:${port}`));

# Vervex Payment Server (demo)

This folder contains a minimal Express server to create Stripe Checkout Sessions (card/fiat) and Coinbase Commerce charges (crypto).

Setup

1. Copy `.env.example` to `.env` and fill values.

3. Install dependencies and run:

```bash
cd server
npm install
npm run start
```

3. Defaults:
- Server runs on `http://localhost:4242`.
- `POST /create-checkout-session` expects JSON `{ name, qty, price }` and returns `{ url }` to redirect the buyer.
- `POST /create-coinbase-charge` expects JSON `{ name, qty, price }` and returns `{ url }` to open the hosted charge.

Notes

- Webhooks: the server includes minimal webhook endpoints. In production you must verify webhook signatures using `STRIPE_WEBHOOK_SECRET` and Coinbase's signature verification.
- Do not commit secret keys to source control.

Webhook setup (Stripe)

- Install the Stripe CLI for local webhook testing: https://stripe.com/docs/stripe-cli
- In a terminal run:

```bash
stripe listen --forward-to localhost:4242/webhook/stripe
```

This will print a webhook signing secret; copy it to `server/.env` as `STRIPE_WEBHOOK_SECRET`.

Alternatively, in the Stripe Dashboard add an endpoint `https://<your-host>/webhook/stripe` and set the signing secret in `STRIPE_WEBHOOK_SECRET`.

When `STRIPE_WEBHOOK_SECRET` is set the server will verify signatures using `stripe.webhooks.constructEvent`. If it's not set the server will accept webhook bodies without verification (INSECURE — only for quick local tests).

Webhook setup (Coinbase Commerce)

- Configure the webhook endpoint in Coinbase Commerce settings and verify signatures similarly (server currently logs receipt; implement verification in production).


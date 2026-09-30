# Checkout.com Flow: Sandbox Test Project

A minimal Node.js + Express app that demonstrates a complete card checkout using [Checkout.com Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website) in the **sandbox** environment.

It shows how to:

- create a Payment Session on the server,
- mount the Flow payment form in the browser,
- take a test payment (including 3D Secure),
- verify the payment result server-side.

> **Sandbox only.** This project uses test keys and test cards. Do not use real card details or production keys.

---

## Project structure

```
cko-flow-test/
├── public/
│   ├── index.html     # Checkout page (loads Flow script + app.js)
│   └── app.js         # Frontend: gets session, mounts Flow, shows result
├── server.js          # Backend: creates payment sessions, fetches payment status
├── .env               # Your keys (NOT committed)
├── .env.example       # Template for .env
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- **Node.js 18 or newer** (the server uses the built-in `fetch`). Check with `node -v`.
- A Checkout.com **sandbox account** with access to the sandbox Dashboard: https://dashboard.sandbox.checkout.com/
- **Flow enabled** on your account. If Flow is rejected for access reasons, ask your Checkout.com contact or use the Dashboard support form.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get your credentials from the sandbox Dashboard

| Value | Where to find it |
|---|---|
| **Client ID prefix** | Settings → Account structure. Take your client ID (e.g. `cli_vkuhvk4vjn2edkps7dfsq6emqm`) and use the **first 8 characters after `cli_`** (e.g. `vkuhvk4v`). |
| **Public API key** (`pk_sbox_...`) | Developers → Keys → Create a new key → *Public API key*. Make sure scopes include `payment-sessions:pay` and `vault-tokenization`. |
| **Secret API key** (`sk_sbox_...`) | Developers → Keys → Create a new key → *Secret API key*. Default scopes are fine. **It is shown only once, so copy it immediately.** |
| **Processing channel ID** (`pc_...`) | Settings → Processing channels |

### 3. Create your `.env` file

Copy the template and fill in your values:

```bash
cp .env.example .env
```

`.env.example`:

```
CKO_PREFIX=your8charprefix
CKO_PUBLIC_KEY=pk_sbox_xxxxxxxx
CKO_SECRET_KEY=sk_sbox_xxxxxxxx
CKO_PROCESSING_CHANNEL_ID=pc_xxxxxxxx
```

| Variable | Purpose | Secret? |
|---|---|---|
| `CKO_PREFIX` | Forms the API base URL: `https://{prefix}.api.sandbox.checkout.com` | No |
| `CKO_PUBLIC_KEY` | Used by the browser to initialize Flow | No |
| `CKO_SECRET_KEY` | Used by the server to call the API | **Yes** |
| `CKO_PROCESSING_CHANNEL_ID` | Routes the payment to your merchant account | No |

Make sure `.gitignore` contains:

```
node_modules
.env
```

### 4. Run the app

```bash
node server.js
```

Open **http://localhost:3000**.

On startup you should see `Running at http://localhost:3000`. When the page loads, the terminal should print `Payment session response: 201 ps_...`. If you see a different status, check [Troubleshooting](#troubleshooting).

> Restart the server after any change to `.env` or `server.js`.

---

## How it works

```
Browser                   Your server                  Checkout.com
   |-- load page ----------->|                               |
   |-- POST /create-payment-sessions -->|-- POST /payment-sessions (secret key) -->|
   |<-- session JSON --------|<-- id, token, secret ---------|
   |-- mount Flow (public key + session) ------------------->|
   |-- customer enters card, clicks Pay -------------------->|
   |<-- onPaymentCompleted, or redirect (3DS) --------------|
   |-- GET /payment/:id ---->|-- GET /payments/{id} -------->|
   |<-- verified status -----|<------------------------------|
```

1. The page asks your server for a Payment Session.
2. The server calls `POST /payment-sessions` with the **secret key** and returns the response **unmodified**.
3. The browser initializes Flow with the **public key** and that session, then mounts the form.
4. The customer pays. Flow handles card entry and 3D Secure.
5. The result arrives one of two ways:
   - **No redirect:** the `onPaymentCompleted` callback fires with a payment ID.
   - **Redirect (e.g. 3DS):** the customer returns to `/?status=...&cko-payment-id=pay_...`.
6. The page asks your server for the payment (`GET /payment/:id`), which fetches it from Checkout.com and returns the verified status.

### Server endpoints

| Endpoint | Description |
|---|---|
| `GET /config` | Returns the public key for the frontend |
| `POST /create-payment-sessions` | Creates a Payment Session at Checkout.com and returns the response |
| `GET /payment/:id` | Fetches payment details (`status`, `approved`, `response_code`, ...) |

### Payment Session request (sent by the server)

| Field | Required? | Value in this project |
|---|---|---|
| `amount` | Yes | `1000` (minor units = 10.00) |
| `currency` | Yes | `GBP` |
| `billing.address.country` | Yes (`billing`) | `GB` |
| `success_url` | Yes | `http://localhost:3000/?status=succeeded` |
| `failure_url` | Yes | `http://localhost:3000/?status=failed` |
| `processing_channel_id` | Required in practice | From `.env` |
| `reference` | Recommended | `ORD-<timestamp>` |
| `display_name`, `customer` | Optional | Test values |

---

## Testing

In the Flow form use:

- **Cardholder name:** anything, e.g. `Test User`
- **Expiry:** any future date, e.g. `12/30`
- **Security code:** any 3 digits (`100`), or any 4 digits for Amex

### Successful payments

| Card | Number | Result |
|---|---|---|
| Visa | `4242 4242 4242 4242` | Approved (`10000`) |
| Visa | `4000 0200 0000 0000` | Approved (`10000`) |
| Visa (debit) | `4659 1055 6905 1157` | Approved (`10000`) |
| Mastercard | `5436 0310 3060 6378` | Approved (`10000`) |
| Amex | `3456 7890 1234 564` | Approved (`10000`) |

### Declined payments

| Number | Result |
|---|---|
| `4242 4242 4242 4242` with `amount: 101` in `server.js` | Insufficient funds (`20051`) |
| `4544 2491 6767 3670` | Insufficient funds (`20051`) |
| `4539 4679 8710 9256` | Do not honour (`20005`) |
| `4111 1111 1111 1129` | Refer to card issuer (`20001`) |
| `4734 8689 5873 3862` | CVV2 failure (`200N7`) |
| `4897 4535 6848 5113` | Suspected fraud (`20059`) |

### 3D Secure

If the 3DS simulator page appears, the password is **`Checkout1!`**.

| Flow | Card | Result |
|---|---|---|
| Challenge | Mastercard `5385 3083 6013 5181` | Authentication successful |
| Challenge | Amex `3726 8858 1899 681` | Authentication successful |
| Challenge | Visa `4243 7542 7170 0719` | Not authenticated (payment fails) |
| Challenge | Visa `4152 8685 5277 3614` | Authentication attempted |
| Frictionless | Visa `4485 0403 7153 6584` | Authentication successful |
| Frictionless | Visa `4539 6283 4711 7863` | Not authenticated |

Full list: https://www.checkout.com/docs/developer-resources/testing/test-cards

### Verify in the Dashboard

Open the sandbox Dashboard → **Payments → Processing → All payments**. Each test payment should appear there with a status matching what your page displayed. Sandbox payments are stored for 30 days.

### Suggested test sequence

1. `4242 4242 4242 4242`: happy path.
2. Same card with `amount: 101`: decline.
3. `5385 3083 6013 5181`: 3DS challenge, then enter `Checkout1!`. Expect success.
4. `4243 7542 7170 0719`: 3DS challenge that ends in failure.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `422` with `processing_channel_id_required` | Set `CKO_PROCESSING_CHANNEL_ID` in `.env` and restart. |
| `401` on session creation | Wrong secret key or client ID prefix. Check `.env` and restart. |
| `403`, or Flow not available | Flow may not be enabled on the account, or the key is restricted to another processing channel. Contact Checkout.com. |
| Blank container, no error | Check the browser console (F12). The public key may be missing a scope (`payment-sessions:pay`, `vault-tokenization`). |
| `.env` changes have no effect | Restart `node server.js`. |
| `fetch is not defined` | Node is older than 18. Upgrade. |

---

## Security notes

- **Never** put the secret key in frontend code or commit it to git. Rotate it if exposed.
- The Flow script must be loaded from Checkout.com's own URL, not copied locally.
- In a real application, compute `amount` and `currency` on the server from the order, never from the client.
- Treat the browser callback and redirect as hints only. Confirm results server-side, and use **webhooks** as the authoritative trigger for order fulfillment.

## Next steps (not implemented here)

- **Webhooks:** register an endpoint in the Dashboard (a public HTTPS URL is required, so use a tunnel such as ngrok locally) and verify event signatures.
- **Production:** create production keys, use your production client ID prefix and processing channel, set Flow's `environment` to `production`, and use the production base URL `https://{prefix}.api.checkout.com`.
- **Customization:** Flow appearance, locale, and enabled payment methods (`enabled_payment_methods` / `disabled_payment_methods`).

## References

- Docs: https://www.checkout.com/docs
- API reference: https://api-reference.checkout.com/
- Test cards: https://www.checkout.com/docs/developer-resources/testing/test-cards
- API keys: https://www.checkout.com/docs/developer-resources/api/manage-api-keys/api-keys

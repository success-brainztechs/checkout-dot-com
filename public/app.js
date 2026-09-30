/* global CheckoutWebComponents */
const resultBox = document.getElementById('result');

function show(msg, ok) {
  resultBox.textContent = msg;
  resultBox.className = ok ? 'ok' : 'bad';
}

// Look up the payment on our server (which asks Checkout.com)
async function showPayment(paymentId) {
  const r = await fetch(`/payment/${paymentId}`);
  const p = await r.json();
  show(
    `Payment ${p.id}\nStatus: ${p.status}\nApproved: ${p.approved}\nResponse: ${p.response_code} ${p.response_summary || ''}`,
    p.approved
  );
}

(async () => {
  // 1. Returning from a redirect (e.g. 3DS)? Show the result.
  const params = new URLSearchParams(window.location.search);
  const returnedId = params.get('cko-payment-id');
  if (returnedId) {
    await showPayment(returnedId);
    return;
  }

  // 2. Otherwise, start a new checkout
  const { publicKey } = await (await fetch('/config')).json();

  const sessionRes = await fetch('/create-payment-sessions', { method: 'POST' });
  const paymentSession = await sessionRes.json();
  if (!sessionRes.ok) {
    show('Error creating payment session:\n' + JSON.stringify(paymentSession, null, 2), false);
    return;
  }

  const checkout = await CheckoutWebComponents({
    publicKey,
    environment: 'sandbox',
    locale: 'en-GB',
    paymentSession,
    onReady: () => console.log('Flow ready'),
    onPaymentCompleted: (_component, paymentResponse) => {
      // Fires for payments that need no redirect
      console.log('Payment completed:', paymentResponse.id);
      showPayment(paymentResponse.id);
    },
    onError: (component, error) => {
      console.error('Flow error', component.type, error);
      show('Flow error: ' + (error.message || JSON.stringify(error)), false);
    },
  });

  checkout.create('flow').mount('#flow-container');
})();
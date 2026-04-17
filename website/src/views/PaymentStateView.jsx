import { useEffect, useRef, useState } from 'react';
import { apiBaseUrl } from '../lib/api';

export function PaymentStateView({ variant }) {
  const isSuccess = variant === 'success';
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');

  const [state, setState] = useState('verifying'); // 'verifying' | 'redirecting' | 'manual' | 'error_payment'
  const [cardUrl, setCardUrl] = useState('');
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!isSuccess || !orderId) {
      setState('manual');
      return;
    }

    let cancelled = false;

    async function verify() {
      for (let i = 0; i < 12; i++) {
        if (cancelled) return;
        try {
          const res = await fetch(`${apiBaseUrl}/orders/${orderId}/verify-payment`, { method: 'POST' });
          const data = await res.json();
          if (data.paymentStatus === 'paid' && data.finalCardUrl) {
            if (!cancelled) {
              setCardUrl(data.finalCardUrl);
              setState('redirecting');
              window.location.href = data.finalCardUrl;
            }
            return;
          }
          if (data.finalCardUrl) setCardUrl(data.finalCardUrl);
        } catch { /* ignore, retry */ }
        // Wait 3 seconds between attempts
        await new Promise((r) => { attemptRef.current = setTimeout(r, 3000); });
      }
      // After 12 attempts (36s) give up and show manual link
      if (!cancelled) setState('manual');
    }

    verify();
    return () => {
      cancelled = true;
      clearTimeout(attemptRef.current);
    };
  }, [isSuccess, orderId]);

  if (!isSuccess) {
    return (
      <div className="payment-state-shell">
        <div className="payment-state-card">
          <span className="eyebrow">Tapal Checkout</span>
          <h1>Paiement annulé</h1>
          <p>La commande est bien enregistrée. Vous pouvez retourner au formulaire et relancer le paiement quand vous êtes prêt·e.</p>
          <a href="/" className="primary-button inline-link">Retour au Studio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-state-shell">
      <div className="payment-state-card">
        <span className="eyebrow">Tapal · Paiement</span>
        {state === 'verifying' && (
          <>
            <h1>Paiement reçu ✓</h1>
            <p>Vérification du paiement et préparation de votre carte…</p>
            <div className="receipt-spinner" style={{ margin: '20px auto' }} />
          </>
        )}
        {state === 'redirecting' && (
          <>
            <h1>Carte prête !</h1>
            <p>Redirection vers votre carte digitale…</p>
            <div className="receipt-spinner" style={{ margin: '20px auto' }} />
          </>
        )}
        {state === 'manual' && (
          <>
            <h1>Paiement confirmé ✓</h1>
            <p>Votre commande est enregistrée. Le studio TEKKO vous contactera pour finaliser votre carte.</p>
            {cardUrl && (
              <a className="primary-button inline-link" href={cardUrl} style={{ marginTop: 16 }}>
                Voir ma carte →
              </a>
            )}
            <a href="/" className="primary-button inline-link" style={{ marginTop: 12, opacity: 0.6 }}>
              Retour au Studio
            </a>
          </>
        )}
      </div>
    </div>
  );
}
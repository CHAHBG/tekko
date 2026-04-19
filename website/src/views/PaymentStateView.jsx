import { useEffect, useRef, useState } from 'react';
import { apiBaseUrl } from '../lib/api';

const MAX_ATTEMPTS = 12;
const POLL_MS = 3000;
const AUTO_REDIRECT_MS = 5000;

export function PaymentStateView({ variant }) {
  const isSuccess = variant === 'success';
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  const portalToken = params.get('portalToken') || '';

  const [phase, setPhase] = useState('verifying'); // verifying | ready | redirecting | manual
  const [cardUrl, setCardUrl] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [autoSec, setAutoSec] = useState(Math.ceil(AUTO_REDIRECT_MS / 1000));
  const attemptRef = useRef(0);
  const redirectTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const portalLink = orderId && portalToken
    ? `/my-order?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(portalToken)}`
    : '';

  useEffect(() => {
    if (!isSuccess || !orderId) {
      setPhase('manual');
      return;
    }

    let cancelled = false;

    async function verify() {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        setAttempt(i + 1);
        try {
          const res = await fetch(`${apiBaseUrl}/orders/${orderId}/verify-payment`, { method: 'POST' });
          const data = await res.json();
          if (data.paymentStatus === 'paid' && data.finalCardUrl) {
            if (!cancelled) {
              setCardUrl(data.finalCardUrl);
              setPhase('ready');
            }
            return;
          }
          if (data.finalCardUrl) setCardUrl(data.finalCardUrl);
        } catch { /* retry */ }
        await new Promise((r) => { attemptRef.current = setTimeout(r, POLL_MS); });
      }
      if (!cancelled) setPhase('manual');
    }

    verify();
    return () => {
      cancelled = true;
      clearTimeout(attemptRef.current);
      clearTimeout(redirectTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [isSuccess, orderId]);

  useEffect(() => {
    if (phase !== 'ready' || !cardUrl) return undefined;

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      return undefined;
    }

    setAutoSec(Math.ceil(AUTO_REDIRECT_MS / 1000));
    const tick = setInterval(() => {
      setAutoSec((s) => Math.max(0, s - 1));
    }, 1000);

    redirectTimerRef.current = setTimeout(() => {
      setPhase('redirecting');
      window.location.href = cardUrl;
    }, AUTO_REDIRECT_MS);

    countdownRef.current = tick;
    return () => {
      clearTimeout(redirectTimerRef.current);
      clearInterval(tick);
    };
  }, [phase, cardUrl]);

  function goToCard() {
    if (cardUrl) window.location.href = cardUrl;
  }

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
        {phase === 'verifying' && (
          <>
            <h1>Paiement reçu ✓</h1>
            <p>Vérification du paiement et préparation de votre carte…</p>
            <div className="payment-verify-progress" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_ATTEMPTS} aria-valuenow={attempt} aria-label="Progression de la vérification">
              <div className="payment-verify-progress-bar" style={{ width: `${(attempt / MAX_ATTEMPTS) * 100}%` }} />
            </div>
            <p className="payment-verify-attempt">Tentative {attempt} / {MAX_ATTEMPTS}</p>
            <div className="receipt-spinner" style={{ margin: '20px auto' }} />
          </>
        )}
        {phase === 'ready' && (
          <>
            <h1>Carte prête ✓</h1>
            <p>Votre paiement est confirmé. Vous pouvez ouvrir votre carte numerique maintenant.</p>
            <button type="button" className="primary-button inline-link payment-open-card-btn" onClick={goToCard}>
              Ouvrir ma carte
            </button>
            <p className="payment-auto-hint">
              Redirection automatique dans {autoSec}s (desactivee si vous avez demande moins d&apos;animations dans le systeme).
            </p>
            {portalLink && (
              <p className="payment-portal-wrap">
                <a href={portalLink} className="payment-portal-link">Suivre ma commande et les statistiques</a>
              </p>
            )}
          </>
        )}
        {phase === 'redirecting' && (
          <>
            <h1>Redirection…</h1>
            <p>Ouverture de votre carte digitale.</p>
            <div className="receipt-spinner" style={{ margin: '20px auto' }} />
          </>
        )}
        {phase === 'manual' && (
          <>
            <h1>Paiement confirmé ✓</h1>
            <p>Votre commande est enregistrée. Le studio TEKKO vous contactera pour finaliser votre carte si besoin.</p>
            {cardUrl && (
              <button type="button" className="primary-button inline-link payment-open-card-btn" onClick={goToCard}>
                Voir ma carte
              </button>
            )}
            {portalLink && (
              <a href={portalLink} className="primary-button inline-link payment-portal-secondary">
                Suivre ma commande
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

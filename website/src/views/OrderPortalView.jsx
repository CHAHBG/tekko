import { useEffect, useMemo, useState } from 'react';
import { fetchCardAnalytics, fetchOrderPortal } from '../lib/api';
import { useI18n } from '../lib/i18n';

const TIMELINE_STAGES = [
  { key: 'submitted', labelKey: 'portal.timeline.submitted', icon: '📝' },
  { key: 'paid', labelKey: 'portal.timeline.paid', icon: '✅' },
  { key: 'processing', labelKey: 'portal.timeline.processing', icon: '🖨️' },
  { key: 'shipped', labelKey: 'portal.timeline.shipped', icon: '📦' },
  { key: 'delivered', labelKey: 'portal.timeline.delivered', icon: '🎉' },
];

function getStageIndex(paymentStatus, orderStatus) {
  if (orderStatus === 'delivered') return 4;
  if (orderStatus === 'shipped') return 3;
  if (orderStatus === 'processing' || orderStatus === 'printing') return 2;
  if (paymentStatus === 'paid') return 1;
  return 0;
}

function OrderTimeline({ paymentStatus, orderStatus, t }) {
  const currentIdx = getStageIndex(paymentStatus, orderStatus);

  return (
    <div className="timeline anim-slide-up">
      {TIMELINE_STAGES.map((stage, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const cls = isDone ? 'done' : isCurrent ? 'current' : 'pending';
        return (
          <div key={stage.key} className={`timeline-step ${cls}`}>
            <div className="timeline-marker">{isDone ? '✓' : stage.icon}</div>
            <div>
              <div className="timeline-label">{t(stage.labelKey)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrderPortalView() {
  const { t } = useI18n();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = params.get('orderId') || '';
  const token = params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portal, setPortal] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    document.title = 'Ma commande · Tapal';
  }, []);

  useEffect(() => {
    if (!orderId || !token) {
      setLoading(false);
      setError('Lien incomplet. Utilisez le lien recu apres votre commande.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchOrderPortal(orderId, token);
        if (cancelled) return;
        setPortal(data);
        if (data.paymentStatus === 'paid') {
          try {
            const s = await fetchCardAnalytics(orderId, token, 30);
            if (!cancelled) setStats(s);
          } catch {
            if (!cancelled) setStats(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Impossible de charger la commande.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orderId, token]);

  if (loading) {
    return (
      <div className="order-portal-shell">
        <div className="order-portal-card">
          <div className="ecard-skeleton ecard-skeleton--title" />
          <div className="ecard-skeleton ecard-skeleton--line" />
          <div className="ecard-skeleton ecard-skeleton--line short" />
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="order-portal-shell">
        <div className="order-portal-card order-portal-card--error">
          <span className="eyebrow">Tapal</span>
          <h1>Commande</h1>
          <p>{error || 'Donnees indisponibles.'}</p>
          <a href="/" className="primary-button inline-link">Retour au Studio</a>
        </div>
      </div>
    );
  }

  const cardPublicUrl = `${window.location.origin}/c/${portal.slug}`;

  return (
    <div className="order-portal-shell">
      <div className="order-portal-card">
        <span className="eyebrow">Tapal · Suivi</span>
        <h1>Bonjour{portal.customerName ? `, ${portal.customerName}` : ''}</h1>
        <p className="order-portal-meta">
          Commande <strong>{portal.orderId.slice(0, 8)}</strong> · {portal.packName}
        </p>

        <div className="order-portal-status">
          <span className={`order-status-pill order-status-pill--${portal.paymentStatus}`}>
            Paiement : {portal.paymentStatus === 'paid' ? 'confirme' : portal.paymentStatus}
          </span>
          <span className={`order-status-pill order-status-pill--${portal.orderStatus}`}>
            Statut : {portal.orderStatus}
          </span>
        </div>

        <OrderTimeline paymentStatus={portal.paymentStatus} orderStatus={portal.orderStatus} t={t} />

        {portal.paymentStatus === 'paid' && portal.finalCardUrl && (
          <a className="primary-button inline-link" href={portal.finalCardUrl}>
            Voir ma carte numerique
          </a>
        )}

        {portal.paymentStatus !== 'paid' && portal.paymentUrl && (
          <a className="primary-button inline-link" href={portal.paymentUrl}>
            Poursuivre le paiement
          </a>
        )}

        {portal.paymentStatus === 'paid' && (
          <a className="primary-button inline-link ghost-portal-link" href={cardPublicUrl}>
            Ouvrir la carte sur ce site
          </a>
        )}

        {stats && stats.totalViews >= 0 && (
          <div className="order-portal-analytics">
            <h2>Visites (30 jours)</h2>
            <p>
              <strong>{stats.totalViews}</strong> vues · <strong>{stats.uniqueVisitors}</strong> visiteurs uniques
            </p>
            {stats.byCountry?.length > 0 && (
              <ul className="order-portal-countries">
                {stats.byCountry.map((row) => (
                  <li key={row.code}>
                    {row.country || row.code} : {row.visits}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <a href="/" className="order-portal-back">Retour au Studio</a>
      </div>
    </div>
  );
}

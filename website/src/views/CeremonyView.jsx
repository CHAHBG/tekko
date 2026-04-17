import { useState } from 'react';
import { submitCeremony } from '../lib/api';
import { buildWhatsAppUrl } from '../lib/catalog';

const EVENT_TYPES = [
  { value: 'mariage', label: 'Mariage' },
  { value: 'gala', label: 'Gala / Soirée' },
  { value: 'seminaire', label: 'Séminaire / Conférence' },
  { value: 'formation', label: 'Formation' },
  { value: 'corporate', label: 'Événement corporate' },
  { value: 'festival', label: 'Festival / Salon' },
  { value: 'autre', label: 'Autre' },
];

const SERVICES = [
  { value: 'galerie_photos', label: 'Galerie photos et souvenirs numériques' },
  { value: 'video_recap', label: 'Vidéo récapitulative' },
  { value: 'livre_or', label: "Livre d'or numérique" },
  { value: 'catalogue_ressources', label: 'Catalogue de ressources et documents' },
  { value: 'cartes_personnalisees', label: 'Cartes NFC aux couleurs de l\'événement' },
  { value: 'badges_acces', label: 'Badges d\'accès NFC' },
  { value: 'programme_agenda', label: 'Programme / Agenda de l\'événement' },
  { value: 'plans_interactifs', label: 'Plans et itinéraires interactifs' },
];

export function CeremonyView() {
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    company: '',
    eventType: '',
    eventName: '',
    eventDate: '',
    eventCity: '',
    guestCount: '',
    services: [],
    customDesign: '',
    budget: '',
    notes: '',
  });
  const [submitState, setSubmitState] = useState({ status: 'idle', message: '' });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleService = (svc) => {
    setForm((f) => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter((s) => s !== svc)
        : [...f.services, svc],
    }));
  };

  const brief = [
    `*Demande Ceremonies - TEKKO*`,
    ``,
    `*Contact*`,
    `Nom : ${form.contactName || '-'}`,
    `Tel : ${form.contactPhone || '-'}`,
    `Email : ${form.contactEmail || '-'}`,
    form.company ? `Entreprise : ${form.company}` : null,
    ``,
    `*Evenement*`,
    `Type : ${EVENT_TYPES.find((t) => t.value === form.eventType)?.label || form.eventType || '-'}`,
    `Nom : ${form.eventName || '-'}`,
    `Date : ${form.eventDate || '-'}`,
    `Lieu : ${form.eventCity || '-'}`,
    `Invites : ${form.guestCount || '-'}`,
    ``,
    `*Services demandes*`,
    ...(form.services.length > 0
      ? form.services.map((s) => `- ${SERVICES.find((sv) => sv.value === s)?.label || s}`)
      : ['Aucun selectionne']),
    form.customDesign ? `\n*Design souhaite*\n${form.customDesign}` : null,
    form.budget ? `\n*Budget*\n${form.budget}` : null,
    form.notes ? `\n*Notes*\n${form.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsAppUrl = buildWhatsAppUrl(brief);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contactName || !form.contactPhone || !form.eventType) {
      setSubmitState({ status: 'error', message: 'Remplissez les champs obligatoires (nom, tel, type).' });
      return;
    }
    setSubmitState({ status: 'saving', message: '' });
    try {
      await submitCeremony(form);
      setSubmitState({ status: 'success', message: 'Votre demande a bien ete envoyee. Nous vous contacterons sous 24h.' });
    } catch (err) {
      setSubmitState({ status: 'error', message: err.message || 'Erreur lors de l\'envoi.' });
    }
  }

  return (
    <div className="ceremony-page">
      <div className="ceremony-shell">
        <header className="ceremony-header">
          <a href="https://tekko.geochifa.com" className="ceremony-back">TEKKO</a>
          <h1>Ceremonies et Evenements</h1>
          <p>Mariages, galas, seminaires, formations. Creez une experience NFC inoubliable pour vos invites.</p>
        </header>

        {submitState.status === 'success' ? (
          <div className="ceremony-success">
            <div className="ceremony-success-icon">&#10003;</div>
            <h2>Demande envoyee</h2>
            <p>{submitState.message}</p>
            <a href="https://tekko.geochifa.com" className="ceremony-back-btn">Retour au site</a>
          </div>
        ) : (
          <form className="ceremony-form" onSubmit={handleSubmit}>
            {/* ── CONTACT ───────────────── */}
            <section className="ceremony-section">
              <h2>Vos coordonnees</h2>
              <div className="ceremony-grid">
                <label className="ceremony-field">
                  <span>Nom complet *</span>
                  <input type="text" value={form.contactName} onChange={(e) => update('contactName', e.target.value)} required />
                </label>
                <label className="ceremony-field">
                  <span>Telephone / WhatsApp *</span>
                  <input type="tel" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} required />
                </label>
                <label className="ceremony-field">
                  <span>Email</span>
                  <input type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </label>
                <label className="ceremony-field">
                  <span>Entreprise / Organisation</span>
                  <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)} />
                </label>
              </div>
            </section>

            {/* ── EVENT ─────────────────── */}
            <section className="ceremony-section">
              <h2>L'evenement</h2>
              <div className="ceremony-grid">
                <label className="ceremony-field">
                  <span>Type d'evenement *</span>
                  <select value={form.eventType} onChange={(e) => update('eventType', e.target.value)} required>
                    <option value="">Selectionnez</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ceremony-field">
                  <span>Nom de l'evenement</span>
                  <input type="text" value={form.eventName} onChange={(e) => update('eventName', e.target.value)} placeholder="ex: Mariage de Fatou & Moussa" />
                </label>
                <label className="ceremony-field">
                  <span>Date prevue</span>
                  <input type="date" value={form.eventDate} onChange={(e) => update('eventDate', e.target.value)} />
                </label>
                <label className="ceremony-field">
                  <span>Ville / Lieu</span>
                  <input type="text" value={form.eventCity} onChange={(e) => update('eventCity', e.target.value)} />
                </label>
                <label className="ceremony-field">
                  <span>Nombre d'invites estime</span>
                  <input type="number" min="1" value={form.guestCount} onChange={(e) => update('guestCount', e.target.value)} placeholder="ex: 150" />
                </label>
              </div>
            </section>

            {/* ── SERVICES ──────────────── */}
            <section className="ceremony-section">
              <h2>Services souhaites</h2>
              <p className="ceremony-hint">Selectionnez tous les services qui vous interessent.</p>
              <div className="ceremony-services">
                {SERVICES.map((svc) => (
                  <label key={svc.value} className={`ceremony-service-pill${form.services.includes(svc.value) ? ' active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.services.includes(svc.value)}
                      onChange={() => toggleService(svc.value)}
                    />
                    <span>{svc.label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* ── DETAILS ──────────────── */}
            <section className="ceremony-section">
              <h2>Details supplementaires</h2>
              <div className="ceremony-grid">
                <label className="ceremony-field ceremony-field-full">
                  <span>Description du design souhaite</span>
                  <textarea rows="3" value={form.customDesign} onChange={(e) => update('customDesign', e.target.value)} placeholder="Couleurs, theme, style des cartes NFC..." />
                </label>
                <label className="ceremony-field">
                  <span>Budget indicatif</span>
                  <input type="text" value={form.budget} onChange={(e) => update('budget', e.target.value)} placeholder="ex: 200 000 FCFA" />
                </label>
                <label className="ceremony-field ceremony-field-full">
                  <span>Notes / Questions</span>
                  <textarea rows="3" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Toute information utile pour preparer votre devis..." />
                </label>
              </div>
            </section>

            {submitState.status === 'error' && (
              <div className="ceremony-error">{submitState.message}</div>
            )}

            <div className="ceremony-actions">
              <button type="submit" className="ceremony-submit" disabled={submitState.status === 'saving'}>
                {submitState.status === 'saving' ? 'Envoi...' : 'Envoyer ma demande'}
              </button>
              <a className="ceremony-whatsapp" href={whatsAppUrl} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.109.549 4.09 1.508 5.812L0 24l6.396-1.475A11.913 11.913 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.86 0-3.63-.504-5.175-1.428l-.369-.222-3.84.885.915-3.72-.24-.384A9.69 9.69 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
                WhatsApp
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

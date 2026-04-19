import { useCallback, useEffect, useState } from 'react';

const translations = {
  fr: {
    // Navigation
    'nav.studio': 'Studio',
    'nav.canvas': 'Canvas',
    'nav.turnkey': 'Clé en main',
    'nav.ceremonies': 'Cérémonies',

    // Builder
    'builder.title': 'Tapal Studio',
    'builder.onboarding.welcome': 'Bienvenue sur Tapal Studio',
    'builder.onboarding.step1': 'Choisissez un thème',
    'builder.onboarding.step1desc': 'Sélectionnez le thème qui correspond à votre marque personnelle.',
    'builder.onboarding.step2': 'Remplissez votre profil',
    'builder.onboarding.step2desc': 'Cliquez directement sur la carte pour modifier vos informations.',
    'builder.onboarding.step3': 'Commandez votre carte',
    'builder.onboarding.step3desc': 'Personnalisez le matériau et passez commande — livraison sous 72h.',
    'builder.onboarding.start': 'Commencer',
    'builder.onboarding.next': 'Suivant',
    'builder.onboarding.skip': 'Passer',
    'builder.templates': 'Modèles',
    'builder.templates.title': 'Choisir un modèle',
    'builder.templates.ceo': 'PDG / Dirigeant',
    'builder.templates.developer': 'Développeur',
    'builder.templates.designer': 'Designer',
    'builder.templates.doctor': 'Médecin',
    'builder.templates.lawyer': 'Avocat',
    'builder.templates.freelancer': 'Freelance',
    'builder.templates.artist': 'Artiste',
    'builder.templates.student': 'Étudiant',
    'builder.orderNfc': 'Commander ma carte NFC',
    'builder.customize': 'Personnaliser',

    // Public card
    'card.save': 'Sauvegarder le contact',
    'card.share': 'Partager',
    'card.copied': 'Lien copié !',

    // Checkout
    'checkout.step.physical': 'Carte physique',
    'checkout.step.delivery': 'Livraison',
    'checkout.step.summary': 'Récapitulatif',
    'checkout.step.payment': 'Paiement',
    'checkout.previous': 'Précédent',
    'checkout.next': 'Suivant',
    'checkout.pay': 'Procéder au paiement',
    'checkout.total': 'Total',

    // Order portal
    'portal.title': 'Ma commande · Tapal',
    'portal.greeting': 'Bonjour',
    'portal.order': 'Commande',
    'portal.payment': 'Paiement',
    'portal.status': 'Statut',
    'portal.viewCard': 'Voir ma carte numérique',
    'portal.continuePay': 'Poursuivre le paiement',
    'portal.backStudio': 'Retour au Studio',
    'portal.timeline.paid': 'Paiement confirmé',
    'portal.timeline.printing': 'Impression en cours',
    'portal.timeline.shipped': 'Expédiée',
    'portal.timeline.delivered': 'Livrée',
    'portal.timeline.submitted': 'Commande reçue',
    'portal.timeline.processing': 'En préparation',

    // Payment
    'payment.success.title': 'Paiement réussi !',
    'payment.success.desc': 'Votre commande est confirmée.',
    'payment.cancel.title': 'Paiement annulé',
    'payment.cancel.desc': 'Vous pouvez réessayer à tout moment.',

    // Dark mode
    'darkMode.light': 'Clair',
    'darkMode.dark': 'Sombre',
    'darkMode.system': 'Système',

    // General
    'general.loading': 'Chargement...',
    'general.error': 'Erreur',
    'general.retry': 'Réessayer',
    'general.close': 'Fermer',
    'general.confirm': 'Confirmer',
    'general.cancel': 'Annuler',

    // Analytics (admin only)
    'analytics.visits': 'Visites',
    'analytics.visitors': 'Visiteurs uniques',
    'analytics.cardViews': 'Vues de cartes',
    'analytics.pageViews': 'Pages vues',
  },
  en: {
    'nav.studio': 'Studio',
    'nav.canvas': 'Canvas',
    'nav.turnkey': 'Turnkey',
    'nav.ceremonies': 'Ceremonies',

    'builder.title': 'Tapal Studio',
    'builder.onboarding.welcome': 'Welcome to Tapal Studio',
    'builder.onboarding.step1': 'Choose a theme',
    'builder.onboarding.step1desc': 'Select the theme that matches your personal brand.',
    'builder.onboarding.step2': 'Fill in your profile',
    'builder.onboarding.step2desc': 'Click directly on the card to edit your information.',
    'builder.onboarding.step3': 'Order your card',
    'builder.onboarding.step3desc': 'Customize the material and place your order — delivery within 72h.',
    'builder.onboarding.start': 'Get started',
    'builder.onboarding.next': 'Next',
    'builder.onboarding.skip': 'Skip',
    'builder.templates': 'Templates',
    'builder.templates.title': 'Choose a template',
    'builder.templates.ceo': 'CEO / Executive',
    'builder.templates.developer': 'Developer',
    'builder.templates.designer': 'Designer',
    'builder.templates.doctor': 'Doctor',
    'builder.templates.lawyer': 'Lawyer',
    'builder.templates.freelancer': 'Freelancer',
    'builder.templates.artist': 'Artist',
    'builder.templates.student': 'Student',
    'builder.orderNfc': 'Order my NFC card',
    'builder.customize': 'Customize',

    'card.save': 'Save contact',
    'card.share': 'Share',
    'card.copied': 'Link copied!',

    'checkout.step.physical': 'Physical card',
    'checkout.step.delivery': 'Delivery',
    'checkout.step.summary': 'Summary',
    'checkout.step.payment': 'Payment',
    'checkout.previous': 'Previous',
    'checkout.next': 'Next',
    'checkout.pay': 'Proceed to payment',
    'checkout.total': 'Total',

    'portal.title': 'My order · Tapal',
    'portal.greeting': 'Hello',
    'portal.order': 'Order',
    'portal.payment': 'Payment',
    'portal.status': 'Status',
    'portal.viewCard': 'View my digital card',
    'portal.continuePay': 'Continue payment',
    'portal.backStudio': 'Back to Studio',
    'portal.timeline.paid': 'Payment confirmed',
    'portal.timeline.printing': 'Printing in progress',
    'portal.timeline.shipped': 'Shipped',
    'portal.timeline.delivered': 'Delivered',
    'portal.timeline.submitted': 'Order received',
    'portal.timeline.processing': 'Processing',

    'payment.success.title': 'Payment successful!',
    'payment.success.desc': 'Your order is confirmed.',
    'payment.cancel.title': 'Payment cancelled',
    'payment.cancel.desc': 'You can try again anytime.',

    'darkMode.light': 'Light',
    'darkMode.dark': 'Dark',
    'darkMode.system': 'System',

    'general.loading': 'Loading...',
    'general.error': 'Error',
    'general.retry': 'Retry',
    'general.close': 'Close',
    'general.confirm': 'Confirm',
    'general.cancel': 'Cancel',

    'analytics.visits': 'Visits',
    'analytics.visitors': 'Unique visitors',
    'analytics.cardViews': 'Card views',
    'analytics.pageViews': 'Page views',
  },
  wo: {
    'nav.studio': 'Studio',
    'nav.canvas': 'Canvas',
    'nav.turnkey': 'Bu fexee',
    'nav.ceremonies': 'Tééré yi',

    'builder.title': 'Tapal Studio',
    'builder.onboarding.welcome': 'Dalal jàmm ci Tapal Studio',
    'builder.onboarding.step1': 'Tànnal ag thème',
    'builder.onboarding.step1desc': 'Tànnal thème bi mu wàcc sa marque.',
    'builder.onboarding.step2': 'Laalal sa profil',
    'builder.onboarding.step2desc': 'Bës na ci carte bi ngir waxale.',
    'builder.onboarding.step3': 'Jëndal sa carte',
    'builder.onboarding.step3desc': 'Tannalal matériau bi te jëndal — yobbu ci 72h.',
    'builder.onboarding.start': 'Tambali',
    'builder.onboarding.next': 'Jooju',
    'builder.onboarding.skip': 'Wacc',
    'builder.templates': 'Modèles',
    'builder.templates.title': 'Tànnal ag modèle',
    'builder.orderNfc': 'Jëndal sama carte NFC',
    'builder.customize': 'Soppi',

    'card.save': 'Denc contact bi',
    'card.share': 'Séddal',
    'card.copied': 'Lien bi copié na !',

    'general.loading': 'Yàgg nañu...',
    'general.error': 'Njuumte',
    'general.retry': 'Jéema kenn',
    'general.close': 'Tëj',
  },
};

const STORAGE_KEY = 'tapal-lang';

function detectLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && translations[stored]) return stored;
  // Default to French regardless of browser language
  return 'fr';
}

let currentLang = 'fr';
const listeners = new Set();

export function initI18n() {
  currentLang = detectLanguage();
}

export function t(key) {
  return translations[currentLang]?.[key] || translations.fr[key] || key;
}

export function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn(lang));
}

export function getLanguage() {
  return currentLang;
}

export function getSupportedLanguages() {
  return [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
  ];
}

export function useI18n() {
  const [lang, setLang] = useState(currentLang);

  useEffect(() => {
    const handler = (newLang) => setLang(newLang);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const translate = useCallback((key) => {
    return translations[lang]?.[key] || translations.fr[key] || key;
  }, [lang]);

  return { t: translate, lang, setLanguage };
}

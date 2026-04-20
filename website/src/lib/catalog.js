export const themeCatalog = {
  executive: {
    label: 'Executive Noir',
    description: 'Confident, premium, dark contrast with precise gold accents.',
    accent: '#d4a147',
    surface: 'linear-gradient(160deg, rgba(10,15,21,0.98) 0%, rgba(24,32,44,0.98) 100%)',
    highlight: '#f4e6c2',
    text: '#f7f1e7',
    panel: 'rgba(255,255,255,0.07)',
  },
  studio: {
    label: 'Studio Editorial',
    description: 'Bright, minimal and refined for consultants and creative founders.',
    accent: '#ff6b2c',
    surface: 'linear-gradient(165deg, rgba(245,241,234,0.98) 0%, rgba(224,220,212,0.95) 100%)',
    highlight: '#fff9f0',
    text: '#1d2430',
    panel: 'rgba(255,255,255,0.62)',
  },
  pulse: {
    label: 'Pulse Tech',
    description: 'Electric, futuristic and sharp for startups, fintech and product teams.',
    accent: '#2bd1ff',
    surface: 'linear-gradient(150deg, rgba(7,20,34,0.98) 0%, rgba(16,48,76,0.96) 100%)',
    highlight: '#bdf5ff',
    text: '#f1fbff',
    panel: 'rgba(10,24,39,0.48)',
  },
  teranga: {
    label: 'Teranga Warm',
    description: 'Warm, human and hospitality-driven with rich earthy tones.',
    accent: '#8e6f48',
    surface: 'linear-gradient(150deg, rgba(72,47,28,0.98) 0%, rgba(123,87,51,0.98) 100%)',
    highlight: '#f1ddc1',
    text: '#fff7ef',
    panel: 'rgba(255,241,224,0.12)',
  },
};

export const promptRules = [
  {
    themeKey: 'executive',
    keywords: ['executive', 'luxury', 'premium', 'elite', 'black', 'gold', 'finance', 'law', 'serious'],
    material: 'Brushed metal',
    finish: 'Soft matte',
    foil: 'Gold foil',
    summary: 'Premium and restrained with dark contrast and metallic detail.',
  },
  {
    themeKey: 'pulse',
    keywords: ['tech', 'futuristic', 'digital', 'startup', 'fintech', 'bold', 'electric', 'modern'],
    material: 'Frosted black',
    finish: 'Gloss',
    foil: 'Silver foil',
    summary: 'Sharp motion, luminous edges and a more digital-first feel.',
  },
  {
    themeKey: 'teranga',
    keywords: ['warm', 'natural', 'earth', 'organic', 'community', 'hospitality', 'artisan', 'brown'],
    material: 'Pearl white',
    finish: 'Satin',
    foil: 'Copper foil',
    summary: 'Warm and personal with softer contrast and tactile materials.',
  },
  {
    themeKey: 'studio',
    keywords: ['minimal', 'clean', 'editorial', 'creative', 'fashion', 'design', 'white', 'simple'],
    material: 'Soft touch PVC',
    finish: 'Matte',
    foil: 'No foil',
    summary: 'Minimal layout, editorial spacing and clean visual hierarchy.',
  },
];

export const materialCatalog = {
  'Soft touch PVC': {
    base: '#1d2430',
    edge: 'rgba(255,255,255,0.12)',
    ink: '#f4eee2',
  },
  'Brushed metal': {
    base: '#747c86',
    edge: 'rgba(255,255,255,0.26)',
    ink: '#faf8f2',
  },
  'Frosted black': {
    base: '#0d1218',
    edge: 'rgba(80,193,255,0.18)',
    ink: '#f5fbff',
  },
  'Pearl white': {
    base: '#f5f5f3',
    edge: 'rgba(255,255,255,0.85)',
    ink: '#21242a',
  },
};

export const foilCatalog = {
  'No foil': '#8b95a7',
  'Gold foil': '#e7c35e',
  'Silver foil': '#d8e6ee',
  'Copper foil': '#c98d58',
};

// Price add-ons on top of the selected pack base price
export const materialPriceAdds = {
  'Soft touch PVC': 0,
  'Brushed metal': 20000,
  'Frosted black': 0,
  'Pearl white': 0,
};

export const foilPriceAdds = {
  'No foil': 0,
  'Gold foil': 5000,
  'Silver foil': 5000,
  'Copper foil': 5000,
};

// Replace with your studio WhatsApp number (international format, no + or spaces)
export const WHATSAPP_STUDIO_NUMBER = '221776585371';

export function calculateTotalPrice({ packageSelection, material, foil }) {
  const base = packageSelection?.price ?? 0;
  const materialExtra = materialPriceAdds[material] ?? 0;
  const foilExtra = foilPriceAdds[foil] ?? 0;
  return base + materialExtra + foilExtra;
}

export function buildWhatsAppUrl(brief, phone = WHATSAPP_STUDIO_NUMBER) {
  // Use encodeURIComponent for the URL but ensure the brief itself has no special encoded chars
  return `https://wa.me/${phone}?text=${encodeURIComponent(brief)}`;
}

const PRO_PACK_PRICE = 22500;
const BUSINESS_PACK_PRICE = Math.round(PRO_PACK_PRICE * 3 * 1.15);

export const packCatalog = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: 15000,
    quantity: 1,
    caption: '1 carte NFC avec profil digital personnalisé.',
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: PRO_PACK_PRICE,
    quantity: 1,
    caption: 'Carte premium avec dorure et design sur mesure.',
  },
  business: {
    key: 'business',
    name: 'Business',
    price: BUSINESS_PACK_PRICE,
    discountBadge: '-15%',
    perCardBase: Math.round(BUSINESS_PACK_PRICE / 5),
    quantity: 5,
    caption: '5 cartes NFC premium — domaine dédié, dorure, design haut de gamme.',
  },
};

export const profileFields = [
  { key: 'fullName', label: 'Full name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'website', label: 'Website', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
];

export const socialFields = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/...' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/...' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/...' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/...' },
];

export const orderContactFields = [
  { key: 'name', label: 'Order contact', type: 'text' },
  { key: 'email', label: 'Billing email', type: 'email' },
  { key: 'phone', label: 'WhatsApp number', type: 'text' },
  { key: 'deliveryCity', label: 'Delivery city', type: 'text' },
  { key: 'deliveryAddress', label: 'Delivery address', type: 'text' },
  { key: 'postalCode', label: 'Postal code', type: 'text' },
];

export const defaultProfile = {
  fullName: 'Sokhna Dieng',
  role: 'Directrice Générale',
  company: 'TEKKO',
  phone: '+221 77 123 45 67',
  email: 'sokhna@tekko.sn',
  website: 'https://tekko.sn/sokhna',
  location: 'Dakar, Sénégal',
  bio: '',
  linkedin: '',
  instagram: '',
  x: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  discord: '',
  github: '',
  snapchat: '',
  whatsapp: '',
};

export const defaultOrderContact = {
  name: 'Sokhna Dieng',
  email: 'sokhna@tekko.sn',
  phone: '+221 77 123 45 67',
  deliveryCity: 'Dakar',
  deliveryAddress: '',
  postalCode: '',
  deliveryNotes: '',
};

export const defaultCustomization = {
  themeKey: 'studio',
  accent: '#ff6b2c',
  stylePrompt: '',
  material: 'Pearl white',
  finish: 'Matte',
  foil: 'No foil',
  includeQr: false,
  includeLogo: false,
  logoPosition: 'bottom-right',
  logoSize: 'medium',
  qrPosition: 'center',
  qrSize: 'medium',
  backsideMessage: 'Tap, scan, connect.',
  cardLabel: 'Tapal Signature',
  textColor: '',
  bgColor: '',
  fontStyle: 'moderne',
};

export const defaultAssets = {
  avatar: {
    sourceType: 'none',
    remoteUrl: '',
    previewUrl: '',
    file: null,
    zoom: 1,
    positionX: 50,
    positionY: 50,
    rotation: 0,
    opacity: 1,
  },
  artwork: {
    sourceType: 'none',
    remoteUrl: '',
    previewUrl: '',
    file: null,
    zoom: 1.12,
    positionX: 50,
    positionY: 50,
    rotation: 0,
    opacity: 0.92,
  },
  cover: {
    sourceType: 'none',
    remoteUrl: '',
    previewUrl: '',
    file: null,
  },
  logo: {
    sourceType: 'none',
    remoteUrl: '',
    previewUrl: '',
    file: null,
    zoom: 1,
    positionX: 50,
    positionY: 50,
    rotation: 0,
    opacity: 1,
  },
};

export function analyzePrompt(prompt) {
  const loweredPrompt = String(prompt ?? '').toLowerCase();
  const scoredRules = promptRules.map((rule) => ({
    ...rule,
    score: rule.keywords.reduce(
      (total, keyword) => total + (loweredPrompt.includes(keyword) ? 1 : 0),
      0,
    ),
  }));

  const bestMatch = scoredRules.sort((left, right) => right.score - left.score)[0];
  const fallbackRule = promptRules[1];
  const selectedRule = bestMatch?.score > 0 ? bestMatch : fallbackRule;

  return {
    ...selectedRule,
    accent: themeCatalog[selectedRule.themeKey].accent,
  };
}

export function createSlug(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function composeCardUrl(slug) {
  const baseUrl = (import.meta.env.VITE_PUBLIC_CARD_BASE_URL ?? 'https://tapal.geochifa.com/c').replace(/\/$/, '');
  return `${baseUrl}/${slug}`;
}

export function getInitials(fullName) {
  return String(fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function getAssetDisplayUrl(asset) {
  return asset?.previewUrl || asset?.storedUrl || asset?.remoteUrl || '';
}

export function serializeAsset(asset) {
  if (!asset) {
    return null;
  }

  const { file, previewUrl, ...rest } = asset;

  if (!rest.remoteUrl && rest.sourceType === 'none') {
    return null;
  }

  return rest;
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('fr-SN', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderBrief({
  profile,
  orderContact,
  customization,
  activeTheme,
  packageSelection,
  finalCardUrl,
  assets,
  totalPrice,
}) {
  const displayPrice = totalPrice ?? packageSelection?.price;
  const sep = '-';
  const lines = [
    `*Nouvelle commande Tapal Studio*`,
    ``,
    `*Client*`,
    `Nom : ${profile.fullName || sep}`,
    `Role : ${profile.role || sep}${profile.company ? ` @ ${profile.company}` : ''}`,
    `Tel : ${orderContact.phone || profile.phone || sep}`,
    `Email : ${orderContact.email || profile.email || sep}`,
    `Adresse : ${orderContact.deliveryAddress || sep}, ${orderContact.deliveryCity || sep}`,
    ``,
    `*Pack*`,
    `${packageSelection.name} - ${formatMoney(displayPrice)}`,
    ``,
    `*Carte NFC physique*`,
    `Materiau : ${customization.material}`,
    `Finition : ${customization.finish}`,
    `Dorure : ${customization.foil}`,
    `QR code verso : ${customization.includeQr ? 'Oui' : 'Non'}${customization.includeQr ? ` (${customization.qrPosition}, ${customization.qrSize})` : ''}`,
    `Logo recto : ${customization.includeLogo ? 'Oui' : 'Non'}${customization.includeLogo ? ` (${customization.logoPosition}, ${customization.logoSize})` : ''}`,
    `Message verso : ${customization.backsideMessage || sep}`,
    ``,
    `*Design digital*`,
    `Theme : ${activeTheme.label}`,
    `Couleur accent : ${customization.accent}`,
    `Mise en page : ${customization.cardLayout || customization.themeKey}`,
    `Photo profil : ${assets.avatar?.sourceType !== 'none' ? 'Oui' : 'Non'}`,
    `Visuel recto : ${assets.artwork?.sourceType !== 'none' ? 'Oui' : 'Non'}`,
  ];

  if (customization.stylePrompt) {
    lines.push(``, `*Direction artistique*`, customization.stylePrompt);
  }

  if (orderContact.deliveryNotes) {
    lines.push(``, `*Notes livraison*`, orderContact.deliveryNotes);
  }

  if (customization.customDomain) {
    lines.push(
      ``,
      `*Nom de domaine*`,
      `Domaine : ${customization.customDomain}`,
      customization.domainUserShareFcfa > 0
        ? `Supplement client : ${formatMoney(customization.domainUserShareFcfa)}`
        : `Supplement client : 0 FCFA (inclus par TEKKO)`,
    );
  }

  lines.push(``, `Carte : ${finalCardUrl}`);

  return lines.join('\n');
}

/** Pre-built card templates for quick-start */
export const cardTemplates = [
  {
    key: 'ceo',
    labelKey: 'builder.templates.ceo',
    label: 'PDG / Dirigeant',
    emoji: '👔',
    profile: { fullName: 'Aminata Diallo', role: 'PDG', company: 'Diallo Group', email: 'aminata@diallogroup.com', phone: '+221 77 123 45 67' },
    customization: { theme: 'executive', accent: '#d4a147', material: 'Brushed metal', finish: 'Soft matte', foil: 'Gold foil', cardLayout: 'classic', fontStyle: 'elegant' },
  },
  {
    key: 'developer',
    labelKey: 'builder.templates.developer',
    label: 'Développeur',
    emoji: '💻',
    profile: { fullName: 'Mamadou Ndiaye', role: 'Full-Stack Developer', company: 'TechSN', email: 'mamadou@techsn.dev', website: 'techsn.dev' },
    customization: { theme: 'pulse', accent: '#2bd1ff', material: 'Frosted black', finish: 'Gloss', foil: 'Silver foil', cardLayout: 'minimal', fontStyle: 'technique' },
  },
  {
    key: 'designer',
    labelKey: 'builder.templates.designer',
    label: 'Designer',
    emoji: '🎨',
    profile: { fullName: 'Fatou Sow', role: 'Creative Director', company: 'Studio Teranga', email: 'fatou@studioteranga.com', website: 'studioteranga.com' },
    customization: { theme: 'studio', accent: '#ff6b2c', material: 'Soft touch PVC', finish: 'Matte', foil: 'No foil', cardLayout: 'bold', fontStyle: 'moderne' },
  },
  {
    key: 'doctor',
    labelKey: 'builder.templates.doctor',
    label: 'Médecin',
    emoji: '⚕️',
    profile: { fullName: 'Dr. Ousmane Ba', role: 'Médecin Généraliste', company: 'Clinique Mermoz', email: 'dr.ba@clinikmermoz.sn', phone: '+221 33 860 00 00' },
    customization: { theme: 'studio', accent: '#1a9b45', material: 'Pearl white', finish: 'Satin', foil: 'No foil', cardLayout: 'elegant', fontStyle: 'moderne' },
  },
  {
    key: 'lawyer',
    labelKey: 'builder.templates.lawyer',
    label: 'Avocat',
    emoji: '⚖️',
    profile: { fullName: 'Maître Ibra Fall', role: 'Avocat', company: 'Cabinet Fall & Associés', email: 'ibra@cabinetfall.sn', phone: '+221 77 890 12 34' },
    customization: { theme: 'executive', accent: '#8b7355', material: 'Brushed metal', finish: 'Soft matte', foil: 'Copper foil', cardLayout: 'classic', fontStyle: 'elegant' },
  },
  {
    key: 'freelancer',
    labelKey: 'builder.templates.freelancer',
    label: 'Freelance',
    emoji: '🚀',
    profile: { fullName: 'Awa Mbaye', role: 'Consultant Marketing Digital', company: '', email: 'awa.mbaye@gmail.com', website: 'awambaye.com' },
    customization: { theme: 'studio', accent: '#ff6b2c', material: 'Soft touch PVC', finish: 'Matte', foil: 'No foil', cardLayout: 'gradient', fontStyle: 'arrondi' },
  },
  {
    key: 'artist',
    labelKey: 'builder.templates.artist',
    label: 'Artiste',
    emoji: '🎵',
    profile: { fullName: 'Youssou Dieng', role: 'Musicien / Producteur', company: '', email: 'youssou@music.sn', bio: 'Artiste sénégalais — Musique mandingue et urbaine.' },
    customization: { theme: 'teranga', accent: '#8e6f48', material: 'Pearl white', finish: 'Satin', foil: 'Copper foil', cardLayout: 'banner', fontStyle: 'arrondi' },
  },
  {
    key: 'student',
    labelKey: 'builder.templates.student',
    label: 'Étudiant',
    emoji: '🎓',
    profile: { fullName: 'Cheikh Thiam', role: 'Étudiant en Informatique', company: 'ESP Dakar', email: 'cheikh.thiam@esp.sn' },
    customization: { theme: 'pulse', accent: '#2bd1ff', material: 'Soft touch PVC', finish: 'Matte', foil: 'No foil', cardLayout: 'minimal', fontStyle: 'moderne' },
  },
];
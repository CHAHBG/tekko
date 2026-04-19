import { useCallback, useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { voiceExtract, voiceDesignSuggest, submitOrder, startCheckout, voiceTranscribeWolof } from '../lib/api';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳', beta: true },
  { code: 'pu', label: 'Pulaar', flag: '🇸🇳', beta: true },
];

const FIELD_LABELS = {
  fullName: 'Nom complet',
  phone: 'Téléphone',
  role: 'Profession',
  company: 'Entreprise',
  email: 'Email',
  packKey: 'Pack',
  images: 'Images',
};

const IMAGE_SLOTS = [
  { key: 'avatar', label: 'Photo de profil', icon: '👤', fieldName: 'avatarFile' },
  { key: 'logo', label: 'Logo entreprise', icon: '🏢', fieldName: 'logoFile' },
  { key: 'artwork', label: 'Spécialisation / Carte', icon: '🎨', fieldName: 'artworkFile' },
  { key: 'cover', label: 'Couverture', icon: '🖼️', fieldName: 'coverFile' },
];

const PACK_LABELS = {
  starter: 'Starter — 15 000 FCFA',
  pro: 'Pro — 22 500 FCFA',
  business: 'Business — 60 000 FCFA',
};

const SILENCE_TIMEOUT_MS = 2800;
const MIN_TRANSCRIPT_LEN = 3;
const MAX_LLM_RETRIES = 2;
const CONFIRM_DELAY_MS = 2500;
const FIELDS = ['fullName', 'phone', 'role', 'company', 'email', 'packKey', 'images'];
const OPTIONAL = new Set(['company', 'email', 'images']);
const REQUIRED = new Set(['fullName', 'phone', 'role', 'packKey']);

const FIRST_PROMPTS = {
  fr: "Bonjour ! Je suis l'assistant Tapal. Quel est votre nom complet ?",
  en: "Hello! I'm the Tapal assistant. What is your full name?",
  wo: "Asalaamaalekum! Maa ngi la nuyu. Man laa Tapal. Na nga tudd?",
  pu: "Jam waali! Ko Tapal woni ɗoo. Hol innde maa?",
};

const NEXT_PROMPTS = {
  fr: {
    phone: (name) => `Merci ${name} ! Quel est votre numéro de téléphone ?`,
    role: 'Quelle est votre profession ou fonction ?',
    company: "Quel est le nom de votre entreprise ? Dites « non » si vous n'en avez pas.",
    email: "Quelle est votre adresse email ? Dites « non » pour passer.",
    packKey: 'Quel pack ? Dites 1 pour Starter à 15 000 F, 2 pour Pro à 22 500 F, ou 3 pour Business à 60 000 F.',
    images: 'Voulez-vous ajouter des images ? Photo de profil, logo, spécialisation ou couverture. Appuyez sur les boutons ou dites non pour passer.',
    complete: 'Parfait ! Votre commande est en cours de création...',
    invalid_phone: "Ce numéro ne semble pas valide. Tapez un numéro sénégalais, ex : 77 123 45 67.",
    invalid_email: "Cette adresse ne semble pas valide. Réessayez ou tapez « non » pour passer.",
    invalid_packKey: "Choisissez : 1 = Starter, 2 = Pro, 3 = Business.",
  },
  en: {
    phone: (name) => `Thanks ${name}! What is your phone number?`,
    role: 'What is your profession or role?',
    company: "What is your company name? Say 'no' if you don't have one.",
    email: "What is your email? Say 'no' to skip.",
    packKey: 'Which pack? Say 1 for Starter at 15,000F, 2 for Pro at 22,500F, or 3 for Business at 60,000F.',
    images: 'Want to add images? Profile photo, logo, specialization or cover. Tap the buttons or say no to skip.',
    complete: 'Your order is being created!',
    invalid_phone: "That number doesn't look right. Type a Senegalese number, e.g. 77 123 45 67.",
    invalid_email: "That email doesn't look valid. Try again or type 'no' to skip.",
    invalid_packKey: "Choose: 1 = Starter, 2 = Pro, 3 = Business.",
  },
  wo: {
    phone: (name) => `Jërejëf ${name}! Jox ma sa nimero bi.`,
    role: 'Lan ngay liggéey?',
    company: "Naka la sa liggéeykat di tudd? Wax déedéet soo amul.",
    email: "Ana sa iimeel? Wax déedéet ngir wàcc.",
    packKey: 'Ban benn nga bëgg? Wax 1 ngir Starter ci 15 000 F, 2 ngir Pro ci 22 500 F, walla 3 ngir Business ci 60 000 F.',
    images: 'Bëgg nga yokk sa nataal? Sa suuret, sa xët liggéey, walla sa kuwertiir. Tobbal ci bitoŋ yi walla wax déedéet.',
    complete: 'Baax na! Sa santaane moo ngi jëm...',
    invalid_phone: 'Nimero bi baaxul. Bindal nimero bu wér, ni: 77 123 45 67.',
    invalid_email: 'Iimeel bi baaxul. Jéemaatal walla wax déedéet.',
    invalid_packKey: 'Tànnal: 1 = Starter, 2 = Pro, 3 = Business.',
  },
  pu: {
    phone: (name) => `A jaaraama ${name}! Hokku am nimero maa.`,
    role: 'Hol ko ngolliɗaa?',
    company: 'Hol innde gollordu maa? Wiy alaa so alaa.',
    email: 'Hol iimeel maa? Wiy alaa ngam ɓennugo.',
    packKey: 'Hol feere njiɗɗaa? Wiy 1 ngam Starter e 15 000 F, 2 ngam Pro e 22 500 F, maa 3 ngam Business e 60 000 F.',
    images: 'Aɗa yiɗi ɓeydude natal? Natal maa, natal golle, maa kuwertiir. Ñoƴƴu bitoŋ ɗen maa wiy alaa.',
    complete: 'A wooɗi! Yamiroore maa ina yahda...',
    invalid_phone: 'Nimero oo moƴƴaani. Winndu nimero moƴƴo, wa: 77 123 45 67.',
    invalid_email: 'Iimeel oo moƴƴaani. Fuɗɗito maa winndu alaa.',
    invalid_packKey: 'Suɓo: 1 = Starter, 2 = Pro, 3 = Business.',
  },
};

const PLACEHOLDERS = {
  fullName: 'Ex: Mamadou Diallo',
  phone: 'Ex: 77 123 45 67',
  role: 'Ex: Développeur, Comptable...',
  company: 'Nom ou « non » pour passer',
  email: 'email@exemple.com ou « non »',
  packKey: '1 = Starter, 2 = Pro, 3 = Business',
  images: 'Dites « non » pour passer',
};

// ─── Correctif A — Client-side smart extraction (zero LLM) ──────────────

const SENEGAL_PHONES = /^(\+221|00221)?\s*[7][0-9]{8}$/;
const PHONE_DIGITS = /\b(7[0-9]\s?\d{3}\s?\d{2}\s?\d{2})\b/;
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
const SKIP_WORDS = /^(non|no|pas|skip|aucun|sans|rien|néant|nope|passer)$/i;
const PACK_MAP = {
  '1': 'starter', 'starter': 'starter', 'start': 'starter',
  'moins cher': 'starter', 'basic': 'starter', 'basique': 'starter',
  '15': 'starter', '15000': 'starter',
  '2': 'pro', 'pro': 'pro', 'premium': 'pro', 'meilleur': 'pro',
  '22': 'pro', '22500': 'pro',
  '3': 'business', 'business': 'business', 'equipe': 'business',
  'équipe': 'business', 'team': 'business', '5 cartes': 'business',
  '60': 'business', '60000': 'business',
};

function tryDirectExtract(text, field) {
  const t = text.trim().toLowerCase();

  if (field === 'phone') {
    const m = text.match(PHONE_DIGITS);
    if (m) {
      const digits = m[1].replace(/\s/g, '');
      return { value: '+221' + digits, confidence: 'high' };
    }
    if (SENEGAL_PHONES.test(text.replace(/\s/g, ''))) {
      const digits = text.replace(/\D/g, '').slice(-9);
      return { value: '+221' + digits, confidence: 'high' };
    }
    const rawDigits = text.replace(/\D/g, '');
    if (rawDigits.length >= 9) {
      const core = rawDigits.slice(-9);
      if (/^[789]\d{8}$/.test(core)) return { value: '+221' + core, confidence: 'high' };
    }
    return null;
  }

  if (field === 'email') {
    if (SKIP_WORDS.test(t)) return { value: null, confidence: 'high' };
    const m = text.match(EMAIL_RE);
    if (m) return { value: m[0].toLowerCase(), confidence: 'high' };
    const fixed = text
      .replace(/\s+arobase\s+/gi, '@')
      .replace(/\s+at\s+/gi, '@')
      .replace(/\s+point\s+/gi, '.')
      .replace(/\s+tiret\s+/gi, '-')
      .toLowerCase().replace(/\s/g, '');
    const m2 = fixed.match(EMAIL_RE);
    if (m2) return { value: m2[0], confidence: 'medium' };
    return null;
  }

  if (field === 'company') {
    if (SKIP_WORDS.test(t)) return { value: null, confidence: 'high' };
    if (t.length > 1 && t.length < 80) return { value: text.trim(), confidence: 'medium' };
    return null;
  }

  if (field === 'packKey') {
    if (PACK_MAP[t]) return { value: PACK_MAP[t], confidence: 'high' };
    for (const [key, val] of Object.entries(PACK_MAP)) {
      if (t.includes(key)) return { value: val, confidence: 'high' };
    }
    return null;
  }

  if (field === 'images') {
    if (SKIP_WORDS.test(t)) return { value: null, confidence: 'high' };
    return null;
  }

  if (field === 'fullName') {
    if (t.length < 2) return null;
    const words = text.trim().split(/\s+/);
    if (words.length >= 2 && !/\d/.test(text)) {
      const capitalized = words.map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      return { value: capitalized, confidence: 'medium' };
    }
    if (words.length === 1 && t.length >= 2 && !/\d/.test(text)) {
      return { value: text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase(), confidence: 'medium' };
    }
    return null;
  }

  if (field === 'role') {
    if (t.length > 2 && t.length < 100) {
      return { value: text.trim(), confidence: 'medium' };
    }
    return null;
  }

  return null;
}

// ─── Correctif B — Field advancement logic ──────────────

function isFieldAnswered(data, field) {
  return Object.prototype.hasOwnProperty.call(data, field);
}

function getNextUnansweredField(data) {
  return FIELDS.find(f => !isFieldAnswered(data, f)) ?? null;
}

function isAllComplete(data) {
  return Array.from(REQUIRED).every(f => isFieldAnswered(data, f) && data[f] != null);
}

function getNextPrompt(nextField, data, lang) {
  const prompts = NEXT_PROMPTS[lang] || NEXT_PROMPTS.fr;
  if (!nextField) return prompts.complete;
  const p = prompts[nextField];
  return typeof p === 'function' ? p(data.fullName || '') : p;
}

// ─── Component ──────────────

export default function VoiceAssistant({ isOpen, onClose }) {
  const [language, setLanguage] = useState(null);
  const [currentField, setCurrentField] = useState(null);
  const [collectedData, setCollectedData] = useState({});
  const [assistantMessage, setAssistantMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [designSuggestion, setDesignSuggestion] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [imageFiles, setImageFiles] = useState({});
  const [isRecordingWolof, setIsRecordingWolof] = useState(false);
  const wolofRecorderRef = useRef(null);
  const wolofChunksRef = useRef([]);

  const silenceTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const llmRetryRef = useRef(0);
  const processingRef = useRef(false);
  const collectedDataRef = useRef({});
  const currentFieldRef = useRef(null);
  const ttsFallbackRef = useRef(null);
  const confirmTimeoutRef = useRef(null);
  const processTranscriptRef = useRef(null);
  const commitAndAdvanceRef = useRef(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => { collectedDataRef.current = collectedData; }, [collectedData]);
  useEffect(() => { currentFieldRef.current = currentField; }, [currentField]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLanguage(null);
      setCurrentField(null);
      setCollectedData({});
      collectedDataRef.current = {};
      currentFieldRef.current = null;
      setAssistantMessage('');
      setIsProcessing(false);
      setIsComplete(false);
      setError(null);
      setCreatedOrder(null);
      setDesignSuggestion(null);
      setTextInput('');
      setPendingConfirm(null);
      setImageFiles({});
      setIsRecordingWolof(false);
      llmRetryRef.current = 0;
      lastTranscriptRef.current = '';
      resetTranscript();
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    } else {
      window.speechSynthesis.cancel();
      try { SpeechRecognition.stopListening(); } catch (_) {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (ttsFallbackRef.current) clearTimeout(ttsFallbackRef.current);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    }
  }, [isOpen, resetTranscript]);

  // ─── Correctif C — Speak with adaptive delay + echo protection ──────────────

  // ─── Wolof recording via HuggingFace ──────────────

  const startWolofRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      wolofChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) wolofChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(wolofChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return;
        setIsProcessing(true);
        try {
          const result = await voiceTranscribeWolof(blob, language);
          if (result.text && result.text.trim().length >= MIN_TRANSCRIPT_LEN) {
            processTranscriptRef.current(result.text.trim(), false);
          } else {
            setError(language === 'wo' ? 'Déglu ma sa baat. Jéemaatal.' : 'Mi nanngaani haala. Fuɗɗito.');
          }
        } catch (err) {
          console.error('[Voice] Wolof transcription error:', err);
          setError(language === 'wo' ? 'Defa am jum. Jéemaatal.' : 'Ina wɔɖi. Fuɗɗito.');
        } finally {
          setIsProcessing(false);
          setIsRecordingWolof(false);
        }
      };
      wolofRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingWolof(true);
    } catch (err) {
      console.error('[Voice] Mic access error:', err);
      setError('Impossible d\'accéder au microphone.');
    }
  }, []);

  const stopWolofRecording = useCallback(() => {
    if (wolofRecorderRef.current && wolofRecorderRef.current.state === 'recording') {
      wolofRecorderRef.current.stop();
    }
  }, []);

  // ─── Image upload handler ──────────────

  const handleImageUpload = useCallback((slotKey, file) => {
    if (!file) return;
    setImageFiles(prev => ({ ...prev, [slotKey]: file }));
  }, []);

  const handleSkipImages = useCallback(() => {
    commitAndAdvanceRef.current('images', null, language || 'fr');
  }, [language]);

  const handleConfirmImages = useCallback(() => {
    commitAndAdvanceRef.current('images', 'uploaded', language || 'fr');
  }, [language]);

  const startListeningNow = useCallback((lang) => {
    resetTranscript();
    lastTranscriptRef.current = '';
    try {
      SpeechRecognition.startListening({
        continuous: true,
        language: lang === 'en' ? 'en-US' : 'fr-FR',
      });
    } catch (_) {}
  }, [resetTranscript]);

  const speak = useCallback((text, lang) => {
    window.speechSynthesis.cancel();
    try { SpeechRecognition.stopListening(); } catch (_) {}
    resetTranscript();
    lastTranscriptRef.current = '';
    if (ttsFallbackRef.current) clearTimeout(ttsFallbackRef.current);

    if (!text) return;
    const effectiveLang = lang || language;

    // For Wolof/Pulaar: no TTS (browser can't speak these), just show text on screen
    if (effectiveLang === 'wo' || effectiveLang === 'pu') {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveLang === 'en' ? 'en-US' : 'fr-FR';
    utterance.rate = 0.88;

    const doStartListening = () => {
      if (window.speechSynthesis.speaking) return;
      const words = text.split(/\s+/).length;
      const delay = Math.max(800, words * 130 + 500);
      setTimeout(() => {
        resetTranscript();
        lastTranscriptRef.current = '';
        startListeningNow(effectiveLang);
      }, delay);
    };

    utterance.onend = doStartListening;

    // Chrome fallback: onend sometimes doesn't fire
    ttsFallbackRef.current = setTimeout(() => {
      if (!window.speechSynthesis.speaking) doStartListening();
    }, text.length * 60 + 2000);
    utterance.onstart = () => {
      if (ttsFallbackRef.current) clearTimeout(ttsFallbackRef.current);
    };

    window.speechSynthesis.speak(utterance);
  }, [language, resetTranscript, startListeningNow]);

  // Create voice order
  const createVoiceOrder = useCallback(async (data, lang) => {
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify({
        profile: {
          fullName: data.fullName,
          phone: data.phone,
          role: data.role,
          company: data.company || '',
          email: data.email || '',
          website: '',
          location: '',
          bio: '',
        },
        customization: {
          theme: 'executive',
          accent: '#d4a147',
          material: 'Pearl white',
          finish: 'Matte',
          foil: 'No foil',
          fontStyle: 'moderne',
          layout: 'classic',
          label: 'Tapal Signature',
        },
        orderContact: {
          name: data.fullName,
          phone: data.phone,
          email: data.email || '',
          deliveryCity: 'Dakar',
          deliveryAddress: '',
          postalCode: '',
          deliveryNotes: '',
        },
        packageSelection: { key: data.packKey },
        assets: {},
      }));

      // Attach image files if any
      for (const slot of IMAGE_SLOTS) {
        const file = imageFiles[slot.key];
        if (file) formData.append(slot.fieldName, file);
      }

      const { order } = await submitOrder(formData);
      setCreatedOrder(order);

      const suggestion = await voiceDesignSuggest({
        orderId: order.orderId ?? order.order_id,
        profileData: { role: data.role, company: data.company },
        language: lang ?? 'fr',
      });
      setDesignSuggestion(suggestion);
    } catch (err) {
      console.error('[Voice] Order creation error:', err);
      setError('Erreur lors de la création de la commande. Réessayez.');
    }
  }, [imageFiles]);

  // ─── Commit a field value and advance ──────────────

  const commitAndAdvance = useCallback((field, value, lang) => {
    const newData = { ...collectedDataRef.current, [field]: value };
    collectedDataRef.current = newData;
    setCollectedData(newData);
    llmRetryRef.current = 0;

    const nextField = getNextUnansweredField(newData);
    currentFieldRef.current = nextField;
    setCurrentField(nextField);

    const effectiveLang = lang || language || 'fr';
    const prompts = NEXT_PROMPTS[effectiveLang] || NEXT_PROMPTS.fr;

    if (!nextField || isAllComplete(newData)) {
      const msg = prompts.complete;
      setAssistantMessage(msg);
      setIsComplete(true);
      window.speechSynthesis.cancel();
      speak(msg, effectiveLang);
      setTimeout(() => createVoiceOrder(newData, effectiveLang), 500);
    } else {
      const nextPrompt = getNextPrompt(nextField, newData, effectiveLang);
      setAssistantMessage(nextPrompt);
      speak(nextPrompt, effectiveLang);
    }
  }, [language, speak, createVoiceOrder]);

  useEffect(() => { commitAndAdvanceRef.current = commitAndAdvance; }, [commitAndAdvance]);

  // ─── Correctif D — Confirmation bubble for medium-confidence ──────────────

  const showConfirmation = useCallback((field, value, lang) => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    try { SpeechRecognition.stopListening(); } catch (_) {}

    const displayValue = value ?? '(ignoré)';
    const label = FIELD_LABELS[field] || field;
    setAssistantMessage(`J'ai compris : ${label} = "${displayValue}". Corrigez ci-dessous ou attendez pour confirmer.`);

    const timeout = setTimeout(() => {
      setPendingConfirm(null);
      confirmTimeoutRef.current = null;
      commitAndAdvance(field, value, lang);
    }, CONFIRM_DELAY_MS);

    confirmTimeoutRef.current = timeout;
    setPendingConfirm({ field, value, label });
  }, [commitAndAdvance]);

  const cancelConfirmation = useCallback(() => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    confirmTimeoutRef.current = null;
    setPendingConfirm(null);
    const field = currentFieldRef.current;
    const lang = language || 'fr';
    const prompt = getNextPrompt(field, collectedDataRef.current, lang);
    setAssistantMessage(prompt);
    speak(prompt, lang);
  }, [language, speak]);

  // ─── Process transcript ──────────────

  const processTranscript = useCallback(async (text, isTyped = false) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < MIN_TRANSCRIPT_LEN || processingRef.current || isComplete) return;
    if (pendingConfirm) return;

    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try { SpeechRecognition.stopListening(); } catch (_) {}

    try {
      const field = currentFieldRef.current;
      if (!field) {
        processingRef.current = false;
        setIsProcessing(false);
        return;
      }

      const lang = language || 'fr';
      const prompts = NEXT_PROMPTS[lang] || NEXT_PROMPTS.fr;

      // 1. Try client-side direct extraction (instant, no API)
      const result = tryDirectExtract(trimmed, field);

      if (result && result.confidence === 'high') {
        // High confidence → advance immediately
        commitAndAdvance(field, result.value, lang);
      } else if (result && result.confidence === 'medium') {
        // Medium confidence → show confirmation bubble
        showConfirmation(field, result.value, lang);
      } else if (isTyped) {
        // Typed input, no extraction → specific error for structured fields
        const invalidKey = `invalid_${field}`;
        if (prompts[invalidKey]) {
          setAssistantMessage(prompts[invalidKey]);
          setError(prompts[invalidKey]);
        } else {
          // For fullName/role typed: just accept
          const accepted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          commitAndAdvance(field, accepted, lang);
        }
      } else {
        // Voice input, no direct match → LLM fallback (only fullName, role)
        if (field !== 'fullName' && field !== 'role') {
          const msg = `Je n'arrive pas à comprendre. Tapez votre ${FIELD_LABELS[field]} ci-dessous.`;
          setAssistantMessage(msg);
          setError(msg);
        } else {
          llmRetryRef.current++;
          if (llmRetryRef.current > MAX_LLM_RETRIES) {
            const msg = `Je n'arrive pas à comprendre. Tapez votre ${FIELD_LABELS[field]} ci-dessous.`;
            setAssistantMessage(msg);
            setError(msg);
            llmRetryRef.current = 0;
          } else {
            try {
              const llmResult = await voiceExtract({
                transcript: trimmed,
                collectedData: collectedDataRef.current,
                stepIndex: FIELDS.indexOf(field),
                language: lang,
                sessionId,
              });

              // Handle new simplified LLM response format
              if (llmResult.extracted && typeof llmResult.extracted === 'object') {
                const llmValue = llmResult.extracted[field] || llmResult.extracted.extracted;
                if (llmValue && llmValue !== 'null') {
                  showConfirmation(field, String(llmValue).trim(), lang);
                } else {
                  const retryMsg = "Je n'ai pas bien compris, pouvez-vous répéter ?";
                  setAssistantMessage(retryMsg);
                  speak(retryMsg, lang);
                }
              } else if (typeof llmResult.extracted === 'string' && llmResult.extracted) {
                showConfirmation(field, llmResult.extracted, lang);
              } else {
                const retryMsg = "Je n'ai pas bien compris, pouvez-vous répéter ?";
                setAssistantMessage(retryMsg);
                speak(retryMsg, lang);
              }
            } catch (llmErr) {
              console.error('[Voice] LLM error:', llmErr);
              const msg = `Erreur réseau. Tapez votre ${FIELD_LABELS[field]} ci-dessous.`;
              setError(msg);
              setAssistantMessage(msg);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Voice] Process error:', err);
      setError('Erreur. Tapez votre réponse ci-dessous.');
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      resetTranscript();
      lastTranscriptRef.current = '';
    }
  }, [language, sessionId, isComplete, pendingConfirm, speak, resetTranscript, commitAndAdvance, showConfirmation]);

  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);

  // Silence detection
  useEffect(() => {
    if (!transcript || transcript.trim().length < MIN_TRANSCRIPT_LEN) return;
    if (transcript === lastTranscriptRef.current) return;
    if (pendingConfirm) return;
    lastTranscriptRef.current = transcript;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    silenceTimerRef.current = setTimeout(() => {
      if (transcript.trim().length >= MIN_TRANSCRIPT_LEN && !processingRef.current && !isComplete) {
        processTranscript(transcript);
      }
    }, SILENCE_TIMEOUT_MS);

    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [transcript, isComplete, pendingConfirm, processTranscript]);

  // Start session after language selection
  const startSession = useCallback((lang) => {
    setLanguage(lang);
    const firstField = FIELDS[0];
    setCurrentField(firstField);
    currentFieldRef.current = firstField;
    const firstPrompt = FIRST_PROMPTS[lang] || FIRST_PROMPTS.fr;
    setAssistantMessage(firstPrompt);
    setTimeout(() => speak(firstPrompt, lang), 300);
  }, [speak]);

  // Text input submit
  const handleTextSubmit = useCallback((e) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing && !isComplete) {
      if (pendingConfirm) {
        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        confirmTimeoutRef.current = null;
        setPendingConfirm(null);
      }
      processTranscript(textInput.trim(), true);
      setTextInput('');
    }
  }, [textInput, isProcessing, isComplete, pendingConfirm, processTranscript]);

  // Checkout
  const handleCheckout = useCallback(async () => {
    if (!createdOrder) return;
    const orderId = createdOrder.orderId ?? createdOrder.order_id;
    try {
      const result = await startCheckout(orderId);
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setError('Paiement non configuré. Contactez TEKKO via WhatsApp.');
      }
    } catch (err) {
      console.error('[Voice] Checkout error:', err);
      setError('Erreur de paiement. Essayez depuis le Studio.');
    }
  }, [createdOrder]);

  // Close handler
  const handleClose = useCallback(() => {
    window.speechSynthesis.cancel();
    try { SpeechRecognition.stopListening(); } catch (_) {}
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (ttsFallbackRef.current) clearTimeout(ttsFallbackRef.current);
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const slug = createdOrder?.slug ?? designSuggestion?.slug;
  const cardUrl = slug ? `/c/${slug}` : null;

  return (
    <div className="voice-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="voice-modal">

        {/* Header */}
        <div className="voice-header">
          <span className="voice-brand">🎤 Tapal Voice</span>
          <button type="button" className="voice-close" onClick={handleClose} aria-label="Fermer">✕</button>
        </div>

        {/* Browser not supported */}
        {!browserSupportsSpeechRecognition && !language && (
          <div className="voice-body">
            <div className="voice-unsupported">
              <p>Votre navigateur ne supporte pas la reconnaissance vocale.</p>
              <p>Utilisez Chrome ou Edge, ou <button type="button" className="voice-link-btn" onClick={handleClose}>passez au Studio classique</button>.</p>
            </div>
          </div>
        )}

        {/* Language selection */}
        {browserSupportsSpeechRecognition && !language && (
          <div className="voice-body">
            <p className="voice-lang-title">Choisissez votre langue</p>
            <div className="voice-lang-grid">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className="voice-lang-btn"
                  onClick={() => startSession(lang.code)}
                >
                  <span className="voice-lang-flag">{lang.flag}</span>
                  <span>{lang.label}</span>
                  {lang.beta && <span className="voice-beta-badge">bêta</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active session */}
        {language && !isComplete && (
          <div className="voice-body">
            <div className="voice-assistant-bubble">
              <span className="voice-assistant-icon">🤖</span>
              <p className="voice-assistant-text">{assistantMessage || '...'}</p>
            </div>

            {/* Correctif D — Confirmation bubble */}
            {pendingConfirm && (
              <div className="voice-confirm-bubble">
                <span className="voice-confirm-label">J'ai compris :</span>
                <strong>{pendingConfirm.value ?? '(ignoré)'}</strong>
                <span className="voice-confirm-timer">Auto-confirmation dans 2.5s…</span>
                <button type="button" onClick={cancelConfirmation}>✏️ Corriger</button>
              </div>
            )}

            {/* Image upload step */}
            {currentField === 'images' && (
              <div className="voice-image-upload-area">
                <div className="voice-image-grid">
                  {IMAGE_SLOTS.map((slot) => (
                    <div key={slot.key} className={`voice-image-slot ${imageFiles[slot.key] ? 'has-file' : ''}`}>
                      <label className="voice-image-label">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleImageUpload(slot.key, e.target.files[0])}
                        />
                        <span className="voice-image-icon">{slot.icon}</span>
                        <span className="voice-image-name">{slot.label}</span>
                        {imageFiles[slot.key] && (
                          <span className="voice-image-check">✅</span>
                        )}
                      </label>
                      {imageFiles[slot.key] && (
                        <img
                          src={URL.createObjectURL(imageFiles[slot.key])}
                          alt={slot.label}
                          className="voice-image-preview"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="voice-image-actions">
                  <button type="button" className="voice-skip-images" onClick={handleSkipImages}>
                    ⏭️ Passer
                  </button>
                  {Object.keys(imageFiles).length > 0 && (
                    <button type="button" className="voice-confirm-images" onClick={handleConfirmImages}>
                      ✅ Valider les images
                    </button>
                  )}
                </div>
              </div>
            )}

            {Object.keys(collectedData).length > 0 && (
              <div className="voice-collected">
                {Object.entries(collectedData).map(([key, val]) => (
                  val != null && (
                    <div key={key} className="voice-field-chip">
                      <span className="voice-field-label">{FIELD_LABELS[key] || key}</span>
                      <span className="voice-field-value">{key === 'packKey' ? (PACK_LABELS[val] || val) : val}</span>
                    </div>
                  )
                ))}
              </div>
            )}

            <div className="voice-listen-area">
              {/* Wolof/Pulaar: manual record button */}
              {(language === 'wo' || language === 'pu') && currentField !== 'images' && !isComplete && (
                <div className="voice-wolof-record">
                  {!isRecordingWolof ? (
                    <button type="button" className="voice-record-btn" onClick={startWolofRecording} disabled={isProcessing}>
                      🎙️ {language === 'wo' ? 'Waxal' : 'Haalan'}
                    </button>
                  ) : (
                    <button type="button" className="voice-record-btn recording" onClick={stopWolofRecording}>
                      ⏹️ {language === 'wo' ? 'Taxaw' : 'Dartin'}
                    </button>
                  )}
                  <span className="voice-wolof-hint">
                    {language === 'wo' ? 'Bës bi, wax ci Wolof, ba noppi' : 'Ñoƴƴu, haalu Pulaar, ngaraa dartin'}
                  </span>
                </div>
              )}
              {listening && !pendingConfirm && (
                <div className="voice-listening">
                  <span className="voice-pulse"></span>
                  <span>Écoute en cours...</span>
                </div>
              )}
              {isProcessing && (
                <div className="voice-processing">
                  <span className="voice-spinner"></span>
                  <span>Traitement...</span>
                </div>
              )}
              {transcript && <p className="voice-transcript">"{transcript}"</p>}
            </div>

            {error && <div className="voice-error">{error}</div>}

            <p className="voice-keyboard-hint">⌨️ Vous pouvez aussi taper votre réponse :</p>
            <form className="voice-input-form" onSubmit={handleTextSubmit}>
              <input
                type="text"
                className="voice-text-input"
                placeholder={PLACEHOLDERS[currentField] || 'Tapez ici...'}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(e); } }}
                disabled={isProcessing}
              />
              <button type="submit" className="voice-send-btn" disabled={isProcessing || !textInput.trim()}>
                Envoyer
              </button>
            </form>
          </div>
        )}

        {/* Completed */}
        {isComplete && (
          <div className="voice-body">
            <div className="voice-success-msg">
              <span className="voice-check">✅</span>
              <p>{assistantMessage}</p>
            </div>

            {designSuggestion && (
              <div className="voice-theme-badge" style={{ borderColor: designSuggestion.accent }}>
                Thème suggéré : <strong>{designSuggestion.themeName}</strong>
              </div>
            )}

            {cardUrl && (
              <div className="voice-preview-wrap">
                <iframe src={cardUrl} title="Aperçu de votre carte" className="voice-preview-iframe" />
              </div>
            )}

            {error && <div className="voice-error">{error}</div>}

            <div className="voice-actions">
              <button type="button" className="voice-pay-btn" onClick={handleCheckout} disabled={!createdOrder}>
                ✅ Valider et payer
              </button>
              {slug && (
                <a href={`/?edit=${slug}`} className="voice-edit-link" onClick={handleClose}>
                  ✏️ Modifier dans le Studio
                </a>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

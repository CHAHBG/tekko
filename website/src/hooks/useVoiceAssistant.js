import { useCallback, useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { voiceExtract, voiceDesignSuggest, submitOrder, startCheckout } from '../lib/api';
import { packCatalog } from '../lib/catalog';

const SILENCE_TIMEOUT_MS = 1800;

const FIRST_PROMPTS = {
  fr: 'Bonjour ! Je suis l\'assistant Tapal. Quel est votre nom complet ?',
  en: 'Hello! I\'m the Tapal assistant. What is your full name?',
  wo: 'Bonjour ! Tapal assistant bi laa. Nanga def ? Na nga tudd ?',
  pu: 'Bonjour ! Mi woni Tapal assistant. Hol innde maa mon ?',
};

const FIELD_ORDER = ['fullName', 'phone', 'role', 'company', 'email', 'packKey'];

export function useVoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState(null); // null = language selection screen
  const [stepIndex, setStepIndex] = useState(0);
  const [collectedData, setCollectedData] = useState({});
  const [assistantMessage, setAssistantMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [designSuggestion, setDesignSuggestion] = useState(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const silenceTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');
  const retryCountRef = useRef(0);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // Speak text via Web Speech API
  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-US' : 'fr-FR';
    utterance.rate = 0.95;
    utterance.onend = () => {
      // Start listening after TTS finishes
      try {
        SpeechRecognition.startListening({
          continuous: true,
          language: language === 'en' ? 'en-US' : 'fr-FR',
        });
      } catch (_) { /* ignore if already listening */ }
    };
    window.speechSynthesis.speak(utterance);
  }, [language]);

  // Process transcript via LLM
  const processTranscript = useCallback(async (text) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      SpeechRecognition.stopListening();
    } catch (_) { /* ignore */ }

    try {
      const result = await voiceExtract({
        transcript: text.trim(),
        collectedData,
        stepIndex,
        language: language ?? 'fr',
        sessionId,
      });

      retryCountRef.current = 0;

      // Merge extracted data
      const newData = { ...collectedData, ...result.extracted };
      setCollectedData(newData);

      // Count filled fields to advance stepIndex
      let nextStep = 0;
      for (const field of FIELD_ORDER) {
        if (newData[field] !== undefined && newData[field] !== null) {
          nextStep++;
        } else {
          break;
        }
      }
      setStepIndex(nextStep);

      setAssistantMessage(result.nextPrompt);

      if (result.complete) {
        setIsComplete(true);
        window.speechSynthesis.cancel();
        speak(result.nextPrompt);
        // Create order after short delay to let TTS finish
        setTimeout(() => createVoiceOrder(newData), 500);
      } else {
        speak(result.nextPrompt);
      }
    } catch (err) {
      console.error('[Voice] Extract error:', err);
      retryCountRef.current++;

      if (retryCountRef.current >= 2) {
        setError('La reconnaissance vocale ne fonctionne pas. Utilisez le clavier.');
      } else {
        const retryMsg = "Je n'ai pas bien compris, pouvez-vous répéter ?";
        setAssistantMessage(retryMsg);
        speak(retryMsg);
      }
    } finally {
      setIsProcessing(false);
      resetTranscript();
    }
  }, [collectedData, stepIndex, language, sessionId, isProcessing, speak, resetTranscript]);

  // Silence detection — submit after 1.8s of no new speech
  useEffect(() => {
    if (!transcript || transcript === lastTranscriptRef.current) return;

    lastTranscriptRef.current = transcript;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      if (transcript.trim() && !isProcessing && !isComplete) {
        processTranscript(transcript);
      }
    }, SILENCE_TIMEOUT_MS);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, isProcessing, isComplete, processTranscript]);

  // Create draft order from collected voice data
  const createVoiceOrder = useCallback(async (data) => {
    try {
      const packInfo = packCatalog[data.packKey] ?? packCatalog.pro;
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

      const { order } = await submitOrder(formData);
      setCreatedOrder(order);

      // Suggest theme based on role
      const suggestion = await voiceDesignSuggest({
        orderId: order.orderId ?? order.order_id,
        profileData: { role: data.role, company: data.company },
        language: language ?? 'fr',
      });
      setDesignSuggestion(suggestion);
    } catch (err) {
      console.error('[Voice] Order creation error:', err);
      setError('Erreur lors de la création de la commande. Réessayez.');
    }
  }, [language]);

  // Start the voice session (after language selection)
  const startSession = useCallback((lang) => {
    setLanguage(lang);
    const firstPrompt = FIRST_PROMPTS[lang] || FIRST_PROMPTS.fr;
    setAssistantMessage(firstPrompt);
    // Small delay to let the modal render
    setTimeout(() => speak(firstPrompt), 300);
  }, [speak]);

  // Handle keyboard input fallback
  const submitText = useCallback((text) => {
    if (!text.trim() || isProcessing || isComplete) return;
    processTranscript(text);
  }, [isProcessing, isComplete, processTranscript]);

  // Open modal
  const open = useCallback(() => {
    setIsOpen(true);
    setLanguage(null);
    setStepIndex(0);
    setCollectedData({});
    setAssistantMessage('');
    setIsProcessing(false);
    setIsComplete(false);
    setError(null);
    setCreatedOrder(null);
    setDesignSuggestion(null);
    retryCountRef.current = 0;
    resetTranscript();
  }, [resetTranscript]);

  // Close modal + cleanup
  const close = useCallback(() => {
    setIsOpen(false);
    window.speechSynthesis.cancel();
    try { SpeechRecognition.stopListening(); } catch (_) { /* ignore */ }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  // Checkout (redirect to Wave)
  const checkout = useCallback(async () => {
    if (!createdOrder) return;
    const orderId = createdOrder.orderId ?? createdOrder.order_id;
    try {
      const result = await startCheckout(orderId);
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      }
    } catch (err) {
      console.error('[Voice] Checkout error:', err);
      setError('Erreur de paiement. Essayez depuis le Studio.');
    }
  }, [createdOrder]);

  return {
    isOpen,
    open,
    close,
    language,
    startSession,
    stepIndex,
    collectedData,
    assistantMessage,
    transcript,
    listening,
    isProcessing,
    isComplete,
    error,
    createdOrder,
    designSuggestion,
    submitText,
    checkout,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { fetchPublicCard } from '../lib/api';
import { getAssetDisplayUrl, getInitials, themeCatalog, socialFields } from '../lib/catalog';

const fontStyleMap = {
  moderne:   "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  elegant:   "Georgia, 'Times New Roman', serif",
  technique: "'Courier New', Courier, monospace",
  arrondi:   "'Trebuchet MS', 'Comic Sans MS', Nunito, Arial, sans-serif",
  roboto:    "'Roboto', sans-serif",
  sf:        "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
  segoe:     "'Segoe UI', Calibri, Arial, sans-serif",
};

function normalizeWebsite(url) {
	if (!url) return '#';
	return url.startsWith('http') ? url : `https://${url}`;
}

function displayWebsite(url) {
	return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function buildVCard(profile, photoBase64, bannerBase64) {
	// Split "SOKHNA DIENG" into first name / last name for N: field
	const fullName = profile.fullName ?? '';
	const nameParts = fullName.trim().split(/\s+/);
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	// Parse location "QP38+HMR, Rufisque, Sénégal" into ADR fields
	let adrLine = '';
	if (profile.location) {
		const parts = profile.location.split(',').map((s) => s.trim());
		if (parts.length >= 3) {
			// street ; city ; state ; zip ; country
			adrLine = `ADR;TYPE=WORK:;;${parts[0]};${parts[1]};;;${parts[parts.length - 1]}`;
		} else if (parts.length === 2) {
			adrLine = `ADR;TYPE=WORK:;;${parts[0]};${parts[1]};;;`;
		} else {
			adrLine = `ADR;TYPE=WORK:;;${parts[0]};;;;`;
		}
	}

	const lines = [
		'BEGIN:VCARD',
		'VERSION:3.0',
		`N:${lastName};${firstName};;;`,
		`FN:${fullName}`,
		profile.company ? `ORG:${profile.company}` : '',
		profile.role ? `TITLE:${profile.role}` : '',
		profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : '',
		profile.email ? `EMAIL:${profile.email}` : '',
		profile.website ? `URL:${normalizeWebsite(profile.website)}` : '',
		profile.bio ? `NOTE:${profile.bio.replace(/\n/g, '\\n')}` : '',
		adrLine || '',
		// Use banner/cover as the contact poster photo (shows on iOS/Android), fallback to avatar
		(bannerBase64 || photoBase64) ? `PHOTO;ENCODING=b;TYPE=JPEG:${bannerBase64 || photoBase64}` : '',
		photoBase64 && bannerBase64 ? `LOGO;ENCODING=b;TYPE=JPEG:${photoBase64}` : '',
		'END:VCARD',
	].filter(Boolean);
	return lines.join('\r\n');
}

/* ── SVG icons ─────────────────────────────────────────────── */
const PhoneIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.7 9.65 19.79 19.79 0 01.63 1a2 2 0 012-1.81h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.1A16 16 0 0016.72 16.9l.96-.95a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
	</svg>
);
const EmailIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
	</svg>
);
const WebIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
	</svg>
);
const LocationIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
	</svg>
);
const DownloadIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
		<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
	</svg>
);
const ShareIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
		<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
	</svg>
);

const ICON_MAP = {
	phone: PhoneIcon,
	email: EmailIcon,
	web: WebIcon,
	location: LocationIcon,
};

/* ── Social SVG icons (brand marks) ─────────────────────── */
const SocialLinkedin = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
const SocialInstagram = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
const SocialX = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const SocialFacebook = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const SocialTiktok = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>;
const SocialYoutube = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
const SocialDiscord = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561 19.9312 19.9312 0 005.9932 3.0294.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286 19.8975 19.8975 0 006.0023-3.0294.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>;
const SocialGithub = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>;
const SocialSnapchat = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.017.014c2.01.02 3.603.776 4.741 1.973 1.068 1.124 1.74 2.675 1.863 4.574.023.358.022.721-.003 1.088.313.106.646.16.997.138a1.09 1.09 0 01.832.302.937.937 0 01.27.708c-.034.456-.384.792-.78.97-.108.048-.222.082-.328.114-.307.092-.624.188-.744.413-.072.136-.04.316.094.537.006.01.49.845 1.236 1.432.453.357.998.617 1.635.716.21.033.37.19.406.398.044.257-.1.555-.442.721a4.174 4.174 0 01-1.138.376c-.066.012-.126.062-.146.123-.066.2-.15.438-.365.545-.301.148-.696.128-1.226.098-.37-.021-.792-.045-1.284.023a3.753 3.753 0 00-.748.222c-.69.295-1.315.921-2.054 1.08-.06.014-.124.02-.185.02H12c-.062 0-.125-.007-.185-.02-.74-.159-1.365-.785-2.055-1.08a3.762 3.762 0 00-.748-.222c-.492-.068-.914-.044-1.284-.023-.53.03-.925.05-1.226-.098-.215-.107-.3-.346-.365-.545-.02-.061-.08-.111-.146-.123a4.174 4.174 0 01-1.138-.376c-.343-.166-.486-.464-.442-.721.036-.209.196-.365.406-.398.637-.099 1.182-.36 1.635-.716.747-.587 1.23-1.422 1.236-1.432.134-.22.166-.401.094-.537-.12-.225-.437-.321-.744-.413a3.118 3.118 0 01-.328-.114c-.396-.178-.746-.514-.78-.97a.937.937 0 01.27-.708 1.09 1.09 0 01.832-.302c.351.022.684-.032.997-.138a12.39 12.39 0 01-.003-1.088c.123-1.9.795-3.45 1.863-4.574C8.412.79 10.006.033 12.017.014z"/></svg>;
const SocialWhatsapp = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.85L.073 23.928a.5.5 0 00.611.611l6.181-1.462A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.384l-.36-.214-3.732.882.897-3.63-.236-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>;

const SOCIAL_ICON_MAP = {
	linkedin: SocialLinkedin, instagram: SocialInstagram, x: SocialX, facebook: SocialFacebook,
	tiktok: SocialTiktok, youtube: SocialYoutube, discord: SocialDiscord, github: SocialGithub,
	snapchat: SocialSnapchat, whatsapp: SocialWhatsapp,
};

const SOCIAL_URL_PREFIXES = {
	linkedin: 'https://linkedin.com/in/',
	instagram: 'https://instagram.com/',
	x: 'https://x.com/',
	facebook: 'https://facebook.com/',
	tiktok: 'https://tiktok.com/@',
	youtube: 'https://youtube.com/@',
	discord: 'https://discord.gg/',
	github: 'https://github.com/',
	snapchat: 'https://snapchat.com/add/',
	whatsapp: 'https://wa.me/',
};

function buildSocialUrl(key, value) {
	if (!value) return '#';
	if (value.startsWith('http')) return value;
	return (SOCIAL_URL_PREFIXES[key] || '') + value;
}

function classifyCardError(error) {
	if (!navigator.onLine) return { kind: 'offline', message: 'Pas de connexion internet. Verifiez le reseau puis reessayez.' };
	const code = error?.code || error?.message;
	if (error?.status === 403 && code === 'expired_preview') {
		return {
			kind: 'expired',
			message: 'Le lien de previsualisation a expire (duree limitee a 2 heures). Votre carte sera accessible apres confirmation du paiement.',
		};
	}
	if (error?.status === 404) {
		return { kind: 'notfound', message: "Cette carte n'existe pas ou n'est pas encore activee. Verifiez le lien ou contactez-nous." };
	}
	return { kind: 'network', message: error?.message || 'Impossible de charger la carte. Reessayez dans un instant.' };
}

export function PublicCardView({ slug }) {
	const [state, setState] = useState({ loading: true, error: '', errorKind: '', card: null });
	const [qrUrl, setQrUrl] = useState('');
	const [toast, setToast] = useState('');
	const toastTimer = useRef(null);

	useEffect(() => {
		let isMounted = true;
		fetchPublicCard(slug)
			.then((response) => {
				if (isMounted) {
					setState({ loading: false, error: '', errorKind: '', card: response.card });
					const name = response.card?.profile?.fullName;
					if (name) document.title = `${name} · Tapal`;
				}
			})
			.catch((error) => {
				if (!isMounted) return;
				const { kind, message } = classifyCardError(error);
				setState({ loading: false, error: message, errorKind: kind, card: null });
			});
		return () => { isMounted = false; };
	}, [slug]);

	// Generate QR code — links to user's website if provided, otherwise card URL
	useEffect(() => {
		if (!state.card) return;
		const target = state.card.profile?.website
			? normalizeWebsite(state.card.profile.website)
			: window.location.href;
		QRCode.toDataURL(target, { margin: 1, width: 300, color: { dark: '#1a3528', light: '#ffffff' } })
			.then(setQrUrl)
			.catch(() => setQrUrl(''));
	}, [state.card]);

	const theme = useMemo(() => {
		if (!state.card) return themeCatalog.studio;
		return themeCatalog[state.card.customization?.themeKey] ?? themeCatalog.studio;
	}, [state.card]);

	function showToast(msg) {
		setToast(msg);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(''), 2500);
	}

	if (state.loading) {
		return (
			<div className="ecard-page ecard-loading ecard-loading--skeleton" aria-busy="true" aria-label="Chargement de la carte">
				<div className="ecard-skeleton-card">
					<div className="ecard-skeleton ecard-skeleton--avatar" />
					<div className="ecard-skeleton ecard-skeleton--title" />
					<div className="ecard-skeleton ecard-skeleton--line" />
					<div className="ecard-skeleton ecard-skeleton--line short" />
				</div>
			</div>
		);
	}
	if (state.error || !state.card) {
		const kind = state.errorKind || 'notfound';
		const title = kind === 'expired' ? 'Apercu expire' : kind === 'offline' ? 'Hors ligne' : kind === 'network' ? 'Erreur reseau' : 'Carte introuvable';
		const icon = kind === 'expired' ? '⏱' : kind === 'offline' ? '📡' : kind === 'network' ? '⚠' : '🔍';
		return (
			<div className="ecard-page ecard-error">
				<div className="ecard-expired-msg">
					<span className="ecard-expired-icon" aria-hidden="true">{icon}</span>
					<h2>{title}</h2>
					<p>{state.error}</p>
					<a href="/" className="ecard-back-link">← Retour a l&apos;accueil</a>
				</div>
			</div>
		);
	}

	const { customization, profile, assets } = state.card;
	const accent = customization?.accent || theme.accent;
	const highlight = theme.highlight || accent;
	const avatarUrl = getAssetDisplayUrl(assets?.avatar);
	const coverUrl = getAssetDisplayUrl(assets?.cover);
	const logoUrl = getAssetDisplayUrl(assets?.logo);
	const initials = getInitials(profile.fullName);
	const cardUrl = window.location.href.replace(/^https?:\/\//, '').replace(/\/$/, '');
	const qrTarget = profile.website ? displayWebsite(profile.website) : cardUrl;
	const layout = customization?.cardLayout || 'classic';

	const textColor = customization?.textColor || null;
	const bgColor = customization?.bgColor || null;

	const cssVars = {
		'--ecard-accent': accent,
		'--ecard-highlight': highlight,
		'--ecard-font': fontStyleMap[customization?.fontStyle] || fontStyleMap.moderne,
		...(textColor ? { '--ecard-text': textColor } : {}),
		...(bgColor ? { '--ecard-bg': bgColor } : {}),
	};

	// Build contact rows
	const contacts = [
		profile.phone   && { key: 'phone',    label: 'Téléphone', value: profile.phone,                     href: `tel:${profile.phone}`,                icon: 'phone' },
		profile.email   && { key: 'email',     label: 'Email',     value: profile.email,                     href: `mailto:${profile.email}`,             icon: 'email' },
		profile.website && { key: 'web',       label: 'Site web',  value: displayWebsite(profile.website),   href: normalizeWebsite(profile.website),     icon: 'web' },
		profile.location && { key: 'location', label: 'Lieu',      value: profile.location,                  href: `https://maps.google.com/maps?q=${encodeURIComponent(profile.location)}`, icon: 'location' },
	].filter(Boolean);

	// Social links that have a value
	const activeSocials = socialFields.filter((sf) => profile[sf.key]?.trim()).map((sf) => ({
		key: sf.key, label: sf.label, url: buildSocialUrl(sf.key, profile[sf.key]),
		Icon: SOCIAL_ICON_MAP[sf.key],
	}));

	async function downloadVCard() {
		let photoBase64 = '';
		let bannerBase64 = '';
		if (avatarUrl) {
			try {
				const resp = await fetch(avatarUrl);
				const blob = await resp.blob();
				photoBase64 = await new Promise((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result.split(',')[1] || '');
					reader.readAsDataURL(blob);
				});
			} catch { /* skip photo if fetch fails */ }
		}
		if (coverUrl) {
			try {
				const resp = await fetch(coverUrl);
				const blob = await resp.blob();
				bannerBase64 = await new Promise((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result.split(',')[1] || '');
					reader.readAsDataURL(blob);
				});
			} catch { /* skip banner if fetch fails */ }
		}
		const vcf = new Blob([buildVCard(profile, photoBase64, bannerBase64)], { type: 'text/vcard' });
		const url = URL.createObjectURL(vcf);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${(profile.fullName ?? 'contact').replace(/\s+/g, '_')}.vcf`;
		a.click();
		URL.revokeObjectURL(url);
		showToast('Contact sauvegardé ✓');
	}

	function shareCard() {
		if (navigator.share) {
			navigator.share({ title: profile.fullName, url: window.location.href }).catch(() => {});
		} else {
			navigator.clipboard.writeText(window.location.href)
				.then(() => showToast('Lien copié ✓'))
				.catch(() => {});
		}
	}

	const sharePreviewUrl = `${window.location.origin}/share/${encodeURIComponent(slug)}`;

	function copySharePreviewLink() {
		navigator.clipboard.writeText(sharePreviewUrl)
			.then(() => showToast('Lien apercu WhatsApp copie'))
			.catch(() => {});
	}

	/* ── Shared sub-components ──────────────────────────── */

	const socialBlock = activeSocials.length > 0 ? (
		<div className="ecard-social-row">
			{activeSocials.map((s) => (
				<a key={s.key} className="ecard-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}
					aria-label={s.label}
					style={{ color: accent }}>
					<s.Icon />
				</a>
			))}
		</div>
	) : null;
	const avatarBlock = (cls = 'ecard-avatar') => (
		<div className={cls}>
			{avatarUrl ? (
				<>
					<img src={avatarUrl} alt={profile.fullName}
						style={{
							objectPosition: `${assets?.avatar?.positionX ?? 50}% ${assets?.avatar?.positionY ?? 50}%`,
							transform: `scale(${assets?.avatar?.zoom ?? 1})`,
							opacity: assets?.avatar?.opacity ?? 1,
						}} />
					<a className="ecard-avatar-dl" href={avatarUrl} download title="Télécharger la photo">
						<DownloadIcon />
					</a>
				</>
			) : <span className="ecard-avatar-initials">{initials}</span>}
		</div>
	);

	const contactsBlock = (
		<div className="ecard-contacts">
			{contacts.map((c) => {
				const Icon = ICON_MAP[c.icon];
				const inner = (
					<>
						<div className="ecard-c-icon" style={{ borderColor: `${accent}30`, background: `${accent}0a` }}>
							<Icon />
						</div>
						<div className="ecard-c-meta">
							<span className="ecard-c-label">{c.label}</span>
							<span className="ecard-c-val">{c.value}</span>
						</div>
					</>
				);
				return c.href ? (
					<a key={c.key} className="ecard-c-link" href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>
				) : (
					<div key={c.key} className="ecard-c-link">{inner}</div>
				);
			})}
		</div>
	);

	const qrBlock = (
		<div className="ecard-qr-section" style={{ borderColor: `${accent}18`, background: `${accent}05` }}>
			{qrUrl && (
				<div className="ecard-qr-box">
					<img src={qrUrl} alt="QR" />
				</div>
			)}
			<div className="ecard-qr-right">
				<div className="ecard-qr-hint">
					Scanner pour ouvrir
					<strong>{qrTarget}</strong>
				</div>
				<div className="ecard-btn-actions">
					<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
						<DownloadIcon />
						Sauvegarder le contact
					</button>
					<button className="ecard-btn-share" style={{ color: accent, borderColor: `${accent}55` }} onClick={shareCard}>
						<ShareIcon />
						Partager cette carte
					</button>
				</div>
			</div>
		</div>
	);

	const footerBlock = (
		<div className="ecard-footer">
			<div className="ecard-nfc-row">
				<span className="ecard-nfc-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
				<span className="ecard-nfc-txt">NFC · QR</span>
			</div>
			<span className="ecard-footer-domain">{cardUrl}</span>
			<button type="button" className="ecard-share-preview-btn" onClick={copySharePreviewLink}>
				Copier lien apercu (WhatsApp, Telegram)
			</button>
		</div>
	);

	/* ── Layout renderers ───────────────────────────────── */

	// CLASSIC — avatar + company header, then identity, contacts, QR
	const renderClassic = () => (
		<div className="ecard">
			<div className="ecard-topbar" style={{ background: `linear-gradient(90deg, ${accent}, ${highlight}88, ${accent})` }} />
			<div className="ecard-header">
				<div className="ecard-logo-area">
					{avatarBlock()}
					<div className="ecard-header-text">
						{profile.company && <div className="ecard-company">{profile.company}</div>}
						{customization?.cardLabel && <div className="ecard-tagline">{customization.cardLabel}</div>}
					</div>
				</div>
				{logoUrl && <img className="ecard-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} />}
			</div>
			<div className="ecard-divider" style={{ background: `linear-gradient(90deg, ${accent}33, ${accent}22, transparent)` }} />
			<div className="ecard-identity">
				<h1 className="ecard-name">{profile.fullName}</h1>
				{profile.role && (
					<div className="ecard-role-row">
						<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
						<span className="ecard-role-tag">{profile.role}</span>
					</div>
				)}
				{profile.company && <div className="ecard-company-tag">{profile.company}</div>}
				{profile.bio && <p className="ecard-bio">{profile.bio}</p>}
			</div>
			{contactsBlock}
			{socialBlock}
			{qrBlock}
			{footerBlock}
		</div>
	);

	// BANNER — cover image/gradient header, avatar overlapping, then body
	const renderBanner = () => (
		<div className="ecard ecard--banner">
			<div className="ecard-banner-cover">
				{coverUrl ? (
					<img className="ecard-banner-cover-img" src={coverUrl} alt="cover"
						style={{
							objectPosition: `${assets?.cover?.positionX ?? 50}% ${assets?.cover?.positionY ?? 50}%`,
							transform: `scale(${assets?.cover?.zoom ?? 1})`,
						}} />
				) : (
					<div className="ecard-banner-cover-grad" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${highlight}88 100%)` }} />
				)}
				<div className="ecard-banner-overlay" />
				{customization?.cardLabel && <span className="ecard-banner-badge">{customization.cardLabel}</span>}
			</div>
			<div className="ecard-banner-avatar-wrap">
				{avatarBlock('ecard-avatar ecard-avatar--lg')}
			</div>
			<div className="ecard-identity" style={{ paddingTop: 0 }}>
				<div className="ecard-name-row">
					{logoUrl && <img className="ecard-logo-circle" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} />}
					<h1 className="ecard-name" style={{ margin: 0 }}>{profile.fullName}</h1>
				</div>
				{profile.role && (
					<div className="ecard-role-row" style={{ justifyContent: 'center' }}>
						<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
						<span className="ecard-role-tag">{profile.role}</span>
					</div>
				)}
				{profile.company && <div className="ecard-company-tag">{profile.company}</div>}
				{profile.bio && <p className="ecard-bio">{profile.bio}</p>}
			</div>
			{contactsBlock}
			{socialBlock}
			{qrBlock}
			{footerBlock}
		</div>
	);

	// SPLIT — two-column layout: left side photo, right info
	const renderSplit = () => (
		<div className="ecard ecard--split">
			<div className="ecard-split-wrap">
				<div className="ecard-split-left" style={{ background: `linear-gradient(180deg, ${accent}cc 0%, ${accent}44 100%)` }}>
					{avatarUrl ? (
						<img className="ecard-split-photo" src={avatarUrl} alt={profile.fullName}
							style={{
								objectPosition: `${assets?.avatar?.positionX ?? 50}% ${assets?.avatar?.positionY ?? 50}%`,
								transform: `scale(${assets?.avatar?.zoom ?? 1})`,
								opacity: assets?.avatar?.opacity ?? 1,
							}} />
					) : (
						<span className="ecard-split-initials">{initials}</span>
					)}
					<div className="ecard-split-overlay">
						{profile.company && <div className="ecard-split-company">{profile.company}</div>}
						{customization?.cardLabel && <div className="ecard-split-label">{customization.cardLabel}</div>}
					</div>
				</div>
				<div className="ecard-split-right">
					<div className="ecard-identity" style={{ padding: '20px 24px 12px' }}>
						{logoUrl && <img className="ecard-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} />}
						<h1 className="ecard-name">{profile.fullName}</h1>
						{profile.role && (
							<div className="ecard-role-row">
								<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
								<span className="ecard-role-tag">{profile.role}</span>
							</div>
						)}
						{profile.bio && <p className="ecard-bio">{profile.bio}</p>}
					</div>
					{contactsBlock}
					{socialBlock}
					<div className="ecard-btn-actions" style={{ padding: '12px 24px' }}>
						<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
							<DownloadIcon />
							Sauvegarder
						</button>
						<button className="ecard-btn-share" style={{ color: accent, borderColor: `${accent}55` }} onClick={shareCard}>
							<ShareIcon />
							Partager
						</button>
					</div>
				</div>
			</div>
			{footerBlock}
		</div>
	);

	// MINIMAL — monogram top with gradient, then clean link rows
	const renderMinimal = () => (
		<div className="ecard ecard--minimal">
			<div className="ecard-minimal-top" style={{ background: `linear-gradient(160deg, ${accent}15 0%, ${accent}05 100%)` }}>
				<div className="ecard-minimal-mono" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }}>
					{avatarUrl ? (
						<img src={avatarUrl} alt={profile.fullName}
							style={{
								objectPosition: `${assets?.avatar?.positionX ?? 50}% ${assets?.avatar?.positionY ?? 50}%`,
								transform: `scale(${assets?.avatar?.zoom ?? 1})`,
								opacity: assets?.avatar?.opacity ?? 1,
							}} />
					) : <span>{initials}</span>}
				</div>
				<h1 className="ecard-name" style={{ textAlign: 'center' }}>{profile.fullName}</h1>
				{profile.role && <div className="ecard-minimal-role">{profile.role}</div>}
				{profile.company && <div className="ecard-minimal-company" style={{ color: accent }}>{profile.company}</div>}
				{logoUrl && <img className="ecard-company-logo ecard-company-logo--center" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1, marginTop: '8px' }} />}
			</div>
			{profile.bio && <p className="ecard-bio" style={{ padding: '0 24px 8px' }}>{profile.bio}</p>}
			<div className="ecard-minimal-links">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					const row = (
						<div className="ecard-ml-row" key={c.key}>
							<span className="ecard-ml-type" style={{ color: accent }}><Icon /></span>
							<span className="ecard-ml-val">{c.value}</span>
						</div>
					);
					return c.href ? <a key={c.key} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="ecard-ml-row-link">{row}</a> : row;
				})}
			</div>
			{socialBlock}
			<div className="ecard-btn-actions" style={{ padding: '12px 24px 20px' }}>
				<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
					<DownloadIcon />
					Sauvegarder le contact
				</button>
				<button className="ecard-btn-share" style={{ color: accent, borderColor: `${accent}55` }} onClick={shareCard}>
					<ShareIcon />
					Partager cette carte
				</button>
			</div>
			{footerBlock}
		</div>
	);

	// BOLD — full-bleed photo background with frosted glass info panel
	const renderBold = () => (
		<div className="ecard ecard--bold">
			<div className="ecard-bold-bg">
				{avatarUrl ? (
					<img src={avatarUrl} alt={profile.fullName}
						style={{
							objectPosition: `${assets?.avatar?.positionX ?? 50}% ${assets?.avatar?.positionY ?? 50}%`,
							transform: `scale(${assets?.avatar?.zoom ?? 1})`,
							opacity: assets?.avatar?.opacity ?? 1,
						}} />
				) : (
					<div className="ecard-bold-placeholder" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${highlight}66 100%)` }} />
				)}
			</div>
			<div className="ecard-bold-glass">
				{logoUrl && <img className="ecard-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1, maxHeight: '28px' }} />}
				<h1 className="ecard-name" style={{ color: '#fff' }}>{profile.fullName}</h1>
				{profile.role && <div className="ecard-role-row" style={{ justifyContent: 'center' }}>
					<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
					<span className="ecard-role-tag" style={{ color: 'rgba(255,255,255,0.8)' }}>{profile.role}{profile.company ? ` · ${profile.company}` : ''}</span>
				</div>}
				{profile.bio && <p className="ecard-bio" style={{ color: 'rgba(255,255,255,0.6)' }}>{profile.bio}</p>}
				<div className="ecard-bold-links">
					{contacts.map((c) => {
						const Icon = ICON_MAP[c.icon];
						return (
							<a key={c.key} className="ecard-bold-link-btn" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
								style={{ borderColor: `${accent}55`, color: accent }}>
								<Icon /> <span>{c.value}</span>
							</a>
						);
					})}
				</div>
				{activeSocials.length > 0 && (
					<div className="ecard-social-row" style={{ justifyContent: 'center' }}>
						{activeSocials.map((s) => (
							<a key={s.key} className="ecard-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}
								style={{ color: accent }}>
								<s.Icon />
							</a>
						))}
					</div>
				)}
				<div className="ecard-btn-actions">
					<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
						<DownloadIcon />
						Sauvegarder
					</button>
					<button className="ecard-btn-share" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={shareCard}>
						<ShareIcon />
						Partager
					</button>
				</div>
			</div>
			{footerBlock}
		</div>
	);

	// GRID — link-tree style with social grid tiles
	const renderGrid = () => (
		<div className="ecard ecard--grid">
			<div className="ecard-grid-header">
				{avatarBlock('ecard-avatar ecard-avatar--grid')}
				<h1 className="ecard-name" style={{ textAlign: 'center' }}>{profile.fullName}</h1>
				{profile.role && <div className="ecard-grid-role">{profile.role}</div>}
				{profile.company && <div className="ecard-grid-company" style={{ color: accent }}>@{profile.company}</div>}
				{profile.bio && <p className="ecard-bio" style={{ textAlign: 'center' }}>{profile.bio}</p>}
			</div>
			<div className="ecard-grid-tiles">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					return (
						<a key={c.key} className="ecard-grid-tile" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
							style={{ '--tile-accent': accent }}>
							<Icon />
							<span className="ecard-grid-tile-label">{c.label}</span>
						</a>
					);
				})}
				<button className="ecard-grid-tile" onClick={downloadVCard} style={{ '--tile-accent': accent }}>
					<DownloadIcon />
					<span className="ecard-grid-tile-label">Sauvegarder</span>
				</button>
				<button className="ecard-grid-tile" onClick={shareCard} style={{ '--tile-accent': accent }}>
					<ShareIcon />
					<span className="ecard-grid-tile-label">Partager</span>
				</button>
				{activeSocials.map((s) => (
					<a key={s.key} className="ecard-grid-tile" href={s.url} target="_blank" rel="noreferrer"
						style={{ '--tile-accent': accent }}>
						<s.Icon />
						<span className="ecard-grid-tile-label">{s.label}</span>
					</a>
				))}
			</div>
			{qrBlock}
			{logoUrl && <div style={{ textAlign: 'center', padding: '8px 0' }}>
				<img className="ecard-company-logo ecard-company-logo--center" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} />
			</div>}
			{footerBlock}
		</div>
	);

	// ELEGANT — centered serif typography, thin dividers, luxury feel
	const renderElegant = () => (
		<div className="ecard ecard--elegant">
			<div className="ecard-elegant-top">
				{customization?.cardLabel && <span className="ecard-elegant-badge" style={{ color: accent }}>{customization.cardLabel}</span>}
				<div className="ecard-elegant-divider" style={{ background: `${accent}33` }} />
				{avatarBlock('ecard-avatar ecard-avatar--elegant')}
				<h1 className="ecard-name ecard-name--serif">{profile.fullName}</h1>
				<div className="ecard-elegant-divider short" style={{ background: accent }} />
				{profile.role && <div className="ecard-elegant-role">{profile.role}</div>}
				{profile.company && <div className="ecard-elegant-company">{profile.company}</div>}
				{logoUrl && <img className="ecard-company-logo ecard-company-logo--center" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1, marginTop: '8px' }} />}
			</div>
			{profile.bio && <p className="ecard-bio ecard-bio--serif" style={{ textAlign: 'center', fontStyle: 'italic' }}>{profile.bio}</p>}
			<div className="ecard-elegant-links">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					const row = (
						<div className="ecard-elegant-link-row" key={c.key}>
							<span className="ecard-elegant-label"><Icon /> {c.label}</span>
							<span className="ecard-elegant-val">{c.value}</span>
						</div>
					);
					return c.href ? <a key={c.key} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="ecard-ml-row-link">{row}</a> : row;
				})}
			</div>
			{socialBlock}
			<div className="ecard-btn-actions" style={{ padding: '12px 24px 20px' }}>
				<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
					<DownloadIcon />
					Sauvegarder le contact
				</button>
				<button className="ecard-btn-share" style={{ color: accent, borderColor: `${accent}55` }} onClick={shareCard}>
					<ShareIcon />
					Partager cette carte
				</button>
			</div>
			{footerBlock}
		</div>
	);

	// GRADIENT — floating avatar over gradient hero, pill-style contact info
	const renderGradient = () => (
		<div className="ecard ecard--gradient">
			<div className="ecard-gradient-hero" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${highlight}88 50%, var(--ecard-bg, #0c1b2b) 100%)` }}>
				{avatarBlock('ecard-avatar ecard-avatar--gradient')}
				{logoUrl && <img className="ecard-company-logo ecard-company-logo--center" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1, maxHeight: '24px' }} />}
			</div>
			<div className="ecard-gradient-body">
				<h1 className="ecard-name">{profile.fullName}</h1>
				{profile.role && <div className="ecard-role-row">
					<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} />
					<span className="ecard-role-tag">{profile.role}{profile.company ? ` · ${profile.company}` : ''}</span>
				</div>}
				{profile.bio && <p className="ecard-bio">{profile.bio}</p>}
				<div className="ecard-gradient-pills">
					{contacts.map((c) => {
						const Icon = ICON_MAP[c.icon];
						return (
							<a key={c.key} className="ecard-gradient-pill" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
								style={{ background: `${accent}12`, color: accent, borderColor: `${accent}30` }}>
								<Icon /> {c.value}
							</a>
						);
					})}
				</div>
				{socialBlock}
			</div>
			<div className="ecard-btn-actions" style={{ padding: '12px 24px 20px' }}>
				<button className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }} onClick={downloadVCard}>
					<DownloadIcon />
					Sauvegarder le contact
				</button>
				<button className="ecard-btn-share" style={{ color: accent, borderColor: `${accent}55` }} onClick={shareCard}>
					<ShareIcon />
					Partager cette carte
				</button>
			</div>
			{qrBlock}
			{footerBlock}
		</div>
	);

	const layoutMap = { classic: renderClassic, banner: renderBanner, split: renderSplit, minimal: renderMinimal, bold: renderBold, grid: renderGrid, elegant: renderElegant, gradient: renderGradient };
	const renderLayout = layoutMap[layout] || renderClassic;

	return (
		<div className={`ecard-page ecard-page--${layout}`} style={cssVars}>
			{renderLayout()}
			<div className={`ecard-toast${toast ? ' show' : ''}`} style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }}>
				{toast}
			</div>
		</div>
	);
}


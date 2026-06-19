import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { fetchPublicCard } from '../lib/api';
import { getAssetDisplayUrl, themeCatalog } from '../lib/catalog';
import { CardRenderer, fontStyleMap, normalizeWebsite, displayWebsite } from './CardRenderer';

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
					if (name) document.title = `${name} · TEKKO`;
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

	return (
		<div className={`ecard-page ecard-page--${layout}`} style={cssVars}>
			<CardRenderer
				profile={profile}
				customization={customization}
				assets={assets}
				accent={accent}
				highlight={highlight}
				layout={layout}
				qrUrl={qrUrl}
				qrTarget={qrTarget}
				cardUrl={cardUrl}
				onSaveContact={downloadVCard}
				onShare={shareCard}
				onCopyPreview={copySharePreviewLink}
			/>
			<div className={`ecard-toast${toast ? ' show' : ''}`} style={{ background: `linear-gradient(135deg, ${accent}, ${highlight})` }}>
				{toast}
			</div>
		</div>
	);
}

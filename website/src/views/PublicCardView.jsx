import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { fetchPublicCard } from '../lib/api';
import { getAssetDisplayUrl, getInitials, themeCatalog } from '../lib/catalog';

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

function buildVCard(profile, photoBase64) {
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
		photoBase64 ? `PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64}` : '',
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

export function PublicCardView({ slug }) {
	const [state, setState] = useState({ loading: true, error: '', card: null });
	const [qrUrl, setQrUrl] = useState('');
	const [toast, setToast] = useState('');
	const toastTimer = useRef(null);

	useEffect(() => {
		let isMounted = true;
		fetchPublicCard(slug)
			.then((response) => {
				if (isMounted) {
					setState({ loading: false, error: '', card: response.card });
					const name = response.card?.profile?.fullName;
					if (name) document.title = `${name} · Tapal`;
				}
			})
			.catch((error) => { if (isMounted) setState({ loading: false, error: error.message, card: null }); });
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

	if (state.loading) return <div className="ecard-page ecard-loading"><div className="pc-spinner" /></div>;
	if (state.error || !state.card) {
		const isExpired = state.error === 'expired_preview';
		return (
			<div className="ecard-page ecard-error">
				<div className="ecard-expired-msg">
					<span className="ecard-expired-icon">{isExpired ? '⏱' : '🔍'}</span>
					<h2>{isExpired ? 'Aperçu expiré' : 'Carte introuvable'}</h2>
					<p>{isExpired
						? 'Le lien de prévisualisation a expiré (durée limitée à 10 minutes). Votre carte sera accessible après confirmation du paiement.'
						: 'Cette carte n\'existe pas ou n\'est pas encore activée. Vérifiez le lien ou contactez-nous.'
					}</p>
					<a href="/" className="ecard-back-link">← Retour à l'accueil</a>
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

	async function downloadVCard() {
		let photoBase64 = '';
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
		const vcf = new Blob([buildVCard(profile, photoBase64)], { type: 'text/vcard' });
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

	/* ── Shared sub-components ──────────────────────────── */
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
			<div className="ecard-identity" style={{ textAlign: 'center', paddingTop: 0 }}>
				{logoUrl && <img className="ecard-company-logo ecard-company-logo--center" src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} />}
				<h1 className="ecard-name">{profile.fullName}</h1>
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

	const layoutMap = { classic: renderClassic, banner: renderBanner, split: renderSplit, minimal: renderMinimal };
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


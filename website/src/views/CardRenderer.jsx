import { getAssetDisplayUrl, getInitials, socialFields } from '../lib/catalog';

/*
 * CardRenderer — the SINGLE source of truth for how a card looks.
 * Used by PublicCardView (mode "view": real links, QR, vCard) and by the
 * studio CardCanvas (edit prop set: clickable zones + drag/zoom gestures).
 * The markup/classes are identical in both modes, so what the user designs
 * in the studio is exactly what ships on the e-card.
 */

export const fontStyleMap = {
	moderne:   "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	elegant:   "Georgia, 'Times New Roman', serif",
	technique: "'Courier New', Courier, monospace",
	arrondi:   "'Trebuchet MS', 'Comic Sans MS', Nunito, Arial, sans-serif",
	roboto:    "'Roboto', sans-serif",
	sf:        "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
	segoe:     "'Segoe UI', Calibri, Arial, sans-serif",
};

export function normalizeWebsite(url) {
	if (!url) return '#';
	return url.startsWith('http') ? url : `https://${url}`;
}

export function displayWebsite(url) {
	return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

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

export function buildSocialUrl(key, value) {
	if (!value) return '#';
	if (value.startsWith('http')) return value;
	return (SOCIAL_URL_PREFIXES[key] || '') + value;
}

/* ── Contact SVG icons ─────────────────────────────────────── */
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

const ICON_MAP = { phone: PhoneIcon, email: EmailIcon, web: WebIcon, location: LocationIcon };

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

const CONTACT_DEFS = [
	{ key: 'phone',    label: 'Téléphone', icon: 'phone',    placeholder: 'Votre téléphone', href: (v) => `tel:${v}` },
	{ key: 'email',    label: 'Email',     icon: 'email',    placeholder: 'Votre email',     href: (v) => `mailto:${v}` },
	{ key: 'website',  label: 'Site web',  icon: 'web',      placeholder: 'Votre site',      href: (v) => normalizeWebsite(v), display: (v) => displayWebsite(v) },
	{ key: 'location', label: 'Lieu',      icon: 'location', placeholder: 'Votre adresse',   href: (v) => `https://maps.google.com/maps?q=${encodeURIComponent(v)}` },
];

export function CardRenderer({
	profile = {},
	customization = {},
	assets = {},
	accent,
	highlight,
	layout: layoutProp,
	initials: initialsProp,
	qrUrl = '',
	qrTarget = '',
	cardUrl = '',
	onSaveContact,
	onShare,
	onCopyPreview,
	edit = null,
}) {
	const isEdit = !!edit;
	const cx = (...c) => c.filter(Boolean).join(' ');
	const ec = isEdit ? 'editable-zone' : '';
	const hc = isEdit && edit.showEditHints ? 'pulse-hint' : '';
	const fld = (key) => (isEdit ? (event) => { event.stopPropagation(); edit.onEditField?.(key, event.currentTarget); } : undefined);
	const imgEdit = (key) => (isEdit ? (event) => { event?.stopPropagation?.(); edit.onEditImage?.(key); } : undefined);
	const grip = (key) => (isEdit && edit.attachGesture ? edit.attachGesture(key) : undefined);
	const ph = (value, placeholder) => value || (isEdit ? placeholder : '');
	const inert = (event) => event.stopPropagation();

	const accentColor = accent || customization?.accent || '#1a9d8f';
	const highlightColor = highlight || accentColor;
	const layout = layoutProp || customization?.cardLayout || 'classic';
	const initials = initialsProp || getInitials(profile.fullName);
	const avatarUrl = getAssetDisplayUrl(assets?.avatar);
	const coverUrl = getAssetDisplayUrl(assets?.cover);
	const logoUrl = getAssetDisplayUrl(assets?.logo);

	const avatarStyle = {
		objectPosition: `${assets?.avatar?.positionX ?? 50}% ${assets?.avatar?.positionY ?? 50}%`,
		transform: `scale(${assets?.avatar?.zoom ?? 1})`,
		opacity: assets?.avatar?.opacity ?? 1,
	};
	const coverStyle = {
		objectPosition: `${assets?.cover?.positionX ?? 50}% ${assets?.cover?.positionY ?? 50}%`,
		transform: `scale(${assets?.cover?.zoom ?? 1})`,
		opacity: assets?.cover?.opacity ?? 1,
	};

	// Contacts: edit mode shows all four slots (with placeholders) so they stay
	// clickable; view mode shows only filled fields, exactly like before.
	const contacts = CONTACT_DEFS
		.map((d) => {
			const raw = profile[d.key];
			const has = !!(raw && String(raw).trim());
			return {
				key: d.key, label: d.label, icon: d.icon, has,
				value: has ? (d.display ? d.display(raw) : raw) : d.placeholder,
				href: has ? d.href(raw) : null,
			};
		})
		.filter((c) => isEdit || c.has);

	const activeSocials = socialFields
		.filter((sf) => isEdit || profile[sf.key]?.trim())
		.filter((sf) => SOCIAL_ICON_MAP[sf.key])
		.map((sf) => ({ key: sf.key, label: sf.label, url: buildSocialUrl(sf.key, profile[sf.key]), Icon: SOCIAL_ICON_MAP[sf.key], has: !!profile[sf.key]?.trim() }));
	const filledSocials = activeSocials.filter((s) => s.has);

	/* ── Reusable element builders ───────────────────────── */

	const avatarBlock = (cls = 'ecard-avatar') => (
		<div className={cx(cls, ec, hc, isEdit && 'gesture-target')} ref={grip('avatar')} onClick={imgEdit('avatar')}
			title={isEdit ? 'Cliquer pour changer · glisser pour repositionner' : undefined}>
			{avatarUrl ? (
				<>
					<img src={avatarUrl} alt={profile.fullName} style={avatarStyle} />
					{!isEdit && <a className="ecard-avatar-dl" href={avatarUrl} download title="Télécharger la photo"><DownloadIcon /></a>}
				</>
			) : <span className="ecard-avatar-initials">{initials || '+'}</span>}
		</div>
	);

	const logoBlock = (extraCls = '') => (logoUrl ? (
		<img className={cx('ecard-company-logo', extraCls, ec, hc)} src={logoUrl} alt="logo"
			style={{ opacity: assets?.logo?.opacity ?? 1 }} onClick={imgEdit('logo')} />
	) : null);

	const ContactRow = ({ c, className }) => {
		const inner = (
			<>
				<div className="ecard-c-icon" style={{ borderColor: `${accentColor}30`, background: `${accentColor}0a` }}>
					{(() => { const Icon = ICON_MAP[c.icon]; return <Icon />; })()}
				</div>
				<div className="ecard-c-meta">
					<span className="ecard-c-label">{c.label}</span>
					<span className="ecard-c-val">{c.value}</span>
				</div>
			</>
		);
		if (isEdit) return <div className={cx(className, ec, hc)} onClick={fld(c.key)} role="button">{inner}</div>;
		return c.href
			? <a className={className} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>
			: <div className={className}>{inner}</div>;
	};

	const contactsBlock = (
		<div className="ecard-contacts">
			{contacts.map((c) => <ContactRow key={c.key} c={c} className="ecard-c-link" />)}
		</div>
	);

	const socialBlock = (filledSocials.length > 0 || isEdit) ? (
		<div className={cx('ecard-social-row', ec, hc)} onClick={isEdit ? fld('socials') : undefined}>
			{filledSocials.length > 0
				? filledSocials.map((s) => (
					isEdit
						? <button key={s.key} type="button" className="ecard-social-btn" title={s.label} aria-label={s.label} style={{ color: accentColor }} onClick={fld('socials')}><s.Icon /></button>
						: <a key={s.key} className="ecard-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label} aria-label={s.label} style={{ color: accentColor }}><s.Icon /></a>
				))
				: <span className="ecard-social-empty-hint" style={{ color: accentColor }}>+ Réseaux sociaux</span>}
		</div>
	) : null;

	const actionButtons = (saveLabel = 'Sauvegarder le contact', shareLabel = 'Partager cette carte', shareStyle = null) => (
		<div className="ecard-btn-actions">
			<button type="button" className="ecard-btn-save" style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }}
				onClick={isEdit ? inert : onSaveContact}>
				<DownloadIcon />
				{saveLabel}
			</button>
			<button type="button" className="ecard-btn-share" style={shareStyle || { color: accentColor, borderColor: `${accentColor}55` }}
				onClick={isEdit ? inert : onShare}>
				<ShareIcon />
				{shareLabel}
			</button>
		</div>
	);

	const qrBlock = (
		<div className="ecard-qr-section" style={{ borderColor: `${accentColor}18`, background: `${accentColor}05` }}>
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
				{actionButtons()}
			</div>
		</div>
	);

	const footerBlock = (
		<div className="ecard-footer">
			<div className="ecard-nfc-row">
				<span className="ecard-nfc-dot" style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }} />
				<span className="ecard-nfc-txt">NFC · QR</span>
			</div>
			<span className="ecard-footer-domain">{cardUrl}</span>
			{!isEdit && onCopyPreview && (
				<button type="button" className="ecard-share-preview-btn" onClick={onCopyPreview}>
					Copier lien apercu (WhatsApp, Telegram)
				</button>
			)}
		</div>
	);

	const nameTag = (extraCls = '', style) => (
		<h1 className={cx('ecard-name', extraCls, ec, hc)} style={style} onClick={fld('fullName')}>{ph(profile.fullName, 'Votre nom')}</h1>
	);
	const roleRow = (extraStyle) => ((profile.role || isEdit) && (
		<div className="ecard-role-row" style={extraStyle} onClick={fld('role')}>
			<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }} />
			<span className={cx('ecard-role-tag', ec, hc)}>{ph(profile.role, 'Votre titre')}</span>
		</div>
	));
	const bioP = (extraCls = '', style) => ((profile.bio || isEdit) && (
		<p className={cx('ecard-bio', extraCls, ec, hc)} style={style} onClick={fld('bio')}>{ph(profile.bio, 'Votre bio (optionnel)')}</p>
	));

	/* ── Layouts (markup mirrors the published e-card) ───── */

	const renderClassic = () => (
		<div className="ecard">
			<div className="ecard-topbar" style={{ background: `linear-gradient(90deg, ${accentColor}, ${highlightColor}88, ${accentColor})` }} />
			<div className="ecard-header">
				<div className="ecard-logo-area">
					{avatarBlock()}
					<div className="ecard-header-text">
						{(profile.company || isEdit) && <div className={cx('ecard-company', ec, hc)} onClick={fld('company')}>{ph(profile.company, 'Votre entreprise')}</div>}
						{(customization?.cardLabel || isEdit) && <div className={cx('ecard-tagline', ec, hc)} onClick={fld('cardLabel')}>{ph(customization?.cardLabel, 'Étiquette')}</div>}
					</div>
				</div>
				{logoBlock()}
			</div>
			<div className="ecard-divider" style={{ background: `linear-gradient(90deg, ${accentColor}33, ${accentColor}22, transparent)` }} />
			<div className="ecard-identity">
				{nameTag()}
				{roleRow()}
				{(profile.company || isEdit) && <div className={cx('ecard-company-tag', ec, hc)} onClick={fld('company')}>{ph(profile.company, 'Votre entreprise')}</div>}
				{bioP()}
			</div>
			{contactsBlock}
			{socialBlock}
			{qrBlock}
			{footerBlock}
		</div>
	);

	const renderBanner = () => (
		<div className="ecard ecard--banner">
			<div className={cx('ecard-banner-cover', ec, hc)} ref={grip('cover')} onClick={imgEdit('cover')}
				title={isEdit ? 'Cliquer pour changer la couverture' : undefined}>
				{coverUrl ? (
					<img className="ecard-banner-cover-img" src={coverUrl} alt="cover" style={coverStyle} />
				) : (
					<div className="ecard-banner-cover-grad" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${highlightColor}88 100%)` }} />
				)}
				<div className="ecard-banner-overlay" />
				{(customization?.cardLabel || isEdit) && <span className={cx('ecard-banner-badge', ec, hc)} onClick={fld('cardLabel')}>{ph(customization?.cardLabel, 'Étiquette')}</span>}
			</div>
			<div className="ecard-banner-avatar-wrap">
				{avatarBlock('ecard-avatar ecard-avatar--lg')}
			</div>
			<div className="ecard-identity" style={{ paddingTop: 0 }}>
				<div className="ecard-name-row">
					{logoUrl && <img className={cx('ecard-logo-circle', ec, hc)} src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} onClick={imgEdit('logo')} />}
					{nameTag('', { margin: 0 })}
				</div>
				{roleRow({ justifyContent: 'center' })}
				{(profile.company || isEdit) && <div className={cx('ecard-company-tag', ec, hc)} onClick={fld('company')}>{ph(profile.company, 'Votre entreprise')}</div>}
				{bioP()}
			</div>
			{contactsBlock}
			{socialBlock}
			{qrBlock}
			{footerBlock}
		</div>
	);

	const renderSplit = () => (
		<div className="ecard ecard--split">
			<div className="ecard-split-wrap">
				<div className={cx('ecard-split-left', ec, hc, isEdit && 'gesture-target')} style={{ background: `linear-gradient(180deg, ${accentColor}cc 0%, ${accentColor}44 100%)` }}
					ref={grip('avatar')} onClick={imgEdit('avatar')} title={isEdit ? 'Cliquer pour changer · glisser pour repositionner' : undefined}>
					{avatarUrl ? (
						<img className="ecard-split-photo" src={avatarUrl} alt={profile.fullName} style={avatarStyle} />
					) : (
						<span className="ecard-split-initials">{initials || '+'}</span>
					)}
					<div className="ecard-split-overlay">
						{(profile.company || isEdit) && <div className={cx('ecard-split-company', ec, hc)} onClick={fld('company')}>{ph(profile.company, 'Entreprise')}</div>}
						{(customization?.cardLabel || isEdit) && <div className={cx('ecard-split-label', ec, hc)} onClick={fld('cardLabel')}>{ph(customization?.cardLabel, 'Étiquette')}</div>}
					</div>
				</div>
				<div className="ecard-split-right">
					<div className="ecard-identity" style={{ padding: '20px 24px 12px' }}>
						{logoBlock()}
						{nameTag()}
						{roleRow()}
						{bioP()}
					</div>
					{contactsBlock}
					{socialBlock}
					{actionButtons('Sauvegarder', 'Partager')}
				</div>
			</div>
			{footerBlock}
		</div>
	);

	const renderMinimal = () => (
		<div className="ecard ecard--minimal">
			<div className="ecard-minimal-top" style={{ background: `linear-gradient(160deg, ${accentColor}15 0%, ${accentColor}05 100%)` }}>
				<div className={cx('ecard-minimal-mono', ec, hc, isEdit && 'gesture-target')} style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }}
					ref={grip('avatar')} onClick={imgEdit('avatar')} title={isEdit ? 'Cliquer pour changer · glisser pour repositionner' : undefined}>
					{avatarUrl ? <img src={avatarUrl} alt={profile.fullName} style={avatarStyle} /> : <span>{initials || '+'}</span>}
				</div>
				{nameTag('', { textAlign: 'center' })}
				{(profile.role || isEdit) && <div className={cx('ecard-minimal-role', ec, hc)} onClick={fld('role')}>{ph(profile.role, 'Votre titre')}</div>}
				{(profile.company || isEdit) && <div className={cx('ecard-minimal-company', ec, hc)} style={{ color: accentColor }} onClick={fld('company')}>{ph(profile.company, 'Votre entreprise')}</div>}
				{logoBlock('ecard-company-logo--center')}
			</div>
			{bioP('', { padding: '0 24px 8px' })}
			<div className="ecard-minimal-links">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					const row = (
						<div className="ecard-ml-row" key={c.key}>
							<span className="ecard-ml-type" style={{ color: accentColor }}><Icon /></span>
							<span className="ecard-ml-val">{c.value}</span>
						</div>
					);
					if (isEdit) return <div key={c.key} className={cx('ecard-ml-row-link', ec, hc)} onClick={fld(c.key)} role="button">{row}</div>;
					return c.href ? <a key={c.key} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="ecard-ml-row-link">{row}</a> : row;
				})}
			</div>
			{socialBlock}
			{actionButtons()}
			{footerBlock}
		</div>
	);

	const renderBold = () => (
		<div className="ecard ecard--bold">
			<div className={cx('ecard-bold-bg', ec, hc, isEdit && 'gesture-target')} ref={grip('avatar')} onClick={imgEdit('avatar')}
				title={isEdit ? 'Cliquer pour changer · glisser pour repositionner' : undefined}>
				{avatarUrl ? (
					<img src={avatarUrl} alt={profile.fullName} style={avatarStyle} />
				) : (
					<div className="ecard-bold-placeholder" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${highlightColor}66 100%)` }} />
				)}
			</div>
			<div className="ecard-bold-glass">
				{logoUrl && <img className={cx('ecard-company-logo', ec, hc)} src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1, maxHeight: '28px' }} onClick={imgEdit('logo')} />}
				{nameTag('', { color: '#fff' })}
				{(profile.role || isEdit) && <div className="ecard-role-row" style={{ justifyContent: 'center' }} onClick={fld('role')}>
					<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }} />
					<span className={cx('ecard-role-tag', ec, hc)} style={{ color: 'rgba(255,255,255,0.8)' }}>{ph(profile.role, 'Votre titre')}{profile.company ? ` · ${profile.company}` : ''}</span>
				</div>}
				{bioP('', { color: 'rgba(255,255,255,0.6)' })}
				<div className="ecard-bold-links">
					{contacts.map((c) => {
						const Icon = ICON_MAP[c.icon];
						const inner = <><Icon /> <span>{c.value}</span></>;
						if (isEdit) return <div key={c.key} className={cx('ecard-bold-link-btn', ec, hc)} onClick={fld(c.key)} role="button" style={{ borderColor: `${accentColor}55`, color: accentColor }}>{inner}</div>;
						return <a key={c.key} className="ecard-bold-link-btn" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ borderColor: `${accentColor}55`, color: accentColor }}>{inner}</a>;
					})}
				</div>
				{(filledSocials.length > 0 || isEdit) && (
					<div className={cx('ecard-social-row', ec, hc)} style={{ justifyContent: 'center' }} onClick={isEdit ? fld('socials') : undefined}>
						{filledSocials.length > 0
							? filledSocials.map((s) => (
								isEdit
									? <button key={s.key} type="button" className="ecard-social-btn" title={s.label} style={{ color: accentColor }} onClick={fld('socials')}><s.Icon /></button>
									: <a key={s.key} className="ecard-social-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label} style={{ color: accentColor }}><s.Icon /></a>
							))
							: <span className="ecard-social-empty-hint" style={{ color: accentColor }}>+ Réseaux sociaux</span>}
					</div>
				)}
				{actionButtons('Sauvegarder', 'Partager', { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' })}
			</div>
			{footerBlock}
		</div>
	);

	const renderGrid = () => (
		<div className="ecard ecard--grid">
			<div className="ecard-grid-header">
				{avatarBlock('ecard-avatar ecard-avatar--grid')}
				{nameTag('', { textAlign: 'center' })}
				{(profile.role || isEdit) && <div className={cx('ecard-grid-role', ec, hc)} onClick={fld('role')}>{ph(profile.role, 'Votre titre')}</div>}
				{(profile.company || isEdit) && <div className={cx('ecard-grid-company', ec, hc)} style={{ color: accentColor }} onClick={fld('company')}>@{ph(profile.company, 'entreprise')}</div>}
				{bioP('', { textAlign: 'center' })}
			</div>
			<div className="ecard-grid-tiles">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					const inner = <><Icon /><span className="ecard-grid-tile-label">{c.label}</span></>;
					if (isEdit) return <div key={c.key} className={cx('ecard-grid-tile', ec, hc)} onClick={fld(c.key)} role="button" style={{ '--tile-accent': accentColor }}>{inner}</div>;
					return <a key={c.key} className="ecard-grid-tile" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ '--tile-accent': accentColor }}>{inner}</a>;
				})}
				<button type="button" className="ecard-grid-tile" onClick={isEdit ? inert : onSaveContact} style={{ '--tile-accent': accentColor }}>
					<DownloadIcon />
					<span className="ecard-grid-tile-label">Sauvegarder</span>
				</button>
				<button type="button" className="ecard-grid-tile" onClick={isEdit ? inert : onShare} style={{ '--tile-accent': accentColor }}>
					<ShareIcon />
					<span className="ecard-grid-tile-label">Partager</span>
				</button>
				{filledSocials.map((s) => (
					isEdit
						? <div key={s.key} className={cx('ecard-grid-tile', ec, hc)} onClick={fld('socials')} role="button" style={{ '--tile-accent': accentColor }}><s.Icon /><span className="ecard-grid-tile-label">{s.label}</span></div>
						: <a key={s.key} className="ecard-grid-tile" href={s.url} target="_blank" rel="noreferrer" style={{ '--tile-accent': accentColor }}><s.Icon /><span className="ecard-grid-tile-label">{s.label}</span></a>
				))}
			</div>
			{qrBlock}
			{logoUrl && <div style={{ textAlign: 'center', padding: '8px 0' }}>
				<img className={cx('ecard-company-logo ecard-company-logo--center', ec, hc)} src={logoUrl} alt="logo" style={{ opacity: assets?.logo?.opacity ?? 1 }} onClick={imgEdit('logo')} />
			</div>}
			{footerBlock}
		</div>
	);

	const renderElegant = () => (
		<div className="ecard ecard--elegant">
			<div className="ecard-elegant-top">
				{(customization?.cardLabel || isEdit) && <span className={cx('ecard-elegant-badge', ec, hc)} style={{ color: accentColor }} onClick={fld('cardLabel')}>{ph(customization?.cardLabel, 'Étiquette')}</span>}
				<div className="ecard-elegant-divider" style={{ background: `${accentColor}33` }} />
				{avatarBlock('ecard-avatar ecard-avatar--elegant')}
				<h1 className={cx('ecard-name ecard-name--serif', ec, hc)} onClick={fld('fullName')}>{ph(profile.fullName, 'Votre nom')}</h1>
				<div className="ecard-elegant-divider short" style={{ background: accentColor }} />
				{(profile.role || isEdit) && <div className={cx('ecard-elegant-role', ec, hc)} onClick={fld('role')}>{ph(profile.role, 'Votre titre')}</div>}
				{(profile.company || isEdit) && <div className={cx('ecard-elegant-company', ec, hc)} onClick={fld('company')}>{ph(profile.company, 'Votre entreprise')}</div>}
				{logoBlock('ecard-company-logo--center')}
			</div>
			{bioP('ecard-bio--serif', { textAlign: 'center', fontStyle: 'italic' })}
			<div className="ecard-elegant-links">
				{contacts.map((c) => {
					const Icon = ICON_MAP[c.icon];
					const row = (
						<div className="ecard-elegant-link-row" key={c.key}>
							<span className="ecard-elegant-label"><Icon /> {c.label}</span>
							<span className="ecard-elegant-val">{c.value}</span>
						</div>
					);
					if (isEdit) return <div key={c.key} className={cx('ecard-ml-row-link', ec, hc)} onClick={fld(c.key)} role="button">{row}</div>;
					return c.href ? <a key={c.key} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="ecard-ml-row-link">{row}</a> : row;
				})}
			</div>
			{socialBlock}
			{actionButtons()}
			{footerBlock}
		</div>
	);

	const renderGradient = () => (
		<div className="ecard ecard--gradient">
			<div className="ecard-gradient-hero" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${highlightColor}88 50%, var(--ecard-bg, #0c1b2b) 100%)` }}>
				{avatarBlock('ecard-avatar ecard-avatar--gradient')}
				{logoBlock('ecard-company-logo--center')}
			</div>
			<div className="ecard-gradient-body">
				{nameTag()}
				{(profile.role || isEdit) && <div className="ecard-role-row" onClick={fld('role')}>
					<span className="ecard-role-dot" style={{ background: `linear-gradient(135deg, ${accentColor}, ${highlightColor})` }} />
					<span className={cx('ecard-role-tag', ec, hc)}>{ph(profile.role, 'Votre titre')}{profile.company ? ` · ${profile.company}` : ''}</span>
				</div>}
				{bioP()}
				<div className="ecard-gradient-pills">
					{contacts.map((c) => {
						const Icon = ICON_MAP[c.icon];
						const inner = <><Icon /> {c.value}</>;
						if (isEdit) return <div key={c.key} className={cx('ecard-gradient-pill', ec, hc)} onClick={fld(c.key)} role="button" style={{ background: `${accentColor}12`, color: accentColor, borderColor: `${accentColor}30` }}>{inner}</div>;
						return <a key={c.key} className="ecard-gradient-pill" href={c.href} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{ background: `${accentColor}12`, color: accentColor, borderColor: `${accentColor}30` }}>{inner}</a>;
					})}
				</div>
				{socialBlock}
			</div>
			{actionButtons()}
			{qrBlock}
			{footerBlock}
		</div>
	);

	const layoutMap = {
		classic: renderClassic, banner: renderBanner, split: renderSplit, minimal: renderMinimal,
		bold: renderBold, grid: renderGrid, elegant: renderElegant, gradient: renderGradient,
	};
	const renderLayout = layoutMap[layout] || renderClassic;
	return renderLayout();
}

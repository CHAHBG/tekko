import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminOrders, updateAdminOrder, updateAdminCard, fetchInventory, setInventoryItem, adminLogin, fetchAdminCoupons, createAdminCoupon, deleteAdminCoupon, fetchAdminCeremonies, updateAdminCeremony, generateAdminInvoice, regeneratePaymentLink, applyAdminCoupon, uploadAdminAssets, fetchAdminAnalytics, fetchAdminAnalyticsVisits } from '../lib/api';
import { formatMoney, getAssetDisplayUrl, materialCatalog, foilCatalog } from '../lib/catalog';

function createDrafts(orders) {
	return Object.fromEntries(
		orders.map((order) => [
			order.orderId,
			{
				orderStatus: order.orderStatus,
				paymentStatus: order.paymentStatus,
				adminNotes: order.adminNotes ?? '',
				deliveryNotes: order.deliveryNotes ?? '',
			},
		]),
	);
}

function LogoMark() {
	return (
		<div className="admin-logo-mark">
			<span>TK</span>
		</div>
	);
}

function IconRefresh() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
			<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
			<path d="M8 16H3v5" />
		</svg>
	);
}

function IconLogout() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
			<polyline points="16 17 21 12 16 7" />
			<line x1="21" y1="12" x2="9" y2="12" />
		</svg>
	);
}

function countryFlag(code) {
	if (!code || code.length !== 2) return '';
	try {
		return String.fromCodePoint(
			0x1F1E6 + code.toUpperCase().charCodeAt(0) - 65,
			0x1F1E6 + code.toUpperCase().charCodeAt(1) - 65,
		);
	} catch { return ''; }
}

function deviceLabel(type) {
	const map = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablette' };
	return map[type] || type || '---';
}

function AnalyticsBarList({ items }) {
	if (!items?.length) return <div className="analytics-empty">Aucune donnÃ©e</div>;
	const max = Math.max(...items.map((i) => i.visits), 1);
	return (
		<div>
			{items.slice(0, 10).map((item, i) => (
				<div key={i} className="analytics-bar-row">
					<span className="analytics-bar-label" title={item.label}>{item.label || 'Inconnu'}</span>
					<div className="analytics-bar-track">
						<div className="analytics-bar-fill" style={{ width: `${Math.max(2, (item.visits / max) * 100)}%` }} />
					</div>
					<span className="analytics-bar-count">{item.visits}</span>
				</div>
			))}
		</div>
	);
}

function TimeSeriesChart({ data }) {
	if (!data?.length) return <div className="analytics-empty">Aucune donnee</div>;
	const max = Math.max(...data.map((d) => d.visits), 1);
	return (
		<div className="analytics-timeseries">
			{data.map((day) => (
				<div key={day.date} className="analytics-ts-day">
					<div className="analytics-ts-bar-wrap">
						<div
							className="analytics-ts-bar"
							style={{ height: `${Math.max(2, (day.visits / max) * 100)}%` }}
							title={`${day.date}: ${day.visits} visites, ${day.uniques} uniques`}
						/>
					</div>
					<span className="analytics-ts-label">{day.date.slice(5)}</span>
				</div>
			))}
		</div>
	);
}

function IconGlobe() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20" />
			<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}

function IconBuilding() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
			<path d="M9 22v-4h6v4" />
			<path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
		</svg>
	);
}

function IconMonitor() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	);
}

function IconBrowser() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="12" r="4" />
			<line x1="21.17" y1="8" x2="12" y2="8" />
			<line x1="3.95" y1="6.06" x2="8.54" y2="14" />
			<line x1="10.88" y1="21.94" x2="15.46" y2="14" />
		</svg>
	);
}

function IconCpu() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
			<rect x="9" y="9" width="6" height="6" />
			<line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
			<line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
			<line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
			<line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
		</svg>
	);
}

function IconLink() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	);
}

function IconMap() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
			<line x1="8" y1="2" x2="8" y2="18" />
			<line x1="16" y1="6" x2="16" y2="22" />
		</svg>
	);
}

function VisitorMap({ locations }) {
	const mapRef = useRef(null);
	const mapInstanceRef = useRef(null);

	useEffect(() => {
		if (!mapRef.current || !locations?.length) return;

		let cancelled = false;

		import('leaflet').then((L) => {
			if (cancelled) return;

			// Destroy previous map instance
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}

			const map = L.map(mapRef.current, {
				scrollWheelZoom: false,
				zoomControl: true,
				attributionControl: false,
			}).setView([14.7, -17.5], 3);

			L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
				maxZoom: 18,
			}).addTo(map);

			const maxVisits = Math.max(...locations.map((l) => l.visits), 1);
			for (const loc of locations) {
				const radius = Math.max(5, Math.min(20, (loc.visits / maxVisits) * 20));
				L.circleMarker([loc.lat, loc.lng], {
					radius,
					fillColor: '#1a9d8f',
					color: '#1a9d8f',
					weight: 1,
					opacity: 0.8,
					fillOpacity: 0.5,
				})
					.bindPopup(
						`<strong>${loc.city || 'Inconnu'}${loc.country ? ', ' + loc.country : ''}</strong><br/>${loc.visits} visite${loc.visits > 1 ? 's' : ''}`
					)
					.addTo(map);
			}

			// Fit bounds to markers
			if (locations.length > 1) {
				const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
				map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
			}

			mapInstanceRef.current = map;
		});

		return () => {
			cancelled = true;
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}
		};
	}, [locations]);

	if (!locations?.length) {
		return (
			<div className="analytics-map-empty">
				<IconMap />
				<span>Aucune donnee de localisation disponible</span>
			</div>
		);
	}

	return <div ref={mapRef} className="analytics-map" />;
}

export function AdminView() {
	const storedToken = window.localStorage.getItem('tapal-admin-token') ?? '';
	const [token, setToken] = useState(storedToken);
	const [loginEmail, setLoginEmail] = useState('');
	const [loginPassword, setLoginPassword] = useState('');
	const [loginError, setLoginError] = useState('');
	const [loginLoading, setLoginLoading] = useState(false);
	const [orders, setOrders] = useState([]);
	const [drafts, setDrafts] = useState({});
	const [status, setStatus] = useState({ type: 'idle', message: '' });
	const [loading, setLoading] = useState(false);
	const [inventory, setInventory] = useState({});
	const [inventorySaving, setInventorySaving] = useState(false);
	const [activeTab, setActiveTab] = useState('orders');

	// â”€â”€ FILTERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [searchQuery, setSearchQuery] = useState('');
	const [filterPayment, setFilterPayment] = useState('');
	const [filterOrder, setFilterOrder] = useState('');

	// â”€â”€ COUPONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [coupons, setCoupons] = useState([]);
	const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percent', discountValue: '', maxUses: '' });

	// â”€â”€ CEREMONIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [ceremonies, setCeremonies] = useState([]);
	const [ceremonyDrafts, setCeremonyDrafts] = useState({});
	const [couponSaving, setCouponSaving] = useState(false);
	const [couponError, setCouponError] = useState('');

	// â”€â”€ INVOICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [invoiceForm, setInvoiceForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', notes: '' });
	const [invoiceItems, setInvoiceItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
	const [invoiceSaving, setInvoiceSaving] = useState(false);
	const [invoiceResult, setInvoiceResult] = useState(null);
	const [invoiceError, setInvoiceError] = useState('');

	// â”€â”€ ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [analytics, setAnalytics] = useState(null);
	const [analyticsVisits, setAnalyticsVisits] = useState([]);
	const [analyticsLoading, setAnalyticsLoading] = useState(false);
	const [analyticsPeriod, setAnalyticsPeriod] = useState('7d');

	// â”€â”€ COLLAPSIBLE ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const [expandedOrders, setExpandedOrders] = useState(new Set());
	const [cardEditing, setCardEditing] = useState({});
	const [cardSaving, setCardSaving] = useState({});

	async function handleLogin(event) {
		event.preventDefault();
		setLoginError('');
		setLoginLoading(true);
		try {
			const result = await adminLogin(loginEmail, loginPassword);
			window.localStorage.setItem('tapal-admin-token', result.token);
			setToken(result.token);
		} catch (error) {
			setLoginError(error.message ?? 'Login failed.');
		} finally {
			setLoginLoading(false);
		}
	}

	function handleLogout() {
		window.localStorage.removeItem('tapal-admin-token');
		setToken('');
		setOrders([]);
	}

	function handleUnauthorized() {
		window.localStorage.removeItem('tapal-admin-token');
		setToken('');
		setOrders([]);
		setStatus({ type: 'error', message: 'Session expirÃ©e. Reconnectez-vous.' });
	}

	async function loadOrders(currentToken) {
		if (!currentToken) return;
		setLoading(true);
		try {
			const response = await fetchAdminOrders(currentToken);
			setOrders(response.orders);
			setDrafts(createDrafts(response.orders));
			setStatus({ type: 'success', message: `${response.orders.length} commandes chargÃ©es.` });
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: error.message });
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (token) {
			loadOrders(token);
			fetchAdminCoupons(token)
				.then((d) => setCoupons(d.coupons ?? []))
				.catch((error) => { if (error.status === 401) handleUnauthorized(); });
			fetchAdminCeremonies(token)
				.then((d) => {
					const list = d.ceremonies ?? [];
					setCeremonies(list);
					setCeremonyDrafts(Object.fromEntries(list.map((c) => [c.id, { status: c.status, adminNotes: c.adminNotes ?? '' }])));
				})
				.catch((error) => { if (error.status === 401) handleUnauthorized(); });
		}
	}, [token]);

	useEffect(() => {
		fetchInventory()
			.then((d) => setInventory(d.inventory ?? {}))
			.catch(() => {});
	}, []);

	useEffect(() => {
		if (token && activeTab === 'analytics') {
			loadAnalytics(token, analyticsPeriod);
		}
	}, [token, activeTab, analyticsPeriod]);

	async function toggleInventory(type, key, currentlyInStock) {
		setInventorySaving(true);
		try {
			const result = await setInventoryItem(type, key, !currentlyInStock, token);
			setInventory(result.inventory ?? {});
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: `Inventory error: ${error.message}` });
		} finally {
			setInventorySaving(false);
		}
	}

	const counts = useMemo(() => {
		return orders.reduce(
			(accumulator, order) => {
				accumulator.total += 1;
				accumulator[order.paymentStatus] = (accumulator[order.paymentStatus] ?? 0) + 1;
				accumulator[order.orderStatus] = (accumulator[order.orderStatus] ?? 0) + 1;
				if (order.paymentStatus === 'paid') {
					accumulator.revenue = (accumulator.revenue ?? 0) + (order.packPrice ?? 0) - (order.discountAmount ?? 0);
				}
				return accumulator;
			},
			{ total: 0, revenue: 0 },
		);
	}, [orders]);

	const filteredOrders = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		return orders.filter((order) => {
			if (filterPayment && order.paymentStatus !== filterPayment) return false;
			if (filterOrder && order.orderStatus !== filterOrder) return false;
			if (q) {
				const haystack = [
					order.profile?.fullName,
					order.profile?.email,
					order.profile?.phone,
					order.orderId,
				].filter(Boolean).join(' ').toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
	}, [orders, searchQuery, filterPayment, filterOrder]);

	async function handleCreateCoupon(event) {
		event.preventDefault();
		setCouponError('');
		setCouponSaving(true);
		try {
			const result = await createAdminCoupon({
				code: couponForm.code.toUpperCase(),
				discountType: couponForm.discountType,
				discountValue: Number(couponForm.discountValue),
				maxUses: Number(couponForm.maxUses || 0),
			}, token);
			setCoupons((prev) => [result.coupon, ...prev]);
			setCouponForm({ code: '', discountType: 'percent', discountValue: '', maxUses: '' });
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setCouponError(error.message ?? 'Erreur.');
		} finally {
			setCouponSaving(false);
		}
	}

	async function handleDeleteCoupon(code) {
		if (!window.confirm(`Supprimer le coupon "${code}" ?`)) return;
		try {
			await deleteAdminCoupon(code, token);
			setCoupons((prev) => prev.filter((c) => c.code !== code));
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: error.message });
		}
	}

	async function handleGenerateInvoice(event) {
		event.preventDefault();
		setInvoiceError('');
		setInvoiceResult(null);
		setInvoiceSaving(true);
		try {
			const validItems = invoiceItems.filter((item) => item.description.trim() && item.unitPrice > 0);
			if (!invoiceForm.clientName.trim() || validItems.length === 0) {
				setInvoiceError('Nom du client et au moins un article valide requis.');
				setInvoiceSaving(false);
				return;
			}
			const result = await generateAdminInvoice({
				clientName: invoiceForm.clientName.trim(),
				clientPhone: invoiceForm.clientPhone.trim(),
				clientEmail: invoiceForm.clientEmail.trim(),
				items: validItems.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice) || 0 })),
				notes: invoiceForm.notes.trim(),
			}, token);
			setInvoiceResult(result);
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setInvoiceError(error.message ?? 'Erreur lors de la gÃ©nÃ©ration.');
		} finally {
			setInvoiceSaving(false);
		}
	}

	function downloadInvoicePdf() {
		if (!invoiceResult) return;
		const byteChars = atob(invoiceResult.pdfBase64);
		const bytes = new Uint8Array(byteChars.length);
		for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
		const blob = new Blob([bytes], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = invoiceResult.pdfFilename || 'facture-tekko.pdf';
		a.click();
		URL.revokeObjectURL(url);
	}

	function resetInvoiceForm() {
		setInvoiceForm({ clientName: '', clientPhone: '', clientEmail: '', notes: '' });
		setInvoiceItems([{ description: '', quantity: 1, unitPrice: 0 }]);
		setInvoiceResult(null);
		setInvoiceError('');
	}

	async function loadAnalytics(currentToken, period) {
		setAnalyticsLoading(true);
		try {
			const [data, visitsData] = await Promise.all([
				fetchAdminAnalytics(period, currentToken),
				fetchAdminAnalyticsVisits(currentToken, 100),
			]);
			setAnalytics(data);
			setAnalyticsVisits(visitsData.visits ?? []);
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
		} finally {
			setAnalyticsLoading(false);
		}
	}

	function toggleOrder(orderId) {
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			if (next.has(orderId)) next.delete(orderId);
			else next.add(orderId);
			return next;
		});
	}

	async function markDelivered(orderId) {
		try {
			const response = await updateAdminOrder(orderId, { ...drafts[orderId], orderStatus: 'delivered' }, token);
			const nextOrders = orders.map((o) => (o.orderId === orderId ? response.order : o));
			setOrders(nextOrders);
			setDrafts(createDrafts(nextOrders));
			setStatus({ type: 'success', message: `Commande ${orderId.slice(0, 8)} marquee livree.` });
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: error.message });
		}
	}

	function updateDraft(orderId, field, value) {
		setDrafts((current) => ({
			...current,
			[orderId]: {
				...current[orderId],
				[field]: value,
			},
		}));
	}

	async function saveOrder(orderId) {
		try {
			const response = await updateAdminOrder(orderId, drafts[orderId], token);
			const nextOrders = orders.map((order) => (order.orderId === orderId ? response.order : order));
			setOrders(nextOrders);
			setDrafts(createDrafts(nextOrders));
			setStatus({ type: 'success', message: `Commande ${orderId.slice(0, 8)} mise Ã  jour.` });
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: error.message });
		}
	}

	function startCardEdit(order) {
		setCardEditing((prev) => ({
			...prev,
			[order.orderId]: {
				fullName: order.profile?.fullName ?? '',
				role: order.profile?.role ?? '',
				company: order.profile?.company ?? '',
				phone: order.profile?.phone ?? '',
				email: order.profile?.email ?? '',
				website: order.profile?.website ?? '',
				location: order.profile?.location ?? '',
				bio: order.profile?.bio ?? '',
				bgColor: order.customization?.bgColor ?? '',
				textColor: order.customization?.textColor ?? '',
				accent: order.customization?.accent ?? '',
			},
		}));
	}

	function updateCardField(orderId, field, value) {
		setCardEditing((prev) => ({
			...prev,
			[orderId]: { ...prev[orderId], [field]: value },
		}));
	}

	function cancelCardEdit(orderId) {
		setCardEditing((prev) => {
			const next = { ...prev };
			delete next[orderId];
			return next;
		});
	}

	async function saveCard(orderId) {
		const fields = cardEditing[orderId];
		if (!fields) return;
		setCardSaving((prev) => ({ ...prev, [orderId]: true }));
		try {
			const response = await updateAdminCard(orderId, {
				profile: {
					fullName: fields.fullName,
					role: fields.role,
					company: fields.company,
					phone: fields.phone,
					email: fields.email,
					website: fields.website,
					location: fields.location,
					bio: fields.bio,
				},
				customization: {
					bgColor: fields.bgColor,
					textColor: fields.textColor,
					accent: fields.accent,
				},
			}, token);
			const nextOrders = orders.map((o) => (o.orderId === orderId ? response.order : o));
			setOrders(nextOrders);
			setDrafts(createDrafts(nextOrders));
			cancelCardEdit(orderId);
			setStatus({ type: 'success', message: `Carte ${orderId.slice(0, 8)} mise Ã  jour.` });
		} catch (error) {
			if (error.status === 401) { handleUnauthorized(); return; }
			setStatus({ type: 'error', message: error.message });
		} finally {
			setCardSaving((prev) => ({ ...prev, [orderId]: false }));
		}
	}

	// â”€â”€ LOGIN SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	if (!token) {
		return (
			<div className="admin-login-page">
				<div className="admin-login-card">
					<div className="admin-login-header">
						<LogoMark />
						<h1>Panneau Admin</h1>
						<p>Connectez-vous pour accÃ©der au tableau de bord.</p>
					</div>
					<form className="admin-login-form" onSubmit={handleLogin}>
						<label className="admin-field">
							<span>Email</span>
							<input
								type="email"
								autoComplete="email"
								required
								value={loginEmail}
								onChange={(e) => setLoginEmail(e.target.value)}
								placeholder="votre@email.com"
							/>
						</label>
						<label className="admin-field">
							<span>Mot de passe</span>
							<input
								type="password"
								autoComplete="current-password"
								required
								value={loginPassword}
								onChange={(e) => setLoginPassword(e.target.value)}
								placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
							/>
						</label>
						{loginError ? <div className="admin-login-error">{loginError}</div> : null}
						<button type="submit" className="admin-login-btn" disabled={loginLoading}>
							{loginLoading ? 'Connexion...' : 'Se connecter'}
						</button>
					</form>
				</div>
			</div>
		);
	}

	// â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	return (
		<div className="admin-page">
			<header className="admin-header">
				<div className="admin-header-brand">
					<LogoMark />
					<span className="admin-header-title">TEKKO Admin</span>
				</div>
				<div className="admin-header-actions">
					<a href="/" className="admin-header-link">Studio</a>
					<button type="button" className="admin-header-link" onClick={() => loadOrders(token)}>
						<IconRefresh /> RafraÃ®chir
					</button>
					<button type="button" className="admin-header-logout" onClick={handleLogout}>
						<IconLogout /> DÃ©connexion
					</button>
				</div>
			</header>

			<div className="admin-body">
				{/* â”€â”€ STATS ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				<div className="admin-stats-row">
					<div className="admin-stat-card">
						<span className="admin-stat-label">Commandes totales</span>
						<strong className="admin-stat-value">{counts.total}</strong>
					</div>
					<div className="admin-stat-card">
						<span className="admin-stat-label">PayÃ©es</span>
						<strong className="admin-stat-value admin-stat-green">{counts.paid ?? 0}</strong>
					</div>
					<div className="admin-stat-card">
						<span className="admin-stat-label">En attente paiement</span>
						<strong className="admin-stat-value admin-stat-amber">{counts.pending ?? 0}</strong>
					</div>
					<div className="admin-stat-card">
						<span className="admin-stat-label">En production</span>
						<strong className="admin-stat-value admin-stat-blue">{counts['in-production'] ?? 0}</strong>
					</div>
					<div className="admin-stat-card">
						<span className="admin-stat-label">LivrÃ©es</span>
						<strong className="admin-stat-value">{counts.delivered ?? 0}</strong>
					</div>
					<div className="admin-stat-card">
						<span className="admin-stat-label">Chiffre d'affaires</span>
						<strong className="admin-stat-value admin-stat-green">{formatMoney(counts.revenue ?? 0)}</strong>
					</div>
				</div>

				{status.message ? (
					<div className={`admin-status-banner admin-status-${status.type}`}>{status.message}</div>
				) : null}

				{/* â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				<div className="admin-tabs">
					<button
						type="button"
						className={`admin-tab${activeTab === 'orders' ? ' active' : ''}`}
						onClick={() => setActiveTab('orders')}
					>
						Commandes
					</button>
					<button
						type="button"
						className={`admin-tab${activeTab === 'inventory' ? ' active' : ''}`}
						onClick={() => setActiveTab('inventory')}
					>
						Stock
					</button>
					<button
						type="button"
						className={`admin-tab${activeTab === 'coupons' ? ' active' : ''}`}
						onClick={() => setActiveTab('coupons')}
					>
						Coupons
					</button>
					<button
						type="button"
						className={`admin-tab${activeTab === 'ceremonies' ? ' active' : ''}`}
						onClick={() => setActiveTab('ceremonies')}
					>
						Ceremonies {ceremonies.length > 0 && <span style={{ marginLeft: '.3rem', background: '#1a9d8f', color: '#fff', borderRadius: '10px', padding: '.1rem .45rem', fontSize: '.65rem', fontWeight: 800 }}>{ceremonies.length}</span>}
					</button>
					<button
						type="button"
						className={`admin-tab${activeTab === 'invoices' ? ' active' : ''}`}
						onClick={() => setActiveTab('invoices')}
					>
						Factures
					</button>
					<button
						type="button"
						className={`admin-tab${activeTab === 'analytics' ? ' active' : ''}`}
						onClick={() => setActiveTab('analytics')}
					>
						Analytics
					</button>
				</div>

				{/* â”€â”€ ORDERS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				{activeTab === 'orders' && (
					<div className="admin-orders-section">
						<div className="admin-filters-bar">
							<input
								className="admin-filter-search"
								type="search"
								placeholder="Rechercher (nom, email, ID...)"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
							<select className="admin-filter-select" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
								<option value="">Tout paiement</option>
								<option value="pending">En attente</option>
								<option value="paid">Payé</option>
								<option value="whatsapp_pending">WhatsApp (Clé en main)</option>
								<option value="failed">Échoué</option>
								<option value="unknown">Inconnu</option>
							</select>
							<select className="admin-filter-select" value={filterOrder} onChange={(e) => setFilterOrder(e.target.value)}>
								<option value="">Tout statut</option>
								<option value="submitted">Soumise</option>
								<option value="in-production">En production</option>
								<option value="ready">PrÃªte</option>
								<option value="delivered">LivrÃ©e</option>
								<option value="cancelled">AnnulÃ©e</option>
							</select>
							{(searchQuery || filterPayment || filterOrder) && (
								<button type="button" className="admin-filter-reset" onClick={() => { setSearchQuery(''); setFilterPayment(''); setFilterOrder(''); }}>
									RÃ©initialiser
								</button>
							)}
							<span className="admin-filter-count">{filteredOrders.length} / {orders.length}</span>
						</div>

						{loading && <div className="admin-empty">Chargement des commandes...</div>}
						{!loading && orders.length === 0 && (
							<div className="admin-empty">Aucune commande pour l'instant.</div>
						)}
						{!loading && orders.length > 0 && filteredOrders.length === 0 && (
							<div className="admin-empty">Aucune commande ne correspond aux filtres.</div>
						)}
						<div className="admin-order-list">
							{filteredOrders.map((order) => {
								const avatarUrl = getAssetDisplayUrl(order.assets?.avatar);
								const artworkUrl = getAssetDisplayUrl(order.assets?.artwork);
								const draft = drafts[order.orderId] ?? {
									orderStatus: order.orderStatus,
									paymentStatus: order.paymentStatus,
									adminNotes: order.adminNotes,
									deliveryNotes: order.deliveryNotes,
								};
								const isExpanded = expandedOrders.has(order.orderId);
								const statusLabel = { submitted: 'Soumise', 'in-production': 'En production', ready: 'Prete', delivered: 'Livree', cancelled: 'Annulee' }[draft.orderStatus] || draft.orderStatus;

								return (
									<article key={order.orderId} className={`admin-order-card${isExpanded ? ' expanded' : ' collapsed'}`}>
										{/* â”€â”€ SUMMARY ROW (always visible) â”€â”€â”€â”€â”€â”€â”€ */}
										<div className="admin-order-summary" onClick={() => toggleOrder(order.orderId)}>
											<div className="admin-order-summary-left">
												{avatarUrl && <img className="admin-order-summary-avatar" src={avatarUrl} alt="" />}
												<div className="admin-order-summary-info">
													<strong className="admin-order-summary-name">{order.profile?.fullName}</strong>
													<span className="admin-order-summary-sub">
														{order.profile?.role}{order.profile?.company ? ` Â· ${order.profile.company}` : ''}
													</span>
												</div>
											</div>
											<div className="admin-order-summary-right">
												<span className="admin-order-summary-pack">{order.packageSelection?.name ?? order.packKey}</span>
												{order.source === 'cle_en_main' && (
													<span style={{ background: '#1a9d8f', color: '#fff', borderRadius: '10px', padding: '.1rem .45rem', fontSize: '.62rem', fontWeight: 800 }}>
														⚡ Clé en main
													</span>
												)}
												<strong className="admin-order-summary-price">{formatMoney(order.packPrice)}</strong>
												<span className={`admin-pay-badge admin-pay-${draft.paymentStatus}`}>{draft.paymentStatus}</span>
												<span className={`admin-order-status-badge admin-ostatus-${draft.orderStatus}`}>{statusLabel}</span>
												{draft.orderStatus !== 'delivered' && draft.paymentStatus === 'paid' && (
													<button
														type="button"
														className="admin-btn-deliver"
														onClick={(e) => { e.stopPropagation(); markDelivered(order.orderId); }}
													>
														Marquer livree
													</button>
												)}
												<span className="admin-order-summary-date">
													{new Date(order.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
												</span>
												<span className={`admin-order-chevron${isExpanded ? ' open' : ''}`}>
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
												</span>
											</div>
										</div>

										{/* â”€â”€ DETAILS (collapsible) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
										{isExpanded && (
											<div className="admin-order-details">
												<div className="admin-images">
													{avatarUrl && (
														<div className="admin-img-wrap">
															<span>Profil</span>
															<img src={avatarUrl} alt={order.profile?.fullName} />
														</div>
													)}
													{artworkUrl && (
														<div className="admin-img-wrap wide">
															<span>Artwork carte</span>
															<img src={artworkUrl} alt="artwork" />
														</div>
													)}
												</div>

												{/* â”€â”€ CARD PREVIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
												<div className="admin-card-previews">
													{order.finalCardUrl && (
														<div className="admin-preview-digital">
															<span className="admin-preview-label">Carte digitale</span>
															<div className="admin-phone-frame">
																<iframe
																	src={order.finalCardUrl}
																	title={`Carte de ${order.profile?.fullName}`}
																	sandbox="allow-scripts allow-same-origin"
																	loading="lazy"
																/>
															</div>
															<a href={order.finalCardUrl} target="_blank" rel="noreferrer" className="admin-preview-link">
																Ouvrir
															</a>
														</div>
													)}
													<div className="admin-preview-physical">
														<span className="admin-preview-label">Carte NFC - Recto</span>
														<div className="admin-nfc-card-mini" style={{
															'--card-base': materialCatalog[order.customization?.material]?.base ?? '#f5f5f3',
															'--card-edge': materialCatalog[order.customization?.material]?.edge ?? '#e0e0d8',
															'--card-ink': materialCatalog[order.customization?.material]?.ink ?? '#111',
															'--card-accent': order.customization?.accent ?? '#c8a96e',
														}}>
															{artworkUrl && (
																<img src={artworkUrl} alt="artwork" className="admin-card-artwork-mini" />
															)}
															<div className="admin-card-content-mini">
																<span className="admin-card-brand-mini">TEKKO</span>
																{order.profile?.fullName && <strong>{order.profile.fullName}</strong>}
																{order.profile?.role && <span>{order.profile.role}</span>}
															</div>
														</div>
													</div>
													<div className="admin-preview-physical">
														<span className="admin-preview-label">Carte NFC - Verso</span>
														<div className="admin-nfc-card-mini admin-nfc-card-back" style={{
															'--card-base': materialCatalog[order.customization?.material]?.base ?? '#f5f5f3',
															'--card-ink': materialCatalog[order.customization?.material]?.ink ?? '#111',
															'--card-accent': order.customization?.accent ?? '#c8a96e',
														}}>
															<div className="admin-card-back-content">
																<span className="admin-card-back-qr-label">{order.customization?.includeQr ? 'QR' : 'Tap only'}</span>
																{order.customization?.includeQr && (
																	<div className="admin-card-back-qr">
																		<img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(order.finalCardUrl || '')}`} alt="QR" />
																	</div>
																)}
																<span className="admin-card-back-url">{(order.finalCardUrl || '').replace(/^https?:\/\//, '')}</span>
															</div>
														</div>
													</div>
												</div>

												{/* â”€â”€ DOWNLOAD ASSETS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
												<div className="admin-downloads">
													<span className="admin-downloads-title">Telecharger pour impression</span>
													<div className="admin-downloads-row">
														{artworkUrl && (
															<a className="admin-dl-btn" href={artworkUrl} download="artwork" title="Telecharger le visuel">
																Visuel recto
															</a>
														)}
														{order.customization?.includeQr && order.finalCardUrl && (
															<a className="admin-dl-btn" href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(order.finalCardUrl)}`} download="qr-code.png" title="Telecharger le QR">
																QR Code
															</a>
														)}
														{avatarUrl && (
															<a className="admin-dl-btn" href={avatarUrl} download="photo-profil" title="Telecharger la photo">
																Photo profil
															</a>
														)}
														{order.paymentStatus === 'paid' && (
															<a className="admin-dl-btn" href={`/api/orders/${encodeURIComponent(order.orderId)}/receipt.pdf`} download title="Telecharger le recu PDF">
																Recu PDF
															</a>
														)}
													</div>
												</div>

												<div className="admin-order-data">
													{order.profile?.phone && <div className="admin-data-item"><span>Telephone</span><strong>{order.profile.phone}</strong></div>}
													{order.profile?.email && <div className="admin-data-item"><span>Email</span><strong>{order.profile.email}</strong></div>}
													{order.orderContact?.deliveryCity && <div className="admin-data-item"><span>Ville</span><strong>{order.orderContact.deliveryCity}</strong></div>}
													{order.quantity > 1 && <div className="admin-data-item"><span>Quantité</span><strong>{order.quantity} carte(s)</strong></div>}
													{order.description && (
														<div className="admin-data-item" style={{ gridColumn: '1 / -1' }}>
															<span>Description client</span>
															<strong style={{ whiteSpace: 'pre-wrap' }}>{order.description}</strong>
														</div>
													)}
													{order.finalCardUrl && (
														<div className="admin-data-item">
															<span>URL carte</span>
															<a href={order.finalCardUrl} target="_blank" rel="noreferrer">{order.finalCardUrl}</a>
														</div>
													)}
													{order.customization?.customDomain && (
														<div className="admin-data-item">
															<span>Domaine</span>
															<strong>{order.customization.customDomain}</strong>
														</div>
													)}
													{order.customization?.customDomain && (
														<div className="admin-data-item">
															<span>Prix domaine/an</span>
															<strong>
																{order.customization?.domainPrice
																	? `${formatMoney(order.customization.domainPrice)} (${order.customization?.domainUserShareFcfa > 0 ? formatMoney(order.customization.domainUserShareFcfa) + ' client' : 'inclus TEKKO'})`
																	: order.customization?.domainUserShareFcfa > 0
																		? formatMoney(order.customization.domainUserShareFcfa)
																		: 'Inclus par TEKKO'}
															</strong>
														</div>
													)}
													{order.customization?.customDomain && (
														<div className="admin-data-item">
															<span>Acheter sur</span>
															<span style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
																<a href={`https://www.hostinger.fr/domaine?search=${order.customization.customDomain}`} target="_blank" rel="noreferrer" style={{color:'var(--orange)',fontWeight:600,fontSize:'.82rem'}}>Hostinger</a>
																<a href={`https://www.namecheap.com/domains/registration/results/?domain=${order.customization.customDomain}`} target="_blank" rel="noreferrer" style={{color:'var(--orange)',fontWeight:600,fontSize:'.82rem'}}>Namecheap</a>
																<a href={`https://www.godaddy.com/domainsearch/find?domainToCheck=${order.customization.customDomain}`} target="_blank" rel="noreferrer" style={{color:'var(--orange)',fontWeight:600,fontSize:'.82rem'}}>GoDaddy</a>
															</span>
														</div>
													)}
												</div>

												<div className="admin-specs-row">
													{[order.customization?.material, order.customization?.finish, order.customization?.foil, order.customization?.themeKey]
														.filter(Boolean)
														.map((s) => <span key={s} className="admin-spec-tag">{s}</span>)}
													{order.customization?.cardLayout && (
														<span className="admin-spec-tag admin-spec-layout">Layout : {order.customization.cardLayout}</span>
													)}
													{order.customization?.fontStyle && order.customization.fontStyle !== 'moderne' && (
														<span className="admin-spec-tag admin-spec-font">Police : {order.customization.fontStyle}</span>
													)}
													{order.customization?.cardLabel && order.customization.cardLabel !== 'Tapal Signature' && (
														<span className="admin-spec-tag">Label : {order.customization.cardLabel}</span>
													)}
												</div>

												{(order.customization?.accent || order.customization?.textColor || order.customization?.bgColor) && (
													<div className="admin-colours-row">
														{order.customization?.accent && (
															<span className="admin-colour-chip" title={`Accent : ${order.customization.accent}`}>
																<span className="admin-colour-swatch" style={{ background: order.customization.accent }} />
																Accent
															</span>
														)}
														{order.customization?.textColor && (
															<span className="admin-colour-chip" title={`Texte : ${order.customization.textColor}`}>
																<span className="admin-colour-swatch" style={{ background: order.customization.textColor }} />
																Texte
															</span>
														)}
														{order.customization?.bgColor && (
															<span className="admin-colour-chip" title={`Fond : ${order.customization.bgColor}`}>
																<span className="admin-colour-swatch" style={{ background: order.customization.bgColor }} />
																Fond
															</span>
														)}
													</div>
												)}

												{(order.customization?.stylePrompt || order.customization?.animationEnabled) && (
													<div className="admin-design-notes">
														{order.customization?.stylePrompt && (
															<div className="admin-design-row">
																<span>Style prompt</span>
																<p>{order.customization.stylePrompt}</p>
															</div>
														)}
														{order.customization?.animationEnabled && order.customization?.animationDescription && (
															<div className="admin-design-row">
																<span>Animation</span>
																<p>{order.customization.animationDescription}</p>
															</div>
														)}
													</div>
												)}

												{/* Business pack â€” show all card profiles */}
												{order.profile?.businessCards && Array.isArray(order.profile.businessCards) && (
													<div className="admin-business-cards">
														<strong style={{ fontSize: '.82rem', marginBottom: '.3rem', display: 'block' }}>Pack Business â€” {order.profile.businessCards.length} cartes</strong>
														<div className="admin-business-grid">
															{order.profile.businessCards.map((bc, i) => (
																<div key={i} className="admin-business-card-item">
																	<span className="business-card-num">{i + 1}</span>
																	<div>
																		<strong>{i === 0 ? (order.profile.fullName || 'Carte principale') : (bc.fullName || 'â€”')}</strong>
																		{i > 0 && bc.role && <span className="admin-order-summary-sub">{bc.role}</span>}
																		{i > 0 && bc.email && <span className="admin-order-summary-sub">{bc.email}</span>}
																		{i > 0 && bc.phone && <span className="admin-order-summary-sub">{bc.phone}</span>}
																	</div>
																</div>
															))}
														</div>
													</div>
												)}

												<div className="admin-edit-fields">
													<label className="admin-field">
														<span>Statut commande</span>
														<select value={draft.orderStatus} onChange={(e) => updateDraft(order.orderId, 'orderStatus', e.target.value)}>
															<option value="submitted">Soumise</option>
															<option value="in-production">En production</option>
															<option value="ready">Prete</option>
															<option value="delivered">Livree</option>
															<option value="cancelled">Annulee</option>
														</select>
													</label>
													<label className="admin-field">
														<span>Statut paiement</span>
														<select value={draft.paymentStatus} onChange={(e) => updateDraft(order.orderId, 'paymentStatus', e.target.value)}>
															<option value="pending">En attente</option>
															<option value="paid">Paye</option>
															<option value="failed">Echoue</option>
															<option value="unknown">Inconnu</option>
														</select>
													</label>
													<div className="admin-field admin-field-full admin-coupon-apply">
														<span>Photos (avatar / logo)</span>
														<div className="admin-upload-row">
															<label className="admin-upload-label">
																Photo profil
																<input
																	type="file"
																	accept="image/jpeg,image/png,image/webp"
																	id={`avatar-upload-${order.orderId}`}
																	style={{ display: 'none' }}
																/>
																<button
																	type="button"
																	className="admin-btn-ghost"
																	onClick={() => document.getElementById(`avatar-upload-${order.orderId}`)?.click()}
																>
																	Choisir photo
																</button>
															</label>
															<label className="admin-upload-label">
																Logo entreprise
																<input
																	type="file"
																	accept="image/jpeg,image/png,image/webp"
																	id={`logo-upload-${order.orderId}`}
																	style={{ display: 'none' }}
																/>
																<button
																	type="button"
																	className="admin-btn-ghost"
																	onClick={() => document.getElementById(`logo-upload-${order.orderId}`)?.click()}
																>
																	Choisir logo
																</button>
															</label>
															<button
																type="button"
																className="admin-btn-ghost"
																onClick={async () => {
																	const avatarInput = document.getElementById(`avatar-upload-${order.orderId}`);
																	const logoInput = document.getElementById(`logo-upload-${order.orderId}`);
																	const avatarFile = avatarInput?.files?.[0] ?? null;
																	const logoFile = logoInput?.files?.[0] ?? null;
																	if (!avatarFile && !logoFile) {
																		setStatus({ type: 'error', message: 'Selectionnez au moins une photo.' });
																		return;
																	}
																	try {
																		setStatus({ type: 'info', message: 'Envoi en cours...' });
																		const result = await uploadAdminAssets(order.orderId, { avatarFile, logoFile }, token);
																		const nextOrders = orders.map((o) => (o.orderId === order.orderId ? { ...o, assets: result.assets } : o));
																		setOrders(nextOrders);
																		setDrafts(createDrafts(nextOrders));
																		if (avatarInput) avatarInput.value = '';
																		if (logoInput) logoInput.value = '';
																		setStatus({ type: 'success', message: 'Photos mises a jour avec succes.' });
																	} catch (error) {
																		if (error.status === 401) { handleUnauthorized(); return; }
																		setStatus({ type: 'error', message: error.message });
																	}
																}}
															>
																Envoyer
															</button>
														</div>
													</div>
													<div className="admin-field admin-field-full admin-coupon-apply">
														<span>Coupon</span>
														<div className="admin-coupon-apply-row">
															<input
																type="text"
																className="admin-coupon-input"
																placeholder="Code coupon (ex: PROMO20)"
																defaultValue={order.couponCode ?? ''}
																id={`coupon-input-${order.orderId}`}
															/>
															<button
																type="button"
																className="admin-btn-ghost"
																onClick={async () => {
																	const input = document.getElementById(`coupon-input-${order.orderId}`);
																	const code = (input?.value ?? '').trim().toUpperCase();
																	try {
																		const result = await applyAdminCoupon(order.orderId, code, token);
																		const nextOrders = orders.map((o) => (o.orderId === order.orderId ? result.order : o));
																		setOrders(nextOrders);
																		setDrafts(createDrafts(nextOrders));
																		const msg = code
																			? `Coupon ${code} applique -- remise ${formatMoney(result.discountAmount)}`
																			: 'Coupon supprime';
																		setStatus({ type: 'success', message: msg });
																	} catch (error) {
																		if (error.status === 401) { handleUnauthorized(); return; }
																		setStatus({ type: 'error', message: error.message });
																	}
																}}
															>
																Appliquer
															</button>
														</div>
														{order.discountAmount > 0 && (
															<span className="admin-coupon-current">
																Remise actuelle : <strong>{order.couponCode}</strong> -- -{formatMoney(order.discountAmount)} - Solde : {formatMoney(order.packPrice - order.discountAmount)}
															</span>
														)}
													</div>
													<label className="admin-field admin-field-full">
														<span>Notes admin</span>
														<textarea rows="2" value={draft.adminNotes} onChange={(e) => updateDraft(order.orderId, 'adminNotes', e.target.value)} />
													</label>
													<label className="admin-field admin-field-full">
														<span>Notes livraison</span>
														<textarea rows="2" value={draft.deliveryNotes} onChange={(e) => updateDraft(order.orderId, 'deliveryNotes', e.target.value)} />
													</label>
												</div>

												{/* â”€â”€ CARD EDITING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
												<div className="admin-card-edit-section">
													{!cardEditing[order.orderId] ? (
														<button type="button" className="admin-btn-ghost" onClick={() => startCardEdit(order)} style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
															Modifier la carte
														</button>
													) : (
														<>
															<div className="admin-card-edit-header">
																<strong>Modifier la carte</strong>
																<button type="button" className="admin-btn-ghost" onClick={() => cancelCardEdit(order.orderId)} style={{ padding: '2px 8px', fontSize: '11px' }}>Annuler</button>
															</div>
															<div className="admin-edit-fields">
																<label className="admin-field">
																	<span>Nom complet</span>
																	<input type="text" value={cardEditing[order.orderId].fullName} onChange={(e) => updateCardField(order.orderId, 'fullName', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Fonction</span>
																	<input type="text" value={cardEditing[order.orderId].role} onChange={(e) => updateCardField(order.orderId, 'role', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Entreprise</span>
																	<input type="text" value={cardEditing[order.orderId].company} onChange={(e) => updateCardField(order.orderId, 'company', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Telephone</span>
																	<input type="text" value={cardEditing[order.orderId].phone} onChange={(e) => updateCardField(order.orderId, 'phone', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Email</span>
																	<input type="text" value={cardEditing[order.orderId].email} onChange={(e) => updateCardField(order.orderId, 'email', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Site web</span>
																	<input type="text" value={cardEditing[order.orderId].website} onChange={(e) => updateCardField(order.orderId, 'website', e.target.value)} />
																</label>
																<label className="admin-field admin-field-full">
																	<span>Localisation</span>
																	<input type="text" value={cardEditing[order.orderId].location} onChange={(e) => updateCardField(order.orderId, 'location', e.target.value)} />
																</label>
																<label className="admin-field admin-field-full">
																	<span>Bio</span>
																	<textarea rows="2" value={cardEditing[order.orderId].bio} onChange={(e) => updateCardField(order.orderId, 'bio', e.target.value)} />
																</label>
																<label className="admin-field">
																	<span>Couleur fond</span>
																	<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
																		<input type="color" value={cardEditing[order.orderId].bgColor || '#ffffff'} onChange={(e) => updateCardField(order.orderId, 'bgColor', e.target.value)} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} />
																		<input type="text" value={cardEditing[order.orderId].bgColor} onChange={(e) => updateCardField(order.orderId, 'bgColor', e.target.value)} style={{ flex: 1 }} />
																	</div>
																</label>
																<label className="admin-field">
																	<span>Couleur texte</span>
																	<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
																		<input type="color" value={cardEditing[order.orderId].textColor || '#000000'} onChange={(e) => updateCardField(order.orderId, 'textColor', e.target.value)} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} />
																		<input type="text" value={cardEditing[order.orderId].textColor} onChange={(e) => updateCardField(order.orderId, 'textColor', e.target.value)} style={{ flex: 1 }} />
																	</div>
																</label>
																<label className="admin-field">
																	<span>Couleur accent</span>
																	<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
																		<input type="color" value={cardEditing[order.orderId].accent || '#1D7A4E'} onChange={(e) => updateCardField(order.orderId, 'accent', e.target.value)} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} />
																		<input type="text" value={cardEditing[order.orderId].accent} onChange={(e) => updateCardField(order.orderId, 'accent', e.target.value)} style={{ flex: 1 }} />
																	</div>
																</label>
															</div>
															<button type="button" className="admin-btn-primary" onClick={() => saveCard(order.orderId)} disabled={cardSaving[order.orderId]} style={{ marginTop: 8, width: '100%' }}>
																{cardSaving[order.orderId] ? 'Enregistrement...' : 'Sauvegarder la carte'}
															</button>
														</>
													)}
												</div>

												<div className="admin-order-footer">
													{order.paymentUrl && (
														<a href={order.paymentUrl} target="_blank" rel="noreferrer" className="admin-btn-ghost">
															Lien paiement
														</a>
													)}
													{order.paymentStatus !== 'paid' && (
														<button
															type="button"
															className="admin-btn-ghost"
															onClick={async () => {
																try {
																	setStatus({ type: 'info', message: 'Generation du lien de paiement...' });
																	const result = await regeneratePaymentLink(order.orderId, token);
																	const nextOrders = orders.map((o) => (o.orderId === order.orderId ? result.order : o));
																	setOrders(nextOrders);
																	setDrafts(createDrafts(nextOrders));
																	setStatus({ type: 'success', message: `Nouveau lien genere. URL : ${result.paymentUrl}` });
																} catch (error) {
																	if (error.status === 401) { handleUnauthorized(); return; }
																	setStatus({ type: 'error', message: error.message });
																}
															}}
														>
															Generer lien paiement
														</button>
													)}
													<a
														className="admin-btn-ghost"
														href={`/api/admin/orders/${encodeURIComponent(order.orderId)}/receipt.pdf`}
														download
														onClick={(e) => {
															e.preventDefault();
															fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}/receipt.pdf`, {
																headers: { 'x-admin-token': token },
															})
																.then((r) => { if (!r.ok) throw new Error('Erreur telechargement'); return r.blob(); })
																.then((blob) => {
																	const url = URL.createObjectURL(blob);
																	const a = document.createElement('a');
																	a.href = url;
																	a.download = `recu-tekko-${order.orderId.slice(0, 8).toUpperCase()}.pdf`;
																	a.click();
																	URL.revokeObjectURL(url);
																})
																.catch(() => setStatus({ type: 'error', message: 'Erreur telechargement recu.' }));
														}}
													>
														Recu PDF
													</a>
													{draft.orderStatus !== 'delivered' && draft.paymentStatus === 'paid' && (
														<button type="button" className="admin-btn-deliver" onClick={() => markDelivered(order.orderId)}>
															Marquer livree
														</button>
													)}
													<button type="button" className="admin-btn-primary" onClick={() => saveOrder(order.orderId)}>
														Enregistrer
													</button>
												</div>
											</div>
										)}
									</article>
								);
							})}
						</div>
					</div>
				)}

				{/* â”€â”€ INVENTORY TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				{activeTab === 'inventory' && (
					<div className="admin-inventory-section">
						<p className="admin-inventory-desc">
							DÃ©sactivez un matÃ©riau ou une dorure pour le griser sur le configurateur client.
						</p>
						<div className="admin-inv-grid">
							<div className="admin-inv-group">
								<h3>MatÃ©riaux</h3>
								{Object.keys(materialCatalog).map((m) => {
									const inv = inventory[`material:${m}`];
									const inStock = inv ? inv.inStock : true;
									return (
										<div key={m} className="admin-inv-row">
											<span>{m}</span>
											<button
												type="button"
												className={`admin-inv-toggle${inStock ? ' in-stock' : ' out-of-stock'}`}
												disabled={inventorySaving}
												onClick={() => toggleInventory('material', m, inStock)}
											>
												{inStock ? 'En stock' : 'Ã‰puisÃ©'}
											</button>
										</div>
									);
								})}
							</div>
							<div className="admin-inv-group">
								<h3>Dorures</h3>
								{Object.keys(foilCatalog).map((f) => {
									const inv = inventory[`foil:${f}`];
									const inStock = inv ? inv.inStock : true;
									return (
										<div key={f} className="admin-inv-row">
											<span>{f}</span>
											<button
												type="button"
												className={`admin-inv-toggle${inStock ? ' in-stock' : ' out-of-stock'}`}
												disabled={inventorySaving}
												onClick={() => toggleInventory('foil', f, inStock)}
											>
												{inStock ? 'En stock' : 'Ã‰puisÃ©'}
											</button>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				)}

				{/* â”€â”€ COUPONS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				{activeTab === 'coupons' && (
					<div className="admin-coupons-section">
						<form className="admin-coupon-form" onSubmit={handleCreateCoupon}>
							<h3>CrÃ©er un coupon</h3>
							<div className="admin-coupon-form-row">
								<label className="admin-field">
									<span>Code</span>
									<input
										type="text"
										required
										placeholder="EX: PROMO20"
										value={couponForm.code}
										onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
									/>
								</label>
								<label className="admin-field">
									<span>Type</span>
									<select value={couponForm.discountType} onChange={(e) => setCouponForm((f) => ({ ...f, discountType: e.target.value }))}>
										<option value="percent">Pourcentage (%)</option>
										<option value="fixed">Montant fixe (FCFA)</option>
									</select>
								</label>
								<label className="admin-field">
									<span>Valeur {couponForm.discountType === 'percent' ? '(%)' : '(FCFA)'}</span>
									<input
										type="number"
										required
										min="1"
										placeholder={couponForm.discountType === 'percent' ? '10' : '1000'}
										value={couponForm.discountValue}
										onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))}
									/>
								</label>
								<label className="admin-field">
									<span>Utilisations max (0 = illimitÃ©)</span>
									<input
										type="number"
										min="0"
										placeholder="0"
										value={couponForm.maxUses}
										onChange={(e) => setCouponForm((f) => ({ ...f, maxUses: e.target.value }))}
									/>
								</label>
							</div>
							{couponError && <div className="admin-login-error">{couponError}</div>}
							<button type="submit" className="admin-btn-primary" disabled={couponSaving}>
								{couponSaving ? 'CrÃ©ation...' : 'CrÃ©er le coupon'}
							</button>
						</form>

						<div className="admin-coupon-list">
							{coupons.length === 0 && <div className="admin-empty">Aucun coupon crÃ©Ã©.</div>}
							{coupons.map((c) => (
								<div key={c.code} className="admin-coupon-row">
									<div className="admin-coupon-info">
										<strong className="admin-coupon-code">{c.code}</strong>
										<span className="admin-coupon-meta">
											{c.discountType === 'percent' ? `${c.discountValue}%` : formatMoney(c.discountValue)}
											{' Â· '}
											{c.maxUses > 0 ? `${c.usedCount}/${c.maxUses} utilisations` : `${c.usedCount} utilisation${c.usedCount !== 1 ? 's' : ''}`}
										</span>
									</div>
									<div className="admin-coupon-right">
										<span className={`admin-coupon-status${c.active ? ' active' : ' inactive'}`}>
											{c.active ? 'Actif' : 'Inactif'}
										</span>
										<button type="button" className="admin-btn-danger" onClick={() => handleDeleteCoupon(c.code)}>
											Supprimer
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* â”€â”€ CEREMONIES TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
				{activeTab === 'ceremonies' && (
					<div className="admin-orders-section">
						{ceremonies.length === 0 && <div className="admin-empty">Aucune demande de cÃ©rÃ©monie.</div>}
						<div className="admin-orders-grid">
							{ceremonies.map((c) => {
								const draft = ceremonyDrafts[c.id] ?? { status: c.status, adminNotes: '' };
								return (
									<div key={c.id} className="admin-ceremony-card">
										<div className="admin-ceremony-head">
											<h3>{c.contactName}</h3>
											<span className="admin-ceremony-type">{c.eventType}</span>
										</div>
										<div className="admin-ceremony-grid">
											<div className="admin-ceremony-item"><span>TÃ©l</span><strong>{c.contactPhone}</strong></div>
											{c.contactEmail && <div className="admin-ceremony-item"><span>Email</span><strong>{c.contactEmail}</strong></div>}
											{c.company && <div className="admin-ceremony-item"><span>Entreprise</span><strong>{c.company}</strong></div>}
											{c.eventName && <div className="admin-ceremony-item"><span>Ã‰vÃ©nement</span><strong>{c.eventName}</strong></div>}
											{c.eventDate && <div className="admin-ceremony-item"><span>Date</span><strong>{c.eventDate}</strong></div>}
											{c.eventCity && <div className="admin-ceremony-item"><span>Lieu</span><strong>{c.eventCity}</strong></div>}
											{c.guestCount && <div className="admin-ceremony-item"><span>InvitÃ©s</span><strong>{c.guestCount}</strong></div>}
											{c.budget && <div className="admin-ceremony-item"><span>Budget</span><strong>{c.budget}</strong></div>}
										</div>
										{c.services?.length > 0 && (
											<div className="admin-ceremony-services">
												{c.services.map((s) => <span key={s} className="admin-ceremony-svc-tag">{s}</span>)}
											</div>
										)}
										{(c.customDesign || c.notes) && (
											<div className="admin-ceremony-notes">
												{c.customDesign && <><strong>Design:</strong> {c.customDesign}<br /></>}
												{c.notes && <><strong>Notes:</strong> {c.notes}</>}
											</div>
										)}
										<div className="admin-ceremony-status-row">
											<select value={draft.status} onChange={(e) => setCeremonyDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], status: e.target.value } }))}>
												<option value="nouveau">Nouveau</option>
												<option value="contacte">ContactÃ©</option>
												<option value="devis_envoye">Devis envoyÃ©</option>
												<option value="confirme">ConfirmÃ©</option>
												<option value="termine">TerminÃ©</option>
												<option value="annule">AnnulÃ©</option>
											</select>
											<input
												type="text"
												placeholder="Notes adminâ€¦"
												value={draft.adminNotes}
												onChange={(e) => setCeremonyDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], adminNotes: e.target.value } }))}
											/>
											<button
												type="button"
												className="admin-btn-primary"
												onClick={() => {
													updateAdminCeremony(c.id, draft, token).then(() => {
														setCeremonies((prev) => prev.map((x) => x.id === c.id ? { ...x, status: draft.status, adminNotes: draft.adminNotes } : x));
													});
												}}
											>
												Sauvegarder
											</button>
										</div>
										<small style={{ color: '#555' }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</small>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{activeTab === 'invoices' && (
					<div className="admin-section">
						<h2>GÃ©nÃ©rer une Facture</h2>
						{invoiceResult ? (
							<div style={{ background: '#f0fff0', border: '1px solid #4caf50', borderRadius: '10px', padding: '1.5rem', marginTop: '1rem' }}>
								<h3 style={{ color: '#2e7d32', marginBottom: '.8rem' }}>Facture generee -- {invoiceResult.invoiceId}</h3>
								<p style={{ fontSize: '.9rem', marginBottom: '.6rem' }}>
									<strong>Total :</strong> {new Intl.NumberFormat('fr-FR').format(invoiceResult.total)} FCFA
								</p>
								{invoiceResult.paymentUrl && (
									<div style={{ marginBottom: '1rem' }}>
										<label style={{ fontWeight: 700, display: 'block', marginBottom: '.3rem', fontSize: '.85rem' }}>Lien de paiement Wave :</label>
										<div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
											<input
												type="text"
												readOnly
												value={invoiceResult.paymentUrl}
												style={{ flex: 1, padding: '.5rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '.8rem' }}
												onClick={(e) => e.target.select()}
											/>
											<button
												type="button"
												className="admin-btn-primary"
												style={{ whiteSpace: 'nowrap' }}
												onClick={() => { navigator.clipboard.writeText(invoiceResult.paymentUrl); }}
											>
												Copier
											</button>
										</div>
									</div>
								)}
								<div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
									<button type="button" className="admin-btn-primary" onClick={downloadInvoicePdf}>
										TÃ©lÃ©charger PDF
									</button>
									<button type="button" className="admin-btn-secondary" onClick={resetInvoiceForm}>
										Nouvelle facture
									</button>
								</div>
							</div>
						) : (
							<form onSubmit={handleGenerateInvoice} style={{ marginTop: '1rem' }}>
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '1rem' }}>
									<div>
										<label className="admin-label">Nom du client *</label>
										<input
											type="text"
											className="admin-input"
											value={invoiceForm.clientName}
											onChange={(e) => setInvoiceForm((f) => ({ ...f, clientName: e.target.value }))}
											required
										/>
									</div>
									<div>
										<label className="admin-label">TÃ©lÃ©phone</label>
										<input
											type="text"
											className="admin-input"
											value={invoiceForm.clientPhone}
											onChange={(e) => setInvoiceForm((f) => ({ ...f, clientPhone: e.target.value }))}
										/>
									</div>
									<div style={{ gridColumn: '1 / -1' }}>
										<label className="admin-label">Email</label>
										<input
											type="email"
											className="admin-input"
											value={invoiceForm.clientEmail}
											onChange={(e) => setInvoiceForm((f) => ({ ...f, clientEmail: e.target.value }))}
										/>
									</div>
								</div>

								<label className="admin-label">Articles</label>
								<div style={{ marginBottom: '1rem' }}>
									{invoiceItems.map((item, idx) => (
										<div key={idx} style={{ display: 'flex', gap: '.5rem', marginBottom: '.4rem', alignItems: 'center' }}>
											<input
												type="text"
												className="admin-input"
												placeholder="Description"
												value={item.description}
												onChange={(e) => { const newItems = [...invoiceItems]; newItems[idx] = { ...item, description: e.target.value }; setInvoiceItems(newItems); }}
												style={{ flex: 2 }}
											/>
											<input
												type="number"
												className="admin-input"
												placeholder="QtÃ©"
												min={1}
												value={item.quantity}
												onChange={(e) => { const newItems = [...invoiceItems]; newItems[idx] = { ...item, quantity: Number(e.target.value) || 1 }; setInvoiceItems(newItems); }}
												style={{ width: '70px', flex: 'none' }}
											/>
											<input
												type="number"
												className="admin-input"
												placeholder="Prix unit."
												min={0}
												value={item.unitPrice}
												onChange={(e) => { const newItems = [...invoiceItems]; newItems[idx] = { ...item, unitPrice: Number(e.target.value) || 0 }; setInvoiceItems(newItems); }}
												style={{ width: '120px', flex: 'none' }}
											/>
											{invoiceItems.length > 1 && (
												<button
													type="button"
													onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}
													style={{ background: 'none', border: 'none', color: '#1a9d8f', cursor: 'pointer', fontWeight: 700, fontSize: '1.2rem' }}
												>
													Ã—
												</button>
											)}
										</div>
									))}
									<button
										type="button"
										onClick={() => setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unitPrice: 0 }])}
										style={{ background: 'none', border: 'none', color: '#1a9d8f', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', padding: '.3rem 0' }}
									>
										+ Ajouter un article
									</button>
								</div>

								<div style={{ marginBottom: '1rem', fontSize: '.95rem', fontWeight: 700 }}>
									Total : {new Intl.NumberFormat('fr-FR').format(invoiceItems.reduce((s, i) => s + (i.quantity || 1) * (i.unitPrice || 0), 0))} FCFA
								</div>

								<div style={{ marginBottom: '1rem' }}>
									<label className="admin-label">Notes (optionnel)</label>
									<textarea
										className="admin-input"
										rows={3}
										value={invoiceForm.notes}
										onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
									/>
								</div>

								{invoiceError && <p style={{ color: '#1a9d8f', marginBottom: '.5rem' }}>{invoiceError}</p>}
								<button type="submit" className="admin-btn-primary" disabled={invoiceSaving}>
									{invoiceSaving ? 'GÃ©nÃ©rationâ€¦' : 'GÃ©nÃ©rer la facture'}
								</button>
							</form>
						)}
					</div>
				)}

				{/* â”€â”€ ANALYTICS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
			{activeTab === 'analytics' && (
				<div className="admin-analytics-section">
					<div className="analytics-toolbar">
						<div className="analytics-period-bar">
							{[['24h', '24 heures'], ['7d', '7 jours'], ['30d', '30 jours'], ['90d', '90 jours']].map(([val, lbl]) => (
								<button
									key={val}
									type="button"
									className={`analytics-period-btn${analyticsPeriod === val ? ' active' : ''}`}
									onClick={() => setAnalyticsPeriod(val)}
								>
									{lbl}
								</button>
							))}
						</div>
						<button type="button" className="admin-header-link" onClick={() => loadAnalytics(token, analyticsPeriod)}>
							<IconRefresh /> Rafraichir
						</button>
					</div>

					{analyticsLoading && <div className="admin-empty">Chargement des analytics...</div>}

					{!analyticsLoading && analytics && (
						<>
							{/* Summary stats */}
							<div className="analytics-stats-row">
								<div className="analytics-stat">
									<span className="analytics-stat-label">Visites totales</span>
									<strong className="analytics-stat-value">{analytics.summary?.totalVisits ?? 0}</strong>
								</div>
								<div className="analytics-stat">
									<span className="analytics-stat-label">Visiteurs uniques</span>
									<strong className="analytics-stat-value analytics-accent">{analytics.summary?.uniqueVisitors ?? 0}</strong>
								</div>
								<div className="analytics-stat">
									<span className="analytics-stat-label">Vues de cartes NFC</span>
									<strong className="analytics-stat-value">{analytics.summary?.cardViews ?? 0}</strong>
								</div>
								<div className="analytics-stat">
									<span className="analytics-stat-label">Vues de pages</span>
									<strong className="analytics-stat-value">{analytics.summary?.pageViews ?? 0}</strong>
								</div>
							</div>

							{/* Visitor map */}
							<div className="analytics-chart-card analytics-chart-full">
								<h3 className="analytics-chart-title"><IconMap /> Carte des visiteurs</h3>
								<VisitorMap locations={analytics.locations} />
							</div>

							{/* Time series */}
							{analytics.timeSeries?.length > 0 && (
								<div className="analytics-chart-card analytics-chart-full">
									<h3 className="analytics-chart-title">Visites par jour</h3>
									<TimeSeriesChart data={analytics.timeSeries} />
								</div>
							)}

							{/* Charts grid */}
							<div className="analytics-charts-grid">
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconGlobe /> Pays</h3>
									<AnalyticsBarList items={analytics.countries?.map((c) => ({ label: `${countryFlag(c.code)} ${c.country || c.code}`, visits: c.visits }))} />
								</div>
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconBuilding /> Villes</h3>
									<AnalyticsBarList items={analytics.cities?.map((c) => ({ label: `${c.city}${c.country ? ', ' + c.country : ''}`, visits: c.visits }))} />
								</div>
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconMonitor /> Appareils</h3>
									<AnalyticsBarList items={analytics.devices?.map((d) => ({ label: deviceLabel(d.deviceType), visits: d.visits }))} />
								</div>
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconBrowser /> Navigateurs</h3>
									<AnalyticsBarList items={analytics.browsers?.map((b) => ({ label: b.browser, visits: b.visits }))} />
								</div>
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconCpu /> Systemes (OS)</h3>
									<AnalyticsBarList items={analytics.os?.map((o) => ({ label: o.os, visits: o.visits }))} />
								</div>
								<div className="analytics-chart-card">
									<h3 className="analytics-chart-title"><IconLink /> Referents</h3>
									<AnalyticsBarList items={analytics.referrers?.map((r) => ({ label: r.referrer || 'Direct', visits: r.visits }))} />
								</div>
							</div>

							{/* Top pages */}
							{analytics.topPages?.length > 0 && (
								<div className="analytics-chart-card analytics-chart-full">
									<h3 className="analytics-chart-title">Top pages et cartes</h3>
									<div className="analytics-table-wrap">
										<table className="analytics-table">
											<thead><tr><th>Page</th><th>Type</th><th>Visites</th></tr></thead>
											<tbody>
												{analytics.topPages.slice(0, 15).map((page, i) => (
													<tr key={i}>
														<td className="analytics-path-cell">
															{page.slug
																? <a href={`/c/${page.slug}`} target="_blank" rel="noreferrer">{page.path}</a>
																: page.path}
														</td>
														<td><span className={`analytics-kind-badge analytics-kind-${page.kind}`}>{page.kind}</span></td>
														<td><strong>{page.visits}</strong></td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</>
					)}

					{/* Recent visits raw table */}
					{analyticsVisits.length > 0 && (
						<div className="analytics-chart-card analytics-chart-full">
							<h3 className="analytics-chart-title">Visites recentes ({analyticsVisits.length})</h3>
							<div className="analytics-table-wrap">
								<table className="analytics-table analytics-visits-table">
									<thead>
										<tr>
											<th>Date</th>
											<th>Page</th>
											<th>Pays</th>
											<th>Ville</th>
											<th>Appareil</th>
											<th>Navigateur</th>
											<th>OS</th>
											<th>Ecran</th>
											<th>Referent</th>
										</tr>
									</thead>
									<tbody>
										{analyticsVisits.map((v, i) => (
											<tr key={i}>
												<td className="analytics-date-cell">{new Date(v.visitedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
												<td className="analytics-path-cell">{v.path}</td>
												<td>{v.countryCode ? `${countryFlag(v.countryCode)} ${v.country}` : '---'}</td>
												<td>{v.city || '---'}</td>
												<td>{deviceLabel(v.deviceType)}</td>
												<td>{v.browser || '---'}</td>
												<td>{v.os || '---'}</td>
												<td>{v.screen || '---'}</td>
												<td>{v.referrer || 'Direct'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{!analyticsLoading && !analytics && (
						<div className="admin-empty">Cliquez sur Rafraichir pour charger les analytics.</div>
					)}
				</div>
			)}
		</div>
	</div>
	);
}

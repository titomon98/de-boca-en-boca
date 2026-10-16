import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Row, Col, Button, Form, Badge, Modal, Table, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import {
	AccountsApi, OrdersApi, MenuApi, TablesApi, PaymentsApi,
} from '../../../services/RestaurantApi';
import {
	money, ORDER_STATUS, getCurrentUser, ROLES, AUDIT_ACTIONS, ROLE_LABELS, PAYMENT_METHODS, paymentLabel, fmtDateTime,
} from '../../../services/helpers';
import { printReceipt } from '../../../services/printTicket';
import MenuPicker from './MenuPicker';

const CuentaDetail = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	// Regresar a la pantalla de la que se vino (Cobros, Historial, Caja, Mesas...).
	// Si se entró directo (sin pantalla previa en la app), cae al área de la cuenta.
	const location = useLocation();
	const goBack = () => {
		// location.key === 'default' solo cuando se entró directo (recarga/enlace);
		// si se llegó navegando dentro de la app, se regresa a esa pantalla.
		if (location.key && location.key !== 'default') {
			navigate(-1);
			return;
		}
		const tables = account?.tables || [];
		const takeout = tables.some((t) => t.isTakeout || t.number === 0);
		navigate(account?.isDelivery ? '/a-domicilio' : takeout ? '/para-llevar' : '/mesas');
	};
	const user = getCurrentUser();
	const canPay = [ROLES.ADMIN, ROLES.CASHIER].includes(user.role);
	const canOrder = [ROLES.ADMIN, ROLES.WAITER].includes(user.role);
	const isAdmin = user.role === ROLES.ADMIN;

	const [loading, setLoading] = useState(true);
	const [account, setAccount] = useState(null);
	const [orders, setOrders] = useState([]);
	const [menu, setMenu] = useState([]);
	const [categories, setCategories] = useState([]);
	const [cart, setCart] = useState([]); // { lineId, menuItem, quantity, notes, choices, chosenItemIds }
	const [notesCocina, setNotesCocina] = useState('');
	const [notesBarra, setNotesBarra] = useState('');

	// selección de extras incluidos (ej. sabor del aderezo) al agregar un platillo
	const [showConfig, setShowConfig] = useState(false);
	const [configItem, setConfigItem] = useState(null);
	const [configChoices, setConfigChoices] = useState({});
	const [sending, setSending] = useState(false);
	const [logs, setLogs] = useState([]);
	const [payments, setPayments] = useState([]);

	// pago
	const [showPay, setShowPay] = useState(false);
	const [payAmount, setPayAmount] = useState('');
	// Envío al motorista que se cobra al cliente (solo cuentas a domicilio), se pide al cobrar.
	const [payFee, setPayFee] = useState('');
	const [payMethod, setPayMethod] = useState('cash');
	const [paid, setPaid] = useState(0);

	// cobro por producto (división de cuenta)
	const [showPayItems, setShowPayItems] = useState(false);
	const [payItemSel, setPayItemSel] = useState([]); // ids de order_items
	const [payItemsMethod, setPayItemsMethod] = useState('cash');

	// propina (al cobrar por monto)
	const [tipEnabled, setTipEnabled] = useState(false);
	const [tipAmount, setTipAmount] = useState('');

	// descuento
	const [showDiscount, setShowDiscount] = useState(false);
	const [discountAmount, setDiscountAmount] = useState('');
	const [discountReason, setDiscountReason] = useState('');


	// unir mesas
	const [showJoin, setShowJoin] = useState(false);
	const [allTables, setAllTables] = useState([]);
	const [joinSel, setJoinSel] = useState([]);

	const load = useCallback(async () => {
		const [a, o, m, c, p, lg] = await Promise.all([
			AccountsApi.get(id),
			OrdersApi.byAccount(id),
			MenuApi.list(true),
			MenuApi.categories(),
			PaymentsApi.byAccount(id).catch(() => []),
			AccountsApi.logs(id).catch(() => []),
		]);
		setAccount(a);
		setOrders(o);
		setMenu(m);
		setCategories(c);
		setPaid(p.reduce((s, x) => s + Number(x.amount), 0));
		setPayments(p);
		setLogs(lg);
		setLoading(false);
	}, [id]);

	useEffect(() => {
		load();
	}, [load]);

	// Opciones a elegir del platillo (productos: aderezos, etc.).
	const choiceGroups = (item) => item.choiceGroups || [];
	// Producto (para nombre/foto) por id.
	const optProduct = (id) => (menu || []).find((x) => x.id === id);
	const productName = (id) => optProduct(id)?.name || `#${id}`;
	const choose = (g) => Math.max(1, Number(g.choose) || 1);
	// Grupo de distribución (ej. sabores de alitas): reparte un total de unidades
	// entre los sabores elegidos (auto-parejo y ajustable), con un máximo de sabores.
	const groupTarget = (g) => (g.distribute ? Math.max(1, Number(g.total) || 1) : choose(g));
	const maxOptions = (g) => (g.distribute ? Math.max(1, Number(g.maxOptions) || 1) : Infinity);
	// Paso de ajuste de la distribución (ej. alitas de 10 en 10, sampler de 5 en 5).
	// Si el grupo no trae `step`, se deduce: total / máximo de sabores
	// (10/1, 20/2, 30/3 -> 10; sampler 60/12 -> 5). Nunca de 1 en 1.
	const stepOf = (g) => {
		if (!g.distribute) return 1;
		if (Number(g.step) > 0) return Number(g.step);
		const total = Number(g.total) || 1;
		const max = Number(g.maxOptions) || 1;
		return Math.max(1, Math.floor(total / max));
	};

	// configChoices: { [label]: { [itemId]: cantidad } }
	const groupTotal = (label) =>
		Object.values(configChoices[label] || {}).reduce((a, b) => a + b, 0);
	const distinctCount = (label) =>
		Object.values(configChoices[label] || {}).filter((n) => n > 0).length;
	const incChoice = (label, itemId) =>
		setConfigChoices((c) => ({
			...c,
			[label]: { ...(c[label] || {}), [itemId]: ((c[label] || {})[itemId] || 0) + 1 },
		}));
	const decChoice = (label, itemId) =>
		setConfigChoices((c) => {
			const g = { ...(c[label] || {}) };
			const n = (g[itemId] || 0) - 1;
			if (n <= 0) delete g[itemId];
			else g[itemId] = n;
			return { ...c, [label]: g };
		});

	// Suma n (puede ser negativo) a un sabor; si queda en 0 o menos, lo quita.
	const addN = (label, itemId, n) =>
		setConfigChoices((c) => {
			const g = { ...(c[label] || {}) };
			const v = (g[itemId] || 0) + n;
			if (v <= 0) delete g[itemId];
			else g[itemId] = v;
			return { ...c, [label]: g };
		});

	// Reparte `total` en múltiplos de `step` entre los ids (resto a los primeros).
	const redistribute = (label, ids, total, step) =>
		setConfigChoices((c) => {
			if (ids.length === 0) return { ...c, [label]: {} };
			const units = Math.max(1, Math.round(total / step));
			const base = Math.floor(units / ids.length);
			const rem = units - base * ids.length;
			const next = {};
			ids.forEach((id, i) => { next[id] = (base + (i < rem ? 1 : 0)) * step; });
			return { ...c, [label]: next };
		});
	// Toca un sabor: lo agrega o lo quita y vuelve a repartir parejo (por paso).
	const toggleFlavor = (g, oid) => {
		const cur = configChoices[g.label] || {};
		const selected = Object.keys(cur).filter((id) => cur[id] > 0).map(Number);
		if (cur[oid] > 0) {
			redistribute(g.label, selected.filter((id) => id !== oid), groupTarget(g), stepOf(g));
		} else {
			if (selected.length >= maxOptions(g)) return;
			redistribute(g.label, [...selected, oid], groupTarget(g), stepOf(g));
		}
	};

	// Listo cuando cada grupo suma lo que pide (y, si es distribución, respeta el máximo de sabores).
	const configReady = configItem
		? choiceGroups(configItem).every((g) => {
			const total = groupTotal(g.label);
			if (g.distribute) {
				const d = distinctCount(g.label);
				return total === groupTarget(g) && d >= 1 && d <= maxOptions(g);
			}
			return total === choose(g);
		})
		: false;

	const addToCart = (item) => {
		// Si el platillo tiene opciones a elegir, primero se pregunta (modal en cuadrícula).
		if (choiceGroups(item).length > 0) {
			setConfigItem(item);
			setConfigChoices(Object.fromEntries(choiceGroups(item).map((g) => [g.label, {}])));
			setShowConfig(true);
			return;
		}
		setCart((prev) => {
			// Une con una línea idéntica (mismo platillo, sin elecciones).
			const found = prev.find((x) => x.menuItem.id === item.id && (x.chosenItemIds || []).length === 0);
			if (found) {
				return prev.map((x) => (x === found ? { ...x, quantity: x.quantity + 1 } : x));
			}
			return [...prev, { lineId: `${item.id}-${Date.now()}`, menuItem: item, quantity: 1, notes: '', choices: [], chosenItemIds: [] }];
		});
	};

	// Confirma los productos elegidos y agrega el platillo como línea propia.
	const confirmConfig = () => {
		const item = configItem;
		const choices = choiceGroups(item).map((g) => {
			const counts = configChoices[g.label] || {};
			const parts = Object.entries(counts).map(([id, n]) => `${productName(Number(id))}${n > 1 ? ` x${n}` : ''}`);
			return `${g.label}: ${parts.join(', ')}`;
		});
		const chosenItemIds = [];
		for (const g of choiceGroups(item)) {
			const counts = configChoices[g.label] || {};
			for (const [id, n] of Object.entries(counts)) {
				for (let k = 0; k < n; k++) chosenItemIds.push(Number(id));
			}
		}
		setCart((prev) => [
			...prev,
			{ lineId: `${item.id}-${Date.now()}`, menuItem: item, quantity: 1, notes: '', choices, chosenItemIds },
		]);
		setShowConfig(false);
		setConfigItem(null);
	};

	// Quita un producto del carrito (uno a uno) desde el menú táctil.
	const removeOne = (lineId) => {
		setCart((prev) =>
			prev
				.map((x) => (x.lineId === lineId ? { ...x, quantity: x.quantity - 1 } : x))
				.filter((x) => x.quantity > 0),
		);
	};

	const cartTotal = cart.reduce((s, x) => s + Number(x.menuItem.price) * x.quantity, 0);

	const sendOrder = async () => {
		if (cart.length === 0) {
			swal('Atención', 'Agregue platillos a la comanda.', 'warning');
			return;
		}
		setSending(true);
		try {
			await OrdersApi.create({
				accountId: Number(id),
				notesCocina: notesCocina || undefined,
				notesBarra: notesBarra || undefined,
				items: cart.map((x) => {
					const ch = (x.choices || []).length ? x.choices.join('; ') : '';
					const notes = [ch, x.notes].filter(Boolean).join(' · ');
					return {
						menuItemId: x.menuItem.id,
						quantity: x.quantity,
						notes: notes || undefined,
						chosenItemIds: (x.chosenItemIds || []).length ? x.chosenItemIds : undefined,
					};
				}),
			});
			setCart([]);
			setNotesCocina('');
			setNotesBarra('');
			await load();
			swal('Enviada', 'La comanda fue enviada.', 'success');
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo enviar la comanda', 'error');
		} finally {
			setSending(false);
		}
	};

	const markBilling = async () => {
		try {
			await AccountsApi.bill(id);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo marcar en cobro', 'error');
		}
	};

	// Neto con un envío dado (en domicilio el envío al motorista se le cobra al cliente).
	const netWithFee = (fee) =>
		Number(account.total) - Number(account.discount || 0) + (account.isDelivery ? Number(fee) || 0 : 0);

	const openPay = () => {
		const fee = Number(account.courierFee || 0);
		setPayFee(account.isDelivery && fee > 0 ? fee.toFixed(2) : '');
		const rem = Math.max(netWithFee(fee) - paid, 0);
		setPayAmount(rem ? rem.toFixed(2) : '');
		setPayMethod('cash');
		setTipEnabled(false);
		setTipAmount('');
		setShowPay(true);
	};

	// Recordatorio para cuadrar caja: en envíos sale efectivo para el motorista.
	const courierNote = () =>
		account.isDelivery && Number(payFee) > 0
			? ` Envío: al entregar, dé ${money(payFee)} en efectivo de caja al motorista.`
			: '';

	// Al cambiar el envío en el cobro, se recalcula el monto a cobrar.
	const changePayFee = (v) => {
		setPayFee(v);
		setPayAmount(Math.max(netWithFee(Number(v) || 0) - paid, 0).toFixed(2));
	};

	const submitPay = async () => {
		const amount = Number(payAmount);
		if (!amount || amount <= 0) {
			swal('Atención', 'Ingrese un monto válido.', 'warning');
			return;
		}
		const tip = tipEnabled ? Number(tipAmount) || 0 : 0;
		try {
			// En domicilio, primero se guarda el envío (se cobra al cliente) y luego el pago.
			if (account.isDelivery) {
				const fee = Math.round((Number(payFee) || 0) * 100) / 100;
				if (fee !== Math.round(Number(account.courierFee || 0) * 100) / 100) {
					await AccountsApi.setDelivery(Number(id), true, fee);
				}
			}
			const res = await PaymentsApi.pay({ accountId: Number(id), amount, paymentMethod: payMethod, tip });
			setShowPay(false);
			if (res.accountStatus === 'paid') {
				swal('Cuenta pagada', `La cuenta fue liquidada.${courierNote()}`, 'success').then(() =>
					goBack(),
				);
			} else {
				await load();
				swal('Pago parcial', `Registrado. Saldo pendiente: ${money(res.remaining)}`, 'info');
			}
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo registrar el pago', 'error');
		}
	};

	// --- Cobro por producto ---
	// Renglones no pagados (y no anulados) de todas las comandas de la cuenta.
	const unpaidItems = orders
		.filter((o) => o.status !== 'cancelled')
		.flatMap((o) => (o.items || []).map((it) => ({ ...it, orderId: o.id })));
	const pendingItems = unpaidItems.filter((it) => !it.paid);

	const openPayItems = () => {
		setPayItemSel([]);
		setPayItemsMethod('cash');
		setShowPayItems(true);
	};
	const togglePayItem = (itemId) =>
		setPayItemSel((prev) => (prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]));
	const payItemsTotal = pendingItems
		.filter((it) => payItemSel.includes(it.id))
		.reduce((s, it) => s + Number(it.subtotal), 0);

	const submitPayItems = async () => {
		if (payItemSel.length === 0) {
			swal('Atención', 'Seleccione al menos un producto.', 'warning');
			return;
		}
		try {
			const res = await PaymentsApi.payItems(Number(id), payItemSel, payItemsMethod);
			setShowPayItems(false);
			if (res.accountStatus === 'paid') {
				swal('Cuenta pagada', `La cuenta fue liquidada.${courierNote()}`, 'success').then(() =>
					goBack(),
				);
			} else {
				await load();
				swal('Cobro registrado', `Saldo pendiente: ${money(res.remaining)}`, 'info');
			}
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo registrar el cobro', 'error');
		}
	};

	// --- Descuento ---
	const openDiscount = () => {
		setDiscountAmount(account.discount ? Number(account.discount).toFixed(2) : '');
		setDiscountReason(account.discountReason || '');
		setShowDiscount(true);
	};
	const submitDiscount = async () => {
		const amount = Number(discountAmount) || 0;
		if (amount > 0 && !discountReason.trim()) {
			swal('Atención', 'El descuento requiere una descripción.', 'warning');
			return;
		}
		try {
			// El administrador aplica directo; cajero/mesero solo solicitan.
			if (isAdmin) {
				await AccountsApi.setDiscount(Number(id), amount, discountReason.trim());
			} else {
				await AccountsApi.requestDiscount(Number(id), amount, discountReason.trim());
				swal('Solicitado', 'El descuento quedó pendiente de autorización del administrador.', 'success');
			}
			setShowDiscount(false);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo registrar el descuento', 'error');
		}
	};

	const approveDiscount = async () => {
		try {
			await AccountsApi.approveDiscount(Number(id));
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo autorizar', 'error');
		}
	};
	const rejectDiscount = async () => {
		try {
			await AccountsApi.rejectDiscount(Number(id));
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo rechazar', 'error');
		}
	};


	const cancelOrder = (o) => {
		swal({
			title: '¿Anular comanda?',
			text: `Comanda #${o.id}. Se descontará de la cuenta.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular comanda'],
			closeOnClickOutside: false,
			closeOnEsc: false,
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await OrdersApi.cancel(o.id);
				await load();
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo anular', 'error');
			}
		});
	};

	const cancelItem = (o, it) => {
		swal({
			title: '¿Anular platillo?',
			text: `${it.menuItem?.name || 'Platillo'} x${it.quantity}`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular'],
			closeOnClickOutside: false,
			closeOnEsc: false,
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await OrdersApi.cancelItem(o.id, it.id);
				await load();
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo anular el platillo', 'error');
			}
		});
	};

	const voidPayment = (p) => {
		swal({
			title: '¿Anular cobro?',
			text: `${money(p.amount)} (${paymentLabel(p.paymentMethod)}). Quedará registrado en la bitácora.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular cobro'],
			closeOnClickOutside: false,
			closeOnEsc: false,
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await PaymentsApi.void(p.id);
				await load();
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo anular el cobro', 'error');
			}
		});
	};

	const removeAccount = () => {
		swal({
			title: '¿Eliminar la cuenta por completo?',
			text: 'Se borrarán sus comandas y pagos, y se liberarán sus mesas. Esta acción no se puede deshacer.',
			icon: 'warning',
			buttons: ['Cancelar', 'Eliminar cuenta'],
			closeOnClickOutside: false,
			closeOnEsc: false,
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await AccountsApi.remove(id);
				swal('Cuenta eliminada', 'La cuenta se eliminó y las mesas quedaron libres.', 'success').then(() =>
					goBack(),
				);
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo eliminar la cuenta', 'error');
			}
		});
	};

	const openJoin = async () => {
		const t = await TablesApi.list();
		setAllTables(t);
		setJoinSel([]);
		setShowJoin(true);
	};

	const submitJoin = async () => {
		if (joinSel.length === 0) {
			setShowJoin(false);
			return;
		}
		try {
			await AccountsApi.joinTables(id, joinSel);
			setShowJoin(false);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudieron unir las mesas', 'error');
		}
	};

	if (loading || !account) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	const discount = Number(account.discount || 0);
	const courierCharge = account.isDelivery ? Number(account.courierFee || 0) : 0;
	const net = Number(account.total) - discount + courierCharge;
	const remaining = Math.max(net - paid, 0);
	const closed = account.status === 'paid' || account.status === 'cancelled';
	// "Para llevar" es una orden, no una mesa: no aplica unir mesas.
	const isTakeout = (account.tables || []).some((t) => t.isTakeout || t.number === 0);
	const isDelivery = !!account.isDelivery;
	const areaLabel = isDelivery ? 'A domicilio' : isTakeout ? 'Para llevar' : 'Mesas';
	// No se puede cobrar una cuenta en Q0 (no se ha ordenado nada).
	const nothingToCharge = net <= 0;

	// Recibo imprimible: desglosa productos y, en domicilio, el envío al motorista.
	const printAccount = () => {
		const lines = (orders || [])
			.filter((o) => o.status !== 'cancelled')
			.flatMap((o) => o.items || [])
			.map((it) => ({ quantity: it.quantity, name: it.menuItem?.name || '', subtotal: it.subtotal }));
		printReceipt({
			orderId: account.id,
			label: account.label,
			lines,
			productTotal: account.total,
			discount,
			courierFee: courierCharge,
			isDelivery,
			total: net,
		});
	};

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<Button variant="light" size="sm" className="mb-2" onClick={() => goBack()}>
						<i className="bi bi-arrow-left me-1"></i>Atrás
					</Button>
					<h3 className="mb-0">{account.label}</h3>
					<span className="text-muted">
						{isTakeout
							? areaLabel
							: `Mesa(s): ${(account.tables || []).map((t) => t.name || t.number).join(', ')}`}{' '}
						·{' '}
						<Badge bg={account.status === 'billing' ? 'danger' : account.status === 'paid' ? 'success' : 'warning'}>
							{account.status === 'billing' ? 'Cobrando' : account.status === 'paid' ? 'Pagada' : account.status === 'cancelled' ? 'Anulada' : 'Abierta'}
						</Badge>
						{account.isDelivery && (
							<Badge bg="secondary" className="ms-2"><i className="fa-solid fa-motorcycle me-1"></i>Envío</Badge>
						)}
					</span>
					{account.isDelivery && Number(account.courierFee) > 0 && (
						<div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">
							<i className="fa-solid fa-triangle-exclamation me-1"></i>
							Envío: se cobran <strong>{money(account.courierFee)}</strong> al cliente (ya incluidos en el total) y salen en efectivo de caja para el motorista.
						</div>
					)}
				</div>
				<div className="text-end">
					<h2 className="mb-0 text-primary">{money(net)}</h2>
					{(discount > 0 || courierCharge > 0) && (
						<small className="d-block text-muted">
							Productos {money(account.total)}
							{courierCharge > 0 && <> · Envío +{money(courierCharge)}</>}
							{discount > 0 && <> · Descuento -{money(discount)}</>}
						</small>
					)}
					{paid > 0 && <small className="text-muted">Pagado {money(paid)} · Saldo {money(remaining)}</small>}
				</div>
			</div>

			{account.discountRequest != null && (
				<div className="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
					<div>
						<i className="fa-solid fa-tag me-1"></i>
						<strong>Descuento solicitado: {money(account.discountRequest)}</strong>
						{account.discountRequestReason ? ` - ${account.discountRequestReason}` : ''}
						{account.discountRequestBy ? <span className="text-muted"> (por {account.discountRequestBy})</span> : null}
					</div>
					{isAdmin ? (
						<div className="d-flex gap-2">
							<Button variant="success" size="sm" onClick={approveDiscount}>
								<i className="fa-solid fa-check me-1"></i>Autorizar
							</Button>
							<Button variant="outline-danger" size="sm" onClick={rejectDiscount}>Rechazar</Button>
						</div>
					) : (
						<Badge bg="secondary">Pendiente de autorización</Badge>
					)}
				</div>
			)}

			<div className="mb-3">
				<Button variant="outline-primary" size="sm" onClick={printAccount} disabled={nothingToCharge}>
					<i className="fa-solid fa-print me-1"></i>Imprimir recibo
				</Button>
			</div>

			{!closed && (
				<div className="d-flex gap-2 mb-3 flex-wrap">
					{canOrder && account.status === 'open' && !isTakeout && (
						<Button variant="outline-secondary" size="sm" onClick={openJoin}>
							<i className="bi bi-link-45deg me-1"></i>Unir mesas
						</Button>
					)}
					{account.status === 'open' && (
						<Button
							variant="outline-danger"
							size="sm"
							onClick={markBilling}
							disabled={nothingToCharge}
							title={nothingToCharge ? 'La cuenta está en Q0' : undefined}
						>
							<i className="bi bi-receipt me-1"></i>Marcar cobrando
						</Button>
					)}
					{canPay && (
						<Button
							variant="success"
							size="sm"
							onClick={openPay}
							disabled={nothingToCharge}
							title={nothingToCharge ? 'La cuenta está en Q0' : undefined}
						>
							<i className="bi bi-cash-stack me-1"></i>Cobrar total / abono
						</Button>
					)}
					{canPay && pendingItems.length > 0 && (
						<Button
							variant="outline-success"
							size="sm"
							onClick={openPayItems}
							disabled={nothingToCharge}
							title={nothingToCharge ? 'La cuenta está en Q0' : undefined}
						>
							<i className="fa-solid fa-list-check me-1"></i>Cobrar productos
						</Button>
					)}

					{(canOrder || canPay) && (
						<Button variant="outline-secondary" size="sm" onClick={openDiscount}>
							<i className="fa-solid fa-tag me-1"></i>{isAdmin ? 'Descuento' : 'Solicitar descuento'}
						</Button>
					)}

						{canOrder && (
							<Button variant="danger" size="sm" onClick={removeAccount}>
								<i className="fa-solid fa-trash me-1"></i>Eliminar cuenta
							</Button>
						)}
				</div>
			)}

			<Row>
				{/* Comandas existentes */}
				<Col lg={12}>
					<Card>
						<Card.Header><Card.Title>Comandas</Card.Title></Card.Header>
						<Card.Body>
							{orders.length === 0 ? (
								<p className="text-muted mb-0">Aún no hay comandas en esta cuenta.</p>
							) : (
								orders.map((o) => {
									const meta = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
										const canEditOrder = canOrder && account.status === 'open' && o.status !== 'cancelled';
									return (
										<div key={o.id} className="border rounded p-3 mb-3">
											<div className="d-flex justify-content-between mb-2">
												<strong>Comanda #{o.id}</strong>
												<span className={`badge ${meta.badge}`}>{meta.label}</span>
													{canEditOrder && (<Button size="sm" variant="outline-danger" className="ms-2 py-0 px-1" title="Anular comanda" onClick={() => cancelOrder(o)}><i className="fa-solid fa-ban"></i></Button>)}
											</div>
											{o.notes && <p className="small text-muted mb-2">Nota: {o.notes}</p>}
											<Table size="sm" className="mb-2">
												<tbody>
													{o.items.map((it) => (
														<tr key={it.id}>
															<td style={{ width: 50 }}>{it.quantity}×</td>
															<td>
																{it.menuItem?.name}
																{it.paid && <span className="badge bg-success ms-2">Pagado</span>}
																{it.notes && <span className="d-block fw-bold text-dark">{it.notes}</span>}
															</td>
															<td className="text-end">{money(it.subtotal)}</td>
																{canEditOrder && (<td className="text-end" style={{ width: 36 }}><Button size="sm" variant="light" className="text-danger py-0 px-1" title="Anular platillo" onClick={() => cancelItem(o, it)}><i className="fa-solid fa-xmark"></i></Button></td>)}
														</tr>
													))}
												</tbody>
											</Table>
											<div className="d-flex gap-3 flex-wrap small text-muted">
												<span><i className="fa-solid fa-user me-1"></i>Mesero: {o.waiter?.name || '-'}</span>
												<span><i className="fa-solid fa-utensils me-1"></i>Cocina: {o.cook?.name || 'sin atender'}</span>
											</div>
										</div>
									);
								})
							)}
						</Card.Body>
					</Card>
				</Col>

			</Row>

			{canOrder && !closed && (
				<Card>
					<Card.Header><Card.Title>Nueva comanda</Card.Title></Card.Header>
					<Card.Body>
						<MenuPicker
							categories={categories}
							menu={menu}
							cart={cart}
							onAdd={addToCart}
							onRemove={removeOne}
						/>
						<Row className="mt-3 g-2">
							<Col md={6}>
								<Form.Label className="mb-1"><i className="fa-solid fa-utensils me-1"></i>Nota para cocina</Form.Label>
								<Form.Control
									as="textarea"
									rows={2}
									placeholder="Indicaciones de los platillos"
									value={notesCocina}
									onChange={(e) => setNotesCocina(e.target.value)}
								/>
							</Col>
							<Col md={6}>
								<Form.Label className="mb-1"><i className="fa-solid fa-martini-glass me-1"></i>Nota para barra</Form.Label>
								<Form.Control
									as="textarea"
									rows={2}
									placeholder="Indicaciones de las bebidas"
									value={notesBarra}
									onChange={(e) => setNotesBarra(e.target.value)}
								/>
							</Col>
						</Row>
						<div className="d-flex justify-content-between align-items-center mt-3">
							<strong>Total: {money(cartTotal)}</strong>
							<Button variant="primary" size="lg" onClick={sendOrder} disabled={sending || cart.length === 0}>
								{sending ? 'Enviando…' : 'Enviar comanda'}
							</Button>
						</div>
					</Card.Body>
				</Card>
			)}

			{/* Cobros de la cuenta */}
				{canPay && payments.length > 0 && (
					<Card>
						<Card.Header><Card.Title>Cobros</Card.Title></Card.Header>
						<Card.Body>
							<Table responsive hover size="sm" className="mb-0">
								<tbody>
									{payments.map((p) => (
										<tr key={p.id}>
											<td>{fmtDateTime(p.date)}</td>
											<td>{paymentLabel(p.paymentMethod)}</td>
											<td className="text-end font-w600">{money(p.amount)}</td>
											<td className="text-end" style={{ width: 90 }}>
												<Button size="sm" variant="outline-danger" onClick={() => voidPayment(p)}>Anular</Button>
											</td>
										</tr>
									))}
								</tbody>
							</Table>
						</Card.Body>
					</Card>
				)}

				{/* Bitácora de la cuenta */}
			<Card>
				<Card.Header><Card.Title>Bitácora de la cuenta</Card.Title></Card.Header>
				<Card.Body>
					{logs.length === 0 ? (
						<p className="text-muted mb-0">Sin registros todavía.</p>
					) : (
						<ul className="list-unstyled mb-0">
							{logs.map((l) => (
								<li key={l.id} className="d-flex align-items-start border-bottom py-2 flex-wrap">
									<span className="text-muted small me-3" style={{ minWidth: 140 }}>{fmtDateTime(l.createdAt)}</span>
									<span className="me-2 font-w600">{AUDIT_ACTIONS[l.action] || l.action}</span>
									<span className="text-muted small">{l.userName ? `· ${l.userName} (${ROLE_LABELS[l.userRole] || l.userRole})` : ""}{l.detail ? ` · ${l.detail}` : ""}</span>
								</li>
							))}
						</ul>
					)}
				</Card.Body>
			</Card>

			{/* Modal cobrar */}
			<Modal show={showPay} onHide={() => setShowPay(false)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Cobrar cuenta</Modal.Title></Modal.Header>
				<Modal.Body>
					{isDelivery && (
						<Form.Group className="mb-3 border rounded p-2 bg-light">
							<Form.Label className="mb-1"><i className="fa-solid fa-motorcycle me-1"></i>Efectivo al motorista (Q)</Form.Label>
							<Form.Control type="number" step="0.01" min={0} placeholder="0.00" value={payFee} onChange={(e) => changePayFee(e.target.value)} />
							<Form.Text className="text-muted">Se le cobra al cliente junto con los productos. Al entregar, sale en efectivo de caja para el motorista.</Form.Text>
						</Form.Group>
					)}
					{isDelivery && (
						<div className="d-flex justify-content-between mb-1 small text-muted">
							<span>Productos {money(Number(account.total) - discount)} + envío {money(Number(payFee) || 0)}</span>
						</div>
					)}
					<div className="d-flex justify-content-between mb-2">
						<span>Neto a pagar</span><strong>{money(isDelivery ? netWithFee(payFee) : net)}</strong>
					</div>
					<div className="d-flex justify-content-between mb-3">
						<span>Saldo pendiente</span><strong className="text-danger">{money(isDelivery ? Math.max(netWithFee(payFee) - paid, 0) : remaining)}</strong>
					</div>
					<Form.Group className="mb-3">
						<Form.Label>Monto a pagar</Form.Label>
						<Form.Control type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
					</Form.Group>
					<Form.Group className="mb-3">
						<Form.Label>Forma de pago</Form.Label>
						<Form.Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
							{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
						</Form.Select>
					</Form.Group>
					<Form.Check
						type="checkbox"
						id="tip-enabled"
						className="mb-2"
						label="Agregar propina (opcional)"
						checked={tipEnabled}
						onChange={(e) => setTipEnabled(e.target.checked)}
					/>
					{tipEnabled && (() => {
						const base = Number(payAmount) || 0;
						const s10 = Math.round(base * 0.10 * 100) / 100;
						const s15 = Math.round(base * 0.15 * 100) / 100;
						const cuadrar = Math.max(Math.ceil(base / 10) * 10 - base, 0);
						return (
							<div className="border rounded p-2 mb-2">
								<div className="d-flex gap-2 flex-wrap mb-2">
									<Button size="sm" variant="outline-success" onClick={() => setTipAmount(String(s10))}>10% ({money(s10)})</Button>
									<Button size="sm" variant="outline-success" onClick={() => setTipAmount(String(s15))}>15% ({money(s15)})</Button>
									{cuadrar > 0 && (
										<Button size="sm" variant="outline-success" onClick={() => setTipAmount(String(cuadrar))}>Cuadrar (+{money(cuadrar)})</Button>
									)}
								</div>
								<Form.Label className="mb-1">Propina (Q)</Form.Label>
								<Form.Control type="number" step="0.01" value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} placeholder="0.00" />
							</div>
						);
					})()}
					{tipEnabled && (
						<div className="d-flex justify-content-between border-top pt-2">
							<strong>Total a cobrar (con propina)</strong>
							<strong className="text-success">{money((Number(payAmount) || 0) + (Number(tipAmount) || 0))}</strong>
						</div>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowPay(false)}>Cancelar</Button>
					<Button variant="success" onClick={submitPay}>Registrar pago</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal: cobro por producto (división de cuenta) */}
			<Modal show={showPayItems} onHide={() => setShowPayItems(false)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Cobrar productos</Modal.Title></Modal.Header>
				<Modal.Body>
					<p className="text-muted">Seleccione los productos que se van a pagar.</p>
					{pendingItems.length === 0 ? (
						<p className="text-muted mb-0">No hay productos pendientes de pago.</p>
					) : (
						pendingItems.map((it) => (
							<Form.Check
								key={it.id}
								type="checkbox"
								id={`payitem-${it.id}`}
								checked={payItemSel.includes(it.id)}
								onChange={() => togglePayItem(it.id)}
								label={`${it.quantity}x ${it.menuItem?.name || "producto"}  -  ${money(it.subtotal)}`}
								className="mb-2"
							/>
						))
					)}
					<hr />
					<div className="d-flex justify-content-between mb-2">
						<strong>Seleccionado</strong>
						<strong>{money(payItemsTotal)}</strong>
					</div>
					<Form.Group>
						<Form.Label>Forma de pago</Form.Label>
						<Form.Select value={payItemsMethod} onChange={(e) => setPayItemsMethod(e.target.value)}>
							{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
						</Form.Select>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowPayItems(false)}>Cancelar</Button>
					<Button variant="success" onClick={submitPayItems} disabled={payItemSel.length === 0}>Cobrar {money(payItemsTotal)}</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal: elegir opciones (aderezos) en cuadrícula */}
			<Modal show={showConfig} onHide={() => setShowConfig(false)} centered size="lg" backdrop="static" keyboard={false}>
				<Modal.Header closeButton>
					<Modal.Title>{configItem?.name}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{configItem && configItem.combo?.components?.length > 0 && (
						<>
							<p className="text-muted mb-1">Incluye:</p>
							<ul>
								{configItem.combo.components.map((cc) => (
									<li key={`c${cc.itemId}`}>{cc.quantity > 1 ? `${cc.quantity} ` : ''}{productName(cc.itemId)}</li>
								))}
							</ul>
						</>
					)}
					{configItem && choiceGroups(configItem).map((g) => {
						const total = groupTotal(g.label);
						const target = groupTarget(g);
						const dist = !!g.distribute;
						const full = total >= target;
						const dCount = distinctCount(g.label);
						const maxOpt = maxOptions(g);
						const step = stepOf(g);
						return (
							<div className="mb-3" key={g.label}>
								<div className="d-flex justify-content-between align-items-center mb-2">
									<strong style={{ fontSize: "1.1rem" }}>{g.label}</strong>
									<span className={`fw-bold ${total === target ? "text-success" : "text-danger"}`} style={{ fontSize: "1.1rem" }}>
										{dist ? `Repartidas ${total}/${target}` : `Elegidos ${total}/${target}`}
									</span>
								</div>
								{dist && (
									<div className="small text-muted mb-2">
										Elige hasta {maxOpt} sabor{maxOpt > 1 ? 'es' : ''}; se reparten parejo y se ajustan de {step} en {step} con - / +.
									</div>
								)}
								<Row className="g-2">
									{g.optionItemIds.map((oid) => {
										const p = optProduct(oid);
										const count = (configChoices[g.label] || {})[oid] || 0;
										const selected = count > 0;
										const canSelect = dist ? (selected || dCount < maxOpt) : !full;
										return (
											<Col xs={6} md={4} key={oid}>
												<Card
													className={`h-100 ${selected ? "border-success border-2" : ""}`}
													style={{ cursor: canSelect ? "pointer" : "not-allowed", opacity: canSelect ? 1 : 0.5 }}
													onClick={() => { if (!canSelect) return; if (dist) toggleFlavor(g, oid); else incChoice(g.label, oid); }}
													title="Toque para elegir"
												>
													{p?.image ? (
														<Card.Img variant="top" src={p.image} style={{ height: 80, objectFit: "cover" }} />
													) : (
														<div className="bg-light d-flex align-items-center justify-content-center text-muted" style={{ height: 80 }}><i className="fa-solid fa-mortar-pestle fa-lg"></i></div>
													)}
													<Card.Body className="p-2 text-center">
														<div className="small font-w600">{productName(oid)}</div>
														{selected && dist && (
															<div className="d-flex justify-content-center align-items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
																<Button variant="outline-danger" onClick={() => addN(g.label, oid, -step)} style={{ fontSize: '1.1rem', padding: '0 12px' }}>-</Button>
																<Badge bg="success" style={{ fontSize: '1.05rem', minWidth: 30 }}>{count}</Badge>
																<Button variant="success" disabled={total + step > target} onClick={() => { if (total + step <= target) addN(g.label, oid, step); }} style={{ fontSize: '1.1rem', padding: '0 12px' }}>+</Button>
															</div>
														)}
														{selected && !dist && (
															<div className="d-flex justify-content-center align-items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
																<Button variant="outline-danger" onClick={() => decChoice(g.label, oid)} style={{ fontSize: '0.95rem', padding: '4px 12px' }}>Quitar</Button>
																<Badge bg="success" style={{ fontSize: '1.05rem', minWidth: 30 }}>{count}</Badge>
															</div>
														)}
													</Card.Body>
												</Card>
											</Col>
										);
									})}
								</Row>
							</div>
						);
					})}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowConfig(false)}>Cancelar</Button>
					<Button variant="primary" onClick={confirmConfig} disabled={!configReady}>Agregar</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal descuento */}
			<Modal show={showDiscount} onHide={() => setShowDiscount(false)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>{isAdmin ? 'Descuento' : 'Solicitar descuento'}</Modal.Title></Modal.Header>
				<Modal.Body>
					{!isAdmin && (
						<p className="text-muted small">El descuento quedará pendiente hasta que el administrador lo autorice.</p>
					)}
					<div className="d-flex justify-content-between mb-3">
						<span>Total de la cuenta</span><strong>{money(account.total)}</strong>
					</div>
					<Form.Group className="mb-3">
						<Form.Label>Monto del descuento (Q)</Form.Label>
						<Form.Control type="number" step="0.01" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" />
					</Form.Group>
					<Form.Group>
						<Form.Label>Descripción (obligatoria)</Form.Label>
						<Form.Control as="textarea" rows={2} value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Ingrese el motivo del descuento" />
					</Form.Group>
					<Form.Text className="text-muted">Queda registrado en la bitácora. Use 0 para quitar el descuento.</Form.Text>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowDiscount(false)}>Cancelar</Button>
					<Button variant="primary" onClick={submitDiscount}>{isAdmin ? 'Aplicar' : 'Solicitar'}</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal unir mesas */}
			<Modal show={showJoin} onHide={() => setShowJoin(false)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Unir mesas a la cuenta</Modal.Title></Modal.Header>
				<Modal.Body>
					<Row className="g-2">
						{allTables
							.filter((t) => !(account.tables || []).some((at) => at.id === t.id))
							.map((t) => {
								const active = joinSel.includes(t.id);
								return (
									<Col xs={3} key={t.id}>
										<div
											className={`text-center p-2 rounded border ${active ? 'border-primary bg-primary-light' : ''}`}
											style={{ cursor: 'pointer' }}
											onClick={() =>
												setJoinSel((prev) =>
													prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
												)
											}
										>
											<div className="font-w600">#{t.number}</div>
											<small className="text-muted">{t.status}</small>
										</div>
									</Col>
								);
							})}
					</Row>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowJoin(false)}>Cancelar</Button>
					<Button variant="primary" onClick={submitJoin}>Unir</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default CuentaDetail;

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Form, Badge, Modal, Table, Spinner, Nav } from 'react-bootstrap';
import swal from 'sweetalert';
import {
	AccountsApi, OrdersApi, MenuApi, TablesApi, PaymentsApi,
} from '../../../services/RestaurantApi';
import {
	money, ORDER_STATUS, getCurrentUser, ROLES, AUDIT_ACTIONS, ROLE_LABELS,
} from '../../../services/helpers';

const CuentaDetail = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const user = getCurrentUser();
	const canPay = [ROLES.ADMIN, ROLES.CASHIER].includes(user.role);
	const canOrder = [ROLES.ADMIN, ROLES.WAITER].includes(user.role);

	const [loading, setLoading] = useState(true);
	const [account, setAccount] = useState(null);
	const [orders, setOrders] = useState([]);
	const [menu, setMenu] = useState([]);
	const [categories, setCategories] = useState([]);
	const [activeCat, setActiveCat] = useState('all');
	const [cart, setCart] = useState([]); // { menuItem, quantity, notes }
	const [orderNotes, setOrderNotes] = useState('');
	const [sending, setSending] = useState(false);
	const [logs, setLogs] = useState([]);
	const [payments, setPayments] = useState([]);

	// pago
	const [showPay, setShowPay] = useState(false);
	const [payAmount, setPayAmount] = useState('');
	const [payMethod, setPayMethod] = useState('cash');
	const [paid, setPaid] = useState(0);

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

	const addToCart = (item) => {
		setCart((prev) => {
			const found = prev.find((x) => x.menuItem.id === item.id);
			if (found) {
				return prev.map((x) =>
					x.menuItem.id === item.id ? { ...x, quantity: x.quantity + 1 } : x,
				);
			}
			return [...prev, { menuItem: item, quantity: 1, notes: '' }];
		});
	};

	const setQty = (itemId, qty) => {
		setCart((prev) =>
			prev
				.map((x) => (x.menuItem.id === itemId ? { ...x, quantity: Math.max(0, qty) } : x))
				.filter((x) => x.quantity > 0),
		);
	};

	const setNote = (itemId, notes) => {
		setCart((prev) => prev.map((x) => (x.menuItem.id === itemId ? { ...x, notes } : x)));
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
				notes: orderNotes || undefined,
				items: cart.map((x) => ({
					menuItemId: x.menuItem.id,
					quantity: x.quantity,
					notes: x.notes || undefined,
				})),
			});
			setCart([]);
			setOrderNotes('');
			await load();
			swal('Enviada', 'La comanda fue enviada a cocina.', 'success');
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

	const openPay = () => {
		const remaining = Math.max(Number(account.total) - paid, 0);
		setPayAmount(remaining ? remaining.toFixed(2) : '');
		setPayMethod('cash');
		setShowPay(true);
	};

	const submitPay = async () => {
		const amount = Number(payAmount);
		if (!amount || amount <= 0) {
			swal('Atención', 'Ingrese un monto válido.', 'warning');
			return;
		}
		try {
			const res = await PaymentsApi.pay({ accountId: Number(id), amount, paymentMethod: payMethod });
			setShowPay(false);
			if (res.accountStatus === 'paid') {
				swal('Cuenta pagada', 'La cuenta fue liquidada y las mesas liberadas.', 'success').then(() =>
					navigate('/mesas'),
				);
			} else {
				await load();
				swal('Pago parcial', `Registrado. Saldo pendiente: ${money(res.remaining)}`, 'info');
			}
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo registrar el pago', 'error');
		}
	};

	const cancelOrder = (o) => {
		swal({
			title: '¿Anular comanda?',
			text: `Comanda #${o.id}. Se descontará de la cuenta.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular comanda'],
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
			text: `${money(p.amount)} (${p.paymentMethod === 'cash' ? 'efectivo' : p.paymentMethod === 'card' ? 'tarjeta' : p.paymentMethod}). Quedará registrado en la bitácora.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular cobro'],
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
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await AccountsApi.remove(id);
				swal('Cuenta eliminada', 'La cuenta se eliminó y las mesas quedaron libres.', 'success').then(() =>
					navigate('/mesas'),
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

	const remaining = Math.max(Number(account.total) - paid, 0);
	const closed = account.status === 'paid' || account.status === 'cancelled';
	const filteredMenu = activeCat === 'all'
		? menu
		: menu.filter((m) => m.categoryId === Number(activeCat));

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<Button variant="light" size="sm" className="mb-2" onClick={() => navigate('/mesas')}>
						<i className="bi bi-arrow-left me-1"></i>Mesas
					</Button>
					<h3 className="mb-0">{account.label}</h3>
					<span className="text-muted">
						Mesa(s): {(account.tables || []).map((t) => t.number).join(', ')} ·{' '}
						<Badge bg={account.status === 'billing' ? 'danger' : account.status === 'paid' ? 'success' : 'warning'}>
							{account.status === 'billing' ? 'Cobrando' : account.status === 'paid' ? 'Pagada' : account.status === 'cancelled' ? 'Anulada' : 'Abierta'}
						</Badge>
					</span>
				</div>
				<div className="text-end">
					<h2 className="mb-0 text-primary">{money(account.total)}</h2>
					{paid > 0 && <small className="text-muted">Pagado {money(paid)} · Saldo {money(remaining)}</small>}
				</div>
			</div>

			{!closed && (
				<div className="d-flex gap-2 mb-3 flex-wrap">
					{canOrder && account.status === 'open' && (
						<Button variant="outline-secondary" size="sm" onClick={openJoin}>
							<i className="bi bi-link-45deg me-1"></i>Unir mesas
						</Button>
					)}
					{account.status === 'open' && (
						<Button variant="outline-danger" size="sm" onClick={markBilling}>
							<i className="bi bi-receipt me-1"></i>Marcar cobrando
						</Button>
					)}
					{canPay && (
						<Button variant="success" size="sm" onClick={openPay}>
							<i className="bi bi-cash-stack me-1"></i>Cobrar
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
				<Col lg={canOrder && !closed ? 7 : 12}>
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
																{it.notes && <span className="text-muted small d-block">↳ {it.notes}</span>}
															</td>
															<td className="text-end">{money(it.subtotal)}</td>
																{canEditOrder && (<td className="text-end" style={{ width: 36 }}><Button size="sm" variant="light" className="text-danger py-0 px-1" title="Anular platillo" onClick={() => cancelItem(o, it)}><i className="fa-solid fa-xmark"></i></Button></td>)}
														</tr>
													))}
												</tbody>
											</Table>
											<div className="d-flex gap-3 flex-wrap small text-muted">
												<span><i className="fa-solid fa-user me-1"></i>Mesero: {o.waiter?.name || '—'}</span>
												<span><i className="fa-solid fa-utensils me-1"></i>Cocina: {o.cook?.name || 'sin atender'}</span>
											</div>
										</div>
									);
								})
							)}
						</Card.Body>
					</Card>
				</Col>

				{/* Nueva comanda */}
				{canOrder && !closed && (
					<Col lg={5}>
						<Card>
							<Card.Header><Card.Title>Nueva comanda</Card.Title></Card.Header>
							<Card.Body>
								<Nav variant="pills" className="mb-3 flex-wrap gap-1">
									<Nav.Item>
										<Nav.Link active={activeCat === 'all'} onClick={() => setActiveCat('all')}>Todos</Nav.Link>
									</Nav.Item>
									{categories.map((c) => (
										<Nav.Item key={c.id}>
											<Nav.Link active={activeCat === String(c.id)} onClick={() => setActiveCat(String(c.id))}>
												{c.name}
											</Nav.Link>
										</Nav.Item>
									))}
								</Nav>

								<div style={{ maxHeight: 220, overflowY: 'auto' }} className="mb-3">
									{filteredMenu.map((m) => (
										<div key={m.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
											<div className="d-flex align-items-center">
												{m.image ? (
													<img src={m.image} alt={m.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} className="me-2" />
												) : (
													<div className="d-flex align-items-center justify-content-center bg-light text-muted me-2" style={{ width: 40, height: 40, borderRadius: 8 }}><i className="fa-solid fa-utensils"></i></div>
												)}
												<div>
													<div className="font-w600">{m.name}</div>
													<small className="text-muted">{money(m.price)}</small>
												</div>
											</div>
											<Button size="sm" variant="outline-primary" onClick={() => addToCart(m)}>
												<i className="fa-solid fa-plus"></i>
											</Button>
										</div>
									))}
								</div>

								{cart.length > 0 && (
									<>
										<hr />
										{cart.map((x) => (
											<div key={x.menuItem.id} className="mb-2">
												<div className="d-flex justify-content-between align-items-center">
													<span className="text-truncate">{x.menuItem.name}</span>
													<div className="d-flex align-items-center gap-1">
														<Button size="sm" variant="light" onClick={() => setQty(x.menuItem.id, x.quantity - 1)}>−</Button>
														<span className="px-2">{x.quantity}</span>
														<Button size="sm" variant="light" onClick={() => setQty(x.menuItem.id, x.quantity + 1)}>+</Button>
													</div>
												</div>
												<Form.Control
													size="sm"
													className="mt-1"
													placeholder="Nota (ej. sin cebolla)"
													value={x.notes}
													onChange={(e) => setNote(x.menuItem.id, e.target.value)}
												/>
											</div>
										))}
										<Form.Control
											as="textarea"
											rows={2}
											className="mt-2"
											placeholder="Nota general de la comanda"
											value={orderNotes}
											onChange={(e) => setOrderNotes(e.target.value)}
										/>
										<div className="d-flex justify-content-between align-items-center mt-3">
											<strong>Total: {money(cartTotal)}</strong>
											<Button variant="primary" onClick={sendOrder} disabled={sending}>
												{sending ? 'Enviando…' : 'Enviar a cocina'}
											</Button>
										</div>
									</>
								)}
							</Card.Body>
						</Card>
					</Col>
				)}
			</Row>

			{/* Cobros de la cuenta */}
				{canPay && payments.length > 0 && (
					<Card>
						<Card.Header><Card.Title>Cobros</Card.Title></Card.Header>
						<Card.Body>
							<Table responsive hover size="sm" className="mb-0">
								<tbody>
									{payments.map((p) => (
										<tr key={p.id}>
											<td>{new Date(p.date).toLocaleString("es-GT")}</td>
											<td>{p.paymentMethod === "cash" ? "Efectivo" : p.paymentMethod === "card" ? "Tarjeta" : p.paymentMethod}</td>
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
									<span className="text-muted small me-3" style={{ minWidth: 140 }}>{new Date(l.createdAt).toLocaleString("es-GT")}</span>
									<span className="me-2 font-w600">{AUDIT_ACTIONS[l.action] || l.action}</span>
									<span className="text-muted small">{l.userName ? `· ${l.userName} (${ROLE_LABELS[l.userRole] || l.userRole})` : ""}{l.detail ? ` · ${l.detail}` : ""}</span>
								</li>
							))}
						</ul>
					)}
				</Card.Body>
			</Card>

			{/* Modal cobrar */}
			<Modal show={showPay} onHide={() => setShowPay(false)} centered>
				<Modal.Header closeButton><Modal.Title>Cobrar cuenta</Modal.Title></Modal.Header>
				<Modal.Body>
					<div className="d-flex justify-content-between mb-2">
						<span>Total de la cuenta</span><strong>{money(account.total)}</strong>
					</div>
					<div className="d-flex justify-content-between mb-3">
						<span>Saldo pendiente</span><strong className="text-danger">{money(remaining)}</strong>
					</div>
					<Form.Group className="mb-3">
						<Form.Label>Monto a pagar</Form.Label>
						<Form.Control type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
					</Form.Group>
					<Form.Group>
						<Form.Label>Forma de pago</Form.Label>
						<Form.Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
							<option value="cash">Efectivo</option>
							<option value="card">Tarjeta</option>
						</Form.Select>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShowPay(false)}>Cancelar</Button>
					<Button variant="success" onClick={submitPay}>Registrar pago</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal unir mesas */}
			<Modal show={showJoin} onHide={() => setShowJoin(false)} centered>
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

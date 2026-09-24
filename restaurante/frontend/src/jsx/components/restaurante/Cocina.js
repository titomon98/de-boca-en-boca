import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Button, Badge, Spinner } from 'react-bootstrap';
import { OrdersApi, SettingsApi } from '../../../services/RestaurantApi';
import { connectComandas } from '../../../services/socket';
import { ORDER_STATUS } from '../../../services/helpers';
import { printTicket } from '../../../services/printTicket';

const COLUMNS = [
	{ key: 'in_preparation', title: 'En preparación', color: 'warning', next: 'ready', nextLabel: 'Marcar lista' },
	{ key: 'ready', title: 'Listas', color: 'info', next: 'delivered', nextLabel: 'Entregar' },
];

const timeAgo = (date) => {
	const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
	if (mins < 1) return 'ahora';
	if (mins === 1) return 'hace 1 min';
	return `hace ${mins} min`;
};

const Cocina = () => {
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [connected, setConnected] = useState(false);
	const socketRef = useRef(null);
	const autoPrintRef = useRef(false);

	const upsert = (order) => {
		setOrders((prev) => {
			const active = ['pending', 'in_preparation', 'ready'].includes(order.status);
			const without = prev.filter((o) => o.id !== order.id);
			return active ? [...without, order].sort((a, b) => a.id - b.id) : without;
		});
	};

	useEffect(() => {
		OrdersApi.kitchen().then((o) => {
			setOrders(o);
			setLoading(false);
		});

		// Lee la config de impresión automática (ref para usarla dentro del socket).
		SettingsApi.get()
			.then((s) => { autoPrintRef.current = s.print_comandas === 'true'; })
			.catch(() => {});

		const socket = connectComandas();
		socketRef.current = socket;
		socket.on('connect', () => setConnected(true));
		socket.on('disconnect', () => setConnected(false));
		socket.on('comanda:nueva', (order) => {
			upsert(order);
			if (autoPrintRef.current) printTicket(order);
		});
		socket.on('comanda:actualizada', upsert);

		return () => socket.close();
	}, []);

	const advance = async (order, next) => {
		// actualización optimista
		upsert({ ...order, status: next });
		try {
			await OrdersApi.updateStatus(order.id, next);
		} catch (e) {
			// recargar si falla
			OrdersApi.kitchen().then(setOrders);
		}
	};

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	return (
		<>
			<div className="d-flex justify-content-between align-items-center mb-3">
				<div>
					<h3 className="mb-0">Cocina</h3>
					<span className="text-muted">Comandas activas en tiempo real</span>
				</div>
				<Badge bg={connected ? 'success' : 'secondary'}>
					<i className="bi bi-broadcast me-1"></i>{connected ? 'En vivo' : 'Sin conexión'}
				</Badge>
			</div>

			<Row className="align-items-start">
				{COLUMNS.map((col) => {
					const list = orders.filter((o) => o.status === col.key);
					return (
						<Col md={6} key={col.key} className="mb-3">
							<div className="d-flex justify-content-between align-items-center mb-2">
								<h5 className={`mb-0 text-${col.color}`}>{col.title}</h5>
								<Badge bg={col.color}>{list.length}</Badge>
							</div>
							<div
								className="cocina-col pe-1"
								style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}
							>
								{list.length === 0 && (
									<p className="text-muted small">Sin comandas</p>
								)}
								{list.map((o) => (
									<Card
										key={o.id}
										className={`mb-2 border-start border-3 border-${col.color}`}
										style={{ height: 'auto' }}
									>
										<Card.Body className="p-2">
											<div className="d-flex justify-content-between align-items-center mb-1">
												<strong className="fs-14">Comanda #{o.id}</strong>
												<small className="text-muted">{timeAgo(o.createdAt)}</small>
											</div>
											{o.notes && <p className="small text-muted mb-1">Nota: {o.notes}</p>}
											<ul className="list-unstyled mb-2 fs-14">
												{o.items.map((it) => (
													<li key={it.id}>
														<span className="font-w600">{it.quantity}× </span>
														{it.menuItem?.name}
														{it.notes && <span className="text-danger small d-block">{it.notes}</span>}
													</li>
												))}
											</ul>
											<div className="d-flex gap-1">
												<Button
													size="sm"
													variant={col.color}
													className="flex-grow-1"
													onClick={() => advance(o, col.next)}
												>
													{col.nextLabel}
												</Button>
												<Button
													size="sm"
													variant="light"
													title="Imprimir comanda"
													onClick={() => printTicket(o)}
												>
													<i className="fa-solid fa-print"></i>
												</Button>
											</div>
										</Card.Body>
									</Card>
								))}
							</div>
						</Col>
					);
				})}
			</Row>
		</>
	);
};

export default Cocina;

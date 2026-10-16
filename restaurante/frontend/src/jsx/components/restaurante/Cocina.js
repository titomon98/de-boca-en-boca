import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Button, Badge, Spinner } from 'react-bootstrap';
import { OrdersApi } from '../../../services/RestaurantApi';
import { connectComandas } from '../../../services/socket';
import { printTicket } from '../../../services/printTicket';
import { fmtTime, toDate } from '../../../services/helpers';

const timeAgo = (date) => {
	const mins = Math.floor((Date.now() - toDate(date).getTime()) / 60000);
	if (mins < 1) return 'ahora';
	if (mins === 1) return 'hace 1 min';
	return `hace ${mins} min`;
};

/**
 * Feed de comandas en tiempo real. Se reutiliza para Cocina (comida) y Barra
 * (bebidas): filtra los renglones de cada comanda por el tipo de producto.
 * Cocina y barra ya no marcan estado a mano: cada comanda se imprime (auto al
 * llegar, si está activado) y se asume preparada y entregada. Aquí solo se ve
 * el historial reciente y se puede reimprimir.
 */
const Cocina = ({ type = 'food', title = 'Cocina', subtitle = 'Comandas recientes (se imprimen automáticamente en la impresora)' }) => {
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [connected, setConnected] = useState(false);
	// Tic cada minuto para que las comandas de más de 300 min desaparezcan solas.
	const [, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((n) => n + 1), 60000);
		return () => clearInterval(t);
	}, []);
	const socketRef = useRef(null);

	// Renglones de esta estación (food -> cocina, drink -> barra).
	const stationItems = (o) => (o.items || []).filter((it) => (it.menuItem?.type || 'food') === type);

	const upsert = (order) => {
		setOrders((prev) => {
			const without = prev.filter((o) => o.id !== order.id);
			if (order.status === 'cancelled') return without;
			return [order, ...without].sort((a, b) => b.id - a.id);
		});
	};

	useEffect(() => {
		OrdersApi.kitchen()
			.then(setOrders)
			.catch(() => {})
			.finally(() => setLoading(false));

		const socket = connectComandas();
		socketRef.current = socket;
		socket.on('connect', () => setConnected(true));
		socket.on('disconnect', () => setConnected(false));
		// La impresión automática la hace el puente de impresión, no esta pantalla.
		socket.on('comanda:nueva', upsert);
		socket.on('comanda:actualizada', upsert);

		return () => socket.close();
	}, []);

	// Solo las comandas que tienen renglones de esta estación.
	// Solo las comandas de esta estación con menos de 300 minutos.
	const MAX_MIN = 300;
	const list = orders.filter(
		(o) => stationItems(o).length > 0 && (Date.now() - toDate(o.createdAt).getTime()) / 60000 < MAX_MIN,
	);

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	return (
		<>
			<div className="d-flex justify-content-between align-items-center mb-3">
				<div>
					<h3 className="mb-0">{title}</h3>
					<span className="text-muted">{subtitle}</span>
				</div>
				<Badge bg={connected ? 'success' : 'secondary'}>
					<i className="bi bi-broadcast me-1"></i>{connected ? 'En vivo' : 'Sin conexión'}
				</Badge>
			</div>

			{list.length === 0 ? (
				<p className="text-muted">Sin comandas recientes.</p>
			) : (
				<Row>
					{list.map((o) => (
						<Col xl={4} lg={6} key={o.id} className="mb-3">
							<Card className="border-start border-3 border-primary h-100">
								<Card.Body className="p-2">
									<div className="d-flex justify-content-between align-items-center mb-1">
										<strong className="fs-14">Comanda #{o.id}</strong>
										<small className="text-muted">{fmtTime(o.createdAt)} · {timeAgo(o.createdAt)}</small>
									</div>
									{(o.account?.isDelivery || (o.account?.tables || []).some((t) => t.isTakeout || t.number === 0)) && (
										<div className="text-center fw-bold text-danger border border-danger border-2 rounded py-1 mb-2" style={{ fontSize: '1.4rem' }}>
											{o.account?.isDelivery ? 'A DOMICILIO - PARA LLEVAR' : 'PARA LLEVAR'}
										</div>
									)}
									{o.notes && <p className="fw-bold text-dark mb-1" style={{ fontSize: '1.1rem' }}>Nota: {o.notes}</p>}
									<ul className="list-unstyled mb-2 fs-14">
										{stationItems(o).map((it) => (
											<li key={it.id} className="mb-1">
												<span className="font-w600">{it.quantity}× </span>
												{it.menuItem?.name}
												{it.notes && <span className="d-block fw-bold text-danger" style={{ fontSize: '1rem' }}>{it.notes}</span>}
											</li>
										))}
									</ul>
									<Button
										size="sm"
										variant="light"
										className="w-100"
										onClick={() => printTicket(o, { type, station: title.toUpperCase() })}
									>
										<i className="fa-solid fa-print me-1"></i>Reimprimir
									</Button>
								</Card.Body>
							</Card>
						</Col>
					))}
				</Row>
			)}
		</>
	);
};

export default Cocina;

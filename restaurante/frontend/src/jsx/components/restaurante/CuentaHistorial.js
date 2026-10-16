import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Badge, Spinner, Form } from 'react-bootstrap';
import { AccountsApi } from '../../../services/RestaurantApi';
import { money, fmtDateTime, toDate } from '../../../services/helpers';

const STATUS = {
	open: { label: 'Abierta', bg: 'warning' },
	billing: { label: 'Cobrando', bg: 'danger' },
	paid: { label: 'Pagada', bg: 'success' },
	cancelled: { label: 'Anulada', bg: 'secondary' },
};

const accountTables = (a) =>
	(a.tables || [])
		.map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || `Mesa ${t.number}`))
		.join(', ') || '-';

// Tiempo de la mesa: de la primera comanda al cobro (o a ahora si sigue abierta).
const duration = (a) => {
	const start = a.firstOrderAt ? toDate(a.firstOrderAt).getTime() : null;
	if (!start) return '-';
	const end = a.closedAt ? toDate(a.closedAt).getTime() : Date.now();
	const mins = Math.max(0, Math.round((end - start) / 60000));
	if (mins < 60) return `${mins} min`;
	return `${Math.floor(mins / 60)}h ${mins % 60}min`;
};

/**
 * Historial cuenta por cuenta: registro de cada cuenta (qué estado, total,
 * descuento, pagado, propina y tiempo de mesa). "Ver" abre el detalle completo
 * (productos servidos, pagos y bitácora).
 */
const CuentaHistorial = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [rows, setRows] = useState([]);
	const [q, setQ] = useState('');

	const load = useCallback(async () => {
		try {
			setRows(await AccountsApi.history());
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	const term = q.trim().toLowerCase();
	const visible = term
		? rows.filter((a) => (a.label || '').toLowerCase().includes(term) || accountTables(a).toLowerCase().includes(term))
		: rows;

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0">Historial de cuentas</h3>
					<span className="text-muted">Registro de cada cuenta: qué se sirvió, descuentos y tiempos</span>
				</div>
				<Button variant="light" onClick={load}><i className="fa-solid fa-rotate me-1"></i>Actualizar</Button>
			</div>

			<Card>
				<Card.Body>
					<div className="mb-3" style={{ maxWidth: 360 }}>
						<Form.Control placeholder="Buscar por cuenta o mesa" value={q} onChange={(e) => setQ(e.target.value)} />
					</div>
					{visible.length === 0 ? (
						<p className="text-muted mb-0">No hay cuentas.</p>
					) : (
						<Table responsive hover className="align-middle">
							<thead>
								<tr>
									<th>Abierta</th>
									<th>Cuenta</th>
									<th>Mesas</th>
									<th>Estado</th>
									<th className="text-end">Total</th>
									<th className="text-end">Descuento</th>
									<th className="text-end">Pagado</th>
									<th className="text-end">Propina</th>
									<th>Tiempo</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{visible.map((a) => {
									const st = STATUS[a.status] || { label: a.status, bg: 'light' };
									const net = Number(a.total) - Number(a.discount || 0) + (a.isDelivery ? Number(a.courierFee || 0) : 0);
									return (
										<tr key={a.id}>
											<td className="small text-muted">{fmtDateTime(a.openedAt)}</td>
											<td className="font-w600">
												{a.label}
												{a.isDelivery && <Badge bg="secondary" className="ms-1"><i className="fa-solid fa-motorcycle"></i></Badge>}
											</td>
											<td>{accountTables(a)}</td>
											<td><Badge bg={st.bg}>{st.label}</Badge></td>
											<td className="text-end">{money(net)}</td>
											<td className="text-end">{Number(a.discount) > 0 ? `-${money(a.discount)}` : '-'}</td>
											<td className="text-end">{money(a.paid)}</td>
											<td className="text-end">{Number(a.tips) > 0 ? money(a.tips) : '-'}</td>
											<td>{duration(a)}</td>
											<td className="text-end">
												<Button size="sm" variant="light" onClick={() => navigate(`/cuenta/${a.id}`)}>Ver</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</Table>
					)}
				</Card.Body>
			</Card>
		</>
	);
};

export default CuentaHistorial;

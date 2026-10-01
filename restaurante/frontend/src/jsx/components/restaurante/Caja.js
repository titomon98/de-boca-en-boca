import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Badge, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { AccountsApi, TablesApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

// Etiqueta de las mesas de una cuenta (nombre, número, o "Para llevar").
const accountTables = (a) =>
	(a.tables || [])
		.map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || `Mesa ${t.number}`))
		.join(', ') || '—';

const Caja = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [accounts, setAccounts] = useState([]);

	const load = useCallback(async () => {
		const a = await AccountsApi.listOpen();
		setAccounts(a);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	// Nueva orden para llevar desde la caja: abre una cuenta sobre la mesa de
	// "para llevar" y entra al menú para tomar el pedido.
	const newTakeout = async () => {
		try {
			const tables = await TablesApi.list();
			const takeout = tables.find((t) => t.isTakeout || t.number === 0);
			if (!takeout) {
				swal('Error', 'No existe una mesa "para llevar" configurada.', 'error');
				return;
			}
			const label = `Para llevar ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
			const acc = await AccountsApi.open({ label, tableIds: [takeout.id] });
			navigate(`/cuenta/${acc.id}`);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo abrir la orden', 'error');
		}
	};

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	return (
		<>
			<div className="d-flex justify-content-between align-items-center mb-3">
				<div>
					<h3 className="mb-0">Caja</h3>
					<span className="text-muted">Cuentas activas por cobrar y pedidos para llevar</span>
				</div>
				<div className="d-flex gap-2 flex-wrap">
					<Button variant="primary" onClick={newTakeout}>
						<i className="fa-solid fa-bag-shopping me-1"></i>Nueva orden para llevar
					</Button>
					<Button variant="outline-secondary" onClick={() => navigate('/para-llevar')}>
						<i className="fa-solid fa-list me-1"></i>Ver para llevar
					</Button>
					<Button variant="light" onClick={() => navigate('/cierre-caja')}>
						<i className="bi bi-lock me-1"></i>Cierre de caja
					</Button>
				</div>
			</div>

			<Card>
				<Card.Body>
					{accounts.length === 0 ? (
						<p className="text-muted mb-0">No hay cuentas activas.</p>
					) : (
						<Table responsive hover>
							<thead>
								<tr>
									<th>Cuenta</th>
									<th>Mesas</th>
									<th>Estado</th>
									<th className="text-end">Total</th>
									<th className="text-end">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{accounts.map((a) => {
									const discount = Number(a.discount || 0);
									const courier = a.isDelivery ? Number(a.courierFee || 0) : 0;
									const net = Number(a.total) - discount + courier;
									return (
										<tr key={a.id}>
											<td className="font-w600">{a.label}</td>
											<td>{accountTables(a)}</td>
											<td>
												<Badge bg={a.status === 'billing' ? 'danger' : 'warning'}>
													{a.status === 'billing' ? 'Cobrando' : 'Abierta'}
												</Badge>
											</td>
											<td className="text-end font-w600">
												{money(net)}
												{discount > 0 && <small className="text-muted d-block">Desc. -{money(discount)}</small>}
											</td>
											<td className="text-end">
												<Button size="sm" variant="light" className="me-1" onClick={() => navigate(`/cuenta/${a.id}`)}>
													Ver
												</Button>
												<Button size="sm" variant="success" onClick={() => navigate(`/cuenta/${a.id}`)}>
													Cobrar
												</Button>
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

export default Caja;

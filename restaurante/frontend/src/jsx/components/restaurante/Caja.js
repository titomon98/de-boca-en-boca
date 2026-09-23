import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Badge, Modal, Form, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { AccountsApi, PaymentsApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

const Caja = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [accounts, setAccounts] = useState([]);
	const [show, setShow] = useState(false);
	const [target, setTarget] = useState(null);
	const [paid, setPaid] = useState(0);
	const [amount, setAmount] = useState('');
	const [method, setMethod] = useState('cash');

	const load = useCallback(async () => {
		const a = await AccountsApi.listOpen();
		setAccounts(a);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const openPay = async (acc) => {
		const payments = await PaymentsApi.byAccount(acc.id).catch(() => []);
		const p = payments.reduce((s, x) => s + Number(x.amount), 0);
		setPaid(p);
		setTarget(acc);
		setAmount(Math.max(Number(acc.total) - p, 0).toFixed(2));
		setMethod('cash');
		setShow(true);
	};

	const submit = async () => {
		const amt = Number(amount);
		if (!amt || amt <= 0) {
			swal('Atención', 'Ingrese un monto válido.', 'warning');
			return;
		}
		try {
			const res = await PaymentsApi.pay({ accountId: target.id, amount: amt, paymentMethod: method });
			setShow(false);
			await load();
			if (res.accountStatus === 'paid') {
				swal('Cuenta pagada', 'Liquidada y mesas liberadas.', 'success');
			} else {
				swal('Pago parcial', `Saldo pendiente: ${money(res.remaining)}`, 'info');
			}
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo cobrar', 'error');
		}
	};

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	const remaining = target ? Math.max(Number(target.total) - paid, 0) : 0;

	return (
		<>
			<div className="d-flex justify-content-between align-items-center mb-3">
				<div>
					<h3 className="mb-0">Caja</h3>
					<span className="text-muted">Cuentas activas por cobrar</span>
				</div>
				<Button variant="light" onClick={() => navigate('/cierre-caja')}>
					<i className="bi bi-lock me-1"></i>Cierre de caja
				</Button>
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
								{accounts.map((a) => (
									<tr key={a.id}>
										<td className="font-w600">{a.label}</td>
										<td>{(a.tables || []).map((t) => t.number).join(', ')}</td>
										<td>
											<Badge bg={a.status === 'billing' ? 'danger' : 'warning'}>
												{a.status === 'billing' ? 'Cobrando' : 'Abierta'}
											</Badge>
										</td>
										<td className="text-end font-w600">{money(a.total)}</td>
										<td className="text-end">
											<Button size="sm" variant="light" className="me-1" onClick={() => navigate(`/cuenta/${a.id}`)}>
												Ver
											</Button>
											<Button size="sm" variant="success" onClick={() => openPay(a)}>
												Cobrar
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					)}
				</Card.Body>
			</Card>

			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton><Modal.Title>Cobrar — {target?.label}</Modal.Title></Modal.Header>
				<Modal.Body>
					<div className="d-flex justify-content-between mb-2">
						<span>Total</span><strong>{money(target?.total)}</strong>
					</div>
					<div className="d-flex justify-content-between mb-3">
						<span>Saldo pendiente</span><strong className="text-danger">{money(remaining)}</strong>
					</div>
					<Form.Group className="mb-3">
						<Form.Label>Monto</Form.Label>
						<Form.Control type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
					</Form.Group>
					<Form.Group>
						<Form.Label>Forma de pago</Form.Label>
						<Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
							<option value="cash">Efectivo</option>
							<option value="card">Tarjeta</option>
						</Form.Select>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="success" onClick={submit}>Registrar pago</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default Caja;

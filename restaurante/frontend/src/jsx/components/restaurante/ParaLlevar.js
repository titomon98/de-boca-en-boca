import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { TablesApi, AccountsApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

/**
 * Órdenes "Para llevar". Reutiliza cuentas/comandas pero sin selección de mesa.
 * Dos estados independientes y combinables por orden:
 *   - Entrega:  Pendiente de entrega  <->  Entregada  (delivered_at)
 *   - Cobro:    Sin cobrar            <->  Cobrada    (status === 'paid', POS)
 * Una orden desaparece de aquí sólo cuando está cobrada Y entregada.
 */
const ParaLlevar = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [takeoutId, setTakeoutId] = useState(null);
	const [accounts, setAccounts] = useState([]);
	const [show, setShow] = useState(false);
	const [label, setLabel] = useState('');
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		try {
			const [tables, accs] = await Promise.all([TablesApi.list(), AccountsApi.listTakeout()]);
			const takeout = tables.find((t) => t.isTakeout || t.number === 0);
			setTakeoutId(takeout ? takeout.id : null);
			setAccounts(accs);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudieron cargar las órdenes para llevar', 'error');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const submit = async () => {
		if (!takeoutId) {
			swal('Error', 'No existe una mesa "para llevar" configurada.', 'error');
			return;
		}
		setSaving(true);
		try {
			const finalLabel = label.trim() || `Para llevar ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
			const acc = await AccountsApi.open({ label: finalLabel, tableIds: [takeoutId] });
			setShow(false);
			navigate(`/cuenta/${acc.id}`);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo abrir la orden', 'error');
		} finally {
			setSaving(false);
		}
	};

	const toggleDelivered = async (acc, delivered) => {
		try {
			await AccountsApi.setDelivered(acc.id, delivered);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo actualizar la entrega', 'error');
		}
	};

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0"><i className="fa-solid fa-bag-shopping me-2"></i>Para llevar</h3>
					<span className="text-muted">Órdenes para llevar - sin mesa. Entrega y cobro son independientes.</span>
				</div>
				<Button variant="primary" onClick={() => { setLabel(''); setShow(true); }}>
					<i className="fa-solid fa-plus me-2"></i>Nueva orden
				</Button>
			</div>

			{accounts.length === 0 ? (
				<Card>
					<Card.Body className="text-center text-muted p-5">
						<i className="fa-solid fa-bag-shopping fs-1 d-block mb-3"></i>
						No hay órdenes para llevar pendientes.
						<div className="mt-3">
							<Button variant="outline-primary" onClick={() => { setLabel(''); setShow(true); }}>
								Crear la primera
							</Button>
						</div>
					</Card.Body>
				</Card>
			) : (
				<Row className="g-3">
					{accounts.map((a) => {
						const delivered = !!a.deliveredAt;
						const paid = a.status === 'paid';
						return (
							<Col xl={4} lg={6} key={a.id}>
								<Card className="h-100">
									<Card.Body>
										<div className="d-flex justify-content-between align-items-start mb-2">
											<h4 className="mb-0 text-truncate">{a.label}</h4>
											<span className="font-w600 fs-5">{money(a.total)}</span>
										</div>

										{/* Estados combinables */}
										<div className="d-flex gap-2 mb-3 flex-wrap">
											<Badge bg={delivered ? 'success' : 'secondary'}>
												<i className={`fa-solid ${delivered ? 'fa-check' : 'fa-clock'} me-1`}></i>
												{delivered ? 'Entregada' : 'Pendiente de entrega'}
											</Badge>
											<Badge bg={paid ? 'success' : 'danger'}>
												<i className={`fa-solid ${paid ? 'fa-check' : 'fa-dollar-sign'} me-1`}></i>
												{paid ? 'Cobrada' : 'Sin cobrar'}
											</Badge>
										</div>

										<div className="d-flex gap-2 flex-wrap">
											<Button size="sm" variant="outline-primary" onClick={() => navigate(`/cuenta/${a.id}`)}>
												<i className="fa-solid fa-pen me-1"></i>Ver / editar
											</Button>
											{delivered ? (
												<Button size="sm" variant="outline-secondary" onClick={() => toggleDelivered(a, false)}>
													Marcar pendiente
												</Button>
											) : (
												<Button size="sm" variant="success" onClick={() => toggleDelivered(a, true)}>
													<i className="fa-solid fa-check me-1"></i>Entregar
												</Button>
											)}
											{!paid && Number(a.total) > 0 && (
												<Button size="sm" variant="success" onClick={() => navigate(`/cuenta/${a.id}`)}>
													<i className="fa-solid fa-dollar-sign me-1"></i>Cobrar
												</Button>
											)}
										</div>
									</Card.Body>
								</Card>
							</Col>
						);
					})}
				</Row>
			)}

			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Nueva orden para llevar</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form.Group>
						<Form.Label>Nombre del cliente (opcional)</Form.Label>
						<Form.Control
							autoFocus
							placeholder="Ingrese nombre del cliente"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
						/>
						<Form.Text className="text-muted">
							Si lo deja vacío, se etiqueta con la hora.
						</Form.Text>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="primary" onClick={submit} disabled={saving}>
						{saving ? 'Abriendo…' : 'Abrir orden'}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default ParaLlevar;

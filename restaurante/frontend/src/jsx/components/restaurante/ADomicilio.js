import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { TablesApi, AccountsApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

/**
 * Órdenes "A domicilio" (envíos). Como Para llevar, pero marcadas como envío y
 * con el efectivo que sale de caja para el motorista (para cuadrar la caja).
 */
const ADomicilio = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [takeoutId, setTakeoutId] = useState(null);
	const [accounts, setAccounts] = useState([]);
	const [show, setShow] = useState(false);
	const [label, setLabel] = useState('');
	const [fee, setFee] = useState('');
	const [saving, setSaving] = useState(false);
	// edición de envío de una orden existente
	const [editAcc, setEditAcc] = useState(null);
	const [editFee, setEditFee] = useState('');

	const load = useCallback(async () => {
		try {
			const [tables, accs] = await Promise.all([TablesApi.list(), AccountsApi.listDelivery()]);
			const takeout = tables.find((t) => t.isTakeout || t.number === 0);
			setTakeoutId(takeout ? takeout.id : null);
			setAccounts(accs);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudieron cargar los envíos', 'error');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { load(); }, [load]);

	const submit = async () => {
		if (!takeoutId) {
			swal('Error', 'No existe una mesa "para llevar/domicilio" configurada.', 'error');
			return;
		}
		setSaving(true);
		try {
			const finalLabel = label.trim() || `Domicilio ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
			const acc = await AccountsApi.open({ label: finalLabel, tableIds: [takeoutId] });
			await AccountsApi.setDelivery(acc.id, true, Number(fee) || 0);
			setShow(false);
			navigate(`/cuenta/${acc.id}`);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo abrir el envío', 'error');
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

	const saveFee = async () => {
		try {
			await AccountsApi.setDelivery(editAcc.id, true, Number(editFee) || 0);
			setEditAcc(null);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo actualizar el envío', 'error');
		}
	};

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0"><i className="fa-solid fa-motorcycle me-2"></i>A domicilio</h3>
					<span className="text-muted">Envíos. El efectivo al motorista sale de caja (para cuadrar).</span>
				</div>
				<Button variant="primary" onClick={() => { setLabel(''); setFee(''); setShow(true); }}>
					<i className="fa-solid fa-plus me-2"></i>Nueva orden a domicilio
				</Button>
			</div>

			{accounts.length === 0 ? (
				<Card>
					<Card.Body className="text-center text-muted p-5">
						<i className="fa-solid fa-motorcycle fs-1 d-block mb-3"></i>
						No hay envíos pendientes.
						<div className="mt-3">
							<Button variant="outline-primary" onClick={() => { setLabel(''); setFee(''); setShow(true); }}>
								Crear el primero
							</Button>
						</div>
					</Card.Body>
				</Card>
			) : (
				<Row className="g-3">
					{accounts.map((a) => {
						const delivered = !!a.deliveredAt;
						const paid = a.status === 'paid';
						const fee = Number(a.courierFee || 0);
						const net = Number(a.total) - Number(a.discount || 0) + fee;
						return (
							<Col xl={4} lg={6} key={a.id}>
								<Card className="h-100">
									<Card.Body>
										<div className="d-flex justify-content-between align-items-start mb-2">
											<h4 className="mb-0 text-truncate">{a.label}</h4>
											<div className="text-end">
												<span className="font-w600 fs-5 d-block">{money(net)}</span>
												{fee > 0 && <small className="text-muted">Productos {money(a.total)} + envío {money(fee)}</small>}
											</div>
										</div>

										<div className="d-flex gap-2 mb-2 flex-wrap">
											<Badge bg={delivered ? 'success' : 'secondary'}>
												<i className={`fa-solid ${delivered ? 'fa-check' : 'fa-clock'} me-1`}></i>
												{delivered ? 'Entregada' : 'Pendiente de entrega'}
											</Badge>
											<Badge bg={paid ? 'success' : 'danger'}>
												<i className={`fa-solid ${paid ? 'fa-check' : 'fa-dollar-sign'} me-1`}></i>
												{paid ? 'Cobrada' : 'Sin cobrar'}
											</Badge>
										</div>

										<div className="small text-muted mb-3">
											<i className="fa-solid fa-money-bill-wave me-1"></i>
											Efectivo motorista: <strong>{money(a.courierFee)}</strong>
											<Button variant="link" size="sm" className="p-0 ms-2" onClick={() => { setEditAcc(a); setEditFee(Number(a.courierFee || 0).toFixed(2)); }}>
												editar
											</Button>
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

			{/* Nueva orden a domicilio */}
			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Nueva orden a domicilio</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form.Group className="mb-3">
						<Form.Label>Nombre del cliente (opcional)</Form.Label>
						<Form.Control
							autoFocus
							placeholder="Ingrese nombre del cliente"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</Form.Group>
					<Form.Group>
						<Form.Label>Efectivo al motorista (Q)</Form.Label>
						<Form.Control
							type="number"
							step="0.01"
							min={0}
							placeholder="0.00"
							value={fee}
							onChange={(e) => setFee(e.target.value)}
						/>
						<Form.Text className="text-muted">Sale de caja. Se descuenta del efectivo esperado en el cierre.</Form.Text>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="primary" onClick={submit} disabled={saving}>
						{saving ? 'Abriendo…' : 'Abrir envío'}
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Editar efectivo del motorista */}
			<Modal show={!!editAcc} onHide={() => setEditAcc(null)} centered>
				<Modal.Header closeButton><Modal.Title>Efectivo al motorista</Modal.Title></Modal.Header>
				<Modal.Body>
					<Form.Group>
						<Form.Label>Efectivo al motorista (Q)</Form.Label>
						<Form.Control type="number" step="0.01" min={0} value={editFee} onChange={(e) => setEditFee(e.target.value)} />
						<Form.Text className="text-muted">Sale de caja. Se descuenta del efectivo esperado en el cierre.</Form.Text>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setEditAcc(null)}>Cancelar</Button>
					<Button variant="primary" onClick={saveFee}>Guardar</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default ADomicilio;

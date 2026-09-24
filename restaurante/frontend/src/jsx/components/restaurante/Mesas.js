import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Modal, Button, Form, Badge, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { TablesApi, AccountsApi } from '../../../services/RestaurantApi';
import { money, TABLE_STATUS } from '../../../services/helpers';

const Mesas = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [tables, setTables] = useState([]);
	const [accounts, setAccounts] = useState([]);
	const [show, setShow] = useState(false);
	const [label, setLabel] = useState('');
	const [selected, setSelected] = useState([]);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		const [t, a] = await Promise.all([TablesApi.list(), AccountsApi.listOpen()]);
		setTables(t);
		setAccounts(a);
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	// "Para llevar" tiene su propia vista; aquí sólo mesas de salón.
	const diningTables = tables.filter((t) => !(t.isTakeout || t.number === 0));

	const accountsByTable = (tableId) =>
		accounts.filter((a) => (a.tables || []).some((t) => t.id === tableId));

	const openModal = (presetTableId) => {
		setLabel('');
		setSelected(presetTableId ? [presetTableId] : []);
		setShow(true);
	};

	const toggleTable = (id) => {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const submit = async () => {
		if (!label.trim()) {
			swal('Atención', 'Escriba una etiqueta para la cuenta.', 'warning');
			return;
		}
		if (selected.length === 0) {
			swal('Atención', 'Seleccione al menos una mesa.', 'warning');
			return;
		}
		setSaving(true);
		try {
			const acc = await AccountsApi.open({ label: label.trim(), tableIds: selected });
			setShow(false);
			navigate(`/cuenta/${acc.id}`);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo abrir la cuenta', 'error');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0">Mapa de mesas</h3>
					<span className="text-muted">Toque una cuenta para gestionarla, o abra una nueva</span>
				</div>
				<Button variant="primary" onClick={() => openModal(null)}>
					<i className="fa-solid fa-plus me-2"></i>Abrir cuenta
				</Button>
			</div>

			<div className="d-flex gap-3 mb-3 flex-wrap">
				{Object.entries(TABLE_STATUS).map(([k, v]) => (
					<span key={k} className="d-inline-flex align-items-center">
						<span className={`badge bg-${v.color} me-1`}>&nbsp;</span> {v.label}
					</span>
				))}
			</div>

			<Row className="g-3">
				{diningTables.map((t) => {
					const meta = TABLE_STATUS[t.status] || TABLE_STATUS.free;
					const takeout = t.isTakeout || t.number === 0;
					const accs = accountsByTable(t.id);
					return (
						<Col xl={3} lg={4} md={6} key={t.id}>
							<Card className={`border-top border-3 border-${meta.color} h-100`}>
								<Card.Body>
									<div className="d-flex justify-content-between align-items-start mb-2">
										<h4 className="mb-0">{takeout ? 'Para llevar' : `Mesa ${t.number}`}</h4>
										<Badge bg={takeout ? 'primary' : meta.color}>{takeout ? 'Disponible' : meta.label}</Badge>
									</div>
									{takeout ? (
										<small className="text-muted d-block mb-2">
											<i className="fa-solid fa-bag-shopping me-1"></i>Órdenes para llevar
										</small>
									) : (
										<small className="text-muted d-block mb-2">
											<i className="bi bi-people me-1"></i>{t.capacity} personas
										</small>
									)}

									{accs.length === 0 ? (
										<p className="text-muted small mb-3">Sin cuentas abiertas</p>
									) : (
										<div className="mb-3">
											{accs.map((a) => (
												<div
													key={a.id}
													className="d-flex justify-content-between align-items-center p-2 mb-1 rounded bg-light cursor-pointer"
													style={{ cursor: 'pointer' }}
													onClick={() => navigate(`/cuenta/${a.id}`)}
												>
													<span className="text-truncate">{a.label}</span>
													<span className="font-w600">{money(a.total)}</span>
												</div>
											))}
										</div>
									)}

									<Button
										variant="outline-primary"
										size="sm"
										className="w-100"
										onClick={() => openModal(t.id)}
									>
										{takeout
											? 'Nueva orden para llevar'
											: accs.length > 0
												? 'Cuenta separada'
												: 'Abrir cuenta'}
									</Button>
								</Card.Body>
							</Card>
						</Col>
					);
				})}
			</Row>

			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>Abrir cuenta</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form.Group className="mb-3">
						<Form.Label>Etiqueta de la cuenta</Form.Label>
						<Form.Control
							placeholder="Ingrese dueño de cuenta"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</Form.Group>
					<Form.Label>Mesas (seleccione una o varias para unirlas)</Form.Label>
					<Row className="g-2">
						{diningTables.map((t) => {
							const meta = TABLE_STATUS[t.status] || TABLE_STATUS.free;
							const takeout = t.isTakeout || t.number === 0;
							const active = selected.includes(t.id);
							return (
								<Col xs={3} key={t.id}>
									<div
										className={`text-center p-2 rounded border ${active ? 'border-primary bg-primary-light' : `border-${meta.color}`}`}
										style={{ cursor: 'pointer' }}
										onClick={() => toggleTable(t.id)}
									>
										<div className="font-w600">{takeout ? 'Llevar' : `#${t.number}`}</div>
										<small className={`text-${takeout ? 'primary' : meta.color}`}>{takeout ? 'Disponible' : meta.label}</small>
									</div>
								</Col>
							);
						})}
					</Row>
					<small className="text-muted d-block mt-2">
						Puede abrir una cuenta separada sobre una mesa ya ocupada.
					</small>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="primary" onClick={submit} disabled={saving}>
						{saving ? 'Abriendo…' : 'Abrir cuenta'}
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default Mesas;

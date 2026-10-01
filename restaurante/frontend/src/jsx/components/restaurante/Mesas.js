import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Modal, Button, Form, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { TablesApi, AccountsApi } from '../../../services/RestaurantApi';
import { money, TABLE_STATUS } from '../../../services/helpers';

// Etiqueta de una mesa: nombre (Barra, Pequeña) o su número.
const tableLabel = (t) => t.name || String(t.number);

// Posiciones del croquis (porcentajes dentro de cada salón), según el plano.
const LAYOUT = {
	pequeno: {
		'Pequeña': { x: 3, y: 6, w: 15, h: 22 },
		'Barra': { x: 30, y: 4, w: 34, h: 12 },
		'3': { x: 72, y: 12, w: 24, h: 26 },
		'1': { x: 5, y: 58, w: 28, h: 32 },
		'2': { x: 40, y: 58, w: 32, h: 32 },
	},
	grande: {
		'7': { x: 4, y: 6, w: 15, h: 20 },
		'6': { x: 33, y: 6, w: 14, h: 16 },
		'5': { x: 51, y: 6, w: 14, h: 16 },
		'4': { x: 69, y: 6, w: 14, h: 16 },
		'8': { x: 12, y: 34, w: 14, h: 30 },
		'9': { x: 30, y: 34, w: 14, h: 30 },
		'10': { x: 48, y: 34, w: 15, h: 30 },
		'13': { x: 4, y: 72, w: 22, h: 24 },
		'12': { x: 32, y: 72, w: 22, h: 24 },
		'11': { x: 60, y: 72, w: 20, h: 24 },
	},
};

// Elementos decorativos (no son mesas), sólo para ubicarse.
const DECOR = {
	pequeno: [{ label: 'Baño', x: 73, y: 60, w: 22, h: 32 }],
	grande: [
		{ label: 'Tele', x: 70, y: 38, w: 12, h: 9 },
		{ label: 'Baño', x: 88, y: 64, w: 8, h: 32 },
	],
};

const STATUS_BG = { free: '#eaf7ee', occupied: '#fff6da', billing: '#fbe1e3' };

const SALONES = [
	{ key: 'pequeno', title: 'Salón Pequeño' },
	{ key: 'grande', title: 'Salón Grande' },
];

const Mesas = () => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [tables, setTables] = useState([]);
	const [accounts, setAccounts] = useState([]);
	const [show, setShow] = useState(false);
	const [label, setLabel] = useState('');
	const [selected, setSelected] = useState([]);
	const [saving, setSaving] = useState(false);
	const [detailTable, setDetailTable] = useState(null); // mesa seleccionada en el croquis

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

	// Salón de las mesas ya seleccionadas (para no unir mesas de salones distintos).
	const salonOf = (id) => diningTables.find((t) => t.id === id)?.salon;
	const selectedSalon = selected.length ? salonOf(selected[0]) : null;

	const toggleTable = (id) => {
		// Cada salón es independiente: no se pueden mezclar.
		if (!selected.includes(id) && selectedSalon && salonOf(id) !== selectedSalon) {
			swal('Atención', 'No se pueden unir mesas de salones distintos.', 'warning');
			return;
		}
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const onTableClick = (t) => {
		const accs = accountsByTable(t.id);
		if (accs.length === 0) openModal(t.id);
		else setDetailTable(t);
	};

	// Área de Caja: mesa de "para llevar" y sus órdenes.
	const takeoutTable = tables.find((t) => t.isTakeout || t.number === 0);
	const takeoutAccounts = takeoutTable ? accountsByTable(takeoutTable.id) : [];

	const newTakeout = async () => {
		if (!takeoutTable) {
			swal('Error', 'No existe una mesa "para llevar" configurada.', 'error');
			return;
		}
		try {
			const label = `Para llevar ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
			const acc = await AccountsApi.open({ label, tableIds: [takeoutTable.id] });
			navigate(`/cuenta/${acc.id}`);
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo abrir la orden', 'error');
		}
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

	const renderSalon = ({ key, title }) => {
		const positions = LAYOUT[key];
		const salonTables = diningTables.filter((t) => t.salon === key);
		return (
			<Card className="mb-4" key={key}>
				<Card.Header><Card.Title className="mb-0">{title}</Card.Title></Card.Header>
				<Card.Body>
					<div style={{ position: 'relative', width: '100%', paddingTop: '52%', border: '2px solid #dee2e6', borderRadius: 8, background: '#fcfcfc' }}>
						{(DECOR[key] || []).map((d) => (
							<div
								key={d.label}
								style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: '1px dashed #cbd3da', borderRadius: 6, color: '#adb5bd' }}
								className="d-flex align-items-center justify-content-center small"
							>
								{d.label}
							</div>
						))}
						{salonTables.map((t) => {
							const p = positions[tableLabel(t)];
							if (!p) return null;
							const meta = TABLE_STATUS[t.status] || TABLE_STATUS.free;
							const accs = accountsByTable(t.id);
							const total = accs.reduce((s, a) => s + Number(a.total), 0);
							return (
								<div
									key={t.id}
									onClick={() => onTableClick(t)}
									title={`${tableLabel(t)} · ${meta.label}`}
									style={{
										position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`,
										background: STATUS_BG[t.status] || STATUS_BG.free,
										border: `2px solid var(--bs-${meta.color})`,
										borderRadius: 8, cursor: 'pointer', overflow: 'hidden', padding: 4,
									}}
									className="d-flex flex-column align-items-center justify-content-center text-center"
								>
									<span className="fw-bold" style={{ lineHeight: 1 }}>{tableLabel(t)}</span>
									{accs.length > 0 ? (
										<span className="small text-dark">{accs.length > 1 ? `${accs.length} cuentas` : money(total)}</span>
									) : (
										<span className={`badge bg-${meta.color} mt-1`}>{meta.label}</span>
									)}
								</div>
							);
						})}
					</div>
				</Card.Body>
			</Card>
		);
	};

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0">Mapa de mesas</h3>
					<span className="text-muted">Toque una mesa para abrir o gestionar su cuenta</span>
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

			{SALONES.map(renderSalon)}

			{/* Caja: área propia (separada de los salones), aquí se hacen pedidos para llevar */}
			<Card className="mb-4">
				<Card.Header>
					<Card.Title className="mb-0"><i className="fa-solid fa-cash-register me-2"></i>Caja</Card.Title>
				</Card.Header>
				<Card.Body>
					<div style={{ position: 'relative', width: '100%', paddingTop: '22%', border: '2px solid #dee2e6', borderRadius: 8, background: '#fcfcfc' }}>
						<div
							onClick={newTakeout}
							title="Nueva orden para llevar"
							style={{
								position: 'absolute', left: '4%', top: '18%', width: '34%', height: '64%',
								background: '#fff6da', border: '2px solid var(--bs-warning)', borderRadius: 8, cursor: 'pointer',
							}}
							className="d-flex flex-column align-items-center justify-content-center text-center"
						>
							<span className="fw-bold"><i className="fa-solid fa-cash-register me-1"></i>Caja</span>
							<small className="text-muted">Toque para nueva orden para llevar</small>
						</div>
					</div>
					<div className="d-flex gap-2 mt-3 flex-wrap">
						<Button variant="primary" onClick={newTakeout}>
							<i className="fa-solid fa-bag-shopping me-1"></i>Nueva orden para llevar
						</Button>
						<Button variant="outline-secondary" onClick={() => navigate('/para-llevar')}>
							<i className="fa-solid fa-list me-1"></i>Ver para llevar{takeoutAccounts.length > 0 ? ` (${takeoutAccounts.length})` : ''}
						</Button>
					</div>
				</Card.Body>
			</Card>

			{/* Modal detalle de mesa ocupada */}
			<Modal show={!!detailTable} onHide={() => setDetailTable(null)} centered>
				<Modal.Header closeButton>
					<Modal.Title>{detailTable ? `Mesa ${tableLabel(detailTable)}` : ''}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					{detailTable && accountsByTable(detailTable.id).map((a) => (
						<div
							key={a.id}
							className="d-flex justify-content-between align-items-center p-2 mb-2 rounded bg-light"
							style={{ cursor: 'pointer' }}
							onClick={() => navigate(`/cuenta/${a.id}`)}
						>
							<span className="text-truncate">{a.label}</span>
							<span className="font-w600">{money(a.total)}</span>
						</div>
					))}
					<Button
						variant="outline-primary"
						className="w-100 mt-2"
						onClick={() => { const id = detailTable.id; setDetailTable(null); openModal(id); }}
					>
						<i className="fa-solid fa-plus me-1"></i>Cuenta separada
					</Button>
				</Modal.Body>
			</Modal>

			{/* Modal abrir cuenta */}
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
					{SALONES.map(({ key, title }) => {
						const salonTables = diningTables.filter((t) => t.salon === key);
						if (salonTables.length === 0) return null;
						return (
							<div key={key} className="mb-3">
								<div className="text-muted small fw-bold mb-1">{title}</div>
								<Row className="g-2">
									{salonTables.map((t) => {
										const meta = TABLE_STATUS[t.status] || TABLE_STATUS.free;
										const active = selected.includes(t.id);
										return (
											<Col xs={3} key={t.id}>
												<div
													className={`text-center p-2 rounded border ${active ? 'border-primary bg-primary-light' : `border-${meta.color}`}`}
													style={{ cursor: 'pointer' }}
													onClick={() => toggleTable(t.id)}
												>
													<div className="font-w600">{tableLabel(t)}</div>
													<small className={`text-${meta.color}`}>{meta.label}</small>
												</div>
											</Col>
										);
									})}
								</Row>
							</div>
						);
					})}
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

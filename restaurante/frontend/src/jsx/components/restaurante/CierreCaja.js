import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Form, Spinner, Modal } from 'react-bootstrap';
import swal from 'sweetalert';
import { CashApi } from '../../../services/RestaurantApi';
import { money, fmtDateTime, getCurrentUser, ROLES } from '../../../services/helpers';

const CierreCaja = () => {
	const isAdmin = getCurrentUser().role === ROLES.ADMIN;
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState(null);
	const [history, setHistory] = useState([]);
	const [counted, setCounted] = useState('');
	const [countedCard, setCountedCard] = useState('');
	const [countedTransfer, setCountedTransfer] = useState('');
	const [notes, setNotes] = useState('');
	const [saving, setSaving] = useState(false);
	// edición de un cierre
	const [editC, setEditC] = useState(null);
	const [ec, setEc] = useState({ countedCash: '', countedCard: '', countedTransfer: '', notes: '' });

	const openEditClosing = (c) => {
		setEditC(c);
		setEc({
			countedCash: c.countedCash != null ? Number(c.countedCash).toFixed(2) : '',
			countedCard: c.countedCard != null ? Number(c.countedCard).toFixed(2) : '',
			countedTransfer: c.countedTransfer != null ? Number(c.countedTransfer).toFixed(2) : '',
			notes: c.notes || '',
		});
	};
	const saveEditClosing = async () => {
		try {
			await CashApi.update(editC.id, {
				countedCash: ec.countedCash !== '' ? Number(ec.countedCash) : undefined,
				countedCard: ec.countedCard !== '' ? Number(ec.countedCard) : undefined,
				countedTransfer: ec.countedTransfer !== '' ? Number(ec.countedTransfer) : undefined,
				notes: ec.notes || undefined,
			});
			setEditC(null);
			await load();
			swal('Guardado', 'El cierre se actualizó y quedó en la bitácora.', 'success');
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo editar el cierre', 'error');
		}
	};

	const load = useCallback(async () => {
		const [s, h] = await Promise.all([CashApi.summary(), CashApi.list()]);
		setSummary(s);
		setHistory(h);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const doClose = async () => {
		swal({
			title: '¿Cerrar caja?',
			text: 'Se registrará un cierre con los totales y el conteo ingresado.',
			icon: 'info',
			buttons: ['Cancelar', 'Cerrar caja'],
			closeOnClickOutside: false,
			closeOnEsc: false,
		}).then(async (ok) => {
			if (!ok) return;
			setSaving(true);
			try {
				await CashApi.create({
					countedCash: counted !== '' ? Number(counted) : undefined,
					countedCard: countedCard !== '' ? Number(countedCard) : undefined,
					countedTransfer: countedTransfer !== '' ? Number(countedTransfer) : undefined,
					notes: notes || undefined,
				});
				setCounted('');
				setCountedCard('');
				setCountedTransfer('');
				setNotes('');
				await load();
				swal('Listo', 'Cierre de caja registrado.', 'success');
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo cerrar la caja', 'error');
			} finally {
				setSaving(false);
			}
		});
	};

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	// Efectivo esperado = efectivo cobrado - salidas de efectivo a motoristas.
	const expectedCash = summary.expectedCash != null ? summary.expectedCash : summary.totalCash;

	// Fila de conciliación por método: esperado vs contado.
	const rows = [
		{ key: 'cash', label: 'Efectivo', expected: expectedCash, value: counted, set: setCounted, hint: summary.courierCash > 0 ? `Ya resta ${money(summary.courierCash)} de efectivo a motoristas` : '' },
		{ key: 'card', label: 'Tarjeta (vouchers)', expected: summary.totalCard, value: countedCard, set: setCountedCard, hint: 'Sume los vouchers' },
		{ key: 'transfer', label: 'Transferencias (comprobantes)', expected: summary.totalTransfer, value: countedTransfer, set: setCountedTransfer, hint: 'Sume los comprobantes' },
	];

	const diffOf = (r) => (r.value !== '' ? Number(r.value) - Number(r.expected) : null);

	return (
		<>
			<h3 className="mb-3">Cierre de caja</h3>

			<Card className="mb-4">
				<Card.Header><Card.Title className="mb-0">Movimiento desde el último cierre</Card.Title></Card.Header>
				<Card.Body>
					<Row className="text-center">
						<Col xs={6} md={3} className="mb-2">
							<h4 className="mb-0 text-success">{money(summary.totalCash)}</h4>
							<small className="text-muted">Efectivo cobrado</small>
						</Col>
						<Col xs={6} md={3} className="mb-2">
							<h4 className="mb-0 text-info">{money(summary.totalCard)}</h4>
							<small className="text-muted">Tarjeta</small>
						</Col>
						<Col xs={6} md={3} className="mb-2">
							<h4 className="mb-0 text-detail">{money(summary.totalTransfer)}</h4>
							<small className="text-muted">Transferencia</small>
						</Col>
						<Col xs={6} md={3} className="mb-2">
							<h4 className="mb-0 text-primary">{money(summary.totalSales)}</h4>
							<small className="text-muted">Total ({summary.paymentsCount} cobros)</small>
						</Col>
					</Row>
					<div className="d-flex gap-3 justify-content-center flex-wrap mt-2">
						<span className="badge bg-warning text-dark fs-6">Propinas: {money(summary.totalTips)}</span>
						{summary.courierCash > 0 && (
							<span className="badge bg-secondary fs-6">Efectivo a motoristas: -{money(summary.courierCash)}</span>
						)}
					</div>
				</Card.Body>
			</Card>

			<Card className="mb-4">
				<Card.Header><Card.Title className="mb-0">Registrar cierre — conteo por método</Card.Title></Card.Header>
				<Card.Body>
					<Table responsive className="align-middle mb-3">
						<thead>
							<tr>
								<th>Método</th>
								<th className="text-end">Esperado (sistema)</th>
								<th style={{ width: 200 }}>Contado</th>
								<th className="text-end">Diferencia</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => {
								const d = diffOf(r);
								return (
									<tr key={r.key}>
										<td>
											<div className="font-w600">{r.label}</div>
											{r.hint && <small className="text-muted">{r.hint}</small>}
										</td>
										<td className="text-end font-w600">{money(r.expected)}</td>
										<td>
											<Form.Control
												type="number"
												step="0.01"
												placeholder="0.00"
												value={r.value}
												onChange={(e) => r.set(e.target.value)}
											/>
										</td>
										<td className="text-end">
											{d === null ? (
												<span className="text-muted">—</span>
											) : (
												<strong className={d === 0 ? 'text-success' : 'text-danger'}>
													{d > 0 ? '+' : ''}{money(d)}
												</strong>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</Table>

					<Row className="align-items-end g-3">
						<Col md={8}>
							<Form.Group>
								<Form.Label>Notas</Form.Label>
								<Form.Control as="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del cierre (opcional)" />
							</Form.Group>
						</Col>
						<Col md={4} className="text-md-end">
							<Button variant="success" size="lg" className="w-100 w-md-auto" onClick={doClose} disabled={saving}>
								{saving ? 'Cerrando…' : 'Cerrar caja'}
							</Button>
						</Col>
					</Row>
				</Card.Body>
			</Card>

			<Card>
				<Card.Header><Card.Title className="mb-0">Historial de cierres</Card.Title></Card.Header>
				<Card.Body>
					{history.length === 0 ? (
						<p className="text-muted mb-0">Sin cierres registrados.</p>
					) : (
						<Table responsive hover>
							<thead>
								<tr>
									<th>Fecha</th>
									<th>Responsable</th>
									<th className="text-end">Efectivo</th>
									<th className="text-end">Tarjeta</th>
									<th className="text-end">Transferencia</th>
									<th className="text-end">Propinas</th>
									<th className="text-end">Total</th>
									<th className="text-end">Dif. efectivo</th>
									{isAdmin && <th className="text-end">Acciones</th>}
								</tr>
							</thead>
							<tbody>
								{history.map((c) => (
									<tr key={c.id}>
										<td>{fmtDateTime(c.date)}</td>
										<td>{c.user?.name || '-'}</td>
										<td className="text-end">{money(c.totalCash)}</td>
										<td className="text-end">{money(c.totalCard)}</td>
										<td className="text-end">{money(c.totalTransfer)}</td>
										<td className="text-end">{money(c.totalTips)}</td>
										<td className="text-end font-w600">{money(c.totalSales)}</td>
										<td className={`text-end ${Number(c.difference) !== 0 ? 'text-danger' : ''}`}>{money(c.difference)}</td>
										{isAdmin && (
											<td className="text-end">
												<Button size="sm" variant="light" onClick={() => openEditClosing(c)}>
													<i className="bi bi-pencil"></i>
												</Button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</Table>
					)}
				</Card.Body>
			</Card>
					<Modal show={!!editC} onHide={() => setEditC(null)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Editar cierre</Modal.Title></Modal.Header>
				<Modal.Body>
					<p className="text-muted small">Solo se edita el conteo y la nota. Queda registrado en la bitácora.</p>
					<Form.Group className="mb-2"><Form.Label>Contado efectivo (Q)</Form.Label><Form.Control type="number" step="0.01" min={0} value={ec.countedCash} onChange={(e) => setEc({ ...ec, countedCash: e.target.value })} /></Form.Group>
					<Form.Group className="mb-2"><Form.Label>Contado tarjeta (Q)</Form.Label><Form.Control type="number" step="0.01" min={0} value={ec.countedCard} onChange={(e) => setEc({ ...ec, countedCard: e.target.value })} /></Form.Group>
					<Form.Group className="mb-2"><Form.Label>Contado transferencia (Q)</Form.Label><Form.Control type="number" step="0.01" min={0} value={ec.countedTransfer} onChange={(e) => setEc({ ...ec, countedTransfer: e.target.value })} /></Form.Group>
					<Form.Group><Form.Label>Nota</Form.Label><Form.Control as="textarea" rows={2} value={ec.notes} onChange={(e) => setEc({ ...ec, notes: e.target.value })} /></Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setEditC(null)}>Cancelar</Button>
					<Button variant="primary" onClick={saveEditClosing}>Guardar</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default CierreCaja;

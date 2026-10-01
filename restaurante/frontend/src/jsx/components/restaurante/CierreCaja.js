import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Form, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { CashApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

const CierreCaja = () => {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState(null);
	const [history, setHistory] = useState([]);
	const [counted, setCounted] = useState('');
	const [countedCard, setCountedCard] = useState('');
	const [countedTransfer, setCountedTransfer] = useState('');
	const [notes, setNotes] = useState('');
	const [saving, setSaving] = useState(false);

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
								</tr>
							</thead>
							<tbody>
								{history.map((c) => (
									<tr key={c.id}>
										<td>{new Date(c.date).toLocaleString('es-GT')}</td>
										<td>{c.user?.name || '-'}</td>
										<td className="text-end">{money(c.totalCash)}</td>
										<td className="text-end">{money(c.totalCard)}</td>
										<td className="text-end">{money(c.totalTransfer)}</td>
										<td className="text-end">{money(c.totalTips)}</td>
										<td className="text-end font-w600">{money(c.totalSales)}</td>
										<td className={`text-end ${Number(c.difference) !== 0 ? 'text-danger' : ''}`}>{money(c.difference)}</td>
									</tr>
								))}
							</tbody>
						</Table>
					)}
				</Card.Body>
			</Card>
		</>
	);
};

export default CierreCaja;

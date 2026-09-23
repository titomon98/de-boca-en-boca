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
			text: 'Se registrará un cierre con los totales actuales.',
			icon: 'info',
			buttons: ['Cancelar', 'Cerrar caja'],
		}).then(async (ok) => {
			if (!ok) return;
			setSaving(true);
			try {
				await CashApi.create({
					countedCash: counted !== '' ? Number(counted) : undefined,
					notes: notes || undefined,
				});
				setCounted('');
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

	const expectedCash = summary.totalCash;
	const diff = counted !== '' ? Number(counted) - expectedCash : null;

	return (
		<>
			<h3 className="mb-3">Cierre de caja</h3>
			<Row>
				<Col lg={7}>
					<Card>
						<Card.Header><Card.Title>Movimiento desde el último cierre</Card.Title></Card.Header>
						<Card.Body>
							<Row className="text-center">
								<Col xs={6} md={3} className="mb-3">
									<h4 className="mb-0 text-success">{money(summary.totalCash)}</h4>
									<small className="text-muted">Efectivo</small>
								</Col>
								<Col xs={6} md={3} className="mb-3">
									<h4 className="mb-0 text-info">{money(summary.totalCard)}</h4>
									<small className="text-muted">Tarjeta</small>
								</Col>
								<Col xs={6} md={3} className="mb-3">
									<h4 className="mb-0 text-warning">{money(summary.totalOther)}</h4>
									<small className="text-muted">Otros</small>
								</Col>
								<Col xs={6} md={3} className="mb-3">
									<h4 className="mb-0 text-primary">{money(summary.totalSales)}</h4>
									<small className="text-muted">Total ({summary.paymentsCount} cobros)</small>
								</Col>
							</Row>
						</Card.Body>
					</Card>
				</Col>
				<Col lg={5}>
					<Card>
						<Card.Header><Card.Title>Registrar cierre</Card.Title></Card.Header>
						<Card.Body>
							<Form.Group className="mb-3">
								<Form.Label>Efectivo contado (opcional)</Form.Label>
								<Form.Control type="number" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} />
							</Form.Group>
							{diff !== null && (
								<p className={`mb-3 ${diff === 0 ? 'text-success' : 'text-danger'}`}>
									Diferencia vs. esperado: <strong>{money(diff)}</strong>
								</p>
							)}
							<Form.Group className="mb-3">
								<Form.Label>Notas</Form.Label>
								<Form.Control as="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
							</Form.Group>
							<Button variant="primary" className="w-100" onClick={doClose} disabled={saving}>
								{saving ? 'Cerrando…' : 'Cerrar caja'}
							</Button>
						</Card.Body>
					</Card>
				</Col>
			</Row>

			<Card>
				<Card.Header><Card.Title>Historial de cierres</Card.Title></Card.Header>
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
									<th className="text-end">Total</th>
									<th className="text-end">Diferencia</th>
								</tr>
							</thead>
							<tbody>
								{history.map((c) => (
									<tr key={c.id}>
										<td>{new Date(c.date).toLocaleString('es-GT')}</td>
										<td>{c.user?.name || '—'}</td>
										<td className="text-end">{money(c.totalCash)}</td>
										<td className="text-end">{money(c.totalCard)}</td>
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

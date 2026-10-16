import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Badge, Spinner, Form, Row, Col, Modal } from 'react-bootstrap';
import swal from 'sweetalert';
import { PaymentsApi } from '../../../services/RestaurantApi';
import { money, fmtDateTime, todayGuatemala, PAYMENT_METHODS, paymentLabel } from '../../../services/helpers';

const accountTables = (a) =>
	(a?.tables || [])
		.map((t) => (t.isTakeout || t.number === 0 ? 'Para llevar' : t.name || `Mesa ${t.number}`))
		.join(', ') || '-';

/**
 * Cobros registrados: permite corregir (monto, método, propina) o anular un
 * cobro mal hecho y luego volver a cobrar desde la cuenta. Todo cambio queda en
 * la bitácora de la cuenta.
 */
const Cobros = () => {
	const navigate = useNavigate();
	const [from, setFrom] = useState(todayGuatemala());
	const [to, setTo] = useState(todayGuatemala());
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [edit, setEdit] = useState(null); // cobro en edición
	const [form, setForm] = useState({ amount: '', paymentMethod: 'cash', tip: '' });
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setRows(await PaymentsApi.list(from || undefined, to || undefined));
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudieron cargar los cobros', 'error');
		} finally {
			setLoading(false);
		}
	}, [from, to]);

	useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

	const openEdit = (p) => {
		setEdit(p);
		setForm({
			amount: Number(p.amount).toFixed(2),
			paymentMethod: p.paymentMethod,
			tip: Number(p.tip || 0).toFixed(2),
		});
	};

	const saveEdit = async () => {
		const amount = Number(form.amount);
		if (!amount || amount <= 0) {
			swal('Atención', 'Ingrese un monto válido.', 'warning');
			return;
		}
		setSaving(true);
		try {
			await PaymentsApi.update(edit.id, {
				amount,
				paymentMethod: form.paymentMethod,
				tip: Number(form.tip) || 0,
			});
			setEdit(null);
			await load();
			swal('Corregido', 'El cobro se corrigió y quedó en la bitácora.', 'success');
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo corregir el cobro', 'error');
		} finally {
			setSaving(false);
		}
	};

	const voidPayment = (p) => {
		swal({
			title: '¿Anular este cobro?',
			text: `${money(p.amount)} (${paymentLabel(p.paymentMethod)}) de "${p.account?.label || ''}". La cuenta volverá a quedar con saldo pendiente para cobrarla de nuevo. Queda en la bitácora.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Anular cobro'],
			closeOnClickOutside: false,
			closeOnEsc: false,
			dangerMode: true,
		}).then(async (ok) => {
			if (!ok) return;
			try {
				await PaymentsApi.void(p.id);
				await load();
				swal({
					title: 'Cobro anulado',
					text: '¿Quiere ir a la cuenta para volver a cobrar?',
					icon: 'success',
					buttons: ['Quedarme aquí', 'Ir a la cuenta'],
					closeOnClickOutside: false,
					closeOnEsc: false,
				}).then((go) => { if (go) navigate(`/cuenta/${p.accountId}`); });
			} catch (e) {
				swal('Error', e?.response?.data?.message || 'No se pudo anular el cobro', 'error');
			}
		});
	};

	const total = rows.reduce((s, p) => s + Number(p.amount), 0);
	const tips = rows.reduce((s, p) => s + Number(p.tip || 0), 0);

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<div>
					<h3 className="mb-0">Cobros</h3>
					<span className="text-muted">Corrija o anule cobros registrados. Todo queda en la bitácora.</span>
				</div>
			</div>

			<Card>
				<Card.Body>
					<Row className="g-2 align-items-end mb-3">
						<Col xs={6} md={3}>
							<Form.Label className="mb-1">Desde</Form.Label>
							<Form.Control type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
						</Col>
						<Col xs={6} md={3}>
							<Form.Label className="mb-1">Hasta</Form.Label>
							<Form.Control type="date" value={to} onChange={(e) => setTo(e.target.value)} />
						</Col>
						<Col xs={12} md={3}>
							<Button variant="primary" onClick={load}><i className="fa-solid fa-magnifying-glass me-1"></i>Buscar</Button>
						</Col>
						<Col xs={12} md={3} className="text-md-end">
							<div className="small text-muted">Cobrado</div>
							<div className="fw-bold">{money(total)} {tips > 0 && <small className="text-muted">+ propina {money(tips)}</small>}</div>
						</Col>
					</Row>

					{loading ? (
						<div className="text-center p-4"><Spinner animation="border" variant="primary" /></div>
					) : rows.length === 0 ? (
						<p className="text-muted mb-0">No hay cobros en ese rango.</p>
					) : (
						<Table responsive hover className="align-middle">
							<thead>
								<tr>
									<th>Fecha</th>
									<th>Cuenta</th>
									<th>Mesas</th>
									<th>Método</th>
									<th className="text-end">Monto</th>
									<th className="text-end">Propina</th>
									<th>Cobró</th>
									<th className="text-end">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((p) => (
									<tr key={p.id}>
										<td className="small text-muted">{fmtDateTime(p.date)}</td>
										<td className="font-w600">
											{p.account?.label || `#${p.accountId}`}
											{(p.itemIds || []).length > 0 && <Badge bg="light" text="dark" className="ms-1">Por productos</Badge>}
										</td>
										<td>{accountTables(p.account)}</td>
										<td>{paymentLabel(p.paymentMethod)}</td>
										<td className="text-end">{money(p.amount)}</td>
										<td className="text-end">{Number(p.tip) > 0 ? money(p.tip) : '-'}</td>
										<td>{p.user?.name || '-'}</td>
										<td className="text-end text-nowrap">
											<Button size="sm" variant="light" className="me-1" title="Ver cuenta" onClick={() => navigate(`/cuenta/${p.accountId}`)}>
												<i className="fa-solid fa-eye"></i>
											</Button>
											<Button size="sm" variant="light" className="me-1" title="Corregir" onClick={() => openEdit(p)}>
												<i className="bi bi-pencil"></i>
											</Button>
											<Button size="sm" variant="light" className="text-danger" title="Anular" onClick={() => voidPayment(p)}>
												<i className="bi bi-x-circle"></i>
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					)}
				</Card.Body>
			</Card>

			<Modal show={!!edit} onHide={() => setEdit(null)} centered backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Corregir cobro</Modal.Title></Modal.Header>
				<Modal.Body>
					{edit && (
						<p className="text-muted small">
							Cuenta "{edit.account?.label}" · {fmtDateTime(edit.date)}. El cambio queda en la bitácora.
						</p>
					)}
					<Form.Group className="mb-2">
						<Form.Label>Monto (Q)</Form.Label>
						<Form.Control
							type="number"
							step="0.01"
							min={0}
							value={form.amount}
							disabled={(edit?.itemIds || []).length > 0}
							onChange={(e) => setForm({ ...form, amount: e.target.value })}
						/>
						{(edit?.itemIds || []).length > 0 && (
							<Form.Text className="text-muted">Cobro por productos: el monto no se edita. Para cambiarlo, anúlelo y vuelva a cobrar.</Form.Text>
						)}
					</Form.Group>
					<Form.Group className="mb-2">
						<Form.Label>Forma de pago</Form.Label>
						<Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
							{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
						</Form.Select>
					</Form.Group>
					<Form.Group>
						<Form.Label>Propina (Q)</Form.Label>
						<Form.Control type="number" step="0.01" min={0} value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })} />
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setEdit(null)}>Cancelar</Button>
					<Button variant="success" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default Cobros;

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Form, Button, Spinner, Row, Col } from 'react-bootstrap';
import swal from 'sweetalert';
import { SettingsApi } from '../../../services/RestaurantApi';
import { printTicket } from '../../../services/printTicket';

const Configuracion = () => {
	const [loading, setLoading] = useState(true);
	const [printComandas, setPrintComandas] = useState(false);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		const s = await SettingsApi.get();
		setPrintComandas(s.print_comandas === 'true');
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const save = async () => {
		setSaving(true);
		try {
			await SettingsApi.update({ print_comandas: printComandas ? 'true' : 'false' });
			swal('Guardado', 'La configuración se actualizó.', 'success');
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo guardar', 'error');
		} finally {
			setSaving(false);
		}
	};

	const testPrint = () => {
		printTicket({
			id: 0,
			createdAt: new Date().toISOString(),
			notes: 'Ticket de prueba',
			waiter: { name: 'Prueba' },
			account: { tables: [{ number: 1 }] },
			items: [
				{ quantity: 2, menuItem: { name: 'Carne asada' }, notes: 'término medio' },
				{ quantity: 1, menuItem: { name: 'Limonada' } },
			],
		});
	};

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	return (
		<>
			<h3 className="mb-3">Configuración</h3>
			<Row>
				<Col lg={8}>
					<Card>
						<Card.Header><Card.Title>Impresión de comandas</Card.Title></Card.Header>
						<Card.Body>
							<Form.Check
								type="switch"
								id="print-comandas"
								className="mb-2"
								label="Imprimir automáticamente las comandas al enviarlas a cocina"
								checked={printComandas}
								onChange={(e) => setPrintComandas(e.target.checked)}
							/>
							<p className="text-muted small">
								Si está activado, cada comanda nueva se enviará a la impresora de tickets
								configurada como predeterminada en el equipo de cocina (además de mostrarse
								en pantalla). Si está desactivado, las comandas sólo aparecen en pantalla.
							</p>
							<div className="d-flex gap-2 mt-3">
								<Button variant="primary" onClick={save} disabled={saving}>
									{saving ? 'Guardando…' : 'Guardar'}
								</Button>
								<Button variant="outline-secondary" onClick={testPrint}>
									<i className="fa-solid fa-print me-1"></i>Imprimir ticket de prueba
								</Button>
							</div>
						</Card.Body>
					</Card>
				</Col>
			</Row>
		</>
	);
};

export default Configuracion;

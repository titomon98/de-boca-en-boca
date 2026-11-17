import React from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';
import { printTicket, printReceipt } from '../../../services/printTicket';

/**
 * Impresión: todo se imprime por el puente de la computadora del restaurante
 * (comandas automáticas a cocina/barra y recibos a caja). Aquí solo se prueba
 * cada impresora.
 */
const testOrder = {
	id: 0,
	createdAt: new Date().toISOString(),
	notes: 'Ticket de prueba',
	waiter: { name: 'Prueba' },
	account: { tables: [{ number: 1 }] },
	items: [{ quantity: 1, menuItem: { name: 'Prueba de impresora' } }],
};

const Configuracion = () => (
	<>
		<h3 className="mb-3">Configuración</h3>
		<Row>
			<Col lg={8}>
				<Card>
					<Card.Header><Card.Title>Impresoras</Card.Title></Card.Header>
					<Card.Body>
						<p className="text-muted small">
							Las comandas se imprimen solas en cocina y barra al enviarlas, y el recibo se
							imprime en caja al presionar "Imprimir recibo". Todo pasa por el puente de
							impresión de la computadora del restaurante, que debe estar encendida.
						</p>
						<div className="d-flex gap-2 flex-wrap">
							<Button variant="outline-secondary" onClick={() => printTicket(testOrder, { station: 'cocina' })}>
								<i className="fa-solid fa-print me-1"></i>Probar cocina
							</Button>
							<Button variant="outline-secondary" onClick={() => printTicket(testOrder, { station: 'barra' })}>
								<i className="fa-solid fa-print me-1"></i>Probar barra
							</Button>
							<Button
								variant="outline-secondary"
								onClick={() => printReceipt({ orderId: 0, lines: [{ quantity: 1, name: 'Prueba de impresora', subtotal: 0 }], productTotal: 0, total: 0 })}
							>
								<i className="fa-solid fa-print me-1"></i>Probar caja
							</Button>
						</div>
					</Card.Body>
				</Card>
			</Col>
		</Row>
	</>
);

export default Configuracion;

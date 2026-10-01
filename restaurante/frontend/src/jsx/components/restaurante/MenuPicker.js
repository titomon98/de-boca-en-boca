import React, { useState } from 'react';
import { Card, Nav, Row, Col, Badge } from 'react-bootstrap';
import { money } from '../../../services/helpers';

/**
 * Menú táctil del mesero (pensado para tablet):
 *  - Categorías arriba (incluye "Todos").
 *  - Grid de productos con foto y descripción breve; UN toque agrega.
 *  - Abajo, los productos ya agregados; un toque los quita (uno a uno).
 *
 * Props:
 *   categories, menu   -> catálogo
 *   cart               -> [{ lineId, menuItem, quantity, choices }]
 *   onAdd(item)        -> agrega (CuentaDetail decide si pide opciones)
 *   onRemove(lineId)   -> quita uno
 */
const MenuPicker = ({ categories, menu, cart, onAdd, onRemove }) => {
	const [activeCat, setActiveCat] = useState('all');

	const filtered = activeCat === 'all' ? menu : menu.filter((m) => m.categoryId === Number(activeCat));
	const nameById = Object.fromEntries((menu || []).map((x) => [x.id, x.name]));
	const comboText = (item) =>
		(item.combo?.components || [])
			.map((c) => `${c.quantity > 1 ? `${c.quantity} ` : ''}${nameById[c.itemId] || 'producto'}`)
			.join(', ');

	// Cantidad ya agregada de un producto (sumando todas sus líneas en el carrito).
	const qtyInCart = (id) => cart.filter((x) => x.menuItem.id === id).reduce((s, x) => s + x.quantity, 0);

	return (
		<>
			{/* Categorías */}
			<Nav variant="pills" className="mb-3 flex-wrap gap-1">
				<Nav.Item>
					<Nav.Link active={activeCat === 'all'} onClick={() => setActiveCat('all')}>Todos</Nav.Link>
				</Nav.Item>
				{categories.map((c) => (
					<Nav.Item key={c.id}>
						<Nav.Link active={activeCat === String(c.id)} onClick={() => setActiveCat(String(c.id))}>
							{c.name}
						</Nav.Link>
					</Nav.Item>
				))}
			</Nav>

			{/* Grid de productos: un toque agrega */}
			<Row className="g-2 mb-3">
				{filtered.map((m) => {
					const qty = qtyInCart(m.id);
					return (
					<Col xs={6} md={4} lg={3} key={m.id}>
						<Card
							className={`h-100 menu-pick-card ${qty > 0 ? 'border-success border-2' : ''}`}
							style={{ cursor: 'pointer', position: 'relative' }}
							onClick={() => onAdd(m)}
							title="Toque para agregar"
						>
							{qty > 0 && (
								<span
									className="badge bg-success"
									style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, fontSize: 13, minWidth: 22 }}
								>
									{qty}
								</span>
							)}
							{m.image ? (
								<Card.Img
									variant="top"
									src={m.image}
									style={{ height: 90, objectFit: 'cover' }}
								/>
							) : (
								<div className="d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: 90 }}>
									<i className="fa-solid fa-utensils fa-2x"></i>
								</div>
							)}
							<Card.Body className="p-2">
								<div className="d-flex justify-content-between align-items-start">
									<span className="font-w600 small">{m.name}</span>
									{m.combo?.components?.length > 0 && (
										<Badge bg="warning" text="dark">Combo</Badge>
									)}
								</div>
								<div className="text-primary font-w600 small">{money(m.price)}</div>
								{m.description && (
									<div className="text-muted" style={{ fontSize: 11, lineHeight: 1.2 }}>{m.description}</div>
								)}
								{m.combo?.components?.length > 0 && (
									<div className="text-muted" style={{ fontSize: 11 }}>Contiene: {comboText(m)}</div>
								)}
								{m.choiceGroups?.length > 0 && (
									<div className="text-primary" style={{ fontSize: 11 }}>
										A elegir: {m.choiceGroups.map((g) => (g.choose > 1 ? `${g.choose} ${g.label}` : g.label)).join(', ')}
									</div>
								)}
							</Card.Body>
						</Card>
					</Col>
					);
				})}
			</Row>

			{/* Agregados: un toque quita */}
			<div className="border-top pt-2">
				<div className="text-muted small mb-2">
					Productos agregados <span className="text-muted">(toque uno para quitarlo)</span>
				</div>
				{cart.length === 0 ? (
					<p className="text-muted small mb-0">Aún no ha agregado productos.</p>
				) : (
					<Row className="g-2">
						{cart.map((x) => (
							<Col xs={6} md={4} lg={3} key={x.lineId}>
								<Card
									className="h-100 border-success"
									style={{ cursor: 'pointer' }}
									onClick={() => onRemove(x.lineId)}
									title="Toque para quitar uno"
								>
									<Card.Body className="p-2">
										<div className="d-flex justify-content-between align-items-start">
											<span className="font-w600 small text-truncate">{x.menuItem.name}</span>
											<Badge bg="success">{x.quantity}</Badge>
										</div>
										{(x.choices || []).length > 0 && (
											<div className="text-primary" style={{ fontSize: 11 }}>{x.choices.join('; ')}</div>
										)}
										<div className="text-danger" style={{ fontSize: 11 }}>
											<i className="fa-solid fa-xmark me-1"></i>Quitar
										</div>
									</Card.Body>
								</Card>
							</Col>
						))}
					</Row>
				)}
			</div>
		</>
	);
};

export default MenuPicker;

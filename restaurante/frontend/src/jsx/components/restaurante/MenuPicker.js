import React, { useState } from 'react';
import { Card, Nav, Row, Col, Badge, Modal, Button } from 'react-bootstrap';
import { money } from '../../../services/helpers';

/**
 * Menú táctil del mesero (pensado para tablet):
 *  - Categorías arriba (incluye "Todos").
 *  - Grid de productos con foto y descripción breve; UN toque agrega.
 *  - Productos con el mismo `grupo` se muestran como UNA tarjeta (ej. "Cervezas",
 *    "Gaseosas", "Alitas"); al tocarla, un modal lista las variantes y se elige.
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
	// Variantes del grupo abierto (modal de elección de variante), o null.
	const [groupModal, setGroupModal] = useState(null);

	// Solo productos vendibles en el grid. Los de Q0 (sabores, componentes) no se
	// venden sueltos: existen únicamente como opciones de elección.
	const sellable = (menu || []).filter((m) => Number(m.price) > 0);
	const filtered = activeCat === 'all' ? sellable : sellable.filter((m) => m.categoryId === Number(activeCat));
	const nameById = Object.fromEntries((menu || []).map((x) => [x.id, x.name]));
	const comboText = (item) =>
		(item.combo?.components || [])
			.map((c) => `${c.quantity > 1 ? `${c.quantity} ` : ''}${nameById[c.itemId] || 'producto'}`)
			.join(', ');

	// Cantidad ya agregada de un producto (sumando todas sus líneas en el carrito).
	const qtyInCart = (id) => cart.filter((x) => x.menuItem.id === id).reduce((s, x) => s + x.quantity, 0);

	// Arma la lista de tarjetas: agrupa por `grupo` (una tarjeta por grupo) y deja
	// sueltos los demás, conservando el orden de aparición.
	const entries = [];
	const groupIndex = {};
	for (const m of filtered) {
		if (m.grupo) {
			if (groupIndex[m.grupo] == null) {
				groupIndex[m.grupo] = entries.length;
				entries.push({ kind: 'group', grupo: m.grupo, items: [m] });
			} else {
				entries[groupIndex[m.grupo]].items.push(m);
			}
		} else {
			entries.push({ kind: 'single', item: m });
		}
	}

	const groupQty = (items) => items.reduce((s, m) => s + qtyInCart(m.id), 0);
	const groupPriceLabel = (items) => {
		const prices = items.map((m) => Number(m.price));
		const min = Math.min(...prices);
		const max = Math.max(...prices);
		return min === max ? money(min) : `desde ${money(min)}`;
	};

	// Imagen representativa del grupo (primera variante con foto).
	const groupImage = (items) => items.find((m) => m.image)?.image;

	// Variante con sabor/aderezo: cierra el grupo y pasa al modal de opciones.
	const pickVariant = (item) => {
		setGroupModal(null);
		onAdd(item);
	};
	// Línea del carrito de un producto simple (sin elecciones), para poder quitar.
	const simpleLineId = (id) => cart.find((x) => x.menuItem.id === id && (x.chosenItemIds || []).length === 0)?.lineId;
	// Última línea agregada de un producto (con o sin opciones), para el botón Quitar rápido.
	const lastLineId = (id) => [...cart].reverse().find((x) => x.menuItem.id === id)?.lineId;

	const renderProductCard = (m) => {
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
						<span className="badge bg-success" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, fontSize: 13, minWidth: 22 }}>{qty}</span>
					)}
					{m.image ? (
						<Card.Img variant="top" src={m.image} style={{ height: 90, objectFit: 'cover' }} />
					) : (
						<div className="d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: 90 }}>
							<i className="fa-solid fa-utensils fa-2x"></i>
						</div>
					)}
					<Card.Body className="p-2">
						<div className="d-flex justify-content-between align-items-start">
							<span className="font-w600 small">{m.name}</span>
							{m.combo?.components?.length > 0 && <Badge bg="warning" text="dark">Combo</Badge>}
						</div>
						<div className="text-primary font-w600 small">{money(m.price)}</div>
						{m.description && <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.2 }}>{m.description}</div>}
						{m.combo?.components?.length > 0 && <div className="text-muted" style={{ fontSize: 11 }}>Contiene: {comboText(m)}</div>}
						{m.choiceGroups?.length > 0 && (
							<div className="text-primary" style={{ fontSize: 11 }}>
								A elegir: {m.choiceGroups.map((g) => (g.choose > 1 ? `${g.choose} ${g.label}` : g.label)).join(', ')}
							</div>
						)}
						{qty > 0 && (
							<div className="mt-2" onClick={(e) => e.stopPropagation()}>
								<Button
									variant="outline-danger"
									size="sm"
									className="w-100"
									onClick={() => onRemove(lastLineId(m.id))}
									title="Quitar uno"
								>
									<i className="fa-solid fa-minus me-1"></i>Quitar
								</Button>
							</div>
						)}
					</Card.Body>
				</Card>
			</Col>
		);
	};

	return (
		<>
			{/* Categorías */}
			<Nav variant="pills" className="mb-3 flex-wrap gap-1">
				<Nav.Item>
					<Nav.Link active={activeCat === 'all'} onClick={() => setActiveCat('all')}>Todos</Nav.Link>
				</Nav.Item>
				{categories.map((c) => (
					<Nav.Item key={c.id}>
						<Nav.Link active={activeCat === String(c.id)} onClick={() => setActiveCat(String(c.id))}>{c.name}</Nav.Link>
					</Nav.Item>
				))}
			</Nav>

			{/* Grid: tarjetas de producto y de grupo */}
			<Row className="g-2 mb-3">
				{entries.map((e) => {
					if (e.kind === 'single') return renderProductCard(e.item);
					const qty = groupQty(e.items);
					const img = groupImage(e.items);
					return (
						<Col xs={6} md={4} lg={3} key={`g-${e.grupo}`}>
							<Card
								className={`h-100 menu-pick-card ${qty > 0 ? 'border-success border-2' : ''}`}
								style={{ cursor: 'pointer', position: 'relative' }}
								onClick={() => setGroupModal(e.items)}
								title="Toque para elegir"
							>
								{qty > 0 && (
									<span className="badge bg-success" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, fontSize: 13, minWidth: 22 }}>{qty}</span>
								)}
								{img ? (
									<Card.Img variant="top" src={img} style={{ height: 90, objectFit: 'cover' }} />
								) : (
									<div className="d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: 90 }}>
										<i className="fa-solid fa-layer-group fa-2x"></i>
									</div>
								)}
								<Card.Body className="p-2">
									<div className="d-flex justify-content-between align-items-start">
										<span className="font-w600 small">{e.grupo}</span>
										<Badge bg="light" text="dark">{e.items.length}</Badge>
									</div>
									<div className="text-primary font-w600 small">{groupPriceLabel(e.items)}</div>
									<div className="text-muted" style={{ fontSize: 11 }}>Toque para elegir</div>
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
								<Card className="h-100 border-success" style={{ cursor: 'pointer' }} onClick={() => onRemove(x.lineId)} title="Toque para quitar uno">
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

			{/* Modal: elegir variante de un grupo. Las simples (bebidas) se suman
			    varias veces con contador sin cerrar; las que tienen sabor/aderezo
			    pasan al modal de opciones una por una. */}
			<Modal show={!!groupModal} onHide={() => setGroupModal(null)} centered size="lg" backdrop="static" keyboard={false}>
				<Modal.Header closeButton><Modal.Title>Elija una opción</Modal.Title></Modal.Header>
				<Modal.Body>
					<Row className="g-2">
						{(groupModal || []).map((m) => {
							const hasChoices = (m.choiceGroups || []).length > 0;
							const count = qtyInCart(m.id);
							return (
								<Col xs={4} key={m.id}>
									<Card
										className={`h-100 ${count > 0 ? 'border-success border-2' : ''}`}
										style={{ cursor: 'pointer' }}
										onClick={() => (hasChoices ? pickVariant(m) : onAdd(m))}
										title={hasChoices ? 'Toque para elegir opciones' : 'Toque para agregar'}
									>
										{m.image ? (
											<Card.Img variant="top" src={m.image} style={{ height: 80, objectFit: 'cover' }} />
										) : (
											<div className="d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: 80 }}>
												<i className="fa-solid fa-utensils fa-lg"></i>
											</div>
										)}
										<Card.Body className="p-2 text-center">
											<div className="font-w600 small">{m.name}</div>
											<div className="text-primary font-w600 small">{money(m.price)}</div>
											{!hasChoices && count > 0 && (
												<div className="d-flex justify-content-center align-items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
													<Button variant="outline-danger" onClick={() => onRemove(simpleLineId(m.id))} style={{ fontSize: '0.95rem', padding: '4px 12px' }}>Quitar</Button>
													<Badge bg="success" style={{ fontSize: '1.05rem', minWidth: 30 }}>{count}</Badge>
													<Button variant="success" onClick={() => onAdd(m)} style={{ fontSize: '1.2rem', minWidth: 40, padding: '2px 10px', lineHeight: 1 }}>+</Button>
												</div>
											)}
											{hasChoices && <div className="text-primary" style={{ fontSize: 11 }}>Elegir opciones</div>}
										</Card.Body>
									</Card>
								</Col>
							);
						})}
					</Row>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="success" onClick={() => setGroupModal(null)}>Listo</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default MenuPicker;

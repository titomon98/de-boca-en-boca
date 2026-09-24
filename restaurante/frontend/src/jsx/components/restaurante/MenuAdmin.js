import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Badge, Spinner, Row, Col } from 'react-bootstrap';
import swal from 'sweetalert';
import { MenuApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

// combo: [{ itemId, quantity }] productos que trae el combo.
// choiceGroups: [{ label, choose, optionItemIds:[...] }] opciones a elegir.
const emptyItem = { name: '', description: '', categoryId: '', price: '', type: 'food', available: true, image: '', combo: [], choiceGroups: [] };

/** Lee un archivo de imagen y lo reduce a un data URL base64 compacto. */
function fileToBase64(file, maxSize = 600) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				let { width, height } = img;
				if (width > height && width > maxSize) {
					height = Math.round((height * maxSize) / width);
					width = maxSize;
				} else if (height > maxSize) {
					width = Math.round((width * maxSize) / height);
					height = maxSize;
				}
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				canvas.getContext('2d').drawImage(img, 0, 0, width, height);
				resolve(canvas.toDataURL('image/jpeg', 0.7));
			};
			img.onerror = reject;
			img.src = reader.result;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

const MenuAdmin = () => {
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState([]);
	const [categories, setCategories] = useState([]);
	const [show, setShow] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState(emptyItem);
	const [showCat, setShowCat] = useState(false);
	const [catName, setCatName] = useState('');
	const [comboItem, setComboItem] = useState(null); // combo en vista de "qué incluye"
	const [editCat, setEditCat] = useState(null); // categoría en edición
	const [editCatName, setEditCatName] = useState('');

	const load = useCallback(async () => {
		const [m, c] = await Promise.all([MenuApi.list(), MenuApi.categories()]);
		setItems(m);
		setCategories(c);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const openNew = () => { setEditing(null); setForm(emptyItem); setShow(true); };
	const openEdit = (it) => {
		setEditing(it);
		setForm({
			name: it.name,
			description: it.description || '',
			categoryId: it.categoryId || '',
			price: it.price,
			type: it.type,
			available: it.available,
			image: it.image || '',
			combo: (it.combo?.components || []).map((c) => ({ itemId: c.itemId, quantity: c.quantity })),
			choiceGroups: (it.choiceGroups || []).map((g) => ({
				label: g.label,
				choose: g.choose || 1,
				optionItemIds: [...(g.optionItemIds || [])],
			})),
		});
		setShow(true);
	};

	// --- Grupos de elección (productos reales) ---
	const addGroup = () =>
		setForm((f) => ({ ...f, choiceGroups: [...(f.choiceGroups || []), { label: '', choose: 1, optionItemIds: [] }] }));
	const updateGroup = (idx, key, value) =>
		setForm((f) => ({
			...f,
			choiceGroups: f.choiceGroups.map((g, i) => (i === idx ? { ...g, [key]: value } : g)),
		}));
	const toggleGroupOption = (idx, itemId) =>
		setForm((f) => ({
			...f,
			choiceGroups: f.choiceGroups.map((g, i) => {
				if (i !== idx) return g;
				const has = g.optionItemIds.includes(itemId);
				return { ...g, optionItemIds: has ? g.optionItemIds.filter((x) => x !== itemId) : [...g.optionItemIds, itemId] };
			}),
		}));
	const removeGroup = (idx) =>
		setForm((f) => ({ ...f, choiceGroups: f.choiceGroups.filter((_, i) => i !== idx) }));

	// --- Vista "qué incluye el combo" ---
	const productName = (id) => items.find((mi) => mi.id === id)?.name || `#${id}`;
	const editFromCombo = () => {
		const it = comboItem;
		setComboItem(null);
		openEdit(it);
	};

	// --- Componentes del combo ---
	const addComponent = () =>
		setForm((f) => ({ ...f, combo: [...(f.combo || []), { itemId: '', quantity: 1 }] }));
	const updateComponent = (idx, key, value) =>
		setForm((f) => ({
			...f,
			combo: f.combo.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
		}));
	const removeComponent = (idx) =>
		setForm((f) => ({ ...f, combo: f.combo.filter((_, i) => i !== idx) }));

	const onPickImage = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const b64 = await fileToBase64(file);
			setForm((f) => ({ ...f, image: b64 }));
		} catch {
			swal('Error', 'No se pudo procesar la imagen.', 'error');
		}
	};

	const save = async () => {
		if (!form.name.trim() || !form.price) {
			swal('Atención', 'Nombre y precio son obligatorios.', 'warning');
			return;
		}
		const dto = {
			name: form.name.trim(),
			description: form.description || undefined,
			categoryId: form.categoryId ? Number(form.categoryId) : undefined,
			price: Number(form.price),
			type: form.type,
			available: form.available,
			image: form.image || undefined,
			includes: null,
			combo: (() => {
				const components = (form.combo || [])
					.filter((c) => c.itemId)
					.map((c) => ({ itemId: Number(c.itemId), quantity: Math.max(1, Number(c.quantity) || 1) }));
				return components.length ? { components } : null;
			})(),
			choiceGroups: (form.choiceGroups || [])
				.filter((g) => g.label.trim() && g.optionItemIds.length > 0)
				.map((g) => ({
					label: g.label.trim(),
					choose: Math.max(1, Number(g.choose) || 1),
					optionItemIds: g.optionItemIds.map(Number),
				})),
		};
		try {
			if (editing) await MenuApi.update(editing.id, dto);
			else await MenuApi.create(dto);
			setShow(false);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo guardar', 'error');
		}
	};

	const remove = (it) => {
		swal({
			title: '¿Eliminar platillo?',
			text: it.name,
			icon: 'warning',
			buttons: ['Cancelar', 'Eliminar'],
			dangerMode: true,
		}).then(async (ok) => {
			if (ok) {
				try {
					await MenuApi.remove(it.id);
					await load();
				} catch (e) {
					swal('Error', e?.response?.data?.message || 'No se pudo eliminar', 'error');
				}
			}
		});
	};

	// --- Categorías (CRUD) ---
	const addCat = async () => {
		if (!catName.trim()) return;
		await MenuApi.createCategory({ name: catName.trim() });
		setCatName('');
		await load();
	};

	const startEditCat = (c) => { setEditCat(c.id); setEditCatName(c.name); };
	const saveEditCat = async () => {
		if (!editCatName.trim()) return;
		await MenuApi.updateCategory(editCat, { name: editCatName.trim() });
		setEditCat(null);
		setEditCatName('');
		await load();
	};
	const removeCat = (c) => {
		swal({
			title: '¿Eliminar categoría?',
			text: `${c.name}. Los platillos quedarán sin categoría.`,
			icon: 'warning',
			buttons: ['Cancelar', 'Eliminar'],
			dangerMode: true,
		}).then(async (ok) => {
			if (ok) {
				try {
					await MenuApi.removeCategory(c.id);
					await load();
				} catch (e) {
					swal('Error', e?.response?.data?.message || 'No se pudo eliminar', 'error');
				}
			}
		});
	};

	if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

	return (
		<>
			<div className="d-flex justify-content-between align-items-center mb-3">
				<h3 className="mb-0">Menú</h3>
				<div className="d-flex gap-2">
					<Button variant="outline-secondary" onClick={() => setShowCat(true)}>
						<i className="bi bi-tag me-1"></i>Categorías
					</Button>
					<Button variant="primary" onClick={openNew}>
						<i className="fa-solid fa-plus me-1"></i>Nuevo platillo
					</Button>
				</div>
			</div>

			<Card>
				<Card.Body>
					<Table responsive hover className="align-middle">
						<thead>
							<tr>
								<th style={{ width: 64 }}></th>
								<th>Nombre</th>
								<th>Categoría</th>
								<th>Tipo</th>
								<th className="text-end">Precio</th>
								<th>Disponible</th>
								<th className="text-end">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{items.map((it) => (
								<tr key={it.id}>
									<td>
										{it.image ? (
											<img src={it.image} alt={it.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
										) : (
											<div className="d-flex align-items-center justify-content-center bg-light text-muted"
												style={{ width: 48, height: 48, borderRadius: 8 }}>
												<i className="fa-solid fa-utensils"></i>
											</div>
										)}
									</td>
									<td>
										<div className="font-w600">
											{it.name}
											{it.combo?.components?.length > 0 && (
												<Badge bg="warning" text="dark" className="ms-2">Combo</Badge>
											)}
										</div>
										{it.description && <small className="text-muted">{it.description}</small>}
									</td>
									<td>{it.category?.name || '-'}</td>
									<td>{it.type === 'drink' ? 'Bebida' : 'Comida'}</td>
									<td className="text-end">{money(it.price)}</td>
									<td>
										<Badge bg={it.available ? 'success' : 'secondary'}>
											{it.available ? 'Sí' : 'No'}
										</Badge>
									</td>
									<td className="text-end">
										{it.combo?.components?.length > 0 && (
											<Button size="sm" variant="outline-warning" className="me-1" title="Ver qué incluye el combo" onClick={() => setComboItem(it)}>
												<i className="fa-solid fa-box-open"></i>
											</Button>
										)}
										<Button size="sm" variant="light" className="me-1" onClick={() => openEdit(it)}>
											<i className="bi bi-pencil"></i>
										</Button>
										<Button size="sm" variant="light" className="text-danger" onClick={() => remove(it)}>
											<i className="bi bi-trash"></i>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</Table>
				</Card.Body>
			</Card>

			{/* Modal platillo */}
			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>{editing ? 'Editar platillo' : 'Nuevo platillo'}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="text-center mb-3">
						{form.image ? (
							<img src={form.image} alt="preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12 }} />
						) : (
							<div className="d-inline-flex align-items-center justify-content-center bg-light text-muted"
								style={{ width: 120, height: 120, borderRadius: 12 }}>
								<i className="fa-solid fa-image fa-2x"></i>
							</div>
						)}
						<div className="mt-2 d-flex justify-content-center gap-2">
							<Form.Label className="btn btn-outline-primary btn-sm mb-0">
								<i className="fa-solid fa-upload me-1"></i>Subir imagen
								<Form.Control type="file" accept="image/*" hidden onChange={onPickImage} />
							</Form.Label>
							{form.image && (
								<Button size="sm" variant="outline-danger" onClick={() => setForm({ ...form, image: '' })}>
									Quitar
								</Button>
							)}
						</div>
					</div>
					<Form.Group className="mb-3">
						<Form.Label>Nombre</Form.Label>
						<Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
					</Form.Group>
					<Form.Group className="mb-3">
						<Form.Label>Descripción</Form.Label>
						<Form.Control value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
					</Form.Group>
					<Row>
						<Col>
							<Form.Group className="mb-3">
								<Form.Label>Categoría</Form.Label>
								<Form.Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
									<option value="">Sin categoría</option>
									{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
								</Form.Select>
							</Form.Group>
						</Col>
						<Col>
							<Form.Group className="mb-3">
								<Form.Label>Tipo</Form.Label>
								<Form.Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
									<option value="food">Comida</option>
									<option value="drink">Bebida</option>
								</Form.Select>
							</Form.Group>
						</Col>
					</Row>
					<Row>
						<Col>
							<Form.Group className="mb-3">
								<Form.Label>Precio (Q)</Form.Label>
								<Form.Control type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
							</Form.Group>
						</Col>
						<Col className="d-flex align-items-center">
							<Form.Check
								type="switch"
								label="Disponible"
								checked={form.available}
								onChange={(e) => setForm({ ...form, available: e.target.checked })}
							/>
						</Col>
					</Row>

					<hr />
					<div className="d-flex justify-content-between align-items-center mb-2">
						<Form.Label className="mb-0">Productos que trae el combo</Form.Label>
						<Button size="sm" variant="outline-primary" onClick={addComponent}>
							<i className="fa-solid fa-plus me-1"></i>Agregar producto
						</Button>
					</div>
					{(form.combo || []).map((c, idx) => (
						<Row className="g-2 mb-2 align-items-center" key={idx}>
							<Col xs={8}>
								<Form.Select size="sm" value={c.itemId} onChange={(e) => updateComponent(idx, 'itemId', e.target.value)}>
									<option value="">Seleccione un producto</option>
									{items.filter((mi) => !editing || mi.id !== editing.id).map((mi) => (
										<option key={mi.id} value={mi.id}>{mi.name}</option>
									))}
								</Form.Select>
							</Col>
							<Col xs={3}>
								<Form.Control size="sm" type="number" min={1} title="Cantidad" value={c.quantity} onChange={(e) => updateComponent(idx, 'quantity', e.target.value)} />
							</Col>
							<Col xs={1} className="text-end">
								<Button size="sm" variant="light" className="text-danger px-1" onClick={() => removeComponent(idx)}>
									<i className="fa-solid fa-xmark"></i>
								</Button>
							</Col>
						</Row>
					))}

					<hr />
					<div className="d-flex justify-content-between align-items-center mb-2">
						<Form.Label className="mb-0">Opciones a elegir</Form.Label>
						<Button size="sm" variant="outline-primary" onClick={addGroup}>
							<i className="fa-solid fa-plus me-1"></i>Agregar opción
						</Button>
					</div>
					{(form.choiceGroups || []).map((g, idx) => (
						<div className="border rounded p-2 mb-2" key={idx}>
							<Row className="g-2 align-items-center mb-2">
								<Col xs={7}>
									<Form.Control size="sm" placeholder="Ingrese nombre de la opción" value={g.label} onChange={(e) => updateGroup(idx, 'label', e.target.value)} />
								</Col>
								<Col xs={4}>
									<Form.Control size="sm" type="number" min={1} title="Cuantos elige el cliente" value={g.choose} onChange={(e) => updateGroup(idx, 'choose', e.target.value)} />
								</Col>
								<Col xs={1} className="text-end">
									<Button size="sm" variant="light" className="text-danger px-1" onClick={() => removeGroup(idx)}>
										<i className="fa-solid fa-xmark"></i>
									</Button>
								</Col>
							</Row>
							<div className="small text-muted mb-1">Productos que puede elegir:</div>
							<div className="d-flex flex-wrap gap-2">
								{items.filter((mi) => !editing || mi.id !== editing.id).map((mi) => (
									<Form.Check key={mi.id} type="checkbox" id={`g${idx}-i${mi.id}`} label={mi.name} checked={g.optionItemIds.includes(mi.id)} onChange={() => toggleGroupOption(idx, mi.id)} />
								))}
							</div>
						</div>
					))}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="primary" onClick={save}>Guardar</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal gestión de categorías */}
			<Modal show={showCat} onHide={() => { setShowCat(false); setEditCat(null); }} centered>
				<Modal.Header closeButton><Modal.Title>Categorías</Modal.Title></Modal.Header>
				<Modal.Body>
					<div className="d-flex gap-2 mb-3">
						<Form.Control
							placeholder="Nueva categoría"
							value={catName}
							onChange={(e) => setCatName(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && addCat()}
						/>
						<Button variant="primary" onClick={addCat}>Agregar</Button>
					</div>
					{categories.length === 0 ? (
						<p className="text-muted mb-0">Sin categorías.</p>
					) : (
						<ul className="list-unstyled mb-0">
							{categories.map((c) => (
								<li key={c.id} className="d-flex align-items-center justify-content-between border-bottom py-2">
									{editCat === c.id ? (
										<>
											<Form.Control
												size="sm"
												className="me-2"
												value={editCatName}
												onChange={(e) => setEditCatName(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && saveEditCat()}
											/>
											<div className="d-flex gap-1">
												<Button size="sm" variant="success" onClick={saveEditCat}>Guardar</Button>
												<Button size="sm" variant="light" onClick={() => setEditCat(null)}>Cancelar</Button>
											</div>
										</>
									) : (
										<>
											<span>{c.name}</span>
											<div className="d-flex gap-1">
												<Button size="sm" variant="light" onClick={() => startEditCat(c)}>
													<i className="bi bi-pencil"></i>
												</Button>
												<Button size="sm" variant="light" className="text-danger" onClick={() => removeCat(c)}>
													<i className="bi bi-trash"></i>
												</Button>
											</div>
										</>
									)}
								</li>
							))}
						</ul>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => { setShowCat(false); setEditCat(null); }}>Cerrar</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal: qué incluye el combo */}
			<Modal show={!!comboItem} onHide={() => setComboItem(null)} centered>
				<Modal.Header closeButton>
					<Modal.Title>
						{comboItem?.name} <Badge bg="warning" text="dark">Combo</Badge>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="d-flex justify-content-between mb-3">
						<span className="text-muted">Precio de paquete</span>
						<strong>{comboItem && money(comboItem.price)}</strong>
					</div>

					<h6 className="mb-2">Productos incluidos</h6>
					{comboItem?.combo?.components?.length > 0 ? (
						<ul className="mb-3">
							{comboItem.combo.components.map((c) => (
								<li key={c.itemId}>
									{c.quantity > 1 ? `${c.quantity}x ` : ''}{productName(c.itemId)}
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted">Sin productos fijos.</p>
					)}

					{comboItem?.choiceGroups?.length > 0 && (
						<>
							<h6 className="mb-2">Opciones a elegir</h6>
							<ul className="mb-0">
								{comboItem.choiceGroups.map((g) => (
									<li key={g.label}>
										<strong>{g.label}</strong>: el cliente elige {g.choose} entre{' '}
										{g.optionItemIds.map((id) => productName(id)).join(', ')}
									</li>
								))}
							</ul>
						</>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setComboItem(null)}>Cerrar</Button>
					<Button variant="primary" onClick={editFromCombo}>
						<i className="bi bi-pencil me-1"></i>Editar combo
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default MenuAdmin;

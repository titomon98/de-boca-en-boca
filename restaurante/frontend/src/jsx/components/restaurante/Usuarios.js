import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap';
import swal from 'sweetalert';
import { UsersApi } from '../../../services/RestaurantApi';
import { ROLE_LABELS } from '../../../services/helpers';

const emptyUser = { name: '', email: '', password: '', role: 'waiter' };

const Usuarios = () => {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [show, setShow] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState(emptyUser);

	const load = useCallback(async () => {
		const u = await UsersApi.list();
		setUsers(u);
		setLoading(false);
	}, []);

	useEffect(() => { load(); }, [load]);

	const openNew = () => { setEditing(null); setForm(emptyUser); setShow(true); };
	const openEdit = (u) => {
		setEditing(u);
		setForm({ name: u.name, email: u.email, password: '', role: u.role });
		setShow(true);
	};

	const save = async () => {
		if (!form.name.trim() || !form.email.trim()) {
			swal('Atención', 'Nombre y correo son obligatorios.', 'warning');
			return;
		}
		if (!editing && !form.password) {
			swal('Atención', 'La contraseña es obligatoria para un usuario nuevo.', 'warning');
			return;
		}
		try {
			if (editing) {
				const dto = { name: form.name, email: form.email, role: form.role };
				if (form.password) dto.password = form.password;
				await UsersApi.update(editing.id, dto);
			} else {
				await UsersApi.create(form);
			}
			setShow(false);
			await load();
		} catch (e) {
			swal('Error', e?.response?.data?.message || 'No se pudo guardar', 'error');
		}
	};

	const remove = (u) => {
		swal({
			title: '¿Eliminar usuario?',
			text: u.name,
			icon: 'warning',
			buttons: ['Cancelar', 'Eliminar'],
			dangerMode: true,
		}).then(async (ok) => {
			if (ok) {
				try {
					await UsersApi.remove(u.id);
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
				<h3 className="mb-0">Usuarios</h3>
				<Button variant="primary" onClick={openNew}>
					<i className="fa-solid fa-plus me-1"></i>Nuevo usuario
				</Button>
			</div>

			<Card>
				<Card.Body>
					<Table responsive hover>
						<thead>
							<tr>
								<th>Nombre</th>
								<th>Correo</th>
								<th>Rol</th>
								<th className="text-end">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<tr key={u.id}>
									<td className="font-w600">{u.name}</td>
									<td>{u.email}</td>
									<td><Badge bg="primary">{ROLE_LABELS[u.role] || u.role}</Badge></td>
									<td className="text-end">
										<Button size="sm" variant="light" className="me-1" onClick={() => openEdit(u)}>
											<i className="bi bi-pencil"></i>
										</Button>
										<Button size="sm" variant="light" className="text-danger" onClick={() => remove(u)}>
											<i className="bi bi-trash"></i>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</Table>
				</Card.Body>
			</Card>

			<Modal show={show} onHide={() => setShow(false)} centered>
				<Modal.Header closeButton>
					<Modal.Title>{editing ? 'Editar usuario' : 'Nuevo usuario'}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form.Group className="mb-3">
						<Form.Label>Nombre</Form.Label>
						<Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
					</Form.Group>
					<Form.Group className="mb-3">
						<Form.Label>Correo</Form.Label>
						<Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
					</Form.Group>
					<Form.Group className="mb-3">
						<Form.Label>Contraseña {editing && <small className="text-muted">(dejar en blanco para no cambiar)</small>}</Form.Label>
						<Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
					</Form.Group>
					<Form.Group>
						<Form.Label>Rol</Form.Label>
						<Form.Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
							<option value="administrator">Administrador</option>
							<option value="waiter">Mesero</option>
							<option value="cashier">Cajero</option>
						</Form.Select>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={() => setShow(false)}>Cancelar</Button>
					<Button variant="primary" onClick={save}>Guardar</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default Usuarios;

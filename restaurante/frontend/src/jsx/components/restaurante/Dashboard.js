import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, Table, Badge, Spinner } from 'react-bootstrap';
import { TablesApi, AccountsApi, ReportsApi } from '../../../services/RestaurantApi';
import { money, getCurrentUser, ROLE_LABELS, TABLE_STATUS, todayGuatemala } from '../../../services/helpers';

const StatCard = ({ icon, color, label, value }) => (
	<Col xl={3} sm={6}>
		<Card>
			<Card.Body className="d-flex align-items-center">
				<span className={`me-3 flex-shrink-0 d-inline-flex align-items-center justify-content-center rounded-circle bg-${color}-light`}
					style={{ width: 60, height: 60 }}>
					<i className={`${icon} text-${color}`} style={{ fontSize: 24 }}></i>
				</span>
				<div style={{ minWidth: 0 }}>
					<h3
						className="mb-0 font-w600"
						title={String(value)}
						style={{ fontSize: '1.4rem', overflowWrap: 'anywhere', lineHeight: 1.2 }}
					>
						{value}
					</h3>
					<span className="text-muted">{label}</span>
				</div>
			</Card.Body>
		</Card>
	</Col>
);

const Dashboard = () => {
	const user = getCurrentUser();
	const [loading, setLoading] = useState(true);
	const [tables, setTables] = useState([]);
	const [accounts, setAccounts] = useState([]);
	const [sales, setSales] = useState({ total: 0, paymentsCount: 0 });

	const load = async () => {
		try {
			const today = todayGuatemala();
			const [t, a, s] = await Promise.all([
				TablesApi.list(),
				AccountsApi.listOpen(),
				ReportsApi.salesSummary(today, today).catch(() => ({ total: 0, paymentsCount: 0 })),
			]);
			setTables(t);
			setAccounts(a);
			setSales(s);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	if (loading) {
		return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
	}

	const occupied = tables.filter((t) => t.status !== 'free').length;

	return (
		<>
			<div className="row page-titles mx-0">
				<div className="col-sm-12 p-0">
					<h3 className="mb-0">Hola, {user.name}</h3>
					<span className="text-muted">{ROLE_LABELS[user.role]} · Resumen de hoy</span>
				</div>
			</div>

			<Row>
				<StatCard icon="bi bi-grid-3x3-gap" color="warning" label="Mesas ocupadas" value={`${occupied}/${tables.length}`} />
				<StatCard icon="bi bi-receipt" color="primary" label="Cuentas activas" value={accounts.length} />
				<StatCard icon="bi bi-cash-stack" color="success" label="Ventas de hoy" value={money(sales.total)} />
				<StatCard icon="bi bi-bag-check" color="info" label="Cobros de hoy" value={sales.paymentsCount} />
			</Row>

			<Row>
				<Col lg={7}>
					<Card>
						<Card.Header>
							<Card.Title>Cuentas activas</Card.Title>
							<Link to="/mesas" className="btn btn-primary btn-sm">Ir a mesas</Link>
						</Card.Header>
						<Card.Body>
							{accounts.length === 0 ? (
								<p className="text-muted mb-0">No hay cuentas abiertas.</p>
							) : (
								<Table responsive hover>
									<thead>
										<tr>
											<th>Cuenta</th>
											<th>Mesas</th>
											<th>Estado</th>
											<th className="text-end">Total</th>
										</tr>
									</thead>
									<tbody>
										{accounts.map((a) => (
											<tr key={a.id}>
												<td>
													<Link to={`/cuenta/${a.id}`}>{a.label}</Link>
												</td>
												<td>{(a.tables || []).map((t) => t.number).join(', ')}</td>
												<td>
													<Badge bg={a.status === 'billing' ? 'danger' : 'warning'}>
														{a.status === 'billing' ? 'Cobrando' : 'Abierta'}
													</Badge>
												</td>
												<td className="text-end font-w600">{money(a.total)}</td>
											</tr>
										))}
									</tbody>
								</Table>
							)}
						</Card.Body>
					</Card>
				</Col>
				<Col lg={5}>
					<Card>
						<Card.Header>
							<Card.Title>Estado del salón</Card.Title>
						</Card.Header>
						<Card.Body>
							<Row className="g-2">
								{tables.map((t) => {
									const meta = TABLE_STATUS[t.status] || TABLE_STATUS.free;
									return (
										<Col xs={3} key={t.id}>
											<div className={`text-center p-2 rounded border border-${meta.color}`}>
												<div className="font-w600">#{t.number}</div>
												<small className={`text-${meta.color}`}>{meta.label}</small>
											</div>
										</Col>
									);
								})}
							</Row>
						</Card.Body>
					</Card>
				</Col>
			</Row>
		</>
	);
};

export default Dashboard;

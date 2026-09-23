import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Form, Button, Table, Spinner } from 'react-bootstrap';
import ReactApexChart from 'react-apexcharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ReportsApi } from '../../../services/RestaurantApi';
import { money } from '../../../services/helpers';

const methodLabel = (k) => (k === 'cash' ? 'Efectivo' : k === 'card' ? 'Tarjeta' : k);

const Reportes = () => {
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState({ total: 0, paymentsCount: 0, byPaymentMethod: {} });
	const [byDay, setByDay] = useState([]);
	const [top, setTop] = useState([]);
	const [inv, setInv] = useState({ total: 0, available: 0, unavailable: 0, items: [] });

	const load = useCallback(async () => {
		setLoading(true);
		const [s, d, t, i] = await Promise.all([
			ReportsApi.salesSummary(from || undefined, to || undefined),
			ReportsApi.salesByDay(from || undefined, to || undefined),
			ReportsApi.topItems(from || undefined, to || undefined, 8),
			ReportsApi.inventory(),
		]);
		setSummary(s);
		setByDay(d);
		setTop(t);
		setInv(i);
		setLoading(false);
	}, [from, to]);

	useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

	const rangeLabel = `${from || 'inicio'} a ${to || 'hoy'}`;

	// Encabezado de tablas en amarillo de marca con texto negro.
	const headStyles = { fillColor: [245, 197, 24], textColor: [26, 26, 26] };

	const exportPDF = () => {
		const doc = new jsPDF();
		doc.setFontSize(16);
		doc.text('De Boca en Boca — Reporte', 14, 18);
		doc.setFontSize(10);
		doc.text(`Rango: ${rangeLabel}`, 14, 25);
		doc.text(`Ventas totales: ${money(summary.total)}   ·   Cobros: ${summary.paymentsCount}`, 14, 31);

		autoTable(doc, {
			startY: 38,
			head: [['Forma de pago', 'Cobros', 'Total']],
			body: Object.entries(summary.byPaymentMethod || {}).map(([k, v]) => [
				methodLabel(k), v.count, money(v.total),
			]),
			headStyles,
		});
		autoTable(doc, {
			startY: (doc.lastAutoTable?.finalY || 38) + 8,
			head: [['Día', 'Cobros', 'Total']],
			body: byDay.map((d) => [d.day, d.count, money(d.total)]),
			headStyles,
		});
		autoTable(doc, {
			startY: (doc.lastAutoTable?.finalY || 38) + 8,
			head: [['Platillo', 'Cantidad', 'Ingresos']],
			body: top.map((t) => [t.menuItemName, t.quantity, money(t.revenue)]),
			headStyles,
		});
		autoTable(doc, {
			startY: (doc.lastAutoTable?.finalY || 38) + 8,
			head: [['Producto', 'Categoría', 'Tipo', 'Precio', 'Estado']],
			body: inv.items.map((i) => [
				i.name, i.category, i.type, money(i.price), i.available ? 'Disponible' : 'Agotado',
			]),
			headStyles,
		});
		doc.save(`reporte_de-boca-en-boca_${rangeLabel.replace(/\s/g, '')}.pdf`);
	};

	const exportExcel = () => {
		const wb = XLSX.utils.book_new();

		const resumen = [
			['De Boca en Boca — Reporte'],
			['Rango', rangeLabel],
			['Ventas totales', Number(summary.total)],
			['Cobros', summary.paymentsCount],
			[],
			['Forma de pago', 'Cobros', 'Total'],
			...Object.entries(summary.byPaymentMethod || {}).map(([k, v]) => [
				methodLabel(k), v.count, Number(v.total),
			]),
		];
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(byDay.map((d) => ({ Día: d.day, Cobros: d.count, Total: Number(d.total) }))),
			'Ventas por día',
		);
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(top.map((t) => ({ Platillo: t.menuItemName, Cantidad: Number(t.quantity), Ingresos: Number(t.revenue) }))),
			'Platillos',
		);
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(inv.items.map((i) => ({
				Producto: i.name, Categoría: i.category, Tipo: i.type,
				Precio: Number(i.price), Estado: i.available ? 'Disponible' : 'Agotado',
			}))),
			'Inventario',
		);
		XLSX.writeFile(wb, `reporte_de-boca-en-boca_${rangeLabel.replace(/\s/g, '')}.xlsx`);
	};

	const dayChart = {
		series: [{ name: 'Ventas', data: byDay.map((d) => Number(d.total)) }],
		options: {
			chart: { type: 'area', toolbar: { show: false } },
			dataLabels: { enabled: false },
			stroke: { curve: 'smooth', width: 2 },
			colors: ['#F5C518'],
			xaxis: { categories: byDay.map((d) => d.day) },
			yaxis: { labels: { formatter: (v) => `Q${v.toFixed(0)}` } },
		},
	};

	const topChart = {
		series: [{ name: 'Cantidad', data: top.map((t) => Number(t.quantity)) }],
		options: {
			chart: { type: 'bar', toolbar: { show: false } },
			plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
			dataLabels: { enabled: false },
			colors: ['#D62828'],
			xaxis: { categories: top.map((t) => t.menuItemName) },
		},
	};

	const hasData = summary.paymentsCount > 0 || top.length > 0 || inv.items.length > 0;

	return (
		<>
			<div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
				<h3 className="mb-0">Reportes</h3>
				<div className="d-flex gap-2 align-items-end flex-wrap">
					<div>
						<Form.Label className="mb-0 small">Desde</Form.Label>
						<Form.Control type="date" size="sm" value={from} onChange={(e) => setFrom(e.target.value)} />
					</div>
					<div>
						<Form.Label className="mb-0 small">Hasta</Form.Label>
						<Form.Control type="date" size="sm" value={to} onChange={(e) => setTo(e.target.value)} />
					</div>
					<Button size="sm" variant="primary" onClick={load}>Aplicar</Button>
					<Button size="sm" variant="danger" onClick={exportPDF} disabled={!hasData}>
						<i className="bi bi-download me-1"></i>PDF
					</Button>
					<Button size="sm" variant="success" onClick={exportExcel} disabled={!hasData}>
						<i className="bi bi-file-earmark-spreadsheet me-1"></i>Excel
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
			) : (
				<>
					<Row>
						<Col md={4}>
							<Card>
								<Card.Body className="text-center">
									<h2 className="text-primary mb-0">{money(summary.total)}</h2>
									<span className="text-muted">Ventas totales</span>
								</Card.Body>
							</Card>
						</Col>
						<Col md={4}>
							<Card>
								<Card.Body className="text-center">
									<h2 className="mb-0">{summary.paymentsCount}</h2>
									<span className="text-muted">Cobros</span>
								</Card.Body>
							</Card>
						</Col>
						<Col md={4}>
							<Card>
								<Card.Body>
									<span className="text-muted d-block mb-1">Por forma de pago</span>
									{Object.keys(summary.byPaymentMethod || {}).length === 0 ? (
										<span>—</span>
									) : (
										Object.entries(summary.byPaymentMethod).map(([k, v]) => (
											<div key={k} className="d-flex justify-content-between">
												<span>{methodLabel(k)}</span>
												<strong>{money(v.total)}</strong>
											</div>
										))
									)}
								</Card.Body>
							</Card>
						</Col>
					</Row>

					<Row>
						<Col lg={7}>
							<Card>
								<Card.Header><Card.Title>Ventas por día</Card.Title></Card.Header>
								<Card.Body>
									{byDay.length === 0 ? (
										<p className="text-muted mb-0">Sin datos en el rango.</p>
									) : (
										<ReactApexChart options={dayChart.options} series={dayChart.series} type="area" height={300} />
									)}
								</Card.Body>
							</Card>
						</Col>
						<Col lg={5}>
							<Card>
								<Card.Header><Card.Title>Platillos más vendidos</Card.Title></Card.Header>
								<Card.Body>
									{top.length === 0 ? (
										<p className="text-muted mb-0">Sin datos en el rango.</p>
									) : (
										<ReactApexChart options={topChart.options} series={topChart.series} type="bar" height={300} />
									)}
								</Card.Body>
							</Card>
						</Col>
					</Row>

					<Card>
						<Card.Header><Card.Title>Detalle de platillos</Card.Title></Card.Header>
						<Card.Body>
							<Table responsive hover>
								<thead>
									<tr><th>Platillo</th><th className="text-end">Cantidad</th><th className="text-end">Ingresos</th></tr>
								</thead>
								<tbody>
									{top.map((t) => (
										<tr key={t.menuItemId}>
											<td>{t.menuItemName}</td>
											<td className="text-end">{t.quantity}</td>
											<td className="text-end font-w600">{money(t.revenue)}</td>
										</tr>
									))}
								</tbody>
							</Table>
						</Card.Body>
					</Card>
						<Row>
							<Col md={4}>
								<Card>
									<Card.Body className="text-center">
										<h2 className="mb-0">{inv.total}</h2>
										<span className="text-muted">Productos en catálogo</span>
									</Card.Body>
								</Card>
							</Col>
							<Col md={4}>
								<Card>
									<Card.Body className="text-center">
										<h2 className="text-success mb-0">{inv.available}</h2>
										<span className="text-muted">Disponibles</span>
									</Card.Body>
								</Card>
							</Col>
							<Col md={4}>
								<Card>
									<Card.Body className="text-center">
										<h2 className="text-danger mb-0">{inv.unavailable}</h2>
										<span className="text-muted">Agotados</span>
									</Card.Body>
								</Card>
							</Col>
						</Row>

						<Card>
							<Card.Header><Card.Title>Inventario (estado del catálogo)</Card.Title></Card.Header>
							<Card.Body>
								<Table responsive hover>
									<thead>
										<tr>
											<th>Producto</th><th>Categoría</th><th>Tipo</th>
											<th className="text-end">Precio</th><th className="text-center">Estado</th>
										</tr>
									</thead>
									<tbody>
										{inv.items.map((i) => (
											<tr key={i.id}>
												<td>{i.name}</td>
												<td>{i.category}</td>
												<td>{i.type}</td>
												<td className="text-end">{money(i.price)}</td>
												<td className="text-center">
													<span className={`badge ${i.available ? 'bg-success' : 'bg-danger'}`}>
														{i.available ? 'Disponible' : 'Agotado'}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</Table>
							</Card.Body>
						</Card>

				</>
			)}
		</>
	);
};

export default Reportes;

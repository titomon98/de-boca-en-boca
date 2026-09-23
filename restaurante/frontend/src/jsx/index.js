import React, { useContext } from "react";
import { Routes, Route, Outlet } from "react-router-dom";

/// Css
import "./index.css";
import "./chart.css";
import "./step.css";

/// Layout
import Nav from "./layouts/nav";
import Footer from "./layouts/Footer";
import ScrollToTop from "./layouts/ScrollToTop";

/// Páginas del restaurante
import Dashboard from "./components/restaurante/Dashboard";
import Mesas from "./components/restaurante/Mesas";
import CuentaDetail from "./components/restaurante/CuentaDetail";
import Cocina from "./components/restaurante/Cocina";
import MenuAdmin from "./components/restaurante/MenuAdmin";
import Caja from "./components/restaurante/Caja";
import CierreCaja from "./components/restaurante/CierreCaja";
import Reportes from "./components/restaurante/Reportes";
import Usuarios from "./components/restaurante/Usuarios";
import Configuracion from "./components/restaurante/Configuracion";

/// Pages de error
import Error400 from "./pages/Error400";
import Error403 from "./pages/Error403";
import Error404 from "./pages/Error404";
import Error500 from "./pages/Error500";
import Error503 from "./pages/Error503";
import { ThemeContext } from "../context/ThemeContext";

const Markup = () => {
  const allroutes = [
    { url: "", component: <Dashboard /> },
    { url: "dashboard", component: <Dashboard /> },
    { url: "mesas", component: <Mesas /> },
    { url: "cuenta/:id", component: <CuentaDetail /> },
    { url: "cocina", component: <Cocina /> },
    { url: "menu-admin", component: <MenuAdmin /> },
    { url: "caja", component: <Caja /> },
    { url: "cierre-caja", component: <CierreCaja /> },
    { url: "reportes", component: <Reportes /> },
    { url: "usuarios", component: <Usuarios /> },
    { url: "configuracion", component: <Configuracion /> },
  ];

  return (
    <>
      <Routes>
        <Route path="page-error-400" element={<Error400 />} />
        <Route path="page-error-403" element={<Error403 />} />
        <Route path="page-error-404" element={<Error404 />} />
        <Route path="page-error-500" element={<Error500 />} />
        <Route path="page-error-503" element={<Error503 />} />
        <Route element={<MainLayout />}>
          {allroutes.map((data, i) => (
            <Route key={i} exact path={`${data.url}`} element={data.component} />
          ))}
        </Route>
      </Routes>
      <ScrollToTop />
    </>
  );
};

function MainLayout() {
  const { menuToggle } = useContext(ThemeContext);
  return (
    <div id="main-wrapper" className={`show ${menuToggle ? "menu-toggle" : ""}`}>
      <Nav />
      <div className="content-body" style={{ minHeight: window.screen.height - 45 }}>
        <div className="container">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Markup;

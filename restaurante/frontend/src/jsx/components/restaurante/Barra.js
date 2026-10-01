import React from 'react';
import Cocina from './Cocina';

/** Barra: mismo tablero de comandas que Cocina, pero para bebidas. */
const Barra = () => (
	<Cocina type="drink" title="Barra" subtitle="Bebidas activas en tiempo real" />
);

export default Barra;

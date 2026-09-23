import { io } from 'socket.io-client';

/**
 * Conecta al gateway de comandas (namespace /comandas) autenticándose con el
 * JWT actual. Devuelve la instancia de socket; recuerda llamar socket.close().
 */
export function connectComandas() {
  const raw = localStorage.getItem('userDetails');
  let token = '';
  try {
    token = raw ? JSON.parse(raw).idToken : '';
  } catch (e) {
    token = '';
  }
  const base = process.env.REACT_APP_WS_URL || 'http://localhost:3002';
  return io(`${base}/comandas`, {
    auth: { token },
    transports: ['websocket'],
  });
}

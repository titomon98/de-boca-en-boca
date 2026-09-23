import swal from 'sweetalert';
import api from './api';
import { loginConfirmedAction, Logout } from '../store/actions/AuthActions';

/**
 * Autenticación contra el backend NestJS (/api/auth/login).
 * El token se guarda en localStorage con la forma que espera el resto de la
 * app (idToken = accessToken), más el rol y el nombre del usuario.
 */
export function login(email, password) {
  return api.post('/auth/login', { email, password });
}

// El registro público no aplica a este sistema (los usuarios los crea el admin).
export function signUp() {
  return Promise.reject(new Error('Registro deshabilitado'));
}

/** Normaliza un error de login para mostrarlo al usuario. */
export function formatError(error) {
  const message =
    error?.response?.data?.message ||
    'No se pudo iniciar sesión. Verifique sus credenciales.';
  swal('Error', Array.isArray(message) ? message.join(', ') : message, 'error', {
    button: 'Reintentar',
  });
  return message;
}

/** Construye el objeto de sesión a partir de la respuesta del backend. */
export function buildTokenDetails(data) {
  const expiresInSeconds = 8 * 60 * 60; // JWT del backend expira en 8h
  return {
    email: data.user.email,
    idToken: data.accessToken,
    localId: String(data.user.id),
    role: data.user.role,
    name: data.user.name,
    expiresIn: expiresInSeconds,
  };
}

export function saveTokenInLocalStorage(tokenDetails) {
  tokenDetails.expireDate = new Date(
    new Date().getTime() + tokenDetails.expiresIn * 1000,
  );
  localStorage.setItem('userDetails', JSON.stringify(tokenDetails));
}

export function runLogoutTimer(dispatch, timer, navigate) {
  setTimeout(() => {
    dispatch(Logout(navigate));
  }, timer);
}

export function checkAutoLogin(dispatch, navigate) {
  const tokenDetailsString = localStorage.getItem('userDetails');
  if (!tokenDetailsString) {
    dispatch(Logout(navigate));
    return;
  }

  const tokenDetails = JSON.parse(tokenDetailsString);
  const expireDate = new Date(tokenDetails.expireDate);
  const todaysDate = new Date();

  if (todaysDate > expireDate) {
    dispatch(Logout(navigate));
    return;
  }

  dispatch(loginConfirmedAction(tokenDetails));

  const timer = expireDate.getTime() - todaysDate.getTime();
  runLogoutTimer(dispatch, timer, navigate);
}

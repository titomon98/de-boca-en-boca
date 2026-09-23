import {
    buildTokenDetails,
    formatError,
    login,
    runLogoutTimer,
    saveTokenInLocalStorage,
} from '../../services/AuthService';
import { homeForRole } from '../../services/helpers';

export const SIGNUP_CONFIRMED_ACTION = '[signup action] confirmed signup';
export const SIGNUP_FAILED_ACTION = '[signup action] failed signup';
export const LOGIN_CONFIRMED_ACTION = '[login action] confirmed login';
export const LOGIN_FAILED_ACTION = '[login action] failed login';
export const LOADING_TOGGLE_ACTION = '[Loading action] toggle loading';
export const LOGOUT_ACTION = '[Logout action] logout action';

export function Logout(navigate) {
    localStorage.removeItem('userDetails');
    if (navigate) navigate('/login');
    return {
        type: LOGOUT_ACTION,
    };
}

export function loginAction(email, password, navigate) {
    return (dispatch) => {
        return login(email, password)
            .then((response) => {
                const tokenDetails = buildTokenDetails(response.data);
                saveTokenInLocalStorage(tokenDetails);
                runLogoutTimer(dispatch, tokenDetails.expiresIn * 1000, navigate);
                dispatch(loginConfirmedAction(tokenDetails));
                navigate(homeForRole(tokenDetails.role));
            })
            .catch((error) => {
                const errorMessage = formatError(error);
                dispatch(loginFailedAction(errorMessage));
            });
    };
}

export function loginFailedAction(data) {
    return {
        type: LOGIN_FAILED_ACTION,
        payload: data,
    };
}

export function loginConfirmedAction(data) {
    return {
        type: LOGIN_CONFIRMED_ACTION,
        payload: data,
    };
}

export function confirmedSignupAction(payload) {
    return {
        type: SIGNUP_CONFIRMED_ACTION,
        payload,
    };
}

export function signupFailedAction(message) {
    return {
        type: SIGNUP_FAILED_ACTION,
        payload: message,
    };
}

export function loadingToggleAction(status) {
    return {
        type: LOADING_TOGGLE_ACTION,
        payload: status,
    };
}

import React, { useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loadingToggleAction, loginAction } from '../../store/actions/AuthActions';

import bgimage from '../../images/logo-dbeb.jpg';

function Login(props) {
	const navigate = useNavigate();
	const [email, setEmail] = useState('admin@restaurante.local');
	let errorsObj = { email: '', password: '' };
	const [errors, setErrors] = useState(errorsObj);
	const [password, setPassword] = useState('Admin123!');
	const dispatch = useDispatch();

	function onLogin(e) {
		e.preventDefault();
		let error = false;
		const errorObj = { ...errorsObj };
		if (email === '') {
			errorObj.email = 'El correo es obligatorio';
			error = true;
		}
		if (password === '') {
			errorObj.password = 'La contraseña es obligatoria';
			error = true;
		}
		setErrors(errorObj);
		if (error) {
			return;
		}
		dispatch(loadingToggleAction(true));
		dispatch(loginAction(email, password, navigate));
	}

	return (
		<div className="container mt-0">
			<div className="row align-items-center justify-contain-center bg-login">
				<div className="col-xl-12 mt-5">
					<div className="card border-0">
						<div className="card-body login-bx">
							<div className="row mt-5">
								<div className="col-xl-8 col-md-6 text-center">
									<img src={bgimage} alt="De Boca en Boca" style={{ maxWidth: 320, width: '80%', borderRadius: 16 }} />
								</div>
								<div className="col-xl-4 col-md-6 pe-0">
									<div className="sign-in-your">
										<div className="text-center mb-3">
											<h4 className="fs-20 font-w800 text-black">De Boca en Boca</h4>
											<span className="dlab-sign-up">Inicie sesión para continuar</span>
										</div>
										{props.errorMessage && (
											<div className="bg-red-300 text-red-900 border border-red-900 p-1 my-2">
												{props.errorMessage}
											</div>
										)}
										<form onSubmit={onLogin}>
											<div className="mb-3">
												<label className="mb-1"><strong>Correo</strong></label>
												<input
													type="email"
													className="form-control"
													value={email}
													onChange={(e) => setEmail(e.target.value)}
												/>
												{errors.email && <div className="text-danger fs-12">{errors.email}</div>}
											</div>
											<div className="mb-3">
												<label className="mb-1"><strong>Contraseña</strong></label>
												<input
													type="password"
													className="form-control"
													value={password}
													onChange={(e) => setPassword(e.target.value)}
												/>
												{errors.password && <div className="text-danger fs-12">{errors.password}</div>}
											</div>
											<div className="text-center mt-4">
												<button type="submit" className="btn btn-primary btn-block">
													Iniciar sesión
												</button>
											</div>
										</form>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const mapStateToProps = (state) => {
	return {
		errorMessage: state.auth.errorMessage,
		successMessage: state.auth.successMessage,
		showLoading: state.auth.showLoading,
	};
};
export default connect(mapStateToProps)(Login);

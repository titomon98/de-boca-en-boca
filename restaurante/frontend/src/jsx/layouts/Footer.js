import React from "react";

const Footer = () => {
	var d = new Date();
	return (
		<div className="footer">
			<div className="copyright border-top">
				<p>Arturo Monterroso {d.getFullYear()}</p>
			</div>
		</div>
	);
};

export default Footer;

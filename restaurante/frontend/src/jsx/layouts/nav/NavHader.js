import React, { useState } from "react";
/// React router dom
import { Link } from "react-router-dom";
import logo from "../../../images/logo-dbeb.jpg";

export function  NavMenuToggle(){
	setTimeout(()=>{
		let mainwrapper = document.querySelector("#main-wrapper");
		if(mainwrapper.classList.contains('menu-toggle')){
			mainwrapper.classList.remove("menu-toggle");
		}else{
			mainwrapper.classList.add("menu-toggle");
		}
	},200);
}


const NavHader = () => {
  const [toggle, setToggle] = useState(false);
  return (
    <div className="nav-header">
      <Link to="/dashboard" className="brand-logo">
        <img
          src={logo}
          alt="De Boca en Boca"
          style={{ height: 44, width: 44, borderRadius: 8, objectFit: "cover" }}
          className="me-2"
        />
        <span className="brand-title fs-5 font-w700 text-black">De Boca en Boca</span>
      </Link>

      <div
        className="nav-control"
        onClick={() => {
          setToggle(!toggle);
         NavMenuToggle();
        }}
      >
        <div className={`hamburger ${toggle ? "is-active" : ""}`}>
          <span className="line"></span>
          <span className="line"></span>
          <span className="line"></span>
        </div>
      </div>
    </div>
  );
};

export default NavHader;

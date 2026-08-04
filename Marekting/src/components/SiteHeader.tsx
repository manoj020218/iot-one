import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { navItems, primaryActions } from "../content/brand";
import { Logo } from "./Logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand-mark" to="/">
        <Logo />
      </Link>
      <button
        aria-expanded={open}
        className="menu-toggle"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        Menu
      </button>
      <nav className={`site-nav${open ? " open" : ""}`}>
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        <Link className="button button-secondary" to="/contact" onClick={() => setOpen(false)}>
          Partner With Jenix
        </Link>
        <a className="button button-primary" href={primaryActions.openApp.path}>
          {primaryActions.openApp.label}
        </a>
      </nav>
    </header>
  );
}

import { Link } from "react-router-dom";

import { brand, footerGroups } from "../content/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span className="eyebrow">Smart One by Jenix</span>
        <h2>Built for connected products, installers and long-term platform growth.</h2>
        <p>
          Smart One is an IoT platform developed and operated by Jenix under
          {` ${brand.businessName}.`}
        </p>
      </div>
      <div className="footer-grid">
        {footerGroups.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.links.map((link) => (
                <li key={link.path}>
                  {link.external ? (
                    <a href={link.path}>{link.label}</a>
                  ) : (
                    <Link to={link.path}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="footer-meta">
        <span>{brand.supportEmail}</span>
        <span>{brand.country}</span>
        <span>© {new Date().getFullYear()} {brand.businessName}</span>
      </div>
    </footer>
  );
}

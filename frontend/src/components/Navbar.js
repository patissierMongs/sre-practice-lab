import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">SRE Lab</Link>
      <Link to="/" className={isActive('/') ? 'active' : ''}>Home</Link>
      <Link to="/posts" className={isActive('/posts') ? 'active' : ''}>게시판</Link>
      <Link to="/security" className={isActive('/security') ? 'active' : ''}>Security Lab</Link>
      <div className="external">
        <a href="http://localhost:9090" target="_blank" rel="noreferrer">Prometheus</a>
        <a href="http://localhost:3001" target="_blank" rel="noreferrer">Grafana</a>
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API Docs</a>
      </div>
    </nav>
  );
}

export default Navbar;

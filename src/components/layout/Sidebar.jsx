import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

export default function Sidebar() {
  const { user, isGuest, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = isGuest ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = isGuest ? 'Modo sin cuenta' : user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <i className="fas fa-wallet"></i>
          </div>
          <span className="logo-text">FinanzApp</span>
        </div>
      </div>

      <div className="nav-links">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <i className="fas fa-home"></i>
          <span>Dashboard</span>
        </NavLink>
        <NavLink
          to="/presupuestos"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <i className="fas fa-wallet"></i>
          <span>Presupuestos</span>
        </NavLink>
        <NavLink
          to="/estadisticas"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <i className="fas fa-chart-pie"></i>
          <span>Estadísticas</span>
        </NavLink>
        <NavLink
          to="/configuracion"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <i className="fas fa-cog"></i>
          <span>Configuración</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              initial
            )}
          </div>
          <div className="user-info" id="userInfoHover">
            <div className="user-name">{displayName}</div>
            <div className="user-email">{displayEmail}</div>
          </div>
          <button
            type="button"
            className="btn btn-icon app-tooltip"
            id="themeToggle"
            title="Cambiar tema"
            onClick={toggleTheme}
          >
            <i className={theme === 'dark' ? "fas fa-sun" : "fas fa-moon"}></i>
          </button>
          <button
            type="button"
            className="btn btn-icon app-tooltip"
            id="logoutButton"
            title="Cerrar sesión"
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

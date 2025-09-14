import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', borderRadius: 6, textDecoration: 'none', color: '#111827' };
  const activeStyle: React.CSSProperties = { ...linkStyle, background: '#e5e7eb' };

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#ffffff' }}>
      <div style={{ fontWeight: 700, marginRight: 16 }}>Factory Map</div>
      <NavLink to="/" end style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>Viewer</NavLink>
      <NavLink to="/editor" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>Editor</NavLink>
      <NavLink to="/settings" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>Settings</NavLink>
    </nav>
  );
}



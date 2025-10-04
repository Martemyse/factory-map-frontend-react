import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', borderRadius: 6, textDecoration: 'none', color: '#60a5fa' };
  const activeStyle: React.CSSProperties = { ...linkStyle, background: '#111827' };

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderBottom: '1px solid #1f2937', background: '#0b0f17' }}>
      <div style={{ fontWeight: 700, marginRight: 16, color: 'white' }}>Factory Map</div>
      <NavLink to="/" end style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>Viewer</NavLink>
      <NavLink to="/settings" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>Settings</NavLink>
    </nav>
  );
}



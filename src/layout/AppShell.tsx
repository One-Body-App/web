import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Plus, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';
import { ApiOfflineBanner } from '@/components/ApiOfflineBanner';
import { useAuth } from '@/auth/context';
import { NAV_ITEMS } from './navItems';
import { DiscoverRail } from './DiscoverRail';
import './AppShell.css';

export function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="shell">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="shell__sidebar">
        <NavLink to="/home" className="shell__brand" aria-label="One Body home">
          <Logo size={30} withWordmark />
        </NavLink>

        <nav className="shell__nav">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `shell__navlink${isActive ? ' is-active' : ''}`}
            >
              <Icon size={23} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="btn btn--brand btn--block shell__post" onClick={() => navigate('/post/new')}>
          <Plus size={20} strokeWidth={2.5} />
          Post
        </button>

        {user ? (
          <NavLink to="/profile" className="shell__me">
            <Avatar src={user.imageUrl} alt={user.fullName} size={40} />
            <span className="shell__me-text">
              <strong>{user.fullName}</strong>
              <small>@{user.username}</small>
            </span>
          </NavLink>
        ) : null}
      </aside>

      {/* -------- Mobile top bar (matches the app: avatar · logo · bell) -------- */}
      <header className="shell__topbar glass">
        <button
          className="shell__topbar-me"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Avatar src={user?.imageUrl ?? '/brand/avatar1.png'} alt={user?.fullName ?? 'Menu'} size={32} />
        </button>

        <NavLink to="/home" className="shell__topbar-logo" aria-label="One Body home">
          <Logo size={28} />
        </NavLink>

        <NavLink to="/notifications" className="iconbtn" aria-label="Notifications">
          <Bell size={24} />
          <span className="iconbtn__dot" />
        </NavLink>
      </header>

      {/* ---------------- Mobile drawer (hamburger menu) ---------------- */}
      <div
        className={`shell__drawer-scrim${menuOpen ? ' is-open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={`shell__drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="shell__drawer-head">
          <NavLink to="/home" className="shell__brand" aria-label="One Body home">
            <Logo size={28} withWordmark />
          </NavLink>
          <button className="iconbtn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        <nav className="shell__nav">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `shell__navlink${isActive ? ' is-active' : ''}`}
            >
              <Icon size={22} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="btn btn--brand btn--block shell__post"
          onClick={() => {
            setMenuOpen(false);
            navigate('/post/new');
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          Post
        </button>

        {user ? (
          <NavLink to="/profile" className="shell__me">
            <Avatar src={user.imageUrl} alt={user.fullName} size={40} />
            <span className="shell__me-text">
              <strong>{user.fullName}</strong>
              <small>@{user.username}</small>
            </span>
          </NavLink>
        ) : null}
      </aside>

      {/* ---------------- Content ---------------- */}
      <main className="shell__content">
        <ApiOfflineBanner />
        <Outlet />
      </main>

      {/* ---------------- Desktop discover rail ---------------- */}
      <DiscoverRail />

      {/* ---------------- Mobile bottom tab bar ---------------- */}
      <nav className="shell__tabbar glass">
        {NAV_ITEMS.filter((n) => n.mobile)
          .slice(0, 2)
          .map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `shell__tab${isActive ? ' is-active' : ''}`}
            >
              <Icon size={26} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}

        <button className="shell__tab-fab" onClick={() => navigate('/post/new')} aria-label="Create post">
          <Plus size={26} strokeWidth={2.5} />
        </button>

        {NAV_ITEMS.filter((n) => n.mobile)
          .slice(2, 4)
          .map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `shell__tab${isActive ? ' is-active' : ''}`}
            >
              <Icon size={26} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
      </nav>
    </div>
  );
}

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Plus, Search } from 'lucide-react';
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

  const title = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to))?.label ?? 'One Body';

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

      {/* ---------------- Mobile top bar ---------------- */}
      <header className="shell__topbar glass">
        <NavLink to="/home" aria-label="One Body home">
          <Logo size={26} withWordmark />
        </NavLink>
        <span className="shell__topbar-title">{title}</span>
        <div className="shell__topbar-actions">
          <NavLink to="/explore" className="iconbtn" aria-label="Search">
            <Search size={22} />
          </NavLink>
          <NavLink to="/notifications" className="iconbtn" aria-label="Notifications">
            <Bell size={22} />
            <span className="iconbtn__dot" />
          </NavLink>
          {user ? (
            <NavLink to="/profile" className="shell__topbar-me" aria-label="Your profile">
              <Avatar src={user.imageUrl} alt={user.fullName} size={34} />
            </NavLink>
          ) : null}
        </div>
      </header>

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

import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../lib/useWishlist";
import Wordmark from "./Wordmark";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `text-sm tracking-wide transition-colors focus-ring rounded flex items-center gap-1.5 ${
      isActive ? "text-primary font-semibold" : "text-muted hover:text-ink"
    }`;

  const mobileLinkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2.5 text-sm ${isActive ? "bg-primary/5 font-semibold text-primary" : "text-ink"}`;

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b hairline bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 focus-ring rounded" onClick={closeMenu}>
          <span className="stamp h-8 w-8 text-primary text-[6px] shrink-0">
            <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <Wordmark className="text-xl" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <NavLink to="/listings" className={linkClass}>Browse Cars</NavLink>
          <NavLink to="/dealers" className={linkClass}>Dealers</NavLink>
          <NavLink to="/listings?saved=true" className={linkClass}>
            <span>❤️ Saved</span>
            {wishlistCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {wishlistCount}
              </span>
            )}
          </NavLink>
          {user?.role === "dealer" && <NavLink to="/dealer" className={linkClass}>Dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <span className="text-sm text-muted">Hi, {user.name.split(" ")[0]}</span>
                <button
                  onClick={async () => { await logout(); navigate("/"); }}
                  className="focus-ring rounded-full border hairline px-4 py-1.5 text-sm text-ink hover:border-primary hover:text-primary"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="focus-ring rounded-full px-4 py-1.5 text-sm text-ink hover:text-primary">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="focus-ring rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-paper hover:bg-primary-light"
                >
                  List your cars
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="focus-ring rounded-lg p-2 text-ink md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t hairline px-4 py-3 md:hidden space-y-1">
          <NavLink to="/listings" className={mobileLinkClass} onClick={closeMenu}>Browse Cars</NavLink>
          <NavLink to="/dealers" className={mobileLinkClass} onClick={closeMenu}>Dealers</NavLink>
          <NavLink to="/listings?saved=true" className={mobileLinkClass} onClick={closeMenu}>
            ❤️ Saved Cars ({wishlistCount})
          </NavLink>
          {user?.role === "dealer" && <NavLink to="/dealer" className={mobileLinkClass} onClick={closeMenu}>Dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin" className={mobileLinkClass} onClick={closeMenu}>Admin</NavLink>}
          <div className="mt-2 border-t hairline pt-3">
            {user ? (
              <button
                onClick={async () => { await logout(); closeMenu(); navigate("/"); }}
                className="focus-ring block w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink"
              >
                Sign out ({user.name.split(" ")[0]})
              </button>
            ) : (
              <div className="flex flex-col gap-2 px-3">
                <Link to="/login" onClick={closeMenu} className="focus-ring rounded-full border hairline py-2 text-center text-sm text-ink">
                  Sign in
                </Link>
                <Link to="/signup" onClick={closeMenu} className="focus-ring rounded-full bg-primary py-2 text-center text-sm font-medium text-paper">
                  List your cars
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

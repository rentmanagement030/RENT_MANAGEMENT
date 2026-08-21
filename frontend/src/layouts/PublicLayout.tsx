import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Building2, Facebook, Instagram, Mail, MapPin, Menu, Phone, Twitter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PUBLIC_LINKS = [
  { to: "/", label: "Home" },
  { to: "/houses", label: "Houses" },
  { to: "/pgs", label: "PGs" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
              <Building2 className="size-5" />
            </span>
            <span className="text-xl font-black tracking-tight text-slate-900">
              C2D <span className="text-blue-600">Properties</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-700 md:flex">
            {PUBLIC_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn("transition-colors hover:text-blue-600 py-1", isActive ? "text-blue-600 font-black border-b-2 border-blue-600" : "text-slate-700")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              Staff Portal
            </Link>
            <button
              type="button"
              className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <ul className="space-y-1">
              {PUBLIC_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-xl px-3 py-2.5 text-sm font-bold transition-colors hover:bg-slate-100",
                        isActive ? "bg-blue-50 text-blue-600" : "text-slate-700",
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                <Building2 className="size-4" />
              </span>
              <span className="font-bold text-white">C2D Properties</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Safe, affordable houses and PGs across Chennai, Coimbatore and Bengaluru. Managed by C2D Tech.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {PUBLIC_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-slate-400 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="size-4" /> +91 90000 00000
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4" /> contact@c2dtech.in
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4" /> Velachery, Chennai
              </li>
            </ul>
            <div className="mt-4 flex gap-3 text-slate-400">
              <Facebook className="size-5 hover:text-white" />
              <Instagram className="size-5 hover:text-white" />
              <Twitter className="size-5 hover:text-white" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} C2D Tech Properties. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FileCheck2,
  Grid,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Shield,
  UserCircle2,
  Users,
  Wrench,
  X,
  CreditCard,
  WalletCards,
  TrendingUp,
  UserCheck,
  Bell,
  BarChart3,
  FileSpreadsheet,
  Globe,
  CalendarCheck,
  Footprints,
  BedSingle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS, type PermissionValue } from "@/lib/permissions";
import { MobileQuickActionSheet } from "@/components/ui/MobileQuickActionSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  permission: PermissionValue;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_READ },
    ],
  },
  {
    section: "Property & Tenants",
    items: [
      { to: "/admin/properties", label: "Properties", icon: Building2, permission: PERMISSIONS.PROPERTIES_READ },
      { to: "/admin/leads", label: "Leads & Enquiries", icon: UserCircle2, permission: PERMISSIONS.TENANTS_READ },
      { to: "/admin/property-taxes", label: "Property Taxes & Utilities", icon: Receipt, permission: PERMISSIONS.PROPERTIES_READ },
      { to: "/admin/tenants", label: "Tenants", icon: Users, permission: PERMISSIONS.TENANTS_READ },
      { to: "/admin/agreements", label: "Agreements", icon: FileCheck2, permission: PERMISSIONS.AGREEMENTS_READ },
      { to: "/admin/rent", label: "Rent Records", icon: ClipboardList, permission: PERMISSIONS.RENT_READ },
      { to: "/admin/bills", label: "Bills", icon: FileText, permission: PERMISSIONS.BILLS_READ },
    ],
  },
  {
    section: "Finance & Expenses",
    items: [
      { to: "/admin/payments", label: "Payments", icon: CreditCard, permission: PERMISSIONS.PAYMENTS_READ },
      { to: "/admin/outstanding", label: "Outstanding Dues", icon: WalletCards, permission: PERMISSIONS.RENT_READ },
      { to: "/admin/expenses", label: "Expenses", icon: Receipt, permission: PERMISSIONS.REPORTS_READ },
      { to: "/admin/accounting", label: "Accounting P&L", icon: TrendingUp, permission: PERMISSIONS.REPORTS_READ },
    ],
  },
  {
    section: "Operations",
    items: [
      { to: "/admin/maintenance", label: "Maintenance", icon: Wrench, permission: PERMISSIONS.MAINTENANCE_MANAGE },
      { to: "/admin/staff-vendors", label: "Staff & Vendors", icon: UserCheck, permission: PERMISSIONS.USERS_READ },
      { to: "/admin/notifications", label: "Notifications", icon: Bell, permission: PERMISSIONS.NOTIFICATIONS_READ },
    ],
  },
  {
    section: "Insights & Admin",
    items: [
      { to: "/admin/reports", label: "Reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_READ },
      { to: "/admin/users", label: "Users & Roles", icon: Shield, permission: PERMISSIONS.USERS_READ },
      { to: "/admin/audit", label: "Audit Logs", icon: FileSpreadsheet, permission: PERMISSIONS.AUDIT_READ },
      { to: "/admin/settings", label: "Settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
];

const MOBILE_BOTTOM_TABS = [
  { to: "/admin", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/admin/properties", label: "Properties", icon: Building2 },
  { to: "/admin/tenants", label: "Tenants", icon: Users },
  { to: "/admin/rent", label: "Rent", icon: ClipboardList },
];

export function AdminLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop sidebar collapse & pin state (persisted to localStorage)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem("c2d_sidebar_pinned") === "true";
    } catch {
      return true;
    }
  });

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save pinned preference
  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("c2d_sidebar_pinned", String(next));
      } catch {}
      return next;
    });
  };

  // Hover handlers for smooth proximity expansion
  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const isExpanded = isPinned || isHovered;

  const visibleNav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((i) => can(i.permission)),
  })).filter((g) => g.items.length > 0);

  // Derive dynamic breadcrumb path & page title
  const currentPathSegment = location.pathname.split("/").filter(Boolean).slice(1)[0] || "dashboard";
  const activeNavItem = NAV.flatMap((g) => g.items).find((i) =>
    i.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(i.to)
  );

  const pageTitle = activeNavItem ? activeNavItem.label : currentPathSegment.charAt(0).toUpperCase() + currentPathSegment.slice(1);

  // Render Desktop Sidebar
  const desktopSidebar = (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "flex h-full flex-col bg-[#0F172A] text-slate-300 border-r border-slate-800/90 shadow-xl transition-[width] duration-200 ease-in-out relative select-none",
        isExpanded ? "w-[264px]" : "w-[72px]"
      )}
    >
      {/* BRAND HEADER & PIN CONTROL */}
      <div className="flex h-16 items-center justify-between px-3.5 border-b border-slate-800/80 shrink-0">
        <Link
          to="/admin"
          className={cn(
            "flex items-center gap-3 transition-all duration-200 overflow-hidden",
            isExpanded ? "justify-start pl-1" : "justify-center w-full"
          )}
          title="C2D Rentals Dashboard"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
            <Building2 className="size-5" />
          </span>
          {isExpanded && (
            <div className="min-w-0 flex-1 animate-in fade-in duration-200">
              <p className="text-sm font-extrabold tracking-tight text-white truncate leading-tight">C2D Rentals</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 truncate">Rent Management SaaS</p>
            </div>
          )}
        </Link>

        {/* PIN / TOGGLE BUTTON (EXPANDED ONLY OR ON HOVER) */}
        {isExpanded && (
          <button
            onClick={togglePin}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border text-slate-400 hover:text-white transition-colors shrink-0",
              isPinned
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "border-slate-800 bg-slate-900/60 hover:bg-slate-800"
            )}
            title={isPinned ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={isPinned ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isPinned ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>

      {/* NAVIGATION ITEMS */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-none">
        {visibleNav.map((group, gIdx) => (
          <div key={group.section} className={cn(gIdx > 0 && !isExpanded ? "border-t border-slate-800/80 pt-3" : "")}>
            {/* GROUP HEADINGS */}
            {isExpanded ? (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 truncate animate-in fade-in duration-200">
                {group.section}
              </p>
            ) : null}

            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.to === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.to);

                return (
                  <li key={item.to} className="relative group">
                    <NavLink
                      to={item.to}
                      end={item.to === "/admin"}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 relative min-h-[44px]",
                        isExpanded ? "justify-start" : "justify-center px-0",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {isExpanded && (
                        <span className="flex-1 truncate animate-in fade-in duration-200">{item.label}</span>
                      )}
                    </NavLink>

                    {/* ACCESSIBLE TOOLTIP WHEN COLLAPSED */}
                    {!isExpanded && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block z-50 pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
                          {item.label}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* FOOTER: VIEW PUBLIC WEBSITE */}
      <div className="border-t border-slate-800 p-3 shrink-0">
        <Link
          to="/"
          className={cn(
            "flex items-center rounded-xl bg-slate-900 border border-slate-800 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors relative group min-h-[44px]",
            isExpanded ? "justify-between px-3.5" : "justify-center px-0"
          )}
        >
          <span className="flex items-center gap-2.5 truncate">
            <Globe className="size-4 text-blue-400 shrink-0" />
            {isExpanded && <span className="truncate">Public Portal</span>}
          </span>
          {isExpanded && <ChevronRight className="size-3.5 text-slate-500 shrink-0" />}

          {/* TOOLTIP WHEN COLLAPSED */}
          {!isExpanded && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
                Public Portal
              </div>
            </div>
          )}
        </Link>
      </div>
    </div>
  );

  // Render Mobile Sidebar Drawer
  const mobileSidebar = (
    <div className="flex h-full flex-col bg-[#0F172A] text-slate-300 border-r border-slate-800 w-72">
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80">
        <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-base font-extrabold tracking-tight text-white">C2D Rentals</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Rent Management SaaS</p>
          </div>
        </Link>
        <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4 scrollbar-none">
        {visibleNav.map((group) => (
          <div key={group.section}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.section}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.to === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.to);

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/admin"}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all min-h-[44px]",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors min-h-[44px]"
        >
          <span className="flex items-center gap-2.5">
            <Globe className="size-4 text-blue-400" />
            Public Portal
          </span>
          <ChevronRight className="size-4 text-slate-500" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* DESKTOP SIDEBAR (FIXED COLLAPSIBLE NAV RAIL) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        {desktopSidebar}
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 max-w-[80vw] shadow-2xl animate-in slide-in-from-left">
            {mobileSidebar}
          </aside>
        </div>
      )}

      {/* MAIN CONTAINER WITH DYNAMIC PADDING-LEFT */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding-left] duration-200 ease-in-out",
          isExpanded ? "lg:pl-[264px]" : "lg:pl-[72px]"
        )}
      >
        {/* TOP HEADER WITH DYNAMIC BREADCRUMB PAGE CONTEXT */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 lg:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 lg:hidden active:scale-95 transition-transform min-h-[44px] min-w-[44px]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile menu"
            >
              <Menu className="size-5" />
            </button>

            {/* QUICK DESKTOP PIN TOGGLE BUTTON IN HEADER (WHEN UNPINNED) */}
            {!isPinned && (
              <button
                onClick={togglePin}
                className="hidden lg:flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="size-4" />
              </button>
            )}

            {/* BREADCRUMB PAGE CONTEXT */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <span>C2D Rentals</span>
                <ChevronRight className="size-3 text-slate-300" />
                <span className="text-blue-600 font-extrabold">{pageTitle}</span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 leading-none mt-0.5">{pageTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-slate-50 p-1.5 pr-3 hover:bg-slate-100 transition-colors shadow-2xs min-h-[44px]">
                  <span className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white shadow-xs">
                    {user?.name?.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden text-xs font-bold text-slate-800 sm:block">{user?.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 text-slate-900 shadow-xl">
                <DropdownMenuLabel className="text-slate-500">Signed in as {user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem className="focus:bg-slate-50 focus:text-blue-600" onClick={() => navigate("/admin/settings")}>
                  <UserCircle2 className="size-4 text-blue-600" />
                  Account & Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-rose-50 focus:text-rose-600 text-rose-600"
                  onClick={async () => {
                    await logout();
                    navigate("/admin/login");
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 lg:pb-8 min-w-0 max-w-full">
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button for Mobile */}
      <MobileQuickActionSheet />

      {/* Fixed Mobile Bottom Navigation Tab Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-slate-200/90 bg-white/95 backdrop-blur-xl px-2 lg:hidden shadow-lg">
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const isActive = tab.exact ? location.pathname === tab.to : location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold transition-all active:scale-95",
                isActive ? "text-blue-600 font-extrabold" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-all",
                  isActive ? "bg-blue-50 border border-blue-200 text-blue-600" : ""
                )}
              >
                <tab.icon className="size-5" />
              </div>
              <span className="mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-slate-500 active:scale-95"
        >
          <div className="flex size-8 items-center justify-center rounded-xl">
            <Grid className="size-5" />
          </div>
          <span className="mt-0.5">More</span>
        </button>
      </nav>
    </div>
  );
}

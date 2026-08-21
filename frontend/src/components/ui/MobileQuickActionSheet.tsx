import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Building2,
  FileText,
  Plus,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";

export function MobileQuickActionSheet() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();

  const handleAction = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const actions = [
    {
      label: "Add Tenant",
      icon: UserPlus,
      color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      path: "/admin/tenants?action=new",
      permission: PERMISSIONS.TENANTS_MANAGE,
    },
    {
      label: "Record Payment",
      icon: Banknote,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      path: "/admin/payments?action=new",
      permission: PERMISSIONS.PAYMENTS_CREATE,
    },
    {
      label: "Add Property",
      icon: Building2,
      color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
      path: "/admin/properties?action=new",
      permission: PERMISSIONS.PROPERTIES_MANAGE,
    },
    {
      label: "Create Bill",
      icon: FileText,
      color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
      path: "/admin/bills?action=new",
      permission: PERMISSIONS.BILLS_MANAGE,
    },
    {
      label: "Log Maintenance",
      icon: Wrench,
      color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
      path: "/admin/maintenance?action=new",
      permission: PERMISSIONS.MAINTENANCE_MANAGE,
    },
  ].filter((a) => can(a.permission));

  if (!actions.length) return null;

  return (
    <>
      {/* FAB Floating Button */}
      <div className="fixed bottom-20 right-4 z-40 lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition-transform active:scale-95 focus:outline-none"
          aria-label="Quick Action"
        >
          <Plus className={`size-7 transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
        </button>
      </div>

      {/* Slide-Up Action Sheet Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white p-6 shadow-2xl animate-bottom-sheet">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Quick Actions</h3>
                <p className="text-xs font-semibold text-slate-500">Perform common tasks in one tap</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {actions.map((act) => (
                <button
                  key={act.label}
                  onClick={() => handleAction(act.path)}
                  className={`flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all active:scale-95 ${act.color}`}
                >
                  <act.icon className="size-6" />
                  <span className="text-sm font-extrabold leading-tight">{act.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

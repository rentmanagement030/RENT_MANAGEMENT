import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calendar,
  CreditCard,
  FileCheck,
  FileText,
  Plus,
  Receipt,
  User,
  Zap,
  ArrowLeftRight,
  ShieldCheck,
  Camera,
} from "lucide-react";
import { api } from "@/lib/api";
import { PropertyHome } from "@/types";
import { formatINR } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";

interface HomeDetailPageProps {
  homeId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function HomeDetailPage({ homeId, isOpen, onClose, onRefresh }: HomeDetailPageProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState<PropertyHome | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "tenant" | "financials" | "taxes" | "activity">("overview");

  useEffect(() => {
    if (!homeId || !isOpen) return;

    setLoading(true);
    api
      .getHome(homeId)
      .then((res) => {
        setHome(res);
      })
      .catch((err) => console.error("Failed to load home details", err))
      .finally(() => setLoading(false));
  }, [homeId, isOpen]);

  const handleRecordRent = () => {
    if (!home) return;
    onClose();
    if (home.activeTenant) {
      navigate(`/admin/payments?tenantId=${home.activeTenant.id}&action=new`);
    } else {
      navigate(`/admin/payments?propertyId=${home.propertyId}&homeId=${home.id}&action=new`);
    }
  };

  const handleViewAgreement = () => {
    if (!home) return;
    onClose();
    if (home.activeTenant) {
      navigate(`/admin/agreements?tenantId=${home.activeTenant.id}`);
    } else {
      navigate(`/admin/agreements?propertyId=${home.propertyId}&homeId=${home.id}&action=new`);
    }
  };

  const handleRecordTax = () => {
    if (!home) return;
    onClose();
    navigate(`/admin/property-taxes?propertyId=${home.propertyId}&homeId=${home.id}&action=new`);
  };

  const handleTransferTenant = () => {
    if (!home) return;
    onClose();
    if (home.activeTenant) {
      navigate(`/admin/tenants/${home.activeTenant.id}`);
    } else {
      navigate(`/admin/tenants?propertyId=${home.propertyId}&homeId=${home.id}&action=new`);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={home ? `Home 360° View — ${home.homeNumber}` : "Home Details"}>
      {loading || !home ? (
        <div className="p-8 text-center text-slate-500 text-sm">Loading Home details...</div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-blue-400 font-semibold uppercase">{home.floor}</span>
                <h3 className="text-xl font-bold">{home.homeNumber}</h3>
                <p className="text-xs text-slate-400">{home.homeType} • {home.builtUpArea ? `${home.builtUpArea} sqft` : "Standard Unit"}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  home.status === "OCCUPIED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : home.status === "AVAILABLE"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {home.status}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div>
                <span className="text-slate-400 block">Monthly Rent</span>
                <span className="font-bold text-white text-sm">{formatINR(home.rent)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Advance</span>
                <span className="font-bold text-white text-sm">{formatINR(home.advance)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Deposit</span>
                <span className="font-bold text-white text-sm">{formatINR(home.deposit)}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleRecordRent}
              className="flex-1 py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-semibold text-[11px] inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" /> Record Rent
            </button>
            <button
              type="button"
              onClick={handleViewAgreement}
              className="flex-1 py-1.5 px-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-semibold text-[11px] inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5" /> View Agreement
            </button>
            <button
              type="button"
              onClick={handleRecordTax}
              className="flex-1 py-1.5 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold text-[11px] inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" /> Record Tax
            </button>
            <button
              type="button"
              onClick={handleTransferTenant}
              className="flex-1 py-1.5 px-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded font-semibold text-[11px] inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer Tenant
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-2 border-b-2 ${activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("tenant")}
              className={`pb-2 border-b-2 ${activeTab === "tenant" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            >
              Tenant
            </button>
            <button
              onClick={() => setActiveTab("financials")}
              className={`pb-2 border-b-2 ${activeTab === "financials" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            >
              Financials
            </button>
            <button
              onClick={() => setActiveTab("taxes")}
              className={`pb-2 border-b-2 ${activeTab === "taxes" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            >
              Taxes & Utilities
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium block">Bedrooms / Bathrooms</span>
                  <span className="font-bold text-slate-900">{home.bedrooms || 2} BHK • {home.bathrooms || 2} Bath</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium block">Rent Due Day & Penalty</span>
                  <span className="font-bold text-slate-900">Day {home.dueDay} • ₹{home.latePenalty}/day</span>
                </div>
              </div>

              {/* EB & Water Connections summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" /> Utility Connections
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">EB Service No:</span>
                    <span className="font-mono font-semibold text-slate-900">{home.ebNumber || "Shared Property EB"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Water Consumer No:</span>
                    <span className="font-mono font-semibold text-slate-900">{home.waterConsumerNumber || "Shared Property Water"}</span>
                  </div>
                </div>
              </div>

              {/* Home Gallery Photos */}
              {home.imageUrls && home.imageUrls.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Camera className="size-3.5 text-slate-600 inline" /> Unit Photos ({home.imageUrls.length})
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {home.imageUrls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer" className="block aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Home ${home.homeNumber} Photo ${idx + 1}`} className="size-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tenant" && (
            <div className="space-y-3">
              {home.activeTenant ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">{home.activeTenant.name}</h4>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-slate-600">Phone: {home.activeTenant.phone || "—"}</p>
                  <p className="text-slate-600">
                    Joining Date: {home.activeTenant.joiningDate ? new Date(home.activeTenant.joiningDate).toLocaleDateString("en-IN") : "—"}
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">No active tenant currently allocated to this home.</div>
              )}
            </div>
          )}

          {activeTab === "taxes" && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <h4 className="font-bold text-blue-900">Tax Status Summary</h4>
                <p className="text-slate-600">
                  Property tax and water tax obligations configured for Home {home.homeNumber}.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Individual EB Connection:</span>
                  <span className="font-mono">{home.ebNumber || "SHARED"}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Individual Water Connection:</span>
                  <span className="font-mono">{home.waterConsumerNumber || "SHARED"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

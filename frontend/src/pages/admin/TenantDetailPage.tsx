import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Trash2,
  Upload,
  Users,
  Building2,
  BedDouble,
  MapPin,
  Calendar,
  Phone,
  ShieldCheck,
  CreditCard,
  ArrowRightLeft,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  XCircle,
  UserCheck,
  UserX,
  Plus,
  RefreshCw,
  FolderOpen,
  UserRound,
  Wallet,
  Lock,
  Download,
  Check,
  Home,
} from "lucide-react";
import { api, downloadUrl } from "@/lib/api";
import { formatINR, formatDate, formatPropertyType } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { EmptyState, KycStatusBadge, StatusBadge } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import FileViewer from "@/components/FileViewer";
import { validateName, validatePhone, validateEmail, validateAadhaar, formatAadhaarInput } from "@/lib/validation";
import type { FamilyMember, Tenant, TenantDocument } from "@/types";

// Official WhatsApp SVG Logo Icon
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function getInitials(name: string): string {
  if (!name) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [uploading, setUploading] = useState(false);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"overview" | "ledger" | "kyc" | "family" | "history">(
    tabParam === "kyc" || tabParam === "ledger" || tabParam === "family" || tabParam === "history" ? tabParam : "overview"
  );

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "kyc" || t === "ledger" || t === "family" || t === "history" || t === "overview") {
      setActiveTab(t);
    }
  }, [searchParams]);

  const [transferOpen, setTransferOpen] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", id],
    queryFn: () => api.getTenant(id!),
    enabled: !!id,
  });

  const { data: rent, refetch: refetchRent } = useQuery({
    queryKey: ["rent", id],
    queryFn: () => api.listRent({ tenantId: id, pageSize: 12 }),
    enabled: !!id,
  });

  const { data: transfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["transfers", id],
    queryFn: () => api.listTenantTransfers(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tenant", id] });
    qc.invalidateQueries({ queryKey: ["family", id] });
    qc.invalidateQueries({ queryKey: ["tenant-documents", id] });
    refetchRent();
    refetchTransfers();
  };

  const { data: documents } = useQuery({
    queryKey: ["tenant-documents", id],
    queryFn: () => api.listTenantDocuments(id!),
    enabled: !!id,
  });

  const { data: family, refetch: refetchFamily } = useQuery({
    queryKey: ["family", id],
    queryFn: () => api.listFamilyMembers(id!),
    enabled: !!id,
  });

  const [familyOpen, setFamilyOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.deleteFamilyMember(id!, memberId),
    onSuccess: () => {
      success("Family member removed");
      setDeletingMember(null);
      refetchFamily();
      qc.invalidateQueries({ queryKey: ["tenant", id] });
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  if (isLoading || !tenant) return <PageLoader />;

  const docs = documents ?? [];
  const activeRentItems = rent?.items ?? [];
  const totalOutstanding = activeRentItems.reduce((acc, r) => acc + Number(r.outstanding || 0), 0);
  const cleanPhone = (tenant.phone ?? "").replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

  const waUrl = cleanPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hi ${tenant.name}, regarding your stay at ${tenant.property?.name ?? "C2D Rentals"}...`)}`
    : null;

  const portalUrl = cleanPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(
        `Hello ${tenant.name},\n\n` +
        `Access your C2D Rentals Tenant Portal here:\n` +
        `${window.location.origin}/tenant/login?phone=${cleanPhone}\n\n` +
        `Registered Mobile: ${tenant.phone}`
      )}`
    : null;

  return (
    <div className="p-3.5 sm:p-6 space-y-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. TOP COMPACT PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/tenants"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="size-4" /> Back to Tenants
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-slate-900">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can(PERMISSIONS.PAYMENTS_CREATE) && (
            <Link
              to={`/admin/payments?tenantId=${tenant.id}&action=new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
            >
              <CreditCard className="size-3.5" /> Record Payment
            </Link>
          )}

          {can(PERMISSIONS.TENANTS_MANAGE) && tenant.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="outline"
              className="font-bold border-slate-300 text-slate-800 rounded-xl h-9 px-3.5 hidden sm:inline-flex"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowRightLeft className="size-3.5 mr-1 text-slate-500" /> Transfer
            </Button>
          )}

          {can(PERMISSIONS.TENANTS_MANAGE) && (
            <Link
              to={`/admin/tenants?edit=${tenant.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 px-3.5 py-2 text-xs font-bold hover:bg-slate-200 transition-all"
            >
              <Pencil className="size-3.5" /> Edit Profile
            </Link>
          )}

          <DetailPageActionMenu
            tenant={tenant}
            canManage={can(PERMISSIONS.TENANTS_MANAGE)}
            onTransfer={() => setTransferOpen(true)}
          />
        </div>
      </div>

      {/* 2. TENANT HERO SUMMARY & FINANCIAL BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          {/* Avatar & Profile Identity */}
          <div className="flex items-start sm:items-center gap-4">
            {(tenant as any).photographStorageKey ? (
              <img
                src={`/api/files/${(tenant as any).photographStorageKey}`}
                alt={tenant.name}
                className="size-16 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-xl shadow-xs">
                {getInitials(tenant.name)}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{tenant.name}</h2>
                <StatusBadge status={tenant.status} />
              </div>

              <div className="flex flex-wrap items-center gap-y-1.5 gap-x-2.5 text-xs font-semibold text-slate-600">
                <a href={`tel:${tenant.phone}`} className="flex items-center gap-1 hover:text-blue-600 font-bold">
                  <Phone className="size-3.5 text-slate-400" /> {tenant.phone || "No phone"}
                </a>
                {tenant.email && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <span>·</span> {tenant.email}
                  </span>
                )}
                {tenant.property && (
                  <Link to={`/admin/properties/${tenant.property.id}`} className="flex items-center gap-1 font-bold text-blue-600 hover:underline">
                    <span>·</span>
                    <Building2 className="size-3.5" /> {tenant.property.name}
                    {tenant.room ? ` (Room ${tenant.room.roomNumber})` : ""}
                    {tenant.bed ? ` · Bed ${tenant.bed.bedNumber}` : ""}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contact Actions (3 Equal Buttons occupying 33.3% width each in 1 row on mobile) */}
          {tenant.phone && (
            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto lg:flex lg:items-center">
              <a
                href={`tel:${tenant.phone}`}
                className="inline-flex h-10 px-2.5 sm:px-4 items-center justify-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-200 transition-all text-center w-full lg:w-auto"
              >
                <Phone className="size-3.5 text-slate-600 shrink-0" /> <span>Call</span>
              </a>

              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 px-2.5 sm:px-4 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs text-center w-full lg:w-auto"
                >
                  <WhatsAppIcon className="size-4 shrink-0" /> <span>WhatsApp</span>
                </a>
              )}

              {portalUrl && (
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 px-2 sm:px-3.5 items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-xs hover:bg-blue-100 transition-all text-center w-full lg:w-auto"
                  title="Send Tenant Portal Credentials via WhatsApp"
                >
                  <ExternalLink className="size-3.5 text-blue-600 shrink-0" /> <span className="truncate">Portal Login</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Financial Summary Bar (Subtle vertical separators on desktop, 2-col on mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Monthly Rent</span>
            <span className="text-base sm:text-lg font-black text-emerald-600 block">{formatINR(tenant.rent)}</span>
          </div>

          <div className="space-y-0.5 lg:border-l border-slate-200/80 lg:pl-5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Advance Paid</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 block">{formatINR(tenant.advance)}</span>
          </div>

          <div className="space-y-0.5 lg:border-l border-slate-200/80 lg:pl-5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Security Deposit</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 block">{formatINR(tenant.deposit)}</span>
          </div>

          <div className="space-y-0.5 lg:border-l border-slate-200/80 lg:pl-5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Outstanding Dues</span>
            <span className={`text-sm sm:text-base font-black block ${totalOutstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {totalOutstanding > 0 ? formatINR(totalOutstanding) : "Cleared"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. PROFILE NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeTab === "ledger"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Financials ({activeRentItems.length})
        </button>

        <button
          onClick={() => setActiveTab("kyc")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeTab === "kyc"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Tenant Documents ({docs.length})
        </button>

        <button
          onClick={() => setActiveTab("family")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeTab === "family"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Family ({family?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            activeTab === "history"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Stay History ({transfers?.length || 0})
        </button>
      </div>

      {/* 4. MAIN CONTENT WORKSPACE */}
      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (70% on Desktop) */}
          <div className="lg:col-span-8 space-y-5">
            {/* STAY INFORMATION */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="size-4 text-blue-600" /> Stay & Property Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Property</span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {tenant.property ? (
                      <Link to={`/admin/properties/${tenant.property.id}`} className="text-blue-600 hover:underline">
                        {tenant.property.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400 font-medium">Unassigned</span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Property Category</span>
                  <p className="font-bold text-slate-800 text-sm">
                    {formatPropertyType(tenant.property?.type)}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">City / Locality</span>
                  <p className="font-bold text-slate-800 text-sm">{tenant.property?.city || "—"}</p>
                </div>

                {/* Conditional allocation: PG vs Residential House/Villa */}
                {tenant.property?.type === "PG" || tenant.property?.type === "HOSTEL" ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Room Allocation</span>
                      <p className="font-bold text-slate-900 text-sm">
                        {tenant.room ? `Room ${tenant.room.roomNumber}` : <span className="text-slate-400 font-medium">Unassigned</span>}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Bed Allocation</span>
                      <p className="font-bold text-slate-900 text-sm">
                        {tenant.bed ? `Bed ${tenant.bed.bedNumber}` : <span className="text-slate-400 font-medium">Unassigned</span>}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Unit / Home</span>
                      <p className="font-extrabold text-slate-900 text-sm">
                        {tenant.home ? (
                          <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200 inline-flex items-center gap-1.5 font-black">
                            <Home className="size-3.5 text-blue-600" />
                            {tenant.home.floor ? `${tenant.home.floor} · ` : ""}
                            {tenant.home.homeNumber || tenant.home.name || "Home Unit"}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Entire Property</span>
                        )}
                      </p>
                    </div>

                    {tenant.home?.homeType && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Unit Configuration</span>
                        <p className="font-bold text-slate-800 text-sm">{tenant.home.homeType}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Move-in / Joining Date</span>
                  <p className="font-bold text-blue-700 text-sm">{formatDate(tenant.joiningDate)}</p>
                </div>
              </div>
            </div>

            {/* FINANCIAL TERMS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="size-4 text-emerald-600" /> Contract Financial Terms
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Monthly Rent</span>
                  <span className="font-black text-emerald-600 text-base">{formatINR(tenant.rent)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Advance Paid</span>
                  <span className="font-bold text-slate-800 text-sm">{formatINR(tenant.advance)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Security Deposit</span>
                  <span className="font-bold text-slate-800 text-sm">{formatINR(tenant.deposit)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Outstanding</span>
                  <span className={`font-black text-sm ${totalOutstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {totalOutstanding > 0 ? formatINR(totalOutstanding) : "Cleared"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column (30% on Desktop) */}
          <div className="lg:col-span-4 space-y-5">
            {/* IDENTITY & EMERGENCY CONTACT */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserRound className="size-4 text-blue-600" /> Identity & Emergency Contact
                </h3>
              </div>

              <dl className="space-y-3 text-xs font-semibold">
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <dt className="text-slate-500 font-bold">Aadhaar / ID Number</dt>
                  <dd className="font-mono font-bold text-slate-900 text-right">{tenant.aadhaarNumber || <span className="text-slate-400 font-normal">Not provided</span>}</dd>
                </div>

                <div className="space-y-1 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500 font-bold">Permanent Address</dt>
                  <dd className="font-medium text-slate-800 leading-normal">{tenant.address || <span className="text-slate-400 font-normal">Not provided</span>}</dd>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <dt className="text-slate-500 font-bold">Emergency Contact</dt>
                  <dd className="font-bold text-slate-900">{tenant.emergencyName || <span className="text-slate-400 font-normal">Not provided</span>}</dd>
                </div>

                <div className="flex justify-between items-center">
                  <dt className="text-slate-500 font-bold">Emergency Phone</dt>
                  <dd className="font-bold text-slate-900">
                    {tenant.emergencyPhone ? (
                      <a href={`tel:${tenant.emergencyPhone}`} className="text-blue-600 hover:underline">
                        {tenant.emergencyPhone}
                      </a>
                    ) : (
                      <span className="text-slate-400 font-normal">Not provided</span>
                    )}
                  </dd>
                </div>

                {tenant.notes && (
                  <div className="pt-2 border-t border-slate-100">
                    <dt className="text-amber-700 font-bold text-[11px] uppercase">Admin Remarks</dt>
                    <dd className="text-slate-700 text-xs font-medium pt-1 leading-normal whitespace-pre-line">{tenant.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* TENANT DOCUMENTS CHECKLIST */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="size-4 text-blue-600" /> Document Vault Checklist
                </h3>
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {docs.length} Stored
                </span>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                {[
                  { key: "AADHAAR", label: "Aadhaar" },
                  { key: "PAN", label: "PAN" },
                  { key: "DRIVING_LICENCE", label: "Driving Licence" },
                  { key: "PASSPORT", label: "Passport" },
                  { key: "RENTAL_AGREEMENT", label: "Rental Agreement" },
                ].map(({ key, label }) => {
                  const isUploaded = docs.some((d) => d.type === key);
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-slate-700 font-bold">{label}</span>
                      {isUploaded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          <Check className="size-3 text-emerald-600" /> Uploaded
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Not uploaded
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setActiveTab("kyc")}
                className="w-full text-center text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline pt-2 block"
              >
                Manage Tenant Documents ({docs.length}) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIALS / RENT LEDGER */}
      {activeTab === "ledger" && (
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900">Rent Ledger & Monthly Billing</CardTitle>
              <p className="text-xs font-semibold text-slate-500">Historical rent statements, billing cycles, and dues collection.</p>
            </div>

            {tenant.phone && (
              <a
                href={`https://wa.me/91${tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${tenant.name}, kindly clear your pending rent dues for ${tenant.property?.name ?? "C2D Rentals"}.\nTotal Outstanding: ${formatINR(totalOutstanding)}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-all shadow-2xs"
              >
                <WhatsAppIcon className="size-3.5" /> Remind Dues
              </a>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {!rent?.items.length ? (
              <EmptyState title="No rent records generated yet" description="Rent records for this tenant will automatically appear every billing cycle." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Billing Month</th>
                      <th className="px-5 py-3.5">Monthly Rent</th>
                      <th className="px-5 py-3.5">Paid Amount</th>
                      <th className="px-5 py-3.5">Outstanding</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rent.items.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-black text-slate-900">{r.billingMonth}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800">{formatINR(r.rent)}</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">{formatINR(r.paidAmount)}</td>
                        <td className="px-5 py-3.5 font-bold text-rose-600">{formatINR(r.outstanding)}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: TENANT DOCUMENTS */}
      {activeTab === "kyc" && (
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="size-5 text-blue-600" /> Tenant Documents
              </CardTitle>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Securely store documents provided by the tenant.</p>
            </div>
            {can(PERMISSIONS.TENANTS_MANAGE) && (
              <Button size="sm" className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs self-start sm:self-auto shrink-0" onClick={() => setUploading(true)}>
                <Upload className="size-4 mr-1.5" /> Upload Document
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {docs.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="size-8 text-slate-400" />}
                title="No documents uploaded"
                description="Upload Aadhaar card, rental agreement, or photograph to complete tenant KYC verification."
                action={
                  can(PERMISSIONS.TENANTS_MANAGE) ? (
                    <Button size="sm" className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs" onClick={() => setUploading(true)}>
                      <Upload className="size-4 mr-1" /> Upload Document
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {docs.map((d) => (
                  <DocumentCard key={d.id} tenantId={tenant.id} doc={d} canManage={can(PERMISSIONS.TENANTS_MANAGE)} onDeleted={invalidate} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: FAMILY MEMBERS */}
      {activeTab === "family" && (
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 border-b border-slate-100">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="size-5 text-blue-600" /> Family Members & Dependents
              </CardTitle>
              <p className="text-xs font-semibold text-slate-500">Registered family members staying in the room.</p>
            </div>
            {can(PERMISSIONS.TENANTS_MANAGE) && (
              <Button
                size="sm"
                className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                onClick={() => {
                  setEditingMember(null);
                  setFamilyOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" /> Add Family Member
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {!family?.length ? (
              <div className="p-8 text-center space-y-3">
                <Users className="size-8 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-800">No family members registered.</p>
                <p className="text-xs text-slate-500 font-medium">Add spouse, children, or dependents residing with this tenant.</p>
                {can(PERMISSIONS.TENANTS_MANAGE) && (
                  <Button
                    size="sm"
                    className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                    onClick={() => {
                      setEditingMember(null);
                      setFamilyOpen(true);
                    }}
                  >
                    <Plus className="size-4 mr-1" /> Add Family Member
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {family.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-black text-slate-900 text-sm truncate">{m.name}</p>
                      <p className="text-xs font-bold text-slate-500">
                        Relation: <strong className="text-slate-800">{m.relation.replace(/_/g, " ")}</strong>
                        {m.age ? ` · ${m.age} yrs` : ""}
                        {m.isDependent ? " · Dependent" : ""}
                        {m.phone ? ` · Phone: ${m.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {can(PERMISSIONS.TENANTS_MANAGE) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-bold text-xs border-slate-200 rounded-xl"
                            onClick={() => {
                              setEditingMember(m);
                              setFamilyOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold text-xs rounded-xl"
                            onClick={() => setDeletingMember(m)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 5: STAY HISTORY */}
      {activeTab === "history" && (
        <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 border-b border-slate-100">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="size-5 text-purple-600" /> Stay Transfer & Shifting History
              </CardTitle>
              <p className="text-xs font-semibold text-slate-500">Complete historical timeline of property and room transfers.</p>
            </div>

            {can(PERMISSIONS.TENANTS_MANAGE) && tenant.status === "ACTIVE" && (
              <Button size="sm" variant="outline" className="font-extrabold text-xs border-slate-300 rounded-xl" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="size-3.5 mr-1" /> Transfer Tenant
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {!transfers?.length ? (
              <div className="p-8 text-center space-y-3">
                <Building2 className="size-8 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-800">No previous transfers recorded.</p>
                <p className="text-xs text-slate-500 font-medium">This resident is currently in their initial property assignment.</p>
                {can(PERMISSIONS.TENANTS_MANAGE) && tenant.status === "ACTIVE" && (
                  <Button size="sm" variant="outline" className="font-extrabold text-xs border-slate-300 rounded-xl" onClick={() => setTransferOpen(true)}>
                    <ArrowRightLeft className="size-3.5 mr-1" /> Transfer Tenant
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Period</th>
                      <th className="p-3">From Stay</th>
                      <th className="p-3">To Stay</th>
                      <th className="p-3">Rent (₹)</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {transfers.map((tr) => (
                      <tr key={tr.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-extrabold text-slate-900">
                          {formatDate(tr.effectiveFrom)} → {tr.effectiveTo ? formatDate(tr.effectiveTo) : <span className="text-emerald-600 font-black">Present</span>}
                        </td>
                        <td className="p-3 font-semibold">
                          {tr.fromProperty.name} {tr.fromRoom ? `· Rm ${tr.fromRoom.roomNumber}` : ""} {tr.fromBed ? `(Bed ${tr.fromBed.bedNumber})` : ""}
                        </td>
                        <td className="p-3 font-bold text-blue-700">
                          {tr.toProperty.name} {tr.toRoom ? `· Rm ${tr.toRoom.roomNumber}` : ""} {tr.toBed ? `(Bed ${tr.toBed.bedNumber})` : ""}
                        </td>
                        <td className="p-3 font-black text-slate-900">
                          {formatINR(tr.fromRent)} → <span className="text-emerald-600 font-black">{formatINR(tr.toRent)}</span>
                        </td>
                        <td className="p-3 font-bold text-slate-700">{tr.reason}</td>
                        <td className="p-3 text-slate-500">{tr.createdBy?.name || "System"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. MODALS & DIALOG OVERLAYS */}
      {uploading && (
        <UploadDialog
          tenantId={tenant.id}
          open={uploading}
          onClose={() => setUploading(false)}
          onSaved={() => {
            setUploading(false);
            invalidate();
          }}
        />
      )}

      <FamilyMemberDialog
        tenantId={tenant.id}
        member={editingMember}
        open={familyOpen}
        onClose={() => setFamilyOpen(false)}
        onSaved={() => {
          setFamilyOpen(false);
          refetchFamily();
          qc.invalidateQueries({ queryKey: ["tenant", id] });
        }}
      />

      <ConfirmDialog
        open={!!deletingMember}
        onOpenChange={(o) => !o && setDeletingMember(null)}
        title="Remove family member?"
        description={deletingMember ? `${deletingMember.name} will be removed from this tenant's record.` : undefined}
        destructive
        loading={deleteMemberMutation.isPending}
        onConfirm={() => deletingMember && deleteMemberMutation.mutate(deletingMember.id)}
      />

      <TransferTenantModal
        tenant={tenant}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={() => invalidate()}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// ACTION MENU DROPDOWN PORTAL
// -----------------------------------------------------------------------------

function DetailPageActionMenu({
  tenant,
  canManage,
  onTransfer,
}: {
  tenant: Tenant;
  canManage: boolean;
  onTransfer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const navigate = useNavigate();

  const MENU_WIDTH = 220;

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = rect.bottom + 6;
    if (vh - rect.bottom < 260) {
      top = rect.top - 260;
    }
    top = Math.max(12, Math.min(top, vh - 270));

    let left = rect.right - MENU_WIDTH;
    left = Math.max(12, Math.min(left, vw - MENU_WIDTH - 12));

    return { top, left };
  }, []);

  useLayoutEffect(() => {
    if (open) {
      setPos(computePosition());
    } else {
      setPos(null);
    }
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="inline-flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all shadow-2xs"
        title="More Actions"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            zIndex: 9999,
            width: `${MENU_WIDTH}px`,
          }}
          className="rounded-xl border border-slate-200/90 bg-white py-1.5 text-slate-700 shadow-xl ring-1 ring-black/5 text-xs font-bold"
        >
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate(`/admin/payments?tenantId=${tenant.id}&action=new`); }}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] hover:bg-slate-100 text-left text-slate-800"
            >
              <CreditCard className="size-4 text-slate-400 shrink-0" /> Record Rent Payment
            </button>

            <button
              onClick={() => { setOpen(false); navigate(`/admin/agreements?tenantId=${tenant.id}`); }}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] hover:bg-slate-100 text-left text-slate-800"
            >
              <FileText className="size-4 text-slate-400 shrink-0" /> View Agreement
            </button>

            <button
              onClick={() => { setOpen(false); navigate(`/admin/tenants/${tenant.id}?tab=kyc`); }}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] hover:bg-slate-100 text-left text-slate-800"
            >
              <ShieldCheck className="size-4 text-slate-400 shrink-0" /> View Documents
            </button>
          </div>

          {canManage && (
            <div className="my-1 border-t border-slate-100 pt-1">
              <button
                onClick={() => { setOpen(false); onTransfer(); }}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] hover:bg-slate-100 text-left text-slate-800"
              >
                <ArrowRightLeft className="size-4 text-slate-400 shrink-0" /> Transfer / Shift Tenant
              </button>

              <button
                onClick={() => { setOpen(false); navigate(`/admin/tenants?edit=${tenant.id}`); }}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] hover:bg-slate-100 text-left text-slate-800"
              >
                <Pencil className="size-4 text-slate-400 shrink-0" /> Edit Tenant Profile
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function DocumentCard({
  tenantId,
  doc,
  canManage,
  onDeleted,
}: {
  tenantId: string;
  doc: TenantDocument;
  canManage: boolean;
  onDeleted: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTenantDocument(tenantId, doc.id),
    onSuccess: () => {
      success("Document deleted");
      setConfirming(false);
      onDeleted();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const formattedType = (doc.type || "OTHER")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="flex flex-col justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="font-extrabold text-slate-900 text-sm truncate">{formattedType}</p>
            <p className="text-xs font-semibold text-slate-600 truncate">{doc.originalName || `${formattedType}.pdf`}</p>
            <p className="text-[11px] text-slate-400 font-medium">
              Uploaded {doc.createdAt ? formatDate(doc.createdAt) : "Recently"}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
          <Check className="size-3.5 text-emerald-600" /> Stored
        </span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 w-full">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 font-bold text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl h-9 px-3 shadow-2xs justify-center"
          onClick={() => setPreview(true)}
        >
          <Eye className="size-3.5 mr-1.5 text-slate-500" /> View
        </Button>

        {doc.downloadUrl && (
          <a
            href={downloadUrl(doc.downloadUrl)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex h-9 px-3 items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 font-bold text-xs text-slate-800 shadow-2xs transition-all"
          >
            <Download className="size-3.5 text-slate-500" /> Download
          </a>
        )}

        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            className="size-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl shrink-0 flex items-center justify-center border border-slate-200 hover:border-rose-200 transition-colors"
            onClick={() => setConfirming(true)}
            title="Delete Document"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {preview && (
        <FileViewer
          url={doc.downloadUrl ?? ""}
          name={doc.originalName || formattedType}
          open={preview}
          onClose={() => setPreview(false)}
        />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        title="Delete document?"
        description={`This will permanently remove ${doc.originalName || formattedType}.`}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// FAMILY MEMBER DIALOG
// -----------------------------------------------------------------------------

function FamilyMemberDialog({
  tenantId,
  member,
  open,
  onClose,
  onSaved,
}: {
  tenantId: string;
  member: FamilyMember | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("SPOUSE");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [isDependent, setIsDependent] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && member) {
      setName(member.name ?? "");
      setRelation(member.relation ?? "SPOUSE");
      setPhone(member.phone ?? "");
      setAge(member.age ? String(member.age) : "");
      setOccupation(member.occupation ?? "");
      setIsDependent(member.isDependent);
      setNotes(member.notes ?? "");
    } else if (open && !member) {
      setName(""); setRelation("SPOUSE"); setPhone(""); setAge(""); setOccupation(""); setIsDependent(false); setNotes("");
    }
  }, [open, member]);

  const mutation = useMutation({
    mutationFn: () =>
      member
        ? api.updateFamilyMember(tenantId, member.id, {
            name: name || undefined,
            relation: relation || undefined,
            phone: phone || undefined,
            age: age ? Number(age) : undefined,
            occupation: occupation || undefined,
            isDependent,
            notes: notes || undefined,
          })
        : api.addFamilyMember(tenantId, {
            name,
            relation,
            phone: phone || undefined,
            age: age ? Number(age) : undefined,
            occupation: occupation || undefined,
            isDependent,
            notes: notes || undefined,
          }),
    onSuccess: () => {
      success(member ? "Family member updated" : "Family member added");
      onSaved();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateFamilyMember = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(name, true, "Full Name");
    if (nameErr) errs.name = nameErr;

    if (phone) {
      const phoneErr = validatePhone(phone, false, "Phone Number");
      if (phoneErr) errs.phone = phoneErr;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900">{member ? "Edit Family Member" : "Add Family Member"}</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">Register family details for room occupancy records.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Full Name *</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g. Meena Kumar"
              className={cn("h-10 rounded-xl border-slate-300 font-bold", fieldErrors.name && "border-rose-500")}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.name}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Relation</Label>
              <Select value={relation} onChange={(e) => setRelation(e.target.value)} className="h-10 rounded-xl border-slate-300 font-bold">
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Age</Label>
              <Input type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 30" className="h-10 rounded-xl border-slate-300 font-bold" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              placeholder="Optional"
              className={cn("h-10 rounded-xl border-slate-300", fieldErrors.phone && "border-rose-500")}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.phone}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Occupation</Label>
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Optional" className="h-10 rounded-xl border-slate-300" />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer pt-1">
            <input type="checkbox" checked={isDependent} onChange={(e) => setIsDependent(e.target.checked)} className="size-4 rounded text-blue-600 focus:ring-blue-500" />
            Financially Dependent
          </label>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Notes & Remarks</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-slate-300 text-xs" />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              if (validateFamilyMember()) {
                mutation.mutate();
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl"
          >
            {member ? "Save Changes" : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// UPLOAD DIALOG
// -----------------------------------------------------------------------------

function UploadDialog({
  tenantId,
  open,
  onClose,
  onSaved,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("AADHAAR");

  const mutation = useMutation({
    mutationFn: () => api.uploadTenantDocument(tenantId, file!, type),
    onSuccess: (doc) => {
      success("Document stored successfully", doc.originalName);
      onSaved();
    },
    onError: (e) => toastError("Upload failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-5 bg-white border border-slate-200 shadow-xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Upload className="size-4 text-blue-600" /> Upload Tenant Document
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">
            Securely store identity or contract documents provided by the tenant.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-3 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Document Type *</Label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-xl border-slate-300 font-bold bg-white text-slate-900"
            >
              <option value="AADHAAR">Aadhaar</option>
              <option value="PAN">PAN</option>
              <option value="DRIVING_LICENCE">Driving Licence</option>
              <option value="PASSPORT">Passport</option>
              <option value="RENTAL_AGREEMENT">Rental Agreement</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Document File *</Label>
            <Input
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-10 rounded-xl border-slate-300 font-medium text-xs bg-slate-50"
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Supported file formats: <strong>PDF, JPG, JPEG, PNG</strong>
            </p>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold text-xs h-9">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file}
              loading={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs h-9 px-5 shadow-xs"
            >
              Upload Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// TRANSFER TENANT MODAL (NAMED EXPORT)
// -----------------------------------------------------------------------------

export function TransferTenantModal({
  tenant,
  open,
  onClose,
  onTransferred,
}: {
  tenant: Tenant;
  open: boolean;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [toPropertyId, setToPropertyId] = useState("");
  const [toHomeId, setToHomeId] = useState("");
  const [toRoomId, setToRoomId] = useState("");
  const [toBedId, setToBedId] = useState("");
  const [toRent, setToRent] = useState(tenant.rent || "0");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: () => api.listProperties({ pageSize: 200 }),
    enabled: open,
  });

  const selectedProperty = properties?.items.find((p) => p.id === toPropertyId);
  const isPg = selectedProperty?.type === "PG";
  const isMultiUnit = selectedProperty && selectedProperty.type !== "PG" && selectedProperty.type !== "HOUSE";
  const homesList = selectedProperty?.homes || [];

  const { data: rooms } = useQuery({
    queryKey: ["rooms", toPropertyId],
    queryFn: () => api.listRooms(toPropertyId),
    enabled: !!toPropertyId && isPg,
  });

  const selectedRoom = rooms?.find((r) => r.id === toRoomId);

  const transferMutation = useMutation({
    mutationFn: () =>
      api.transferTenant(tenant.id, {
        toPropertyId,
        toHomeId: toHomeId || undefined,
        toRoomId: toRoomId || undefined,
        toBedId: toBedId || undefined,
        toRent: Number(toRent),
        transferDate,
        reason,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      success("Tenant transferred successfully!");
      onTransferred();
      onClose();
    },
    onError: (e) => toastError("Transfer failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-purple-600" /> Transfer / Shift Tenant
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">
            Move <strong>{tenant.name}</strong> to another property, room, or bed. Historical stay records will be preserved.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            transferMutation.mutate();
          }}
        >
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Current Stay Assignment</span>
            <p className="font-extrabold text-slate-900">
              {tenant.property?.name || "Unassigned"} {(tenant as any).home ? `· ${(tenant as any).home.homeNumber} (${(tenant as any).home.floor})` : ""} {tenant.room ? `· Room ${tenant.room.roomNumber}` : ""} {tenant.bed ? `(Bed ${tenant.bed.bedNumber})` : ""}
            </p>
            <p className="text-slate-600 font-bold">Current Rent: {formatINR(tenant.rent)}/mo</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Target Property *</Label>
            <Select
              value={toPropertyId}
              onChange={(e) => {
                const pid = e.target.value;
                setToPropertyId(pid);
                setToHomeId("");
                setToRoomId("");
                setToBedId("");
                const prop = properties?.items.find((p) => p.id === pid);
                if (prop?.rent) setToRent(String(prop.rent));
              }}
              required
              className="h-11 font-medium border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="">-- Select Target Property --</option>
              {properties?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type}) — Rent: {formatINR(p.rent)}
                </option>
              ))}
            </Select>
          </div>

          {isMultiUnit && homesList.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Target Home / Unit *</Label>
              <Select
                value={toHomeId}
                onChange={(e) => {
                  const hid = e.target.value;
                  setToHomeId(hid);
                  const h = homesList.find((item) => item.id === hid);
                  if (h?.rent) setToRent(String(h.rent));
                }}
                required
                className="h-11 font-medium border-slate-300 rounded-xl bg-white text-xs"
              >
                <option value="">-- Select Home Unit --</option>
                {homesList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.homeNumber} ({h.floor}) — {h.status === "OCCUPIED" ? "Occupied" : "Available"} (Rent: {formatINR(h.rent || selectedProperty?.rent)})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {isPg && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Target Room</Label>
                <Select
                  value={toRoomId}
                  onChange={(e) => {
                    setToRoomId(e.target.value);
                    setToBedId("");
                  }}
                  className="h-11 font-medium border-slate-300 rounded-xl bg-white text-xs"
                >
                  <option value="">-- Select Room --</option>
                  {rooms?.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.beds?.filter((b) => b.status === "AVAILABLE").length || 0} beds free)
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Target Bed (Available Only)</Label>
                <Select
                  value={toBedId}
                  onChange={(e) => setToBedId(e.target.value)}
                  className="h-11 font-medium border-slate-300 rounded-xl bg-white text-xs"
                >
                  <option value="">-- Select Bed --</option>
                  {selectedRoom?.beds
                    ?.filter((b) => b.status === "AVAILABLE" || b.id === tenant.bed?.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bedNumber} ({b.status})
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">New Monthly Rent (₹) *</Label>
              <Input
                type="number"
                min={0}
                required
                value={toRent}
                onChange={(e) => setToRent(e.target.value)}
                className="h-11 font-bold border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Effective Date *</Label>
              <Input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="h-11 font-bold border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Reason for Transfer *</Label>
            <Input
              placeholder="e.g. Room upgrade, shifted to flat, workplace change"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 font-medium border-slate-300 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!toPropertyId || !reason.trim()}
              loading={transferMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 font-extrabold rounded-xl"
            >
              Confirm & Shift Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

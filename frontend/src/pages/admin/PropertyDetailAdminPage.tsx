import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  Globe,
  Plus,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Zap,
  Users,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Layers,
  MoreHorizontal,
  Star,
  Copy,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
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
} from "@/components/ui/primitives";
import { EmptyState, StatusBadge } from "@/components/ui/data";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import PropertyGallery from "@/components/PropertyGallery";
import type { PgBed, PgRoom, PropertyImage, PropertyHome, Property } from "@/types";
import { HomeDetailPage } from "@/pages/admin/HomeDetailPage";
import { AddHomeModal } from "@/components/AddHomeModal";
import { BuildingStructureBuilder } from "@/components/BuildingStructureBuilder";
import { PropertyFormDialog, SecurePropertyDeleteModal } from "@/pages/admin/PropertiesPage";

// Official WhatsApp SVG Logo Icon
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function PropertyDetailAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();

  const navigate = useNavigate();
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [mobileTab, setMobileTab] = useState<"units" | "financials" | "residents">("units");
  const [editingProperty, setEditingProperty] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [addingHome, setAddingHome] = useState(false);
  const [editingHome, setEditingHome] = useState<PropertyHome | null>(null);
  const [deletingHome, setDeletingHome] = useState<PropertyHome | null>(null);
  const [managingStructure, setManagingStructure] = useState(false);
  const [editingRoom, setEditingRoom] = useState<PgRoom | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<PgRoom | null>(null);
  const [addingBedsFor, setAddingBedsFor] = useState<PgRoom | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => api.getProperty(id!),
    enabled: !!id,
  });

  const { data: rooms } = useQuery({
    queryKey: ["property-rooms", id],
    queryFn: () => api.listRooms(id!),
    enabled: !!id && property?.type === "PG",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["property", id] });
    qc.invalidateQueries({ queryKey: ["property-rooms", id] });
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const visibilityMutation = useMutation({
    mutationFn: () => api.updateProperty(id!, { publicVisibility: !property!.publicVisibility }),
    onSuccess: () => {
      success("Visibility updated");
      invalidate();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const imagesMutation = useMutation({
    mutationFn: (images: { url: string; storageKey?: string | null; isPrimary?: boolean; type?: string; sortOrder?: number }[]) =>
      api.setPropertyImages(id!, images),
    onSuccess: () => {
      success("Photos updated");
      invalidate();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const [uploading, setUploading] = useState(false);

  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: string) => api.deleteHome(homeId),
    onSuccess: () => {
      success("Home unit deleted");
      setDeletingHome(null);
      invalidate();
    },
    onError: (e) => toastError("Could not delete unit", e instanceof Error ? e.message : undefined),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) => api.deleteRoom(roomId),
    onSuccess: () => {
      success("Room deleted");
      setDeletingRoom(null);
      invalidate();
    },
    onError: (e) => toastError("Could not delete", e instanceof Error ? e.message : undefined),
  });

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const current = (property?.images ?? []).map((i) => ({ ...i }));
      const uploaded = await Promise.all(files.map((f) => api.uploadPropertyImage(f)));
      imagesMutation.mutate(
        [...current, ...uploaded.map((u) => ({ url: u.url, storageKey: u.storageKey ?? null }))],
        { onSuccess: () => success(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`) },
      );
    } catch (e) {
      toastError("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (img: PropertyImage) => {
    imagesMutation.mutate((property!.images ?? []).filter((i) => i.id !== img.id).map((i) => ({ ...i })));
  };

  const handleSetPrimary = (img: PropertyImage) => {
    imagesMutation.mutate((property!.images ?? []).map((i) => ({ ...i, isPrimary: i.id === img.id })));
  };

  if (isLoading || !property) return <PageLoader />;

  const isMultiUnit =
    property.type === "VILLA" ||
    property.type === "MULTI_UNIT_HOUSE" ||
    property.type === "APARTMENT" ||
    (property.homes && property.homes.length > 0);

  const displayType = isMultiUnit
    ? property.type === "APARTMENT"
      ? "Apartment Building"
      : property.type === "MULTI_UNIT_HOUSE"
      ? "Multi-Unit House"
      : "Villa / Multi-Home"
    : property.type === "PG"
    ? "PG / Hostel"
    : "Single House";

  const homesList: PropertyHome[] = property.homes || [];
  const totalHomesCount = homesList.length;

  // Rent & Deposit calculations for homes
  const totalHomesPotentialRent = homesList.reduce((sum, h) => sum + Number(h.rent || 0), 0);
  const totalHomesDeposit = homesList.reduce((sum, h) => sum + Number(h.deposit || 0), 0);
  const occupiedHomesRent = homesList
    .filter((h) => h.status === "OCCUPIED" || h.activeTenant)
    .reduce((sum, h) => sum + Number(h.rent || 0), 0);
  const vacantHomesRent = homesList
    .filter((h) => h.status === "AVAILABLE" && !h.activeTenant)
    .reduce((sum, h) => sum + Number(h.rent || 0), 0);

  const displayMonthlyRent = isMultiUnit && totalHomesCount > 0 ? totalHomesPotentialRent : Number(property.rent || 0);
  const displayTotalDeposit = isMultiUnit && totalHomesCount > 0 ? totalHomesDeposit : Number(property.deposit || 0);

  const occupiedHomesCount = homesList.filter((h) => h.status === "OCCUPIED" || h.activeTenant).length;
  const availableHomesCount = homesList.filter((h) => h.status === "AVAILABLE" && !h.activeTenant).length;
  const maintenanceHomesCount = homesList.filter((h) => h.status === "MAINTENANCE").length;

  const roomTotal = property.roomCounts?.total || 0;
  const occupancyRate = isMultiUnit
    ? totalHomesCount > 0
      ? Math.round((occupiedHomesCount / totalHomesCount) * 100)
      : 0
    : roomTotal > 0
    ? Math.round(((property.roomCounts?.occupied || 0) / roomTotal) * 100)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full min-w-0 max-w-full pb-20 sm:pb-24 px-0">
      {/* Enterprise Executive Hero Header Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-6 shadow-md border border-slate-800 space-y-3.5 w-full min-w-0 max-w-full box-border">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Link
              to="/admin/properties"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all shrink-0"
            >
              <ArrowLeft className="size-3.5" /> Properties
            </Link>
            <StatusBadge status={property.status} />
            <Badge variant="secondary" className="bg-blue-900/60 text-blue-200 border border-blue-700/50 font-black text-xs shrink-0">
              <Building2 className="size-3 mr-1 inline" />
              {displayType}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0 w-full sm:w-auto justify-start sm:justify-end">
            {can(PERMISSIONS.PROPERTIES_MANAGE) && (
              <Button
                size="sm"
                variant="outline"
                className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 font-extrabold text-xs flex-1 sm:flex-none h-9"
                onClick={() => setEditingProperty(true)}
              >
                <Pencil className="size-3.5 mr-1" /> Edit Property
              </Button>
            )}
            {isMultiUnit && can(PERMISSIONS.PROPERTIES_MANAGE) && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-xs flex-1 sm:flex-none h-9"
                onClick={() => setManagingStructure(true)}
              >
                <Layers className="size-3.5 mr-1" /> Building Structure Builder
              </Button>
            )}
            {isMultiUnit && can(PERMISSIONS.PROPERTIES_MANAGE) && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs flex-1 sm:flex-none h-9"
                onClick={() => {
                  setEditingHome(null);
                  setAddingHome(true);
                }}
              >
                <Plus className="size-3.5 mr-1" /> Add Home
              </Button>
            )}
            {can(PERMISSIONS.TENANTS_MANAGE) && (
              <Link
                to={`/admin/tenants?propertyId=${property.id}&action=new`}
                className="inline-flex items-center justify-center gap-1 text-xs font-black bg-white text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl shadow-xs flex-1 sm:flex-none h-9"
              >
                <UserPlus className="size-3.5" /> Add Tenant
              </Link>
            )}
            {can(PERMISSIONS.PROPERTIES_MANAGE) && (
              <Button
                size="sm"
                variant="outline"
                className="bg-rose-950/80 text-rose-300 border-rose-800/80 hover:bg-rose-900 hover:text-white font-extrabold text-xs flex-1 sm:flex-none h-9"
                onClick={() => setDeletingProperty(property)}
              >
                <Trash2 className="size-3.5 mr-1 text-rose-400" /> Delete Property
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-t border-slate-800 pt-3.5">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight capitalize truncate">{property.name}</h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 text-blue-400 shrink-0" />
              <span className="truncate">
                {property.number ? `${property.number}, ` : ""}
                {property.address}{property.area ? `, ${property.area}` : ""}, {property.city}
              </span>
            </p>
          </div>

          {/* Quick Key Performance Indicators */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4 text-xs font-extrabold bg-slate-800/80 p-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-slate-700/60 shrink-0 w-full sm:w-auto text-center sm:text-left min-w-0">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block uppercase font-bold truncate">{isMultiUnit ? "Units" : "Capacity"}</span>
              <span className="text-sm sm:text-base font-black text-white truncate block">{isMultiUnit ? totalHomesCount : (property.roomCounts?.total || 1)}</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-slate-700" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block uppercase font-bold truncate">Revenue</span>
              <span className="text-xs sm:text-base font-black text-emerald-400 truncate block">{formatINR(displayMonthlyRent)}</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-slate-700" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block uppercase font-bold truncate">Occupancy</span>
              <span className="text-sm sm:text-base font-black text-blue-400 truncate block">{occupancyRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* RentOK Mobile Segmented Section Navigation Tabs (Mobile Only) */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl lg:hidden text-xs font-black w-full min-w-0">
        <button
          onClick={() => setMobileTab("units")}
          className={cn(
            "py-2 px-1 rounded-lg transition-all text-center truncate",
            mobileTab === "units" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Units ({totalHomesCount})
        </button>
        <button
          onClick={() => setMobileTab("financials")}
          className={cn(
            "py-2 px-1 rounded-lg transition-all text-center truncate",
            mobileTab === "financials" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Analytics & EB
        </button>
        <button
          onClick={() => setMobileTab("residents")}
          className={cn(
            "py-2 px-1 rounded-lg transition-all text-center truncate",
            mobileTab === "residents" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Residents ({property.tenants?.length || 0})
        </button>
      </div>

      {/* Main Balanced 2-Column SaaS Grid Layout */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3 w-full min-w-0 max-w-full">
        {/* Left Column: Photos, Building Structure, Revenue Financials (65% width on desktop) */}
        <div className={cn("space-y-4 sm:space-y-5 lg:col-span-2 min-w-0 w-full", mobileTab !== "units" && mobileTab !== "financials" ? "hidden lg:block" : "block")}>
          {/* Main Hero Photo Gallery Card */}
          <div className={cn(mobileTab !== "units" ? "hidden lg:block" : "block")}>
            <Card className="shadow-xs overflow-hidden border border-slate-200 bg-white rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Globe className="size-4.5 text-blue-600" /> Property Photo Gallery
                </CardTitle>
                <Badge variant={property.publicVisibility ? "success" : "muted"} className="font-extrabold text-xs">
                  {property.publicVisibility ? "Public Website Visible" : "Private Listing"}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 sm:p-5">
                <PropertyGallery
                  images={property.images ?? []}
                  alt={property.name}
                  editable={can(PERMISSIONS.PROPERTIES_MANAGE)}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onRemove={handleRemove}
                  onSetPrimary={handleSetPrimary}
                />
              </CardContent>
            </Card>
          </div>

          {/* Building Floors & Homes Breakdown Matrix */}
          {isMultiUnit && (
            <div className={cn(mobileTab !== "units" ? "hidden lg:block" : "block")}>
              <Card className="shadow-xs bg-white border-slate-200 rounded-2xl w-full min-w-0 box-border">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-100">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <Building2 className="size-5 text-blue-600" /> Floors & Homes Breakdown
                    </CardTitle>
                    <p className="text-xs font-semibold text-slate-500">Floor-grouped independent units, rent terms, and occupants</p>
                  </div>
                  {can(PERMISSIONS.PROPERTIES_MANAGE) && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-bold text-xs border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                        onClick={() => setManagingStructure(true)}
                      >
                        <Layers className="size-3.5 text-blue-600" /> Structure Builder
                      </Button>
                      <Button
                        size="sm"
                        className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                        onClick={() => {
                          setEditingHome(null);
                          setAddingHome(true);
                        }}
                      >
                        <Plus className="size-4 mr-1" /> Add Home
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <FloorHomesMatrix
                    homes={homesList}
                    onSelectHome={(homeId) => setSelectedHomeId(homeId)}
                    onEditHome={(home) => {
                      setEditingHome(home);
                      setAddingHome(true);
                    }}
                    onDeleteHome={(home) => setDeletingHome(home)}
                    onAddHome={() => {
                      setEditingHome(null);
                      setAddingHome(true);
                    }}
                    canManage={can(PERMISSIONS.PROPERTIES_MANAGE)}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* PG Rooms & Beds Matrix (Only for PG properties) */}
          {property.type === "PG" && (
            <div className={cn(mobileTab !== "units" ? "hidden lg:block" : "block")}>
              <Card className="shadow-xs bg-white border-slate-200 rounded-2xl w-full min-w-0 box-border">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-100">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <BedDouble className="size-5 text-blue-600" /> PG Rooms & Beds Matrix
                    </CardTitle>
                    <p className="text-xs font-semibold text-slate-500">Real-time room occupancy, bed availability, and resident allocation</p>
                  </div>
                  {can(PERMISSIONS.PG_MANAGE) && (
                    <Button size="sm" className="font-extrabold bg-blue-600 hover:bg-blue-700 shadow-xs" onClick={() => setAddingRoom(true)}>
                      <Plus className="size-4 mr-1" /> Add Room
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {!rooms?.length ? (
                    <EmptyState title="No PG rooms configured yet" description="Add rooms and beds to allocate residents and track occupancy." />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {rooms.map((room) => {
                        const bedsList = Array.isArray(room.beds) ? room.beds : [];
                        const occupiedCount = bedsList.filter((b) => b.status === "OCCUPIED" || b.tenantId).length;
                        const occupancyPercent = bedsList.length ? Math.round((occupiedCount / bedsList.length) * 100) : 0;

                        return (
                          <div key={room.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5 hover:border-blue-200 transition-colors">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900 text-base">Room {room.roomNumber}</span>
                                  {room.floor && <Badge variant="secondary" className="font-bold text-[10px]">Floor {room.floor}</Badge>}
                                </div>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                  {room.capacity === 1 ? "1 Sharing (Single)" : `${room.capacity} Sharing`} · Rent: <span className="font-extrabold text-blue-600">{formatINR(room.rent || property.rent)}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-1">
                                {can(PERMISSIONS.PG_MANAGE) && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => setEditingRoom(room)} title="Edit room">
                                      <Pencil className="size-3.5 text-slate-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50" onClick={() => setDeletingRoom(room)} title="Delete room">
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setAddingBedsFor(room)} title="Add beds">
                                      <Plus className="size-3.5 text-blue-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-extrabold text-slate-700">
                                <span>Occupancy ({occupiedCount} / {bedsList.length || room.capacity} Beds)</span>
                                <span className={occupancyPercent === 100 ? "text-rose-600" : "text-blue-600"}>{occupancyPercent}% Occupied</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${occupancyPercent === 100 ? "bg-rose-500" : "bg-blue-600"}`}
                                  style={{ width: `${occupancyPercent}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 pt-1">
                              {bedsList.map((bed) => (
                                <BedRow key={bed.id} bed={bed} canManage={can(PERMISSIONS.PG_MANAGE)} propertyId={property.id} onChanged={invalidate} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Revenue Analytics & Financial Breakdown Card */}
          <div className={cn(mobileTab !== "financials" ? "hidden lg:block" : "block")}>
            <Card className="shadow-xs bg-white border-slate-200 rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Zap className="size-5 text-blue-600" /> Revenue & Financial Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-5 space-y-4">
                {/* Financial Terms Breakdown */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                  <div className="flex items-center justify-between p-3 min-w-0">
                    <span className="text-xs font-extrabold text-slate-600 truncate pr-2">
                      Total Potential Monthly Rent
                    </span>
                    <span className="text-sm sm:text-base font-black text-blue-700 shrink-0">{formatINR(displayMonthlyRent)} / month</span>
                  </div>
                  <div className="flex items-center justify-between p-3 min-w-0">
                    <span className="text-xs font-extrabold text-slate-600 truncate">Security Deposit</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 shrink-0">
                      {formatINR(displayTotalDeposit)}
                    </span>
                  </div>
                </div>

                {/* Revenue Potential & Occupancy Grid */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-3.5 sm:p-4 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider">Revenue Breakdown</h3>
                    <Badge variant="info" className="font-extrabold text-[10px] bg-blue-100 text-blue-800">
                      {occupancyRate}% Revenue Realized
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3 rounded-xl bg-white p-3 border border-blue-200/80 text-xs min-w-0 text-center">
                    <div className="min-w-0">
                      <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-slate-500 block truncate">Potential</span>
                      <span className="text-xs sm:text-base font-black text-blue-700 mt-0.5 block truncate">{formatINR(displayMonthlyRent)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-emerald-600 block truncate">Occupied</span>
                      <span className="text-xs sm:text-base font-black text-emerald-700 mt-0.5 block truncate">
                        {isMultiUnit ? formatINR(occupiedHomesRent) : formatINR((property as any).occupiedRevenue ?? 0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-amber-600 block truncate">Vacant</span>
                      <span className="text-xs sm:text-base font-black text-amber-700 mt-0.5 block truncate">
                        {isMultiUnit ? formatINR(vacantHomesRent) : formatINR((property as any).vacantRevenue ?? displayMonthlyRent)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Contact / Caretaker Bar */}
                {property.contactPhone && (
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs font-bold text-slate-700 truncate w-full sm:w-auto">
                      Primary Contact: <span className="text-slate-900 font-extrabold">{property.contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <a
                        href={`tel:${property.contactPhone}`}
                        className="flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 px-3.5 rounded-lg bg-blue-600 text-xs font-black text-white hover:bg-blue-700 transition-all shadow-xs"
                      >
                        <Phone className="size-3.5" /> Call Caretaker
                      </a>
                      <a
                        href={`https://wa.me/91${property.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, regarding ${property.name}...`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-1.5 px-3.5 rounded-lg bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700 transition-all shadow-xs"
                      >
                        <WhatsAppIcon className="size-3.5 text-white" /> WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Occupancy Summary, Residents Roster, EB Tracking, Public Visibility (35% width, Sticky Pinned on Desktop Scroll) */}
        <div className="lg:col-span-1 w-full min-w-0">
          <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-20 w-full min-w-0">
          {/* Property Occupancy & Capacity Summary Card */}
          <div className={cn(mobileTab !== "units" && mobileTab !== "financials" ? "hidden lg:block" : "block")}>
            <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base font-black text-slate-900">
                  {isMultiUnit ? "Property Units & Occupancy" : "Property Occupancy Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-2 text-center min-w-0">
                  <div className="rounded-xl bg-slate-50 p-2.5 sm:p-3 border border-slate-200 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 block truncate">
                      {isMultiUnit ? "Total Units / Homes" : "Total Capacity"}
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block truncate">
                      {isMultiUnit ? `${totalHomesCount} Units` : `${property.roomCounts?.total || 1} Beds`}
                    </span>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-2.5 sm:p-3 border border-blue-100 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-blue-600 block truncate">
                      {isMultiUnit ? "Occupied Units" : "Occupied Beds"}
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-700 mt-0.5 block truncate">
                      {isMultiUnit ? occupiedHomesCount : (property.roomCounts?.occupied ?? (property.tenants?.length || 0))}
                    </span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-2.5 sm:p-3 border border-emerald-100 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600 block truncate">
                      {isMultiUnit ? "Available Units" : "Available Beds"}
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 mt-0.5 block truncate">
                      {isMultiUnit ? availableHomesCount : (property.roomCounts?.available ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-2.5 sm:p-3 border border-amber-100 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 block truncate">Maintenance</span>
                    <span className="text-base sm:text-lg font-black text-amber-700 mt-0.5 block truncate">
                      {isMultiUnit ? maintenanceHomesCount : (property.roomCounts?.maintenance ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Occupancy Rate Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs font-black text-slate-700">
                    <span>Occupancy Rate</span>
                    <span className={occupancyRate === 100 ? "text-emerald-600" : "text-blue-600"}>{occupancyRate}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${occupancyRate === 100 ? "bg-emerald-500" : "bg-blue-600"}`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Tenants & Occupants Roster */}
          <div className={cn(mobileTab !== "residents" ? "hidden lg:block" : "block")}>
            <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 truncate">
                  <Users className="size-4 text-blue-600 shrink-0" /> Residents Roster ({property.tenants?.length || 0})
                </CardTitle>
                {can(PERMISSIONS.TENANTS_MANAGE) && (
                  <Link
                    to={`/admin/tenants?propertyId=${property.id}&action=new`}
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="size-3.5" /> Add
                  </Link>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!property.tenants || property.tenants.length === 0 ? (
                  <div className="p-6 text-center space-y-3">
                    <div className="size-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                      <Users className="size-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 max-w-xs mx-auto">
                      No active residents allocated to this property yet.
                    </p>
                    {can(PERMISSIONS.TENANTS_MANAGE) && (
                      <Link
                        to={`/admin/tenants?propertyId=${property.id}&action=new`}
                        className="inline-flex h-8 items-center gap-1.5 px-3 rounded-xl bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition-all shadow-xs"
                      >
                        <UserPlus className="size-3.5" /> Add Resident
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {property.tenants.map((t: any) => {
                      const phone = t.phone || t.contactNumber;
                      return (
                        <li key={t.id} className="p-3 sm:p-3.5 flex items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 font-black text-xs">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link to={`/admin/tenants/${t.id}`} className="font-extrabold text-xs text-slate-900 hover:text-blue-600 truncate block">
                                {t.name}
                              </Link>
                              {phone && <p className="text-[11px] font-semibold text-slate-500 truncate">{phone}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {phone && (
                              <>
                                <a
                                  href={`tel:${phone}`}
                                  className="inline-flex size-7 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all text-xs"
                                  title="Call Resident"
                                >
                                  <Phone className="size-3 text-slate-700" />
                                </a>
                                <a
                                  href={`https://wa.me/91${phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all text-xs"
                                  title="WhatsApp Resident"
                                >
                                  <WhatsAppIcon className="size-3 text-emerald-700" />
                                </a>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Electricity & Utility EB Meter Tracking Card */}
          <div className={cn(mobileTab !== "financials" ? "hidden lg:block" : "block")}>
            <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base font-black text-slate-900">Electricity & Utility Service</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 space-y-2.5 text-xs font-semibold">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-slate-500 truncate">EB Meter Number:</span>
                  <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[11px] truncate shrink-0 max-w-[55%] text-right">
                    {property.ebNumber || "Not configured"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-slate-500 truncate">Utility Bill Auto-Billing:</span>
                  <Badge variant="success" className="text-[10px] font-extrabold shrink-0">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Public Visibility Toggle Card */}
          <div className={cn(mobileTab !== "financials" ? "hidden lg:block" : "block")}>
            <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden rounded-2xl w-full min-w-0 box-border">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base font-black text-slate-900">Public Visibility</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold min-w-0">
                  <span className="flex items-center gap-2 text-slate-700 truncate min-w-0">
                    <Globe className="size-4 text-blue-600 shrink-0" /> <span className="truncate">Public Website Listing</span>
                  </span>
                  <Badge variant={property.publicVisibility ? "success" : "muted"} className="shrink-0">
                    {property.publicVisibility ? "Visible" : "Hidden"}
                  </Badge>
                </div>
                {can(PERMISSIONS.PROPERTIES_MANAGE) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-bold border-slate-200 text-slate-800 hover:bg-slate-100 text-xs h-9"
                    loading={visibilityMutation.isPending}
                    onClick={() => visibilityMutation.mutate()}
                  >
                    {property.publicVisibility ? "Hide from public site" : "Show on public site"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>

      {editingProperty && (
        <PropertyFormDialog
          property={property}
          open={editingProperty}
          onClose={() => setEditingProperty(false)}
          onSaved={() => {
            setEditingProperty(false);
            invalidate();
          }}
        />
      )}

      {deletingProperty && (
        <SecurePropertyDeleteModal
          property={deletingProperty}
          open={!!deletingProperty}
          onClose={() => setDeletingProperty(null)}
          onSuccess={() => navigate("/admin/properties")}
        />
      )}

      {addingRoom && (
        <AddRoomDialog
          propertyId={property.id}
          open={addingRoom}
          onClose={() => setAddingRoom(false)}
          onSaved={() => {
            setAddingRoom(false);
            invalidate();
          }}
        />
      )}
      {editingRoom && (
        <EditRoomDialog
          room={editingRoom}
          open={!!editingRoom}
          onClose={() => setEditingRoom(null)}
          onSaved={() => {
            setEditingRoom(null);
            invalidate();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deletingRoom}
        onOpenChange={(o) => !o && setDeletingRoom(null)}
        title="Delete this room?"
        description={
          deletingRoom
            ? `Room ${deletingRoom.roomNumber} and its beds will be permanently removed. This is not possible while a bed is occupied.`
            : undefined
        }
        confirmLabel="Delete room"
        destructive
        loading={deleteRoomMutation.isPending}
        onConfirm={() => deletingRoom && deleteRoomMutation.mutate(deletingRoom.id)}
      />
      <ConfirmDialog
        open={!!deletingHome}
        onOpenChange={(o) => !o && setDeletingHome(null)}
        title="Delete home unit?"
        description={
          deletingHome
            ? `Home ${deletingHome.homeNumber} will be permanently removed from ${deletingHome.floor}. This is not possible while unit is occupied.`
            : undefined
        }
        confirmLabel="Delete unit"
        destructive
        loading={deleteHomeMutation.isPending}
        onConfirm={() => deletingHome && deleteHomeMutation.mutate(deletingHome.id)}
      />
      {addingBedsFor && (
        <AddBedsDialog
          room={addingBedsFor}
          open={!!addingBedsFor}
          onClose={() => setAddingBedsFor(null)}
          onSaved={() => {
            setAddingBedsFor(null);
            invalidate();
          }}
        />
      )}
      {addingHome && property && (
        <AddHomeModal
          propertyId={property.id}
          propertyName={property.name}
          existingHomes={property.homes || []}
          editingHome={editingHome}
          open={addingHome}
          onClose={() => {
            setAddingHome(false);
            setEditingHome(null);
          }}
          onSaved={() => {
            setAddingHome(false);
            setEditingHome(null);
            invalidate();
          }}
        />
      )}
      {managingStructure && property && (
        <BuildingStructureBuilder
          propertyId={property.id}
          propertyName={property.name}
          homes={property.homes || []}
          open={managingStructure}
          onClose={() => setManagingStructure(false)}
          onRefresh={invalidate}
        />
      )}
      {selectedHomeId && (
        <HomeDetailPage
          homeId={selectedHomeId}
          isOpen={!!selectedHomeId}
          onClose={() => setSelectedHomeId(null)}
          onRefresh={invalidate}
        />
      )}
    </div>
  );
}

function BedRow({
  bed,
  canManage,
  propertyId,
  onChanged,
}: {
  bed: PgBed;
  canManage: boolean;
  propertyId: string;
  onChanged: () => void;
}) {
  const { success, error: toastError } = useToast();

  const toggleStatusMutation = useMutation({
    mutationFn: () =>
      api.updateBed(bed.id, {
        status: bed.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE",
      }),
    onSuccess: () => {
      success("Bed status updated");
      onChanged();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const isOccupied = bed.status === "OCCUPIED" || !!bed.tenantId;

  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-semibold border border-slate-200 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-extrabold text-slate-900 truncate">Bed {bed.bedNumber}</span>
        <Badge
          variant={
            isOccupied ? "success" : bed.status === "MAINTENANCE" ? "warning" : "info"
          }
          className="text-[10px] font-bold shrink-0"
        >
          {isOccupied ? "Occupied" : bed.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isOccupied && (
          <span className="text-slate-600 font-extrabold truncate max-w-[120px]">
            {bed.tenant?.name || "Resident"}
          </span>
        )}

        {canManage && (
          <div className="flex items-center gap-1">
            {!isOccupied && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] font-bold"
                loading={toggleStatusMutation.isPending}
                onClick={() => toggleStatusMutation.mutate()}
              >
                {bed.status === "MAINTENANCE" ? "Set available" : "Set maintenance"}
              </Button>
            )}
            {!isOccupied && (
              <Link
                to={`/admin/tenants?propertyId=${propertyId}&bedId=${bed.id}&action=new`}
                className="inline-flex h-6 items-center rounded-md bg-blue-600 px-2 text-[10px] font-extrabold text-white hover:bg-blue-700"
              >
                Assign
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditRoomDialog({
  room,
  open,
  onClose,
  onSaved,
}: {
  room: PgRoom;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    roomNumber: room.roomNumber,
    floor: room.floor || "",
    capacity: room.capacity.toString(),
    rent: room.rent != null ? room.rent.toString() : "",
    deposit: room.deposit != null ? room.deposit.toString() : "",
    advance: room.advance != null ? room.advance.toString() : "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.updateRoom(room.id, {
        roomNumber: form.roomNumber,
        floor: form.floor || undefined,
        capacity: Number(form.capacity),
        rent: form.rent ? Number(form.rent) : undefined,
        deposit: form.deposit ? Number(form.deposit) : undefined,
        advance: form.deposit ? Number(form.deposit) : undefined,
      }),
    onSuccess: () => {
      success("Room updated");
      onSaved();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit room {room.roomNumber}</DialogTitle>
          <DialogDescription>Update room details and default room rates.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Room number *</Label>
            <Input required value={form.roomNumber} onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Floor</Label>
              <Input value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rent (₹)</Label>
              <Input type="number" min={0} value={form.rent} onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))} placeholder="Room Rent" />
            </div>
            <div className="space-y-1.5">
              <Label>Security Deposit (₹)</Label>
              <Input type="number" min={0} value={form.deposit} onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value, advance: e.target.value }))} placeholder="Security Deposit" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRoomDialog({
  propertyId,
  open,
  onClose,
  onSaved,
}: {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    roomNumber: "",
    floor: "Ground Floor",
    capacity: "2",
    rent: "8000",
    deposit: "16000",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createRoom(propertyId, {
        roomNumber: form.roomNumber,
        floor: form.floor || undefined,
        capacity: Number(form.capacity),
        rent: form.rent ? Number(form.rent) : undefined,
        deposit: form.deposit ? Number(form.deposit) : undefined,
        advance: form.deposit ? Number(form.deposit) : undefined,
      }),
    onSuccess: () => {
      success("Room added");
      onSaved();
    },
    onError: (e) => toastError("Failed to add room", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>Add a new room and configure sharing capacity.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Room number *</Label>
            <Input required placeholder="e.g. 101" value={form.roomNumber} onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Floor</Label>
              <Input placeholder="Ground Floor" value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (Sharing)</Label>
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Room Rent (₹)</Label>
              <Input type="number" min={0} value={form.rent} onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))} placeholder="Monthly Rent" />
            </div>
            <div className="space-y-1.5">
              <Label>Security Deposit (₹)</Label>
              <Input type="number" min={0} value={form.deposit} onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value }))} placeholder="Security Deposit" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddBedsDialog({
  room,
  open,
  onClose,
  onSaved,
}: {
  room: PgRoom;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [bedNumbers, setBedNumbers] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.createBeds(
        room.id,
        { bedNumbers: bedNumbers.split(",").map((s) => s.trim()).filter(Boolean) },
        {
          rent: rent ? Number(rent) : undefined,
          advance: deposit ? Number(deposit) : undefined,
          deposit: deposit ? Number(deposit) : undefined,
        },
      ),
    onSuccess: () => {
      success("Beds added");
      onSaved();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add beds to room {room.roomNumber}</DialogTitle>
          <DialogDescription>Comma separated bed numbers, e.g. A, B, C. Optionally set custom bed pricing.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Bed numbers *</Label>
            <Input required value={bedNumbers} onChange={(e) => setBedNumbers(e.target.value)} placeholder="A, B, C" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bed Rent (₹)</Label>
              <Input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} placeholder="Default from Room" />
            </div>
            <div className="space-y-1.5">
              <Label>Bed Security Deposit (₹)</Label>
              <Input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="Default from Room" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Add beds
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FloorHomesMatrix({
  homes,
  onSelectHome,
  onEditHome,
  onDeleteHome,
  onAddHome,
  canManage = false,
}: {
  homes: PropertyHome[];
  onSelectHome: (id: string) => void;
  onEditHome: (home: PropertyHome) => void;
  onDeleteHome: (home: PropertyHome) => void;
  onAddHome?: () => void;
  canManage?: boolean;
}) {
  if (!homes || homes.length === 0) {
    return (
      <div className="space-y-4 text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 min-w-0">
        <EmptyState title="No homes or floor units added yet" description="Add floor units to manage asymmetric multi-home rentals." />
        {onAddHome && (
          <div className="flex justify-center">
            <Button size="sm" className="font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-xs" onClick={onAddHome}>
              <Plus className="size-4 mr-1" /> Add First Home / Unit
            </Button>
          </div>
        )}
      </div>
    );
  }

  const floorsMap: Record<string, PropertyHome[]> = {};
  for (const h of homes) {
    const fl = h.floor || "Ground Floor";
    if (!floorsMap[fl]) floorsMap[fl] = [];
    floorsMap[fl].push(h);
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {Object.entries(floorsMap).map(([floor, floorHomes]) => (
        <div key={floor} className="border border-slate-200 rounded-2xl p-3 sm:p-4 bg-slate-50/60 space-y-3 shadow-2xs min-w-0 w-full">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
            <span className="font-black text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5 truncate">
              <Building2 className="size-4 text-blue-600 shrink-0" /> {floor}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shrink-0">
              {floorHomes.length} Home{floorHomes.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0 w-full">
            {floorHomes.map((h) => (
              <div
                key={h.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between min-w-0 w-full"
              >
                {/* Photo Banner if available */}
                {h.imageUrls && h.imageUrls.length > 0 && (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-100 mb-0.5">
                    <img src={h.imageUrls[0]} alt={`Home ${h.homeNumber}`} className="size-full object-cover" />
                    {h.imageUrls.length > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-slate-900/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                        +{h.imageUrls.length - 1} photos
                      </span>
                    )}
                  </div>
                )}

                {/* Header Row: Home Number + Type Badge + Subtle Status Pill */}
                <div className="flex justify-between items-start gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-900 text-sm truncate">{h.homeNumber}</span>
                      <Badge variant="secondary" className="font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {h.homeType}
                      </Badge>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm font-black text-slate-900">
                        {formatINR(h.rent)} <span className="text-[11px] font-normal text-slate-500">/ month</span>
                      </p>
                      {h.deposit && Number(h.deposit) > 0 && (
                        <p className="text-xs font-semibold text-slate-500">
                          Deposit {formatINR(h.deposit)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border flex items-center gap-1 ${
                      h.status === "OCCUPIED"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : h.status === "AVAILABLE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${
                      h.status === "OCCUPIED" ? "bg-blue-600" : h.status === "AVAILABLE" ? "bg-emerald-600" : "bg-amber-600"
                    }`} />
                    {h.status === "AVAILABLE" ? "Available" : h.status === "OCCUPIED" ? "Occupied" : "Maintenance"}
                  </span>
                </div>

                {/* Active Resident Badge if occupied, or Move-in button if vacant */}
                {h.activeTenant ? (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-2.5 text-xs flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold uppercase text-emerald-600 block">Resident</span>
                      <span className="font-black text-emerald-950 truncate block text-xs">{h.activeTenant.name}</span>
                    </div>
                    {h.activeTenant.phone && (
                      <a
                        href={`tel:${h.activeTenant.phone}`}
                        className="size-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors shrink-0"
                        title="Call Resident"
                      >
                        <Phone className="size-3.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2 text-xs flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 truncate">Vacant Unit</span>
                    {canManage && (
                      <Link
                        to={`/admin/tenants?propertyId=${h.propertyId}&homeId=${h.id}&action=new`}
                        className="inline-flex h-7 items-center gap-1 px-2.5 rounded-lg bg-blue-600 text-white text-[11px] font-extrabold hover:bg-blue-700 transition-all shrink-0 shadow-2xs"
                      >
                        <UserPlus className="size-3" /> Move In
                      </Link>
                    )}
                  </div>
                )}

                {/* Actions Row */}
                <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditHome(h);
                        }}
                        title="Edit unit details"
                      >
                        <Pencil className="size-3 mr-1" /> Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-extrabold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shrink-0"
                      onClick={() => onSelectHome(h.id)}
                    >
                      <Eye className="size-3 mr-1" /> View 360°
                    </Button>
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg shrink-0"
                          title="More options"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white border-slate-200 text-xs font-bold">
                        <DropdownMenuItem
                          onClick={() => onEditHome(h)}
                          className="cursor-pointer"
                        >
                          <Pencil className="size-3.5 mr-2 text-slate-500" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteHome(h)}
                          className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                        >
                          <Trash2 className="size-3.5 mr-2 text-rose-600" /> Delete Unit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

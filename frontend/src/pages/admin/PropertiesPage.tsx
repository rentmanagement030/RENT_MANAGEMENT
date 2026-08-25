import { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Filter,
  Home,
  Pencil,
  Plus,
  Search,
  Trash2,
  MapPin,
  Phone,
  Zap,
  BedDouble,
  Users,
  Eye,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Share2,
  X,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  Layers,
  LayoutGrid,
  List,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatPropertyType, formatStatusBadge } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  FilterSelect,
  Input,
  Label,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { EmptyState, Pagination, StatusBadge } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import PropertyGallery from "@/components/PropertyGallery";
import { AddHomeModal } from "@/components/AddHomeModal";
import type { Property, PropertyImage } from "@/types";

// Official WhatsApp SVG Logo Icon
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function PropertiesPage() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  usePageResetOnFilter(setPage, search, typeFilter, statusFilter);

  // Paginated List Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["properties", page, debouncedSearch, typeFilter, statusFilter],
    queryFn: () =>
      api.listProperties({
        page,
        pageSize: 12,
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  // Global Portfolio Aggregation Data
  const { data: allPropertiesData } = useQuery({
    queryKey: ["properties", "summary-stats"],
    queryFn: () => api.listProperties({ pageSize: 500 }),
    staleTime: 15000,
  });

  const [editing, setEditing] = useState<Property | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [detailModal, setDetailModal] = useState<Property | null>(null);

  useEffect(() => {
    if (searchParams.get("action") === "new" && can(PERMISSIONS.PROPERTIES_MANAGE)) {
      setCreating(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, can]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["properties"] });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProperty(deleting!.id),
    onSuccess: () => {
      success("Property deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toastError("Delete failed", e instanceof Error ? e.message : undefined),
  });

  const propertyTypes = [
    { label: "All Property Types", value: "" },
    { label: "Single House", value: "HOUSE" },
    { label: "PG / Hostel", value: "PG" },
    { label: "Villa", value: "VILLA" },
    { label: "Multi-Unit House", value: "MULTI_UNIT_HOUSE" },
    { label: "Apartment", value: "APARTMENT" },
  ];

  const statusTypes = [
    { label: "All Statuses", value: "" },
    { label: "Available", value: "AVAILABLE" },
    { label: "Occupied", value: "OCCUPIED" },
    { label: "Maintenance", value: "MAINTENANCE" },
  ];

  // Portfolio Summary Calculations
  // Portfolio Summary Calculations
  const allItems = allPropertiesData?.items ?? [];
  const totalCount = allItems.length;
  const residentialProperties = allItems.filter((p) => p.type !== "PG");
  const residentialCount = residentialProperties.length;
  const pgsCount = allItems.filter((p) => p.type === "PG").length;

  // Calculate Vacant Capacity strictly for residential homes, villas, multi-unit houses, single houses, and apartments
  let vacantResidentialUnits = 0;
  let totalResidentialUnits = 0;
  let occupiedResidentialUnits = 0;

  residentialProperties.forEach((p) => {
    if (p.type === "VILLA" || p.type === "MULTI_UNIT_HOUSE" || p.type === "APARTMENT") {
      const homes = p.homes || [];
      const totalUnits = homes.length;
      totalResidentialUnits += totalUnits;
      const occupiedUnits = Math.max(
        homes.filter((h: any) => h.status === "OCCUPIED" || (Array.isArray(h.tenants) && h.tenants.length > 0)).length,
        (p.tenants || []).length
      );
      occupiedResidentialUnits += occupiedUnits;
      vacantResidentialUnits += Math.max(0, totalUnits - occupiedUnits);
    } else {
      // Single House (HOUSE)
      totalResidentialUnits += 1;
      const isOccupied = p.status === "OCCUPIED" || (p.tenants || []).length > 0;
      if (isOccupied) {
        occupiedResidentialUnits += 1;
      } else {
        vacantResidentialUnits += 1;
      }
    }
  });

  const totalMonthlyPotentialRent = allItems.reduce((sum, p) => {
    if ((p as any).potentialRevenue !== undefined && (p as any).potentialRevenue !== null) {
      return sum + Number((p as any).potentialRevenue);
    }
    if (p.type === "PG" && Array.isArray(p.rooms)) {
      const beds = p.rooms.flatMap((r: any) => (Array.isArray(r.beds) ? r.beds : []));
      if (beds.length > 0) {
        return sum + beds.reduce((bSum: number, b: any) => {
          if (b.archived) return bSum;
          const room = (p.rooms || []).find((r: any) => r.id === b.roomId);
          const effRent = (b.rent !== null && b.rent !== undefined && Number(b.rent) > 0)
            ? Number(b.rent)
            : ((room?.rent !== null && room?.rent !== undefined && Number(room.rent) > 0)
                ? Number(room.rent)
                : Number(p.rent || 0));
          return bSum + effRent;
        }, 0);
      }
    }
    return sum + Number(p.rent || 0);
  }, 0);

  let totalBeds = 0;
  let occupiedBeds = 0;
  let activeTenantsCount = 0;

  allItems.forEach((p) => {
    activeTenantsCount += (p.tenants || []).length;
    if (p.type === "PG") {
      const bedsList = (p.rooms || []).flatMap((r) => (Array.isArray(r.beds) ? r.beds : []));
      if (bedsList.length > 0) {
        totalBeds += bedsList.length;
        occupiedBeds += bedsList.filter((b) => b.status === "OCCUPIED" || b.tenantId).length;
      } else if (p.roomCounts) {
        const occ = p.roomCounts.occupied ?? Math.max(0, p.roomCounts.total - p.roomCounts.available);
        totalBeds += p.roomCounts.total;
        occupiedBeds += occ;
      }
    }
  });

  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const bedOccupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const vacantCapacityCount = vacantResidentialUnits;

  // City options
  const cityOptions = Array.from(new Set(allItems.map((p) => p.city).filter(Boolean)));

  // Helper to extract effective monthly rent for sorting across all property types
  const getPropertyEffectiveRent = (p: any): number => {
    if (p.potentialRevenue !== undefined && p.potentialRevenue !== null && Number(p.potentialRevenue) > 0) {
      return Number(p.potentialRevenue);
    }
    if (Array.isArray(p.homes) && p.homes.length > 0) {
      const homesTotal = p.homes.reduce((sum: number, h: any) => sum + Number(h.rent || 0), 0);
      if (homesTotal > 0) return homesTotal;
    }
    if (Array.isArray(p.rooms) && p.rooms.length > 0) {
      const roomsTotal = p.rooms.reduce((sum: number, r: any) => {
        if (Array.isArray(r.beds) && r.beds.length > 0) {
          return sum + r.beds.reduce((bSum: number, b: any) => bSum + Number(b.rent || r.rent || 0), 0);
        }
        return sum + (Number(r.rent || 0) * (r.capacity || 1));
      }, 0);
      if (roomsTotal > 0) return roomsTotal;
    }
    return Number(p.rent || 0);
  };

  // Client-side filtering & sorting
  const itemsToDisplay = (data?.items ?? [])
    .filter((p) => (!cityFilter ? true : p.city === cityFilter))
    .sort((a, b) => {
      if (sortBy === "rent-desc") return getPropertyEffectiveRent(b) - getPropertyEffectiveRent(a);
      if (sortBy === "rent-asc") return getPropertyEffectiveRent(a) - getPropertyEffectiveRent(b);
      return a.name.localeCompare(b.name);
    });

  const hasActiveFilters = !!(search || typeFilter || statusFilter || cityFilter || sortBy !== "name-asc");

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setCityFilter("");
    setSortBy("name-asc");
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Building2 className="size-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Properties</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 pl-0.5">
            Manage houses, PGs, rooms, residents and property availability.
          </p>
        </div>

        {can(PERMISSIONS.PROPERTIES_MANAGE) && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black h-11 px-5 rounded-xl shadow-xs active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Plus className="size-4 stroke-[3]" /> Add Property
          </Button>
        )}
      </div>

      {/* 2. Portfolio KPI Summary (5 Compact Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {/* TOTAL PROPERTIES */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Total Properties</span>
            <div className="size-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Home className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalCount}</div>
            <span className="text-[11px] font-bold text-slate-400">{residentialCount} Residential · {pgsCount} PG</span>
          </div>
        </div>

        {/* PG BED OCCUPANCY */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">PG Bed Occupancy</span>
            <div className="size-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <BedDouble className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-blue-900">{occupiedBeds} / {totalBeds}</div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 inline-block mt-0.5">
              {bedOccupancyPercent}% occupied
            </span>
          </div>
        </div>

        {/* VACANT CAPACITY */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Vacant Capacity</span>
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Building2 className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{vacantCapacityCount}</div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
              Available in homes & villas
            </span>
          </div>
        </div>

        {/* ACTIVE RESIDENTS */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-700">Active Residents</span>
            <div className="size-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-900">{activeTenantsCount}</div>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 inline-block mt-0.5">
              Across portfolio
            </span>
          </div>
        </div>

        {/* POTENTIAL MONTHLY REVENUE */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Potential Revenue</span>
            <div className="size-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <IndianRupee className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-600">{formatINR(totalMonthlyPotentialRent)}</div>
            <span className="text-[11px] font-bold text-slate-400">100% occupancy potential</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-12 items-center">
            {/* Search Input */}
            <div className="relative col-span-2 lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search properties by name, area, address or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 sm:h-11 text-slate-900 border-slate-300 font-bold rounded-xl text-xs sm:text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="col-span-1 lg:col-span-2">
              <FilterTypeCombobox
                value={typeFilter}
                options={propertyTypes}
                onChange={setTypeFilter}
              />
            </div>

            {/* Status Filter */}
            <div className="col-span-1 lg:col-span-2">
              <FilterStatusCombobox
                value={statusFilter}
                options={statusTypes}
                onChange={setStatusFilter}
              />
            </div>

            {/* City Filter */}
            <div className="col-span-1 lg:col-span-1.5">
              <FilterCityCombobox
                value={cityFilter}
                cities={cityOptions}
                onChange={setCityFilter}
              />
            </div>

            {/* Sort Order & Desktop View Toggle */}
            <div className="col-span-1 lg:col-span-1.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FilterSortCombobox
                  value={sortBy}
                  onChange={setSortBy}
                />
              </div>

              <div className="hidden md:flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "table" ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Table View"
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "cards" ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Active Filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  Search: "{search}"
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                  Type: {typeFilter === "HOUSE" ? "House" : "PG"}
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Status: {statusFilter}
                </span>
              )}
              {cityFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  City: {cityFilter}
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline ml-auto"
              >
                Clear Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Main Property Grid (3 columns on desktop, 2 on tablet, 1 on mobile) */}
      <div>
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <div className="p-8 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
            <AlertTriangle className="size-10 text-rose-500 mx-auto" />
            <h3 className="text-base font-black text-slate-900">Unable to load properties</h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              We couldn't retrieve the property portfolio. Please check your connection and retry.
            </p>
            <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : !itemsToDisplay.length ? (
          <EmptyState
            icon={<Building2 className="size-8 text-slate-400" />}
            title="No properties found"
            description={
              hasActiveFilters
                ? "No properties match your current search or filters. Try clearing filters."
                : "Create your first house or PG property to get started."
            }
            action={
              hasActiveFilters ? (
                <Button onClick={clearAllFilters} variant="outline" className="font-bold border-slate-300 text-slate-700 rounded-xl">
                  Clear Filters
                </Button>
              ) : (
                can(PERMISSIONS.PROPERTIES_MANAGE) && (
                  <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                    <Plus className="size-4 mr-1.5" /> Add Property
                  </Button>
                )
              )
            }
          />
        ) : (
          <>
            {/* RentOK Mobile Property Cards (Mobile Only <768px) */}
            <div className="space-y-3.5 md:hidden">
              {itemsToDisplay.map((p) => {
                const isMultiUnit = p.type === "VILLA" || p.type === "MULTI_UNIT_HOUSE" || p.type === "APARTMENT" || (p.homes && p.homes.length > 0);
                const typeLabel = isMultiUnit
                  ? p.type === "APARTMENT"
                    ? "Apartment"
                    : p.type === "MULTI_UNIT_HOUSE"
                    ? "Multi-Unit"
                    : "Villa"
                  : p.type === "PG"
                  ? "PG / Hostel"
                  : "Single House";

                const pgTotalBeds = p.roomCounts?.total || p.rooms?.reduce((s: number, r: any) => s + (r.beds?.length || r.capacity || 0), 0) || p.maxCapacity || 0;
                const unitsCount = isMultiUnit
                  ? `${p.homes?.length || 0} Homes`
                  : p.type === "PG"
                  ? `${pgTotalBeds} Beds`
                  : `Cap: ${p.maxCapacity || 1}`;

                const displayRent = (p as any).potentialRevenue
                  ? formatINR((p as any).potentialRevenue)
                  : formatINR(p.rent);

                const primaryImg = p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url;

                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-3 min-w-0 w-full box-border">
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <Link to={`/admin/properties/${p.id}`} className="font-black text-sm text-slate-900 hover:text-blue-600 truncate block capitalize">
                          {p.name}
                        </Link>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1 min-w-0">
                          <MapPin className="size-3 text-blue-500 shrink-0" />
                          <span className="truncate">{p.area ? `${p.area}, ` : ""}{p.city}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="font-extrabold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          {typeLabel}
                        </Badge>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>

                    {primaryImg && (
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                        <img src={primaryImg} alt={p.name} className="size-full object-cover" />
                      </div>
                    )}

                    {/* 3 Metrics Pills Row */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center text-xs min-w-0">
                      <div className="min-w-0">
                        <span className="text-[9px] font-extrabold uppercase text-slate-400 block truncate">Units / Capacity</span>
                        <span className="font-black text-slate-800 text-xs mt-0.5 block truncate">{unitsCount}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-extrabold uppercase text-slate-400 block truncate">Monthly Rent</span>
                        <span className="font-black text-blue-600 text-xs mt-0.5 block truncate">{displayRent}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-extrabold uppercase text-slate-400 block truncate">Residents</span>
                        <span className="font-black text-emerald-600 text-xs mt-0.5 block truncate">{p.tenants?.length || 0} Active</span>
                      </div>
                    </div>

                    {/* Touch Action Bar */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <Link
                        to={`/admin/properties/${p.id}`}
                        className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 text-xs font-black bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-2xs"
                      >
                        <Eye className="size-3.5" /> Manage Property
                      </Link>
                      {can(PERMISSIONS.PROPERTIES_MANAGE) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shrink-0"
                          onClick={() => setEditing(p)}
                        >
                          <Pencil className="size-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Property List (Table or Cards on >=768px screens) */}
            <div className="hidden md:block">
              {viewMode === "table" ? (
                <Card className="border border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4">Property</th>
                            <th className="py-3.5 px-4">Type</th>
                            <th className="py-3.5 px-4">Location</th>
                            <th className="py-3.5 px-4">Units / Capacity</th>
                            <th className="py-3.5 px-4">Occupancy</th>
                            <th className="py-3.5 px-4">Monthly Rent</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {itemsToDisplay.map((p) => {
                            const typeLabel = p.type === "HOUSE" ? "Single House" : p.type === "PG" ? "PG Hostel" : p.type === "VILLA" ? "Villa" : p.type === "MULTI_UNIT_HOUSE" ? "Multi-Unit" : "Apartment";

                            const pgTotalBeds = p.roomCounts?.total || p.rooms?.reduce((s: number, r: any) => s + (r.beds?.length || r.capacity || 0), 0) || p.maxCapacity || 0;
                            const unitsCount = p.type === "VILLA" || p.type === "MULTI_UNIT_HOUSE" || p.type === "APARTMENT"
                              ? `${p.homes?.length || 0} Homes`
                              : p.type === "PG"
                              ? `${pgTotalBeds} Beds (${p.rooms?.length || 0} Rooms)`
                              : `Cap: ${p.maxCapacity || 1}`;

                            const occCountText = p.type === "VILLA" || p.type === "MULTI_UNIT_HOUSE" || p.type === "APARTMENT"
                              ? `${p.homes?.filter((h) => h.status === "OCCUPIED").length || 0} / ${p.homes?.length || 0} Occupied`
                              : p.type === "PG"
                              ? `${p.tenants?.length || 0} Residents`
                              : `${p.tenants?.length || 0} / ${p.maxCapacity || 1} Occupied`;

                            const displayRent = (p as any).potentialRevenue
                              ? formatINR((p as any).potentialRevenue)
                              : formatINR(p.rent);

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4">
                                  <Link to={`/admin/properties/${p.id}`} className="font-extrabold text-slate-900 hover:text-blue-600">
                                    {p.name}
                                  </Link>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                                    {typeLabel}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">{p.area ? `${p.area}, ${p.city}` : p.city}</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{unitsCount}</td>
                                <td className="py-3 px-4 font-extrabold text-blue-700">{occCountText}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-900">{displayRent}<span className="text-[10px] text-slate-500 font-normal">/mo</span></td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${p.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right space-x-2">
                                  <Link to={`/admin/properties/${p.id}`} className="font-extrabold text-blue-600 hover:underline">
                                    View
                                  </Link>
                                  {can(PERMISSIONS.PROPERTIES_MANAGE) && (
                                    <button type="button" onClick={() => setEditing(p)} className="font-bold text-slate-600 hover:text-slate-900">
                                      Edit
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
              {itemsToDisplay.map((p) => {
                const primaryImg = p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url;
                const rawPhone = p.contactPhone ?? "";
                const cleanPhone = rawPhone.replace(/\D/g, "");
                const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

                const shareText = encodeURIComponent(
                  `Hi! Check out ${p.name} (${p.type === "HOUSE" ? "House" : "PG"}) located at ${p.address}, ${p.city}.\nMonthly Rent: ${formatINR(p.rent)}\nFor details, visit: ${window.location.origin}/admin/properties/${p.id}`
                );
                const waShareUrl = `https://wa.me/?text=${shareText}`;

                const bedsList = (p.rooms || []).flatMap((r) => (Array.isArray(r.beds) ? r.beds : []));
                const totBeds = bedsList.length > 0 ? bedsList.length : p.roomCounts?.total || 0;
                const occCount = bedsList.length > 0 ? bedsList.filter((b) => b.status === "OCCUPIED" || b.tenantId).length : (p.roomCounts?.occupied ?? 0);
                const bedOccupancyPct = totBeds > 0 ? Math.round((occCount / totBeds) * 100) : 0;
                const activeResidentCount = (p.tenants || []).length;

                return (
                  <Card key={p.id} className="overflow-hidden border border-slate-200 bg-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between rounded-2xl">
                    <div>
                      {/* 1. Image Header Banner */}
                      <div className="relative aspect-video w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        {primaryImg ? (
                          <img src={primaryImg} alt={p.name} className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-slate-100 text-slate-400 flex-col gap-2">
                            <Building2 className="size-10 text-slate-300" />
                            <span className="text-[11px] font-bold text-slate-400">Property image unavailable</span>
                          </div>
                        )}
                        <div className="absolute left-3 top-3 flex items-center gap-1.5">
                          <Badge variant={p.type === "HOUSE" ? "info" : "secondary"} className="font-extrabold shadow-xs text-xs">
                            {p.type === "HOUSE" ? "House" : "PG"}
                          </Badge>
                        </div>
                        <div className="absolute right-3 top-3">
                          <PropertyStatusBadge status={p.status} />
                        </div>
                      </div>

                      {/* 2. Property Information */}
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        <div>
                          <button
                            onClick={() => setDetailModal(p)}
                            className="font-black text-lg text-slate-900 hover:text-blue-600 transition-colors block text-left line-clamp-1"
                          >
                            {p.name}
                          </button>
                          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1 line-clamp-1">
                            <MapPin className="size-3.5 text-slate-400 shrink-0" />
                            <span>{p.number ? `${p.number}, ` : ""}{p.address}{p.area ? `, ${p.area}` : ""}, {p.city}</span>
                          </p>
                        </div>

                        {/* 3. Financial Summary Box */}
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              {p.type === "PG" ? "Bed Rent Range" : "Monthly Rent"}
                            </span>
                            <span className="text-base font-black text-emerald-600">
                              {p.type === "PG" && (p as any).bedRentRange ? (p as any).bedRentRange : formatINR(p.rent)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              {p.type === "PG" ? "Potential Revenue" : "Advance / Deposit"}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {p.type === "PG" && (p as any).potentialRevenue !== undefined
                                ? `${formatINR((p as any).potentialRevenue)} /mo`
                                : `${formatINR(p.advance)} / ${formatINR(p.deposit)}`}
                            </span>
                          </div>
                        </div>

                        {/* 4. PG / House Capacity & Occupancy Breakdown */}
                        {p.type === "PG" ? (
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-slate-700 font-extrabold">Bed Occupancy</span>
                              <span className="text-blue-700 font-mono font-black">{occCount} / {totBeds} beds ({bedOccupancyPct}%)</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                                style={{ width: `${Math.min(bedOccupancyPct, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-0.5">
                              <span>Available: <strong className="text-emerald-600">{Math.max(0, totBeds - occCount)} beds</strong></span>
                              <span>Occupied: <strong className="text-blue-600">{occCount} beds</strong></span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Occupancy</span>
                              <span className="font-extrabold text-slate-900">
                                {activeResidentCount > 0 ? `${activeResidentCount} active resident${activeResidentCount !== 1 ? "s" : ""}` : "Vacant / Available"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Max Capacity</span>
                              <span className="font-bold text-slate-700">{p.maxCapacity || 1} resident(s)</span>
                            </div>
                          </div>
                        )}

                        {/* 5. Caretaker & EB Meter Info */}
                        {(p.contactPhone || p.ebNumber) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100/70">
                            {p.contactPhone && (
                              <a href={`tel:${p.contactPhone}`} className="text-blue-700 hover:underline flex items-center gap-1.5">
                                <Phone className="size-3.5 text-blue-600 shrink-0" /> {p.contactPhone}
                              </a>
                            )}
                            {p.ebNumber && (
                              <span className="text-slate-600 flex items-center gap-1 text-[11px] font-semibold">
                                <Zap className="size-3 text-amber-500 shrink-0" /> EB: {p.ebNumber}
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </div>

                    {/* 6. Action Area (Compact 3-Item Layout) */}
                    <div className="border-t border-slate-100 p-3 bg-slate-50/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Link to={`/admin/properties/${p.id}`} className="flex-1">
                          <Button
                            variant="outline"
                            className="w-full font-bold text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-800 rounded-xl h-9"
                          >
                            View Property
                          </Button>
                        </Link>

                        {can(PERMISSIONS.TENANTS_MANAGE) && (
                          <Link to={`/admin/tenants?propertyId=${p.id}&action=new`} className="flex-1">
                            <Button size="sm" className="w-full font-black text-xs bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs h-9">
                              + Resident
                            </Button>
                          </Link>
                        )}
                      </div>

                      <PropertyActionMenu
                        property={p}
                        canManage={can(PERMISSIONS.PROPERTIES_MANAGE)}
                        menuOpen={activeMenuId === p.id}
                        onMenuOpenChange={(open) => setActiveMenuId(open ? p.id : null)}
                        onViewDetail={() => setDetailModal(p)}
                        onEdit={() => setEditing(p)}
                        onViewResidents={() => setDetailModal(p)}
                        onAddResident={() => {}}
                        onDelete={() => setDeleting(p)}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 mt-6">
            <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0} onPageChange={setPage} />
          </div>
        </>
      )}
      </div>

      {/* 5. MODALS & DIALOGS */}
      {/* PROPERTY DETAIL OVERLAY MODAL */}
      <PropertyDetailModal
        property={detailModal}
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        onEdit={() => {
          if (detailModal) {
            setEditing(detailModal);
            setDetailModal(null);
          }
        }}
        onAddResident={() => {}}
      />

      {/* EDIT / CREATE PROPERTY DIALOG */}
      {(creating || editing) && (
        <PropertyFormDialog
          property={editing}
          open={!!creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            invalidate();
          }}
        />
      )}

      {/* HIGH SECURITY DELETE CONFIRMATION MODAL */}
      <SecurePropertyDeleteModal
        property={deleting}
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onSuccess={invalidate}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

function PropertyStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "AVAILABLE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-500"></span> AVAILABLE
        </span>
      );
    case "OCCUPIED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="size-1.5 rounded-full bg-blue-500"></span> OCCUPIED
        </span>
      );
    case "MAINTENANCE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="size-1.5 rounded-full bg-amber-500"></span> MAINTENANCE
        </span>
      );
    case "INACTIVE":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="size-1.5 rounded-full bg-slate-400"></span> INACTIVE
        </span>
      );
  }
}

function PropertyActionMenu({
  property,
  canManage,
  menuOpen,
  onMenuOpenChange,
  onViewDetail,
  onEdit,
  onViewResidents,
  onAddResident,
  onDelete,
}: {
  property: Property;
  canManage: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onViewDetail: () => void;
  onEdit: () => void;
  onViewResidents: () => void;
  onAddResident: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const MENU_WIDTH = 210;
  const MENU_MARGIN = 12;

  const computePosition = useCallback((menuHeight: number) => {
    const button = buttonRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= menuHeight + 8 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
    } else {
      top = rect.top - menuHeight - 6;
    }
    top = Math.max(MENU_MARGIN, Math.min(top, vh - menuHeight - MENU_MARGIN));

    let left = rect.right - MENU_WIDTH;
    left = Math.max(MENU_MARGIN, Math.min(left, vw - MENU_WIDTH - MENU_MARGIN));

    return { top, left };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setPos(null);
      setVisible(false);
      return;
    }
    const btn = buttonRef.current;
    const isVis = !!btn && btn.getBoundingClientRect().width > 0 && btn.getBoundingClientRect().height > 0;
    setVisible(isVis);
    if (isVis) {
      setPos(computePosition(260));
    }
  }, [menuOpen, computePosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onMenuOpenChange(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuOpenChange(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, onMenuOpenChange]);

  const close = () => onMenuOpenChange(false);

  return (
    <>
      <button
        ref={buttonRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMenuOpenChange(!menuOpen);
        }}
        className="inline-flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all shadow-2xs shrink-0"
        title="More Actions"
      >
        <MoreVertical className="size-4" />
      </button>

      {menuOpen && pos && visible && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            zIndex: 9999,
            width: `${MENU_WIDTH}px`,
          }}
          className="rounded-xl border border-slate-200/90 bg-white py-1.5 text-slate-700 shadow-xl ring-1 ring-black/5 text-xs"
        >
          <div className="py-1">
            <button
              type="button"
              onClick={() => { close(); onViewDetail(); }}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left"
            >
              <Eye className="size-4 text-slate-400 shrink-0" /> View Details
            </button>

            {property.type === "PG" && (
              <Link
                to={`/admin/properties/${property.id}`}
                onClick={close}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <BedDouble className="size-4 text-slate-400 shrink-0" /> View Rooms & Beds
              </Link>
            )}

            <button
              type="button"
              onClick={() => { close(); onViewResidents(); }}
              className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left"
            >
              <Users className="size-4 text-slate-400 shrink-0" /> View Residents
            </button>

            {canManage && (
              <Link
                to={`/admin/tenants?propertyId=${property.id}&action=new`}
                onClick={close}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors text-left"
              >
                <UserPlus className="size-4 text-blue-600 shrink-0" /> Add Resident
              </Link>
            )}
          </div>

          {canManage && (
            <div className="my-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => { close(); onEdit(); }}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <Pencil className="size-4 text-slate-400 shrink-0" /> Edit Property
              </button>

              <button
                type="button"
                onClick={() => { close(); onDelete(); }}
                className="flex w-full items-center gap-2.5 px-3 min-h-[36px] font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-left"
              >
                <Trash2 className="size-4 text-rose-600 shrink-0" /> Delete Property
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function PropertyDetailModal({
  property,
  open,
  onClose,
  onEdit,
  onAddResident,
}: {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddResident: () => void;
}) {
  if (!property) return null;

  const activeTenants = property.tenants ?? [];
  const primaryImg = property.images?.find((img) => img.isPrimary)?.url || property.images?.[0]?.url;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black text-slate-900">{property.name}</DialogTitle>
            <PropertyStatusBadge status={property.status} />
          </div>
          <DialogDescription className="text-xs font-semibold text-slate-500">
            {property.address}, {property.city}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {primaryImg && (
            <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-200">
              <img src={primaryImg} alt={property.name} className="size-full object-cover" />
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-semibold">
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500 font-bold">Property Type</span>
              <span className="font-black text-slate-900">{property.type === "HOUSE" ? "House / Flat" : "PG / Hostel"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500 font-bold">Monthly Rent</span>
              <span className="font-black text-emerald-600">{formatINR(property.rent)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500 font-bold">Advance / Deposit</span>
              <span className="font-bold text-slate-800">{formatINR(property.advance)} / {formatINR(property.deposit)}</span>
            </div>
            {property.contactPhone && (
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Caretaker Phone</span>
                <a href={`tel:${property.contactPhone}`} className="font-bold text-blue-600 hover:underline">
                  {property.contactPhone}
                </a>
              </div>
            )}
            {property.ebNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">EB Meter Number</span>
                <span className="font-bold text-slate-800">{property.ebNumber}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900">Current Residents ({activeTenants.length})</span>
              <Link to={`/admin/tenants?propertyId=${property.id}&action=new`} onClick={onClose} className="text-xs font-bold text-blue-600 hover:underline">
                + Add Resident
              </Link>
            </div>
            {activeTenants.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 font-semibold text-xs">
                No active residents assigned to this property yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {activeTenants.map((t) => (
                  <div key={t.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <Link to={`/admin/tenants/${t.id}`} className="font-extrabold text-slate-900 hover:text-blue-600">
                        {t.name}
                      </Link>
                      <p className="text-[11px] text-slate-500 font-semibold">{(t as any).phone ?? "No Phone"}</p>
                    </div>
                    <Link to={`/admin/tenants/${t.id}`} className="text-xs font-bold text-blue-600 hover:underline">
                      View Profile →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex gap-2">
            {property.type === "PG" && (
              <Link to={`/admin/properties/${property.id}`} onClick={onClose} className="flex-1">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-10 rounded-xl">
                  View Rooms & Beds Matrix
                </Button>
              </Link>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-300 font-bold h-10 px-4">
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// PROPERTY FORM DIALOG (NAMED EXPORT)
// -----------------------------------------------------------------------------

const AMENITY_PRESETS = [
  "Wi-Fi",
  "Air Conditioner (AC)",
  "Television (TV)",
  "Food / Mess",
  "Washing Machine",
  "Power Backup",
  "CCTV Security",
  "Housekeeping",
  "Refrigerator",
  "Geyser / Hot Water",
  "Lift",
  "Car & Bike Parking",
];

const BHK_OPTIONS = ["1 BHK", "2 BHK", "3 BHK", "4+ BHK", "Studio", "Independent House"];

const emptyForm = {
  type: "HOUSE",
  name: "",
  number: "",
  address: "",
  city: "Chennai",
  area: "",
  rent: "",
  advance: "",
  deposit: "",
  dueDay: "5",
  latePenalty: "50",
  status: "AVAILABLE",
  description: "",
  amenities: [] as string[],
  publicVisibility: true,
  contactPhone: "",
  bhkType: "2 BHK",
  ebNumber: "",
  maxCapacity: "1",
};

export function PropertyFormDialog({
  property,
  open,
  autoFocusCapacity = false,
  onClose,
  onSaved,
}: {
  property: Property | null;
  open: boolean;
  autoFocusCapacity?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [images, setImages] = useState<PropertyImage[]>(() => property?.images ?? []);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Building structure state for newly created multi-unit properties
  const [formFloors, setFormFloors] = useState<string[]>(["Ground Floor", "1st Floor"]);
  const [formHomes, setFormHomes] = useState<any[]>([]);
  const [modalAddingHomeFloor, setModalAddingHomeFloor] = useState<string | null>(null);
  const [modalEditingHome, setModalEditingHome] = useState<any | null>(null);
  const [showAddFloorModal, setShowAddFloorModal] = useState(false);
  const [newFloorInput, setNewFloorInput] = useState("");

  const currentActiveTenants = property ? (property.tenants?.length || (property as any).activeTenantsCount || 0) : 0;

  const [form, setForm] = useState(() => {
    if (property) {
      return {
        type: property.type,
        name: property.name ?? "",
        number: property.number ?? "",
        address: property.address ?? "",
        city: property.city ?? "Chennai",
        area: property.area ?? "",
        rent: property.rent !== undefined && property.rent !== null ? String(property.rent) : "",
        advance: property.advance !== undefined && property.advance !== null ? String(property.advance) : "",
        deposit: property.deposit !== undefined && property.deposit !== null ? String(property.deposit) : "",
        dueDay: property.dueDay ? String(property.dueDay) : "5",
        latePenalty: property.latePenalty !== undefined && property.latePenalty !== null ? String(property.latePenalty) : "50",
        status: property.status ?? "AVAILABLE",
        description: property.description ?? "",
        amenities: property.amenities ?? [],
        publicVisibility: property.publicVisibility ?? true,
        contactPhone: property.contactPhone ?? "",
        bhkType: property.bhkType ?? "2 BHK",
        ebNumber: property.ebNumber ?? "",
        maxCapacity: property.maxCapacity ? String(property.maxCapacity) : "1",
      };
    }
    return { ...emptyForm };
  });

  useEffect(() => {
    if (open) {
      setWizardStep(1);
      if (property) {
        setForm({
          type: property.type,
          name: property.name ?? "",
          number: property.number ?? "",
          address: property.address ?? "",
          city: property.city ?? "Chennai",
          area: property.area ?? "",
          rent: property.rent !== undefined && property.rent !== null ? String(property.rent) : "",
          advance: property.advance !== undefined && property.advance !== null ? String(property.advance) : "",
          deposit: property.deposit !== undefined && property.deposit !== null ? String(property.deposit) : "",
          dueDay: property.dueDay ? String(property.dueDay) : "5",
          latePenalty: property.latePenalty !== undefined && property.latePenalty !== null ? String(property.latePenalty) : "50",
          status: property.status ?? "AVAILABLE",
          description: property.description ?? "",
          amenities: property.amenities ?? [],
          publicVisibility: property.publicVisibility ?? true,
          contactPhone: property.contactPhone ?? "",
          bhkType: property.bhkType ?? "2 BHK",
          ebNumber: property.ebNumber ?? "",
          maxCapacity: property.maxCapacity ? String(property.maxCapacity) : "1",
        });
        setImages(property.images ?? []);
      } else {
        setForm({ ...emptyForm });
        setImages([]);
        setFormHomes([]);
      }
    }
  }, [open, property]);

  const handleUploadPhotos = async (files: File[]) => {
    setUploadingPhotos(true);
    try {
      const uploaded = await Promise.all(files.map((f) => api.uploadPropertyImage(f)));
      const newImageList: PropertyImage[] = [
        ...images,
        ...uploaded.map((u, idx) => ({
          id: `temp-${Date.now()}-${idx}`,
          url: u.url,
          storageKey: u.storageKey ?? null,
          isPrimary: images.length === 0 && idx === 0,
          type: "GALLERY",
          sortOrder: images.length + idx,
        })),
      ];
      setImages(newImageList);
    } catch (e) {
      toastError("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (img: PropertyImage) => {
    const updated = images.filter((i) => (img.id ? i.id !== img.id : i.url !== img.url));
    setImages(updated);
  };

  const handleSetPrimaryPhoto = (img: PropertyImage) => {
    const updated = images.map((i) => ({ ...i, isPrimary: img.id ? i.id === img.id : i.url === img.url }));
    setImages(updated);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const newCapacity = Number(form.maxCapacity || 1);
      if (property && property.type === "HOUSE" && newCapacity < currentActiveTenants) {
        throw new Error(`Capacity cannot be lower than the current ${currentActiveTenants} occupants.`);
      }

      const body = {
        type: form.type,
        name: form.name,
        number: form.number || undefined,
        address: form.address,
        city: form.city,
        area: form.area || undefined,
        rent: Number(form.rent || 0),
        advance: Number(form.advance || 0),
        deposit: Number(form.deposit || 0),
        dueDay: Number(form.dueDay || 5),
        latePenalty: Number(form.latePenalty || 50),
        status: form.status,
        description: form.description || undefined,
        amenities: form.amenities,
        publicVisibility: form.publicVisibility,
        contactPhone: form.contactPhone || undefined,
        bhkType: form.type === "HOUSE" ? form.bhkType : undefined,
        ebNumber: form.ebNumber || undefined,
        maxCapacity: newCapacity,
      };
      const savedProp = property ? await api.updateProperty(property.id, body) : await api.createProperty(body);

      // Save configured homes (including photos, bedrooms, bathrooms) if creating a new VILLA, MULTI_UNIT_HOUSE, or APARTMENT
      if (!property && (form.type === "VILLA" || form.type === "MULTI_UNIT_HOUSE" || form.type === "APARTMENT") && formHomes.length > 0) {
        for (const item of formHomes) {
          await api.createHome(savedProp.id, {
            floor: item.floor || "Ground Floor",
            homeNumber: item.homeNumber,
            homeType: item.homeType || "2 BHK",
            rent: Number(item.rent),
            advance: Number(item.advance || item.deposit || 0),
            deposit: Number(item.deposit || 0),
            dueDay: Number(item.dueDay || 5),
            latePenalty: Number(item.latePenalty || 50),
            ebConnectionType: item.ebConnectionType || "INDIVIDUAL",
            ebNumber: item.ebNumber || undefined,
            ebMeterNumber: item.ebMeterNumber || undefined,
            waterConnectionType: item.waterConnectionType || "INDIVIDUAL",
            waterConsumerNumber: item.waterConsumerNumber || undefined,
            builtUpArea: item.builtUpArea ? Number(item.builtUpArea) : undefined,
            bedrooms: item.bedrooms ? Number(item.bedrooms) : undefined,
            bathrooms: item.bathrooms ? Number(item.bathrooms) : undefined,
            imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
          });
        }
      }

      // Save property images together upon explicit form submission
      if (images.length > 0) {
        await api.setPropertyImages(
          savedProp.id,
          images.map((i, idx) => ({
            url: i.url,
            storageKey: i.storageKey ?? undefined,
            isPrimary: i.isPrimary ?? idx === 0,
            type: "GALLERY",
            sortOrder: idx,
          })),
        );
      }
      return savedProp;
    },
    onSuccess: (p) => {
      success(property ? "Property updated successfully." : "Property created successfully", p.name);
      onSaved();
      if (!property) {
        navigate(`/admin/properties/${p.id}`);
      }
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleAmenity = (preset: string) => {
    setForm((f) => {
      const list = Array.isArray(f.amenities) ? f.amenities : [];
      const exists = list.includes(preset);
      const next = exists ? list.filter((a: string) => a !== preset) : [...list, preset];
      return { ...f, amenities: next };
    });
  };

  const isMultiUnitType = form.type === "VILLA" || form.type === "MULTI_UNIT_HOUSE" || form.type === "APARTMENT";
  const maxSteps = isMultiUnitType && !property ? 4 : 3;

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 1 && (!form.name.trim() || !form.address.trim() || !form.city.trim())) {
      toastError("Required fields missing", "Please fill in Property Name, Address, and City before proceeding.");
      return;
    }
    setWizardStep(targetStep);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border-none shadow-2xl">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-100 -mx-4 px-4 sm:mx-0 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-900">{property ? "Edit Property / PG" : "Add New Property / PG"}</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500">Configure building location, rent, EB meter, amenities, photos, and listing details.</DialogDescription>
        </DialogHeader>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 -mt-1 text-xs font-semibold text-slate-500 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => handleStepClick(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              wizardStep === 1 ? "bg-blue-600 text-white font-extrabold shadow-xs" : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <span>1. Identity & Location</span>
          </button>

          <ChevronRight className="size-3.5 text-slate-300 shrink-0" />

          <button
            type="button"
            onClick={() => handleStepClick(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              wizardStep === 2 ? "bg-blue-600 text-white font-extrabold shadow-xs" : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <span>2. Financial Terms</span>
          </button>

          {isMultiUnitType && !property && (
            <>
              <ChevronRight className="size-3.5 text-slate-300 shrink-0" />
              <button
                type="button"
                onClick={() => handleStepClick(3)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                  wizardStep === 3 ? "bg-blue-600 text-white font-extrabold shadow-xs" : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span>3. Building Structure</span>
              </button>
            </>
          )}

          <ChevronRight className="size-3.5 text-slate-300 shrink-0" />

          <button
            type="button"
            onClick={() => handleStepClick(maxSteps)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
              wizardStep === maxSteps
                ? "bg-blue-600 text-white font-extrabold shadow-xs"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <span>{isMultiUnitType && !property ? "4. Media & Listing" : "3. Media & Listing"}</span>
          </button>
        </div>

        <form
          className="space-y-5 pt-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault();
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            if (wizardStep < maxSteps) {
              if (wizardStep === 1 && (!form.name.trim() || !form.address.trim() || !form.city.trim())) {
                toastError("Required fields missing", "Please fill in Property Name, Address, and City before proceeding.");
                return;
              }
              setWizardStep((s) => s + 1);
              return;
            }
            if (!form.name.trim() || !form.address.trim() || !form.city.trim()) {
              toastError("Required fields missing", "Please fill in Property Name, Address, and City.");
              setWizardStep(1);
              return;
            }
            mutation.mutate();
          }}
        >
          {/* Section 1: Property Identity & Location */}
          {wizardStep === 1 && (
            <div className="space-y-3.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 animate-in fade-in duration-150">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <span>1.</span> Property Identity & Location
              </h3>
              <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Property Type *</Label>
                  <Select value={form.type} onChange={set("type")} className="h-11 font-bold text-slate-900 rounded-xl border-slate-300">
                    <option value="HOUSE">Single House / Flat</option>
                    <option value="PG">PG / Hostel Building</option>
                    <option value="VILLA">Villa / Multi-Home Property</option>
                    <option value="MULTI_UNIT_HOUSE">Multi-Unit House (Independent Floors)</option>
                    <option value="APARTMENT">Apartment Complex</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Property Name *</Label>
                  <Input required value={form.name} onChange={set("name")} placeholder="e.g. Sunrise Villa or Royal PG" className="h-11 font-medium text-slate-900 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Building / Door Number</Label>
                  <Input value={form.number} onChange={set("number")} placeholder="e.g. Door No. 14/B" className="h-11 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Street Address *</Label>
                  <Input required value={form.address} onChange={set("address")} placeholder="Street, Main Road..." className="h-11 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">City *</Label>
                  <Input required value={form.city} onChange={set("city")} placeholder="e.g. Chennai, Bengaluru, Mumbai" className="h-11 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Area / Locality</Label>
                  <Input value={form.area} onChange={set("area")} placeholder="e.g. Velachery or Koramangala" className="h-11 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Primary Contact Phone</Label>
                  <Input value={form.contactPhone} onChange={set("contactPhone")} placeholder="+91 90000 00000" className="h-11 rounded-xl border-slate-300" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Electricity Bill (EB) Meter Number</Label>
                  <Input value={form.ebNumber} onChange={set("ebNumber")} placeholder="e.g. EB-04-129-883" className="h-11 rounded-xl border-slate-300" />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Financials & Capacity Setup */}
          {wizardStep === 2 && (
            <div className="space-y-3.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 animate-in fade-in duration-150">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <span>2.</span> Rent Financials & Capacity
              </h3>

              {isMultiUnitType ? (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs font-semibold text-blue-900 space-y-1">
                  <p className="font-extrabold text-sm text-blue-950">Rent & Security Deposit</p>
                  <p>Rent and security deposit are configured individually for each home in the next Building Structure step.</p>
                </div>
              ) : (
                <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Monthly Rent (₹) *</Label>
                    <Input
                      required
                      type="number"
                      min={0}
                      value={form.rent}
                      onChange={set("rent")}
                      placeholder="e.g. 18000"
                      className="h-11 font-extrabold text-blue-600 rounded-xl border-slate-300 text-base sm:text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Security Deposit (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.deposit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((f) => ({ ...f, deposit: val, advance: val }));
                      }}
                      placeholder="e.g. 45000"
                      className="h-11 font-bold text-slate-800 rounded-xl border-slate-300"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-3 pt-1">
                {form.type === "HOUSE" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">BHK Type</Label>
                    <Select value={form.bhkType} onChange={set("bhkType")} className="h-11 rounded-xl border-slate-300">
                      {BHK_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Max Capacity (Tenants)</Label>
                  <Input
                    type="number"
                    min={Math.max(1, currentActiveTenants)}
                    value={form.maxCapacity ?? "1"}
                    onChange={set("maxCapacity")}
                    autoFocus={autoFocusCapacity}
                    className={`h-11 rounded-xl font-bold ${autoFocusCapacity ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-300"}`}
                  />
                  {property && form.type === "HOUSE" && (
                    <div className="text-[11px] font-semibold text-slate-600 space-y-0.5 pt-1">
                      <p>Current Active Tenants: <strong className="text-slate-900">{currentActiveTenants}</strong></p>
                      <p>Available Capacity: <strong className={Number(form.maxCapacity || 1) - currentActiveTenants > 0 ? "text-emerald-600" : "text-amber-600"}>{Math.max(0, Number(form.maxCapacity || 1) - currentActiveTenants)}</strong></p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Initial Status</Label>
                  <Select value={form.status} onChange={set("status")} className="h-11 rounded-xl border-slate-300">
                    <option value="AVAILABLE">Available</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Overdue Penalty (₹ / day)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.latePenalty}
                    onChange={set("latePenalty")}
                    placeholder="e.g. 50"
                    className="h-11 font-bold text-slate-800 rounded-xl border-slate-300"
                  />
                  <p className="text-[11px] font-semibold text-slate-500">Overdue penalty rate for rent given during property creation.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Rent Due Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dueDay}
                    onChange={set("dueDay")}
                    placeholder="e.g. 5"
                    className="h-11 font-bold text-slate-800 rounded-xl border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Building Structure (ONLY for Villa, Multi-Unit House, Apartment) */}
          {isMultiUnitType && !property && wizardStep === 3 && (
            <div className="space-y-3.5 rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 sm:p-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2.5">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Building2 className="size-4 text-blue-600" />
                    <span>3.</span> Building Structure
                  </h3>
                  <p className="text-xs text-slate-500 font-medium pt-0.5">
                    Add floors and configure the homes or units within each floor.
                  </p>
                </div>
              </div>

              {/* Floors & Homes Breakdown */}
              <div className="space-y-3">
                {formFloors.map((floor) => {
                  const floorHomes = formHomes.filter(
                    (h) => (h.floor || "Ground Floor").toLowerCase() === floor.toLowerCase()
                  );

                  return (
                    <div key={floor} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{floor}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {floorHomes.length} Home{floorHomes.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 shadow-xs"
                          onClick={() => setModalAddingHomeFloor(floor)}
                        >
                          <Plus className="size-3 mr-1" /> Add Home
                        </Button>
                      </div>

                      {floorHomes.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium italic py-2 text-center">
                          No homes added yet to {floor}.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {floorHomes.map((h, idx) => (
                            <div
                              key={h.tempId || idx}
                              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-xs text-slate-900">{h.homeNumber}</span>
                                  <span className="text-[10px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {h.homeType}
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                    ₹{Number(h.rent).toLocaleString()}/mo
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setModalEditingHome(h)}
                                  className="text-slate-600 hover:text-blue-600 p-1 text-xs font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormHomes((prev) => prev.filter((item) => (h.tempId ? item.tempId !== h.tempId : item.homeNumber !== h.homeNumber)))}
                                  className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Floor Action Button */}
              <div className="pt-1 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-xs font-extrabold text-slate-800 border-slate-300 bg-white hover:bg-slate-50 rounded-xl shadow-2xs"
                  onClick={() => setShowAddFloorModal(true)}
                >
                  <Plus className="size-3.5 mr-1.5 text-blue-600" /> Add Floor
                </Button>
              </div>
            </div>
          )}

          {/* Section 4: Amenities & Public Listing */}
          {(isMultiUnitType && !property ? wizardStep === 4 : wizardStep === 3) && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-3.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                  <span>{isMultiUnitType && !property ? "4." : "3."}</span> Amenities & Listing Details
                </h3>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Select Amenities</Label>
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_PRESETS.map((preset) => {
                      const active = form.amenities.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => toggleAmenity(preset)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 border min-h-[42px] flex items-center justify-center ${
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {active ? <Check className="size-3.5 mr-1" /> : <Plus className="size-3.5 mr-1" />}{preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs font-bold text-slate-700">Property Description & House Rules</Label>
                  <Textarea value={form.description} onChange={set("description")} placeholder="Describe the property, gate timings, parking rules, etc..." className="rounded-xl border-slate-300 min-h-[90px]" />
                </div>

                <label className="flex items-center gap-3 text-sm font-bold text-slate-800 pt-1 cursor-pointer">
                  <Checkbox
                    checked={form.publicVisibility}
                    onChange={(e) => setForm((f) => ({ ...f, publicVisibility: e.target.checked }))}
                    className="size-5 rounded-md"
                  />
                  Show on Public Website for direct tenant inquiries
                </label>
              </div>

              {/* Section: Photos */}
              <div className="space-y-3.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                  Property Photos & Media Gallery
                </h3>
                <PropertyGallery
                  images={images}
                  editable
                  uploading={uploadingPhotos}
                  onUpload={handleUploadPhotos}
                  onRemove={handleRemovePhoto}
                  onSetPrimary={handleSetPrimaryPhoto}
                />
              </div>
            </div>
          )}

          {/* Sticky Action Footer */}
          <div className="sticky -bottom-4 sm:-bottom-6 bg-white/95 backdrop-blur-md border-t border-slate-200 pt-3 pb-3 px-4 sm:px-6 -mx-4 sm:-mx-6 flex items-center justify-between gap-2.5 z-20 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (wizardStep > 1) {
                  setWizardStep((s) => s - 1);
                } else {
                  onClose();
                }
              }}
              className="h-10 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
            >
              {wizardStep > 1 ? "Previous" : "Cancel"}
            </Button>

            <div className="flex items-center gap-2">
              {wizardStep < (isMultiUnitType && !property ? 4 : 3) ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && (!form.name || !form.address || !form.city)) {
                      toastError("Required fields missing", "Please fill in Property Name, Address, and City before proceeding.");
                      return;
                    }
                    setWizardStep((s) => s + 1);
                  }}
                  className="h-10 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1"
                >
                  Next Step <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    if (!form.name.trim() || !form.address.trim() || !form.city.trim()) {
                      toastError("Required fields missing", "Please fill in Property Name, Address, and City.");
                      setWizardStep(1);
                      return;
                    }
                    mutation.mutate();
                  }}
                  loading={mutation.isPending}
                  className="h-10 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  {property ? "Save Property Changes" : "Create Property"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Add / Edit Home Modal for newly created property */}
      {(modalAddingHomeFloor || modalEditingHome) && (
        <AddHomeModal
          isTemp={!property}
          propertyId={property?.id}
          propertyName={form.name || "New Property"}
          defaultFloor={modalAddingHomeFloor || modalEditingHome?.floor || "Ground Floor"}
          existingHomes={property ? (property.homes || []) : formHomes}
          editingHome={modalEditingHome}
          onAddTempHome={(tempHome) => {
            if (modalEditingHome) {
              setFormHomes((prev) =>
                prev.map((h) => (h.tempId === modalEditingHome.tempId ? tempHome : h))
              );
            } else {
              setFormHomes((prev) => [...prev, tempHome]);
            }
          }}
          open={!!(modalAddingHomeFloor || modalEditingHome)}
          onClose={() => {
            setModalAddingHomeFloor(null);
            setModalEditingHome(null);
          }}
        />
      )}

      {/* Add Floor Modal */}
      {showAddFloorModal && (
        <Dialog open={showAddFloorModal} onOpenChange={(o) => !o && setShowAddFloorModal(false)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-5 border border-slate-200 shadow-xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-slate-900">Add New Floor</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Enter floor level name (e.g. 2nd Floor, 3rd Floor, Penthouse).
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newFloorInput.trim();
                if (!trimmed) return;
                if (formFloors.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
                  toastError("Floor already exists", `"${trimmed}" is already in your building structure.`);
                  return;
                }
                setFormFloors((prev) => [...prev, trimmed]);
                setNewFloorInput("");
                setShowAddFloorModal(false);
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Floor Level Name *</Label>
                <Input
                  required
                  placeholder="e.g. 2nd Floor"
                  className="h-10 text-xs font-bold"
                  value={newFloorInput}
                  onChange={(e) => setNewFloorInput(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" className="h-9 text-xs font-bold" onClick={() => setShowAddFloorModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                  Add Floor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

export const PropertyModal = PropertyFormDialog;

// -----------------------------------------------------------------------------
// PORTAL-BASED CUSTOM FILTER COMBODROPDOWNS
// -----------------------------------------------------------------------------

function FilterTypeCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between w-full text-xs sm:text-sm font-bold text-slate-900 shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Building2 className="size-4 text-blue-600 shrink-0" />
          <span className="truncate font-extrabold">{selectedOpt.label}</span>
        </div>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl p-1 text-xs animate-in fade-in duration-100 space-y-0.5 ring-1 ring-black/5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  opt.value === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function FilterStatusCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between w-full text-xs sm:text-sm font-bold text-slate-900 shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Filter className="size-4 text-blue-600 shrink-0" />
          <span className="truncate font-extrabold">{selectedOpt.label}</span>
        </div>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl p-1 text-xs animate-in fade-in duration-100 space-y-0.5 ring-1 ring-black/5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  opt.value === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function FilterCityCombobox({
  value,
  cities,
  onChange,
}: {
  value: string;
  cities: string[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const displayLabel = value ? value : "All Cities";

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between w-full text-xs sm:text-sm font-bold text-slate-900 shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <MapPin className="size-4 text-blue-600 shrink-0" />
          <span className="truncate font-extrabold">{displayLabel}</span>
        </div>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl p-1 text-xs animate-in fade-in duration-100 space-y-0.5 ring-1 ring-black/5 max-h-60 overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                !value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>All Cities</span>
              {!value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
            </button>
            {cities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  onChange(city);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  city === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="truncate">{city}</span>
                {city === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function FilterSortCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const SORT_OPTIONS = [
    { value: "name-asc", label: "Sort: A to Z" },
    { value: "rent-desc", label: "Rent: High to Low" },
    { value: "rent-asc", label: "Rent: Low to High" },
  ];

  const selectedOpt = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 200),
      width: Math.max(rect.width, 180),
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl border border-slate-300 bg-white flex items-center justify-between w-full text-xs sm:text-sm font-bold text-slate-900 shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="truncate font-extrabold">{selectedOpt.label}</span>
        </div>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-xl p-1 text-xs animate-in fade-in duration-100 space-y-0.5 ring-1 ring-black/5"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer font-bold",
                  opt.value === value ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="size-4 text-blue-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

// -----------------------------------------------------------------------------
// HIGH SECURITY PROPERTY DELETE CONFIRMATION MODAL
// -----------------------------------------------------------------------------

export function SecurePropertyDeleteModal({
  property,
  open,
  onClose,
  onSuccess,
}: {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    setConfirmName("");
  }, [open, property]);

  const activeTenants = property?.tenants?.length || (property as any)?.activeTenantsCount || (property as any)?.occupiedCount || 0;
  const isBlockedByResidents = activeTenants > 0;
  const isNameMatched = property ? confirmName.trim().toLowerCase() === property.name.trim().toLowerCase() : false;

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProperty(property!.id),
    onSuccess: () => {
      success(`Property "${property?.name}" deleted successfully.`);
      onClose();
      onSuccess();
    },
    onError: (err) => {
      toastError("Property Deletion Failed", err instanceof Error ? err.message : "Security verification failed.");
    },
  });

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md p-5 sm:p-6 bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="text-base sm:text-lg font-black text-rose-900 flex items-center gap-2">
            <div className="size-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <Trash2 className="size-5" />
            </div>
            <span>Delete Property (Security Safeguard)</span>
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-slate-500 pt-1">
            This operation will permanently delete the property record, units, and configuration settings.
          </DialogDescription>
        </DialogHeader>

        {isBlockedByResidents ? (
          <div className="my-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <span>Deletion Blocked by Security Protocol</span>
            </div>
            <p className="font-semibold text-amber-800 leading-relaxed">
              This property currently has <strong className="font-black text-amber-950">{activeTenants} active assigned resident(s)</strong>.
            </p>
            <p className="text-[11px] font-medium text-amber-700">
              To protect active tenant leases and financial logs, you must reassign or vacate all residents before deleting this property.
            </p>
            <div className="pt-1">
              <Link
                to={`/admin/tenants?propertyId=${property.id}`}
                onClick={onClose}
                className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg bg-amber-600 text-white text-xs font-extrabold hover:bg-amber-700 transition-all shadow-xs"
              >
                <Users className="size-3.5" /> View Assigned Residents
              </Link>
            </div>
          </div>
        ) : (
          <div className="my-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Target Property</span>
              <p className="font-extrabold text-slate-900 text-sm">{property.name}</p>
              <p className="text-slate-500 font-semibold truncate">
                {property.number ? `${property.number}, ` : ""}{property.address}, {property.city}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-900">
                Security Safeguard: Type <span className="text-rose-600 underline font-black">{property.name}</span> to confirm:
              </Label>
              <Input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={`Type "${property.name}" here`}
                className="h-10 text-xs font-bold border-slate-300 focus:ring-rose-500 focus:border-rose-500 rounded-xl"
              />
              <p className="text-[11px] font-semibold text-slate-400">
                This confirmation prevents accidental property deletions.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-bold rounded-xl border-slate-300">
            Cancel
          </Button>
          {!isBlockedByResidents && (
            <Button
              type="button"
              disabled={!isNameMatched || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="h-10 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs disabled:opacity-40"
            >
              {deleteMutation.isPending ? "Deleting Property..." : "Confirm Permanent Deletion"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

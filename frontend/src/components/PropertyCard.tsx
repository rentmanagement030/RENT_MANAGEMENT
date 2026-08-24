import { Link } from "react-router-dom";
import { Building2, Home, MapPin, BedDouble } from "lucide-react";
import type { PublicProperty } from "@/types";
import { formatINR } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const img = (property.images ?? [])[0];
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "HOUSE": return "House";
      case "VILLA": return "Villa";
      case "MULTI_UNIT_HOUSE": return "Multi-Unit";
      case "APARTMENT": return "Apartment";
      case "PG": return "PG";
      default: return type;
    }
  };

  let displayRent = property.rent ? Number(property.rent) : 0;
  let rentPrefix = "";
  if (displayRent === 0) {
    const unitRents = [
      ...(property.rooms?.map(r => Number(r.rent || 0)) ?? []),
      ...(property.homes?.map(h => Number(h.rent || 0)) ?? [])
    ].filter(r => r > 0);
    
    if (unitRents.length > 0) {
      displayRent = Math.min(...unitRents);
      rentPrefix = "From ";
    }
  }

  return (
    <Link
      to={`/properties/${property.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {img ? (
          <img src={img} alt={property.name} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center bg-slate-100 text-slate-400">
            {property.type === "HOUSE" || property.type === "VILLA" ? <Home className="size-12" /> : <Building2 className="size-12" />}
          </div>
        )}
        <Badge variant="secondary" className="absolute left-3 top-3 bg-white/95 backdrop-blur-md shadow-xs font-bold text-slate-800 border border-slate-200">
          {getTypeLabel(property.type)}
        </Badge>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-extrabold text-base text-slate-900 leading-snug">{property.name}</h3>
          <p className="shrink-0 text-base font-black text-blue-600">{displayRent > 0 ? `${rentPrefix}${formatINR(displayRent)}/mo` : "Rent TBA"}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <MapPin className="size-3.5 text-slate-400" />
          {property.area ? `${property.area}, ` : ""}
          {property.city}
        </p>
        {property.type === "PG" && property.roomCounts && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <BedDouble className="size-3.5 text-blue-600" />
            {property.roomCounts.available} of {property.roomCounts.total} beds available
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {property.amenities?.slice(0, 3).map((a) => (
            <Badge key={a} variant="muted" className="font-semibold text-slate-600 bg-slate-100 border border-slate-200">
              {a}
            </Badge>
          ))}
          {(property.amenities?.length ?? 0) > 3 && (
            <Badge variant="muted" className="font-semibold text-slate-600 bg-slate-100 border border-slate-200">+{property.amenities!.length - 3}</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

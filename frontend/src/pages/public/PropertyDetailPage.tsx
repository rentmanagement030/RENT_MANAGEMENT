import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, Home, Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Badge, PageLoader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/data";
import { useToast } from "@/components/ui/toast";
import PropertyGallery from "@/components/PropertyGallery";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import type { PgRoom, PropertyImage } from "@/types";

function availableBeds(beds: PgRoom["beds"]): number {
  return Array.isArray(beds) ? beds.filter((b) => b.status === "AVAILABLE").length : 0;
}

function galleryImages(urls: string[] | undefined): PropertyImage[] {
  return (urls ?? []).map((url, i) => ({ id: `img-${i}`, url, storageKey: null, type: "IMAGE", isPrimary: i === 0, sortOrder: i }));
}

function HomeUnitCard({ home, pName }: { home: any, pName?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const images = (home.imageUrls || []).map((url: string) => ({ url, alt: `Home ${home.homeNumber}` }));

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col">
        {home.imageUrls && home.imageUrls.length > 0 && (
          <div 
            className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 border border-slate-100 bg-slate-100 cursor-pointer group"
            onClick={() => setLightboxOpen(true)}
          >
            <img src={home.imageUrls[0]} alt={`Home ${home.homeNumber}`} className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
            {home.imageUrls.length > 1 && (
              <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                +{home.imageUrls.length - 1} photos
              </span>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
        )}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <p className="font-extrabold text-slate-900 text-sm">
            {home.homeNumber}
            {home.floor ? ` • Floor ${home.floor}` : ""}
          </p>
          {home.rent ? <p className="text-xs font-black text-blue-600">{formatINR(home.rent)}/mo</p> : null}
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          {home.homeType || "House"} • <span className="text-emerald-600 font-extrabold">Available</span>
        </p>
      </div>

      {lightboxOpen && images.length > 0 && (
        <ImageLightboxModal
          images={images}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ["public", "property", id],
    queryFn: () => api.publicProperty(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (isError || !p) return <EmptyState title="Property not found" description="This listing may have been removed." />;

  const gallery = p.images && p.images.length > 0;

  return (
    <div className="bg-slate-50 min-h-screen pb-32">
      <div className="mx-auto max-w-6xl px-3.5 sm:px-6 py-4 sm:py-8 space-y-4">
        <Link to={p.type === "HOUSE" ? "/houses" : "/pgs"} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <ArrowLeft className="size-4" /> Back to {p.type === "HOUSE" ? "houses" : "PGs"}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4 sm:space-y-6">
            {gallery ? (
              <PropertyGallery images={galleryImages(p.images)} alt={p.name} />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex aspect-[16/9] w-full items-center justify-center text-slate-400">
                  {p.type === "HOUSE" ? <Home className="size-16" /> : <BedDouble className="size-16" />}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs">
              <div className="space-y-1 border-b border-slate-100 pb-3">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight capitalize">{p.name}</h1>
                <p className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600">
                  <MapPin className="size-4 text-blue-600 shrink-0" />
                  {p.number ? `${p.number}, ` : ""}
                  {p.address}, {p.area ? `${p.area}, ` : ""}
                  {p.city}
                </p>
              </div>

              {/* Mobile Financial Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Financial Summary</p>
                <div className="rounded-xl bg-white border border-slate-200/80 divide-y divide-slate-200/70">
                  <div className="flex items-center justify-between p-3">
                    <span className="text-xs font-extrabold text-slate-600">Monthly Rent</span>
                    <span className="text-sm font-black text-blue-600">
                      {p.rent && Number(p.rent) > 0 ? `${formatINR(p.rent)} / month` : "Not specified"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-xs font-extrabold text-slate-600">Advance</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {p.advance && Number(p.advance) > 0 ? formatINR(p.advance) : "Not specified"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-xs font-extrabold text-slate-600">Security Deposit</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {p.deposit && Number(p.deposit) > 0 ? formatINR(p.deposit) : "Not specified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Actions */}
              {p.contactPhone && (
                <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
                  <a
                    href={`tel:${p.contactPhone}`}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-black text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
                  >
                    <Phone className="size-3.5 inline" /> Call {p.contactPhone}
                  </a>
                  <a
                    href={`https://wa.me/91${p.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, regarding ${p.name}...`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
                  >
                    WhatsApp
                  </a>
                </div>
              )}

              {p.description && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Description</p>
                  <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed font-medium text-slate-700">{p.description}</p>
                </div>
              )}

              {p.amenities && p.amenities.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Amenities & Features</p>
                  <div className="flex flex-wrap gap-2">
                    {p.amenities.map((a) => (
                      <Badge key={a} variant="secondary" className="font-extrabold text-xs text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                        ✓ {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {p.type === "PG" && (p.rooms?.filter(r => availableBeds(r.beds) > 0).length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Rooms & Bed Availability</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.rooms!.filter(r => availableBeds(r.beds) > 0).map((room) => (
                    <div key={room.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <p className="font-extrabold text-slate-900 text-sm">
                          Room {room.roomNumber}
                          {room.floor ? ` · Floor ${room.floor}` : ""}
                        </p>
                        {room.rent ? <p className="text-xs font-black text-blue-600">{formatINR(room.rent)}/mo</p> : null}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        Capacity {room.capacity} Sharing · <span className="text-emerald-600 font-extrabold">{availableBeds(room.beds)} bed(s) available</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {p.type !== "PG" && (p.homes?.filter((h: any) => h.status === "AVAILABLE").length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Available Units</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.homes!.filter((h: any) => h.status === "AVAILABLE").map((home: any) => (
                    <HomeUnitCard key={home.id} home={home} pName={p.name} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {/* Public Property Enquiry Widget */}
            <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs space-y-3.5">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5 text-blue-900">
                <Mail className="size-4 text-blue-600 inline" /> Inquire About This {p.type === "HOUSE" ? "House" : "PG"}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Send your details to book a visit or check room availability.
              </p>
              <EnquiryForm property={p} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 shadow-2xs space-y-2">
              <p className="font-black text-slate-900 text-sm">Why book with C2D Rentals?</p>
              <ul className="list-inside list-disc space-y-1.5 font-semibold text-slate-700">
                <li>Verified property & genuine owner details</li>
                <li>Instant digital rent agreement generation</li>
                <li>Online rent payments with instant digital receipts</li>
                <li>Dedicated maintenance & caretaker support</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function EnquiryForm({ property }: { property: any }) {
  const { success, error: toastError } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    roomId: "",
    preferredMoveInDate: "",
    message: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.submitPublicEnquiry({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        propertyId: property.id,
        roomId: form.roomId || undefined,
        preferredMoveInDate: form.preferredMoveInDate || undefined,
        message: form.message || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      success("Enquiry Sent!", "Our property manager will contact you shortly.");
    },
    onError: (e) => toastError("Submission Failed", e instanceof Error ? e.message : undefined),
  });

  if (submitted) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-1.5">
        <p className="text-xs font-black text-emerald-900">✅ Enquiry Received!</p>
        <p className="text-[11px] font-semibold text-emerald-700">Thank you {form.name}. We will get back to you at {form.phone}.</p>
        <button onClick={() => setSubmitted(false)} className="text-[10px] font-bold text-emerald-800 underline mt-2">
          Submit another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 block">Your Name *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Rahul Sharma"
          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-blue-600 focus:outline-hidden"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 block">Phone / WhatsApp Number *</label>
        <input
          required
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+91 98765 43210"
          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-blue-600 focus:outline-hidden"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 block">Email Address (Optional)</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="rahul@example.com"
          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:border-blue-600 focus:outline-hidden"
        />
      </div>

      {property.type === "PG" && (property.rooms?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 block">Interested Room (Optional)</label>
          <select
            value={form.roomId}
            onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
            className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
          >
            <option value="">Any Room / General Enquiry</option>
            {property.rooms.map((r: any) => (
              <option key={r.id} value={r.id}>
                Room {r.roomNumber} ({r.capacity} Sharing)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 block">Preferred Move-in Date</label>
        <input
          type="date"
          value={form.preferredMoveInDate}
          onChange={(e) => setForm((f) => ({ ...f, preferredMoveInDate: e.target.value }))}
          className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 block">Message / Questions</label>
        <textarea
          rows={2}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="I would like to schedule a visit..."
          className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:border-blue-600 focus:outline-hidden"
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs transition-all shadow-xs"
      >
        {mutation.isPending ? "Submitting..." : "Send Enquiry →"}
      </button>
    </form>
  );
}

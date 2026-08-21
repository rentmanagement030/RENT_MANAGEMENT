import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Home, ShieldCheck, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { PropertyCard } from "@/components/PropertyCard";
import { PageLoader } from "@/components/ui/primitives";

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public", "properties", "home"],
    queryFn: () => api.publicProperties({ pageSize: 6 }),
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary-foreground/70">
              Chennai · Coimbatore · Bengaluru
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Find your perfect <span className="text-sky-400">house</span> or{" "}
              <span className="text-sky-400">PG</span> in minutes
            </h1>
            <p className="mt-4 max-w-lg text-slate-300">
              C2D Properties connects you with verified homes and PGs — transparent rents, no brokerage games, and
              secure online rent payments.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/houses"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Home className="size-4" /> Browse Houses
              </Link>
              <Link
                to="/pgs"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
              >
                <Building2 className="size-4" /> Browse PGs <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, title: "Verified Listings", desc: "Every property is inspected before it goes live." },
              { icon: Wallet, title: "Online Rent", desc: "Pay rent via UPI, bank transfer or demand draft." },
              { icon: Home, title: "No Brokerage", desc: "Deal directly with the owner. Zero hidden fees." },
              { icon: Building2, title: "Managed PGs", desc: "Food, Wi-Fi, housekeeping — all in one monthly rent." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <f.icon className="size-6 text-sky-400" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Featured properties</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hand-picked homes and PGs available right now.</p>
          </div>
          <Link to="/houses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-8">
          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Own a property with C2D Tech?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            We manage your rentals end-to-end — tenant onboarding, monthly rent collection, receipts, and maintenance.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            Get in touch <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

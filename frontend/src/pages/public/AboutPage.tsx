import { Building2, Home, ShieldCheck, Users } from "lucide-react";

const STATS = [
  { icon: Building2, value: "25+", label: "Properties managed" },
  { icon: Users, value: "120+", label: "Happy tenants" },
  { icon: ShieldCheck, value: "99%", label: "On-time collections" },
  { icon: Home, value: "5", label: "Cities served" },
];

export default function AboutPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">About C2D Properties</h1>
          <p className="mt-3 max-w-2xl text-base font-semibold text-slate-600">
            We are C2D Tech — a modern rental and PG management company helping property owners and tenants connect, transact and
            live with total peace of mind.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">Our Story</h2>
            <p className="mt-3 text-sm leading-relaxed font-medium text-slate-700">
              Finding a genuine house or PG and managing rent collections is a hassle for everyone involved —
              owners, tenants and caretakers. C2D Properties was created to resolve that with a single, transparent
              platform: verified listings, digital agreements, online rent collection, instant receipts and prompt
              maintenance.
            </p>
            <p className="mt-3 text-sm leading-relaxed font-medium text-slate-700">
              Today we manage independent houses and PGs across Chennai, Coimbatore and Bengaluru, serving working
              professionals and students.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">What We Do</h2>
            <ul className="mt-4 space-y-3.5 text-sm font-semibold text-slate-700">
              <li className="flex gap-3 items-start">
                <Home className="mt-0.5 size-5 shrink-0 text-blue-600" />
                <span>Listing and leasing of houses and PGs with digital agreements.</span>
              </li>
              <li className="flex gap-3 items-start">
                <Users className="mt-0.5 size-5 shrink-0 text-blue-600" />
                <span>Tenant onboarding with KYC (Aadhaar) verification and emergency contacts.</span>
              </li>
              <li className="flex gap-3 items-start">
                <Building2 className="mt-0.5 size-5 shrink-0 text-blue-600" />
                <span>Monthly rent billing and collection via UPI, bank transfer or cash.</span>
              </li>
              <li className="flex gap-3 items-start">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-600" />
                <span>Maintenance coordination, expense tracking and owner reports.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-6 rounded-2xl border border-slate-200 bg-white p-8 sm:grid-cols-2 lg:grid-cols-4 shadow-sm">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="mx-auto size-8 text-blue-600" />
              <p className="mt-2 text-3xl font-black text-slate-900">{s.value}</p>
              <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

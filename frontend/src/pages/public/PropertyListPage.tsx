import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { PropertyCard } from "@/components/PropertyCard";
import { Input, PageLoader, Select } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/data";

export default function PropertyListPage({ type }: { type: "HOUSE" | "PG" }) {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") || "1");
  const city = params.get("city") || "";
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);
  const [citySel, setCitySel] = useState(city);

  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = { type, page, pageSize: 9 };
    if (city) p.city = city;
    if (q) p.search = q;
    return p;
  }, [type, page, city, q]);

  const { data, isLoading } = useQuery({
    queryKey: ["public", "properties", queryParams],
    queryFn: () => api.publicProperties(queryParams),
  });

  const { data: cities } = useQuery({
    queryKey: ["public", "cities"],
    queryFn: () => api.publicCities(),
  });

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (citySel) next.set("city", citySel);
    next.set("page", "1");
    setParams(next);
  };

  const title = type === "HOUSE" ? "Houses for Rent" : "PGs for Rent";

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        <p className="mt-1.5 text-base font-semibold text-slate-600">
          {type === "HOUSE" ? "Independent houses available on rent across our primary cities." : "Single-seater to multi-sharing PGs with meals and housekeeping."}
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10 text-slate-900 font-medium"
              placeholder="Search by property name, area or landmark..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <Select className="sm:w-52 font-medium" value={citySel} onChange={(e) => setCitySel(e.target.value)}>
            <option value="">All Cities</option>
            {(cities ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <button
            onClick={applyFilters}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            Apply Filters
          </button>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm font-semibold text-slate-500">
              No {type === "HOUSE" ? "houses" : "PGs"} match your search criteria. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
              <div className="mt-8">
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  total={data.total}
                  onPageChange={(p) => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(p));
                    setParams(next);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { Badge, Card, CardContent, Input, PageLoader, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/data";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const debouncedAction = useDebouncedValue(action);
  usePageResetOnFilter(setPage, action);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, debouncedAction],
    queryFn: () => api.auditLogs({ page, pageSize: 20, action: debouncedAction || undefined }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="A record of every sensitive action in the system." />

      <Card>
        <CardContent className="flex pt-6">
          <Input placeholder="Filter by action…" value={action} onChange={(e) => setAction(e.target.value)} className="sm:max-w-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <EmptyState icon={<ScrollText className="size-6" />} title="No audit entries" />
          ) : (
            <>
              {/* Mobile View (< 1024px) */}
              <div className="lg:hidden space-y-3 p-3.5 bg-slate-50/50">
                {data.items.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <p className="font-extrabold text-sm text-slate-900">{a.user?.name ?? "System"}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{a.user?.email ?? "Automated Event"}</p>
                      </div>
                      <Badge variant="secondary">{a.action}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Entity</span>
                        <span className="font-bold text-slate-800 block mt-0.5">{a.entityType}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">IP Address</span>
                        <span className="font-mono text-slate-600 block mt-0.5">{a.ip ?? "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 font-medium">{formatDateTime(a.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View (>= 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{a.user?.name ?? "System"}</p>
                        <p className="text-xs text-muted-foreground">{a.user?.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.action}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.entityType}</TableCell>
                      <TableCell className="max-w-sm text-xs text-muted-foreground">
                        {a.metadata ? <pre className="truncate whitespace-pre-wrap">{JSON.stringify(a.metadata)}</pre> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.ip ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <div className="border-t">
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

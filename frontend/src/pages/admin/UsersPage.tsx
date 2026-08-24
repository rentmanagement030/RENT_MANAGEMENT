import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageResetOnFilter } from "@/hooks/usePageResetOnFilter";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import { Badge, Button, Card, CardContent, Input, Label, PageLoader, Select } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/data";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { validateName, validatePhone, validateEmail } from "@/lib/validation";
import type { RoleInfo, User } from "@/types";

export default function UsersPage() {
  const { user: me, can } = useAuth();
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  usePageResetOnFilter(setPage, search);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page, debouncedSearch],
    queryFn: () => api.listUsers({ page, pageSize: 10, search: debouncedSearch || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteUser(deleting!.id),
    onSuccess: () => {
      success("User deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toastError("Failed", e instanceof Error ? e.message : undefined),
  });

  const canManage = can(PERMISSIONS.USERS_MANAGE) || can(PERMISSIONS.ROLES_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Staff accounts and their access permissions."
        actions={
          can(PERMISSIONS.USERS_MANAGE) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Add user
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="flex pt-6">
          <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoader />
          ) : !data?.items.length ? (
            <EmptyState icon={<ShieldCheck className="size-6" />} title="No users found" />
          ) : (
            <>
              {/* Mobile View (< 1024px) */}
              <div className="lg:hidden space-y-3 p-3.5 bg-slate-50/50">
                {data.items.map((u) => (
                  <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                          {u.name}
                          {me?.id === u.id && <Badge variant="info">You</Badge>}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{u.email}</p>
                      </div>
                      <StatusBadge status={u.status} />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Assigned Roles</span>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <Badge key={r} variant="secondary">{r}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 font-medium">Created: {formatDateTime(u.createdAt)}</span>
                      {canManage && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditing(u)} className="h-8 px-3 text-xs font-bold rounded-xl">
                            Edit User
                          </Button>
                          {u.id !== me?.id && (
                            <Button variant="destructive" size="sm" onClick={() => setDeleting(u)} className="h-8 px-3 text-xs font-bold rounded-xl">
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View (>= 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {u.name}
                          {me?.id === u.id && <Badge className="ml-2" variant="info">You</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((r) => (
                            <Badge key={r} variant="secondary">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditing(u)} title="Edit">
                              <Pencil />
                            </Button>
                            {u.id !== me?.id && (
                              <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleting(u)} title="Delete">
                                <UserX />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="border-t">
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <UserFormDialog
          user={editing}
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete user?"
        description={deleting ? `${deleting.name} (${deleting.email}) will be permanently removed.` : undefined}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function UserFormDialog({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.listRoles() });
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    status: user?.status ?? "ACTIVE",
    roleNames: (user?.roles ?? []).map((r) => r),
  }));

  const toggleRole = (name: string) => {
    setForm((f) => ({
      ...f,
      roleNames: f.roleNames.includes(name) ? f.roleNames.filter((r) => r !== name) : [...f.roleNames, name],
    }));
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateUserForm = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.name, true, "Full Name");
    if (nameErr) errs.name = nameErr;

    const emailErr = validateEmail(form.email, true, "Email Address");
    if (emailErr) errs.email = emailErr;

    if (form.phone) {
      const phoneErr = validatePhone(form.phone, false, "Phone Number");
      if (phoneErr) errs.phone = phoneErr;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const base = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        roleNames: form.roleNames,
      };
      if (user) {
        return api.updateUser(user.id, {
          ...base,
          status: form.status,
          ...(form.password ? { resetPassword: form.password } : {}),
        });
      }
      return api.createUser({ ...base, password: form.password });
    },
    onSuccess: () => {
      success(user ? "User updated" : "User created");
      onSaved();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  const allRoles: RoleInfo[] = roles ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>Assign roles to control what this user can access.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (validateUserForm()) {
              mutation.mutate();
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={cn(fieldErrors.name && "border-rose-500")}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
              }}
              className={cn(fieldErrors.email && "border-rose-500")}
            />
            {fieldErrors.email && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.email}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: e.target.value }));
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              placeholder="e.g. 9876543210"
              className={cn(fieldErrors.phone && "border-rose-500")}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] font-bold text-rose-600 animate-in fade-in">{fieldErrors.phone}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{user ? "Reset password" : "Password *"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={user ? "Leave blank to keep current" : "Min 8 characters"}
              minLength={user ? undefined : 8}
              required={!user}
            />
          </div>
          {user && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="LOCKED">Locked</option>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((r) => (
                <Badge
                  key={r.id}
                  variant={form.roleNames.includes(r.name) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleRole(r.name)}
                >
                  {r.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click a role to toggle it. Users need at least one role.</p>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.roleNames.length === 0} loading={mutation.isPending}>
              {user ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ConfirmDialog } from "@/components/ui/overlay";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, Layers, Building2, ChevronRight, Camera } from "lucide-react";
import type { PropertyHome } from "@/types";
import { AddHomeModal } from "./AddHomeModal";

interface BuildingStructureBuilderProps {
  propertyId: string;
  propertyName?: string;
  homes: PropertyHome[];
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function BuildingStructureBuilder({
  propertyId,
  propertyName,
  homes = [],
  open,
  onClose,
  onRefresh,
}: BuildingStructureBuilderProps) {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();

  // Custom floors defined by user or derived from existing homes
  const defaultFloorsList = ["Ground Floor", "1st Floor"];
  const existingFloors = Array.from(new Set(homes.map((h) => h.floor || "Ground Floor").filter(Boolean)));
  const initialFloors = Array.from(new Set([...defaultFloorsList, ...existingFloors]));

  const [floorsList, setFloorsList] = useState<string[]>(initialFloors);
  const [addingHomeOnFloor, setAddingHomeOnFloor] = useState<string | null>(null);
  const [editingHome, setEditingHome] = useState<PropertyHome | null>(null);
  const [deletingHome, setDeletingHome] = useState<PropertyHome | null>(null);
  const [addingFloorModal, setAddingFloorModal] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Group homes by floor name (case-insensitive key comparison)
  const homesByFloorMap: Record<string, PropertyHome[]> = {};
  for (const f of floorsList) {
    homesByFloorMap[f] = [];
  }

  for (const h of homes) {
    const flName = h.floor || "Ground Floor";
    let matchedKey = floorsList.find((f) => f.toLowerCase() === flName.toLowerCase());
    if (!matchedKey) {
      matchedKey = flName;
      homesByFloorMap[matchedKey] = [];
      if (!floorsList.includes(matchedKey)) {
        setFloorsList((prev) => [...prev, matchedKey!]);
      }
    }
    homesByFloorMap[matchedKey].push(h);
  }

  // Delete Home Mutation
  const deleteMutation = useMutation({
    mutationFn: (homeId: string) => api.deleteHome(homeId),
    onSuccess: () => {
      success("Home deleted successfully");
      setDeletingHome(null);
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      if (onRefresh) onRefresh();
    },
    onError: (e) => toastError("Could not delete home", e instanceof Error ? e.message : undefined),
  });

  const handleAddFloorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFloorName.trim();
    if (!trimmed) return;
    if (floorsList.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      toastError("Floor already exists", `"${trimmed}" is already in your floor list.`);
      return;
    }
    setFloorsList((prev) => [...prev, trimmed]);
    setNewFloorName("");
    setAddingFloorModal(false);
    success(`Floor "${trimmed}" added to building structure`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white">
          <DialogHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" /> Building Structure Builder
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-slate-500">
                {propertyName ? `${propertyName} · ` : ""}Add floors and manage homes with independent rent terms.
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-bold text-slate-700 hover:bg-slate-50 border-slate-300 flex items-center gap-1.5"
              onClick={() => setShowBatchModal(true)}
            >
              <Layers className="size-3.5 text-blue-600" /> Batch Generator
            </Button>
          </DialogHeader>

          {/* BUILDING STRUCTURE CONTAINER */}
          <div className="space-y-5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-600 tracking-wider">
                Building Structure ({homes.length} Homes Configured)
              </span>
            </div>

            {/* FLOORS & HOMES LIST */}
            <div className="space-y-4">
              {floorsList.map((floor) => {
                const floorHomes = homesByFloorMap[floor] || [];

                return (
                  <div key={floor} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    {/* Floor Header Bar */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{floor}</span>
                        <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {floorHomes.length} Home{floorHomes.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 shadow-xs"
                        onClick={() => setAddingHomeOnFloor(floor)}
                      >
                        <Plus className="size-3.5 mr-1" /> Add Home
                      </Button>
                    </div>

                    {/* Homes List under this floor */}
                    {floorHomes.length === 0 ? (
                      <div className="py-4 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                        <p className="text-xs font-semibold text-slate-400">No homes added yet to {floor}.</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs font-bold text-blue-600 hover:bg-blue-50 mt-1"
                          onClick={() => setAddingHomeOnFloor(floor)}
                        >
                          + Add Home to {floor}
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {floorHomes.map((h) => (
                          <div
                            key={h.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900">{h.homeNumber}</span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {h.homeType}
                                </span>
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                    h.status === "OCCUPIED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {h.status}
                                </span>
                                {h.imageUrls && h.imageUrls.length > 0 && (
                                   <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                     <Camera className="size-3 text-blue-600 inline" /> {h.imageUrls.length}
                                   </span>
                                )}
                              </div>
                              <p className="text-xs font-black text-blue-700">
                                {formatINR(h.rent)}<span className="text-[10px] font-normal text-slate-500">/month</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
                                onClick={() => setEditingHome(h)}
                              >
                                <Pencil className="size-3 mr-1" /> Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                onClick={() => setDeletingHome(h)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ADD FLOOR BUTTON */}
            <div className="pt-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="h-10 text-xs font-extrabold text-slate-800 border-slate-300 hover:bg-slate-100 px-6 rounded-xl shadow-2xs"
                onClick={() => setAddingFloorModal(true)}
              >
                <Plus className="size-4 mr-1.5 text-blue-600" /> Add Floor
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" className="h-10 text-xs font-bold rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 shadow-xs"
              onClick={onClose}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Home Modal */}
      {(addingHomeOnFloor || editingHome) && (
        <AddHomeModal
          propertyId={propertyId}
          propertyName={propertyName}
          defaultFloor={addingHomeOnFloor || editingHome?.floor || "Ground Floor"}
          existingHomes={homes}
          editingHome={editingHome}
          open={!!(addingHomeOnFloor || editingHome)}
          onClose={() => {
            setAddingHomeOnFloor(null);
            setEditingHome(null);
          }}
          onSaved={() => {
            setAddingHomeOnFloor(null);
            setEditingHome(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Add Floor Modal */}
      {addingFloorModal && (
        <Dialog open={addingFloorModal} onOpenChange={(o) => !o && setAddingFloorModal(false)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-5 border border-slate-200 shadow-xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-slate-900">Add New Floor</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Enter floor level name (e.g. 2nd Floor, 3rd Floor, Penthouse).
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4 pt-2" onSubmit={handleAddFloorSubmit}>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Floor Level Name *</Label>
                <Input
                  required
                  placeholder="e.g. 2nd Floor"
                  className="h-10 text-xs font-bold"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" className="h-9 text-xs font-bold" onClick={() => setAddingFloorModal(false)}>
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

      {/* Delete Home Confirm Dialog */}
      <ConfirmDialog
        open={!!deletingHome}
        onOpenChange={(o) => !o && setDeletingHome(null)}
        title={`Delete Home ${deletingHome?.homeNumber}?`}
        description={
          deletingHome
            ? `Home ${deletingHome.homeNumber} (${deletingHome.floor}) will be archived. You cannot delete a home with active tenants.`
            : undefined
        }
        confirmLabel="Delete Home"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deletingHome && deleteMutation.mutate(deletingHome.id)}
      />
    </>
  );
}

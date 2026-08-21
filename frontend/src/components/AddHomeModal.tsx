import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, ChevronDown, ChevronUp, Camera, Upload, X, Loader2, Plus, Check } from "lucide-react";

interface ComboboxItem {
  value: string;
  label?: string;
  badge?: string;
  isTaken?: boolean;
  isCustom?: boolean;
}

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxItem[];
  placeholder?: string;
  customAddPrefix?: string;
  hasError?: boolean;
  className?: string;
  required?: boolean;
}

function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  customAddPrefix = "+ Add custom",
  hasError = false,
  className = "",
  required = false,
}: ComboboxInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = (value || "").trim().toLowerCase();

  // Filter options based on typed input
  const filtered = useMemo(() => {
    const matched = options.filter((opt) => opt.value.toLowerCase().includes(query));
    const exactMatch = options.some((opt) => opt.value.toLowerCase() === query);

    if (query && !exactMatch) {
      matched.push({
        value: value,
        label: `${customAddPrefix} "${value}"`,
        isCustom: true,
      });
    }
    return matched;
  }, [options, query, value, customAddPrefix]);

  const handleSelect = (itemValue: string) => {
    onChange(itemValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      }
    } else if (e.key === "Enter") {
      if (isOpen && filtered.length > 0) {
        e.preventDefault();
        const selected = filtered[highlightedIndex] || filtered[0];
        if (selected) {
          handleSelect(selected.value);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "h-9 text-xs font-semibold pr-8 transition-all bg-white",
            hasError ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-blue-500",
            className
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-150", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl max-h-48 overflow-y-auto py-1 text-xs font-semibold animate-in fade-in duration-100">
          {filtered.map((opt, idx) => {
            const isSelected = opt.value.toLowerCase() === query;
            const isHighlighted = idx === highlightedIndex;

            return (
              <button
                key={opt.value + "-" + idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt.value);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer",
                  isHighlighted ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50",
                  isSelected && "font-bold text-blue-600"
                )}
              >
                <span className="truncate flex items-center gap-1.5">
                  {opt.isCustom ? (
                    <span className="text-blue-600 font-extrabold flex items-center gap-1">
                      <Plus className="size-3" /> {opt.label}
                    </span>
                  ) : (
                    opt.label || opt.value
                  )}
                </span>

                {opt.badge && (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-2",
                      opt.isTaken ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    )}
                  >
                    {opt.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AddHomeModalProps {
  propertyId?: string;
  propertyName?: string;
  defaultFloor?: string;
  existingHomes?: any[];
  editingHome?: any | null;
  isTemp?: boolean;
  onAddTempHome?: (tempHome: any) => void;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AddHomeModal({
  propertyId,
  propertyName,
  defaultFloor = "Ground Floor",
  existingHomes = [],
  editingHome = null,
  isTemp = false,
  onAddTempHome,
  open,
  onClose,
  onSaved,
}: AddHomeModalProps) {
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState({
    floor: defaultFloor,
    homeNumber: "",
    homeType: "2 BHK",
    rent: "",
    advance: "",
    deposit: "",
    dueDay: "5",
    latePenalty: "50",
    ebConnectionType: "INDIVIDUAL",
    ebNumber: "",
    ebMeterNumber: "",
    waterConnectionType: "INDIVIDUAL",
    waterConsumerNumber: "",
    builtUpArea: "",
    bedrooms: "",
    bathrooms: "",
  });

  // Helper to extract prefix from floor name
  const getFloorPrefix = (floorName: string) => {
    const fl = (floorName || "").toLowerCase();
    if (fl.includes("ground") || fl.startsWith("g")) return "G-";
    if (fl.includes("1st") || fl.includes("first") || fl.includes("1")) return "F-";
    if (fl.includes("2nd") || fl.includes("second") || fl.includes("2")) return "S-";
    if (fl.includes("3rd") || fl.includes("third") || fl.includes("3")) return "T-";
    if (fl.includes("stilt")) return "ST-";
    if (fl.includes("terrace")) return "TH-";
    if (fl.includes("basement")) return "B-";
    return "H-";
  };

  // 1. Dynamic Floor Combobox Suggestions
  const floorOptions: ComboboxItem[] = useMemo(() => {
    const DEFAULT_FLOORS = [
      "Ground Floor",
      "1st Floor",
      "2nd Floor",
      "3rd Floor",
      "4th Floor",
      "Stilt Floor",
      "Terrace Floor",
      "Basement",
    ];
    const existingFloors = Array.from(new Set(existingHomes.map((h) => h.floor).filter(Boolean)));
    const merged = Array.from(new Set([...existingFloors, ...DEFAULT_FLOORS]));
    return merged.map((fl) => ({ value: fl, label: fl }));
  }, [existingHomes]);

  // 2. Dynamic Home Number Combobox Suggestions (Generated from selected Floor & existing units)
  const homeNumberOptions: ComboboxItem[] = useMemo(() => {
    const prefix = getFloorPrefix(form.floor);
    const existingNumSet = new Set(
      existingHomes
        .filter((h) => !editingHome || (editingHome.id ? h.id !== editingHome.id : h.tempId !== editingHome.tempId))
        .map((h) => (h.homeNumber || "").toLowerCase().trim())
    );

    const generated: ComboboxItem[] = [];

    // Generate candidate numbers (e.g., G-01 to G-08 or F-01 to F-08)
    for (let i = 1; i <= 8; i++) {
      const numStr = `${prefix}${i.toString().padStart(2, "0")}`;
      const isTaken = existingNumSet.has(numStr.toLowerCase());
      generated.push({
        value: numStr,
        label: numStr,
        badge: isTaken ? "Taken" : "Available",
        isTaken,
      });
    }

    // Include existing home numbers on this floor
    const existingOnThisFloor = existingHomes
      .filter((h) => (h.floor || "").toLowerCase() === (form.floor || "").toLowerCase())
      .map((h) => h.homeNumber)
      .filter(Boolean);

    for (const num of existingOnThisFloor) {
      if (!generated.some((g) => g.value.toLowerCase() === num.toLowerCase())) {
        const isTaken = existingNumSet.has(num.toLowerCase());
        generated.unshift({
          value: num,
          label: num,
          badge: isTaken ? "Taken" : "Available",
          isTaken,
        });
      }
    }

    return generated;
  }, [form.floor, existingHomes, editingHome]);

  // Duplicate Check Validation
  const handleHomeNumberChange = (num: string) => {
    setForm((f) => ({ ...f, homeNumber: num }));
    const trimmed = num.trim().toLowerCase();
    if (!trimmed) {
      setDupError(null);
      return;
    }
    const isDup = existingHomes.some(
      (h) =>
        (h.homeNumber || "").toLowerCase() === trimmed &&
        (!editingHome || (editingHome.id ? h.id !== editingHome.id : h.tempId !== editingHome.tempId))
    );
    if (isDup) {
      setDupError(`Home number "${num.trim()}" already exists in this property.`);
    } else {
      setDupError(null);
    }
  };

  const handleFloorChange = (newFloor: string) => {
    setForm((f) => {
      const currentPrefix = getFloorPrefix(f.floor);
      const newPrefix = getFloorPrefix(newFloor);
      let nextNum = f.homeNumber;

      if (!f.homeNumber || f.homeNumber.startsWith(currentPrefix)) {
        const existingNumSet = new Set(
          existingHomes
            .filter((h) => !editingHome || (editingHome.id ? h.id !== editingHome.id : h.tempId !== editingHome.tempId))
            .map((h) => (h.homeNumber || "").toLowerCase().trim())
        );
        for (let i = 1; i <= 20; i++) {
          const candidate = `${newPrefix}${i.toString().padStart(2, "0")}`;
          if (!existingNumSet.has(candidate.toLowerCase())) {
            nextNum = candidate;
            break;
          }
        }
      }

      handleHomeNumberChange(nextNum);
      return { ...f, floor: newFloor, homeNumber: nextNum };
    });
  };

  useEffect(() => {
    if (editingHome) {
      setForm({
        floor: editingHome.floor || defaultFloor,
        homeNumber: editingHome.homeNumber || "",
        homeType: editingHome.homeType || "2 BHK",
        rent: editingHome.rent != null ? editingHome.rent.toString() : "",
        advance: editingHome.advance != null ? editingHome.advance.toString() : "",
        deposit: editingHome.deposit != null ? editingHome.deposit.toString() : "",
        dueDay: editingHome.dueDay != null ? editingHome.dueDay.toString() : "5",
        latePenalty: editingHome.latePenalty != null ? editingHome.latePenalty.toString() : "50",
        ebConnectionType: editingHome.ebConnectionType || "INDIVIDUAL",
        ebNumber: editingHome.ebNumber || "",
        ebMeterNumber: editingHome.ebMeterNumber || "",
        waterConnectionType: editingHome.waterConnectionType || "INDIVIDUAL",
        waterConsumerNumber: editingHome.waterConsumerNumber || "",
        builtUpArea: editingHome.builtUpArea != null ? editingHome.builtUpArea.toString() : "",
        bedrooms: editingHome.bedrooms != null ? editingHome.bedrooms.toString() : "",
        bathrooms: editingHome.bathrooms != null ? editingHome.bathrooms.toString() : "",
      });
      setImageUrls(editingHome.imageUrls ?? []);
    } else {
      // Suggest next unit number if default floor is selected
      const prefix = getFloorPrefix(defaultFloor);
      const existingNumSet = new Set(
        existingHomes.map((h) => (h.homeNumber || "").toLowerCase().trim())
      );
      let suggestedNum = `${prefix}01`;
      for (let i = 1; i <= 20; i++) {
        const candidate = `${prefix}${i.toString().padStart(2, "0")}`;
        if (!existingNumSet.has(candidate.toLowerCase())) {
          suggestedNum = candidate;
          break;
        }
      }

      setForm({
        floor: defaultFloor,
        homeNumber: suggestedNum,
        homeType: "2 BHK",
        rent: "15000",
        advance: "30000",
        deposit: "45000",
        dueDay: "5",
        latePenalty: "50",
        ebConnectionType: "INDIVIDUAL",
        ebNumber: "",
        ebMeterNumber: "",
        waterConnectionType: "INDIVIDUAL",
        waterConsumerNumber: "",
        builtUpArea: "",
        bedrooms: "",
        bathrooms: "",
      });
      setImageUrls([]);
    }
    setDupError(null);
  }, [editingHome, defaultFloor, open]);

  const handleUploadHomePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => api.uploadPropertyImage(f)));
      setImageUrls((prev) => [...prev, ...uploaded.map((u) => u.url)]);
      success(`${uploaded.length} photo(s) added for this unit`);
    } catch (err) {
      toastError("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = form.homeNumber.trim();
      const isDup = existingHomes.some(
        (h) =>
          (h.homeNumber || "").toLowerCase() === trimmed.toLowerCase() &&
          (!editingHome || (editingHome.id ? h.id !== editingHome.id : h.tempId !== editingHome.tempId))
      );
      if (isDup) {
        throw new Error(`Home number "${trimmed}" already exists in this property.`);
      }

      const body = {
        floor: form.floor || defaultFloor,
        homeNumber: trimmed,
        homeType: form.homeType,
        rent: Number(form.rent),
        advance: form.deposit ? Number(form.deposit) : undefined,
        deposit: form.deposit ? Number(form.deposit) : undefined,
        dueDay: form.dueDay ? Number(form.dueDay) : 5,
        latePenalty: form.latePenalty ? Number(form.latePenalty) : 50,
        ebConnectionType: form.ebConnectionType,
        ebNumber: form.ebNumber || undefined,
        ebMeterNumber: form.ebMeterNumber || undefined,
        waterConnectionType: form.waterConnectionType,
        waterConsumerNumber: form.waterConsumerNumber || undefined,
        builtUpArea: form.builtUpArea ? Number(form.builtUpArea) : undefined,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        imageUrls,
      };

      if (isTemp && onAddTempHome) {
        onAddTempHome({
          ...body,
          tempId: editingHome?.tempId || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        });
        return { homeNumber: trimmed };
      }

      if (editingHome && editingHome.id) {
        return await api.updateHome(editingHome.id, body);
      } else if (propertyId) {
        return await api.createHome(propertyId, body);
      }
    },
    onSuccess: (res) => {
      if (!isTemp) {
        success(editingHome ? `Home ${res?.homeNumber} updated` : `Home ${res?.homeNumber} created`);
        if (propertyId) {
          qc.invalidateQueries({ queryKey: ["property", propertyId] });
          qc.invalidateQueries({ queryKey: ["properties"] });
        }
        if (onSaved) onSaved();
      }
      onClose();
    },
    onError: (e) => toastError("Save failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col rounded-2xl p-5 border border-slate-200 shadow-xl bg-white overflow-hidden">
        <DialogHeader className="pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-extrabold text-slate-900">
            {editingHome ? `Edit Home ${editingHome.homeNumber}` : `Add Home to ${form.floor}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            {propertyName ? `${propertyName} · ` : ""}Configure unit number, home type, and financial rent terms.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-3 overflow-y-auto max-h-[calc(90vh-130px)] pr-1.5 scrollbar-thin"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dupError) saveMutation.mutate();
          }}
        >
          {/* Duplicate Error Banner */}
          {dupError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {dupError}
            </div>
          )}

          {/* Floor & Unit Identifier Comboboxes */}
          <div className="grid grid-cols-2 gap-3 relative z-30">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Floor</Label>
              <ComboboxInput
                required
                value={form.floor}
                onChange={handleFloorChange}
                options={floorOptions}
                placeholder="e.g. Ground Floor"
                customAddPrefix="+ Add custom floor"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Home Number *</Label>
              <ComboboxInput
                required
                value={form.homeNumber}
                onChange={handleHomeNumberChange}
                options={homeNumberOptions}
                placeholder="e.g. G-01"
                customAddPrefix="+ Enter custom home number"
                hasError={!!dupError}
              />
            </div>
          </div>

          {/* Home Type & Rent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Home Type</Label>
              <Select
                className="h-9 text-xs font-semibold"
                value={form.homeType}
                onChange={(e) => setForm((f) => ({ ...f, homeType: e.target.value }))}
              >
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK">2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4 BHK">4 BHK</option>
                <option value="Studio">Studio</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Independent House">Independent House</option>
                <option value="INDEPENDENT_FLOOR">Independent Floor</option>
                <option value="Other">Other</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Monthly Rent (₹) *</Label>
              <Input
                required
                type="number"
                min={0}
                placeholder="e.g. 18000"
                className="h-9 text-xs font-extrabold text-blue-700"
                value={form.rent}
                onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))}
              />
            </div>
          </div>

          {/* Security Deposit */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Security Deposit (₹)</Label>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 45000"
              className="h-9 text-xs font-semibold"
              value={form.deposit}
              onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value, advance: e.target.value }))}
            />
          </div>

          {/* Unit Photos (Optional) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Camera className="size-3.5 text-blue-600" /> Unit Photos (Optional)
              </Label>
              <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all">
                {uploadingImage ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                <span>Upload Photos</span>
                <input type="file" accept="image/*" multiple onChange={handleUploadHomePhotos} disabled={uploadingImage} className="hidden" />
              </label>
            </div>

            {imageUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group size-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                    <img src={url} alt={`Unit photo ${idx + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(url)}
                      className="absolute top-1 right-1 bg-slate-900/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 font-medium italic">No unit photos attached. Click upload to add interior/balcony photos for this home.</p>
            )}
          </div>

          {/* More Options Collapsible Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors py-1"
            >
              <SlidersHorizontal className="size-3.5" />
              {showAdvanced ? "Hide More Options" : "More Options (Due Day, Penalty, EB & Water Meters)"}
              {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>

          {showAdvanced && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3 text-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Rent Due Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    className="h-8 text-xs font-semibold bg-white"
                    value={form.dueDay}
                    onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Late Penalty (₹/day)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs font-semibold bg-white"
                    value={form.latePenalty}
                    onChange={(e) => setForm((f) => ({ ...f, latePenalty: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">EB Connection</Label>
                  <Select
                    className="h-8 text-xs font-semibold bg-white"
                    value={form.ebConnectionType}
                    onChange={(e) => setForm((f) => ({ ...f, ebConnectionType: e.target.value }))}
                  >
                    <option value="INDIVIDUAL">Individual Meter</option>
                    <option value="SHARED_PROPERTY">Shared Property EB</option>
                  </Select>
                </div>
                {form.ebConnectionType === "INDIVIDUAL" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">EB Consumer No</Label>
                    <Input
                      placeholder="e.g. EB-CHN-100234"
                      className="h-8 text-xs bg-white"
                      value={form.ebNumber}
                      onChange={(e) => setForm((f) => ({ ...f, ebNumber: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Area (sq ft)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1100"
                    className="h-8 text-xs bg-white"
                    value={form.builtUpArea}
                    onChange={(e) => setForm((f) => ({ ...f, builtUpArea: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Bedrooms</Label>
                  <Input
                    type="number"
                    placeholder="2"
                    className="h-8 text-xs bg-white"
                    value={form.bedrooms}
                    onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">Bathrooms</Label>
                  <Input
                    type="number"
                    placeholder="2"
                    className="h-8 text-xs bg-white"
                    value={form.bathrooms}
                    onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="h-9 text-xs font-bold" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!!dupError}
              loading={saveMutation.isPending}
              className="h-9 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white px-5 shadow-xs"
            >
              {editingHome ? "Update Home" : "Add Home"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

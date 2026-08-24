import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ShieldCheck,
  FileText,
  Lock,
  AlertCircle,
  Eye,
  Download,
  PenTool,
  Type,
  Trash2,
  Check,
  Calendar,
  Building2,
  User,
  Phone,
  FileCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageLoader } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import FileViewer from "@/components/FileViewer";
import { validateName } from "@/lib/validation";

function formatAgreementNo(agreementNumber?: string | null, id?: string): string {
  if (!agreementNumber) return id ? `AGR-${id.slice(-6).toUpperCase()}` : "AGR-—";
  if (agreementNumber.startsWith("AGR-")) return agreementNumber;
  return `AGR-${agreementNumber}`;
}

export default function PublicAgreementSignPage() {
  const { token } = useParams<{ token: string }>();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<"DRAW" | "TYPE">("DRAW");
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const { data: agreement, isLoading, error } = useQuery({
    queryKey: ["agreementSign", token],
    queryFn: () => api.getAgreementForSigning(token!),
    enabled: !!token,
  });

  // Pre-fill typed name from tenant record once loaded
  useEffect(() => {
    if (agreement?.tenant?.name && !typedName) {
      setTypedName(agreement.tenant.name);
    }
  }, [agreement, typedName]);

  const signMutation = useMutation({
    mutationFn: (data: { signatureName: string; signatureUrl?: string; signatureMethod: string }) =>
      api.signAgreement(token!, data),
    onSuccess: () => {
      setSignedSuccess(true);
      setConfirmModalOpen(false);
      success("Agreement signed successfully!");
    },
    onError: (err) => {
      setConfirmModalOpen(false);
      toastError("Signing failed", err instanceof Error ? err.message : "Could not process signature");
    },
  });

  // Touch & Mouse Canvas Helpers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toastError("Action Required", "Please check the consent box to confirm electronic signature.");
      return;
    }

    if (activeTab === "DRAW" && !hasDrawn) {
      toastError("Action Required", "Please draw your signature in the box provided.");
      return;
    }

    if (activeTab === "TYPE") {
      const nameErr = validateName(typedName, true, "Full legal name");
      if (nameErr) {
        toastError("Invalid Name", nameErr);
        return;
      }
    }

    setConfirmModalOpen(true);
  };

  const executeSigning = () => {
    let signatureUrl: string | undefined = undefined;
    if (activeTab === "DRAW" && canvasRef.current && hasDrawn) {
      signatureUrl = canvasRef.current.toDataURL("image/png");
    }

    const name = activeTab === "DRAW" 
      ? (agreement?.tenant?.name || typedName.trim() || "Resident")
      : typedName.trim();

    signMutation.mutate({
      signatureName: name,
      signatureUrl,
      signatureMethod: activeTab,
    });
  };

  if (isLoading) return <PageLoader label="Loading agreement for digital signature…" />;

  if (error || !agreement) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 bg-white text-center p-6 rounded-2xl shadow-lg space-y-4">
          <div className="size-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="size-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Agreement Unavailable</h2>
            <p className="text-sm font-semibold text-slate-600 mt-2 leading-relaxed">
              {error instanceof Error ? error.message : "This signing link is invalid, expired, cancelled, or revoked."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isSigned = signedSuccess || agreement.isLocked || agreement.status === "SIGNED" || agreement.status === "COMPLETED";
  const agrNo = formatAgreementNo(agreement.agreementNumber, agreement.id);
  const tenantName = agreement.tenant?.name || "Resident";
  const propertyName = agreement.property?.name || "Property";
  const periodStr = `${agreement.startDate ? formatDate(agreement.startDate) : ""} – ${agreement.endDate ? formatDate(agreement.endDate) : ""}`;

  const docUrl = isSigned
    ? (agreement.signedPdf?.url || `${window.location.origin}/api/rent/agreements/${agreement.id}/signed-document`)
    : (agreement.document?.url || `${window.location.origin}/api/rent/agreements/${agreement.id}/document`);

  const currentStep = isSigned ? 3 : (hasDrawn || typedName.trim()) ? 2 : 1;

  const canSubmit = agreed && (activeTab === "DRAW" ? hasDrawn : !!typedName.trim()) && !signMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* TOP BRAND HEADER */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200 pb-4 bg-white p-4 sm:p-6 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
              C2D
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">C2D Tech Rentals</h1>
              <p className="text-xs font-bold text-slate-500">Secure Electronic Agreement Portal</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
            <Lock className="size-3.5 text-emerald-600 shrink-0" />
            <span>Secure Signing</span>
          </div>
        </header>

        {/* PROGRESS STEPPER */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-extrabold max-w-lg mx-auto">
            {/* Step 1 */}
            <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-blue-700" : "text-slate-400"}`}>
              <div className={`size-7 rounded-full flex items-center justify-center font-black transition-all ${
                currentStep > 1 ? "bg-emerald-600 text-white" : currentStep === 1 ? "bg-blue-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
              }`}>
                {currentStep > 1 ? "✓" : "1"}
              </div>
              <span className="hidden sm:inline">Review Agreement</span>
            </div>

            <div className={`h-0.5 flex-1 mx-2 sm:mx-4 ${currentStep > 1 ? "bg-emerald-600" : "bg-slate-200"}`} />

            {/* Step 2 */}
            <div className={`flex items-center gap-2 ${currentStep >= 2 ? "text-blue-700" : "text-slate-400"}`}>
              <div className={`size-7 rounded-full flex items-center justify-center font-black transition-all ${
                currentStep > 2 ? "bg-emerald-600 text-white" : currentStep === 2 ? "bg-blue-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
              }`}>
                {currentStep > 3 ? "✓" : "2"}
              </div>
              <span className="hidden sm:inline">Sign Agreement</span>
            </div>

            <div className={`h-0.5 flex-1 mx-2 sm:mx-4 ${currentStep > 2 ? "bg-emerald-600" : "bg-slate-200"}`} />

            {/* Step 3 */}
            <div className={`flex items-center gap-2 ${currentStep === 3 ? "text-emerald-700" : "text-slate-400"}`}>
              <div className={`size-7 rounded-full flex items-center justify-center font-black transition-all ${
                currentStep === 3 ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
              }`}>
                {currentStep === 3 ? "✓" : "3"}
              </div>
              <span className="hidden sm:inline">Completed</span>
            </div>
          </div>
        </div>

        {/* IF ALREADY SIGNED / COMPLETED */}
        {isSigned ? (
          <Card className="border border-emerald-300 bg-emerald-50/90 shadow-sm rounded-2xl text-center p-6 sm:p-8 space-y-4">
            <div className="size-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="size-10" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-emerald-950">Agreement Signed Successfully</h2>
              <p className="text-sm font-bold text-emerald-800 mt-1">
                Thank you, <strong>{tenantName}</strong>. Your rental agreement has been electronically signed and locked.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 max-w-md mx-auto text-left space-y-2 text-xs font-semibold">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-bold">Agreement Ref</span>
                <span className="font-mono font-black text-slate-900">{agrNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-bold">Property</span>
                <span className="font-bold text-slate-900">{propertyName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-bold">Signed Date</span>
                <span className="font-bold text-slate-900">{agreement.signedAt ? formatDate(agreement.signedAt) : formatDate(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Status</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">SIGNED</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setPdfViewerOpen(true)}
                className="h-11 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2"
              >
                <Eye className="size-4" /> View Signed Agreement
              </Button>
              <a
                href={docUrl}
                download={`Signed-Agreement-${agrNo}.pdf`}
                className="inline-flex h-11 items-center justify-center gap-2 px-5 bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 font-extrabold text-xs rounded-xl transition-all"
              >
                <Download className="size-4 text-emerald-700" /> Download Signed PDF
              </a>
            </div>
          </Card>
        ) : (
          /* SUMMARY OVERVIEW BOX */
          <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <FileText className="size-5 text-blue-400" /> Residential Lease Agreement
                </CardTitle>
                <span className="font-mono font-black text-xs text-blue-300 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-800">
                  {agrNo}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center font-bold">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-black">Tenant</span>
                  <span className="text-slate-900 text-sm font-black truncate block">{tenantName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-black">Property</span>
                  <span className="text-slate-900 text-sm font-black truncate block">{propertyName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-black">Monthly Rent</span>
                  <span className="text-emerald-600 text-sm font-black">{formatINR(agreement.rent)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block font-black">Status</span>
                  <span className="text-blue-700 text-xs font-extrabold bg-blue-100 px-2 py-0.5 rounded-md inline-block">
                    Awaiting Signature
                  </span>
                </div>
              </div>

              {/* Lease Dates */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex flex-col sm:flex-row items-center justify-between text-xs font-semibold gap-2">
                <span className="text-blue-900 font-bold flex items-center gap-1.5">
                  <Calendar className="size-4 text-blue-600" /> Lease Term: <strong>{periodStr}</strong>
                </span>
                <span className="text-slate-600">
                  Advance: <strong className="text-slate-900">{formatINR(agreement.advance)}</strong> · Deposit: <strong className="text-slate-900">{formatINR(agreement.deposit)}</strong>
                </span>
              </div>

              {/* DOCUMENT PREVIEW IN-APP */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="size-4 text-blue-600" /> Document Preview
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfViewerOpen(true)}
                      className="h-8 px-3 text-xs font-bold border-slate-300 hover:bg-blue-50 hover:text-blue-700 rounded-lg"
                    >
                      <Eye className="size-3.5 mr-1" /> Open Full Document
                    </Button>
                    <a
                      href={docUrl}
                      download={`Agreement-${agrNo}.pdf`}
                      className="inline-flex h-8 items-center gap-1 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                    >
                      <Download className="size-3.5" /> Download PDF
                    </a>
                  </div>
                </div>

                {/* Rendered Agreement Content View Box */}
                <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 space-y-4 max-h-60 overflow-y-auto leading-relaxed border-l-4 border-l-blue-600">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase mb-1">1. PARTIES TO THE AGREEMENT</h4>
                    <p>This Residential Lease Agreement is entered into between <strong>C2D Tech Rentals</strong> (Landlord/Property Manager) and <strong>{tenantName}</strong> (Tenant/Occupant).</p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase mb-1">2. PREMISES & OCCUPANCY</h4>
                    <p>The Landlord agrees to lease the premises at <strong>{propertyName}</strong> to the Tenant for residential occupancy during the specified tenancy term.</p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase mb-1">3. TERM & FINANCIAL DETAILS</h4>
                    <p>Tenancy Period: <strong>{periodStr}</strong>. Monthly Rent: <strong>{formatINR(agreement.rent)}</strong> due on the 1st of each calendar month. Security Deposit: <strong>{formatINR(agreement.deposit)}</strong>.</p>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase mb-1">4. GENERAL TERMS & OPERATING CONDITIONS</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Rent is payable on or before the due date specified by property management.</li>
                      <li>Electricity, Water, and Maintenance charges shall be billed separately based on utility meter readings or fixed terms.</li>
                      <li>The security deposit is refundable upon move-out after deducting unpaid dues or damage charges.</li>
                      <li>Sub-letting, unauthorized overnight guests, or illegal activities are strictly prohibited.</li>
                      <li>Electronic signatures provided via this portal are recorded with timestamp, IP address, and browser metadata.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ELECTRONIC SIGNATURE CAPTURE SECTION */}
        {!isSigned && (
          <form onSubmit={handleOpenConfirm}>
            <Card className="border-2 border-blue-600 bg-white shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-4 sm:p-5">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <PenTool className="size-5 text-blue-400" /> Electronic Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">

                {/* Legal Acknowledgment Notice */}
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-950 space-y-1">
                  <p className="font-black text-blue-900 text-xs">By signing below, I confirm that:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-blue-900/90 text-[11px]">
                    <li>I have reviewed the lease agreement terms and financial details.</li>
                    <li>The information provided is accurate and true.</li>
                    <li>I agree to the terms and conditions of this rental agreement.</li>
                    <li>I understand that my electronic signature represents my acceptance of this agreement.</li>
                  </ul>
                </div>

                {/* Signature Tab Switcher */}
                <div className="space-y-3">
                  <div className="flex border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab("DRAW")}
                      className={`flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all ${
                        activeTab === "DRAW"
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <PenTool className="size-4" /> Draw Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("TYPE")}
                      className={`flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all ${
                        activeTab === "TYPE"
                          ? "border-blue-600 text-blue-700 bg-blue-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Type className="size-4" /> Type Signature
                    </button>
                  </div>

                  {/* TAB 1: DRAW SIGNATURE */}
                  {activeTab === "DRAW" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800">
                          Draw your signature inside the box below
                        </label>
                        {hasDrawn && (
                          <button
                            type="button"
                            onClick={clearCanvas}
                            className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="size-3.5" /> Clear Signature
                          </button>
                        )}
                      </div>

                      <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none flex justify-center overflow-hidden relative">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={160}
                          className="w-full h-40 cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                        {!hasDrawn && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 font-extrabold text-xs select-none">
                            Sign inside this box (touch or mouse)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: TYPE SIGNATURE */}
                  {activeTab === "TYPE" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-slate-800 block">
                          Full Legal Name <span className="text-rose-600">*</span>
                        </label>
                        <Input
                          placeholder="Type your full legal name"
                          value={typedName}
                          onChange={(e) => setTypedName(e.target.value)}
                          className="font-bold border-slate-300 rounded-xl"
                        />
                      </div>

                      {/* Styled Cursive Signature Preview Box */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Signature Preview</span>
                        <div className="font-serif italic text-2xl font-black text-slate-900 tracking-wider py-2 select-none border-b border-slate-300/80 inline-block px-6">
                          {typedName.trim() || tenantName}
                        </div>
                        <p className="text-[10px] font-extrabold text-slate-500 pt-1">
                          Typed electronic signature
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* SIGNER DETAILS SUMMARY (READ-ONLY) */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Signer Name</span>
                    <span className="font-black text-slate-900 truncate block">{tenantName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Number</span>
                    <span className="font-bold text-slate-900 truncate block">{agreement.tenant?.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Date</span>
                    <span className="font-bold text-slate-900 truncate block">{formatDate(new Date().toISOString())}</span>
                  </div>
                </div>

                {/* REQUIRED CONSENT CHECKBOX */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="agreeCheck"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="size-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor="agreeCheck" className="text-xs font-bold text-slate-800 leading-snug cursor-pointer select-none">
                      I confirm that I have read and understood this agreement and agree to sign it electronically.
                    </label>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 pl-6">
                    By selecting Submit & Sign, you agree that your electronic signature will be associated with this agreement.
                  </p>
                </div>

                {/* SUBMIT BUTTON */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={!canSubmit}
                  className="w-full h-12 font-black text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="size-4 mr-1.5" /> Submit & Sign Agreement
                </Button>
              </CardContent>
            </Card>
          </form>
        )}
      </div>

      {/* CONFIRMATION DIALOG BEFORE SIGNING */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-blue-600" /> Confirm Electronic Signature
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-600">
              Please review and confirm your intent to electronically sign this contract.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-500 font-bold">Agreement Ref</span>
                <span className="font-mono font-black text-slate-900">{agrNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-500 font-bold">Document</span>
                <span className="font-bold text-slate-900">Residential Lease Agreement</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span className="text-slate-500 font-bold">Property</span>
                <span className="font-bold text-blue-700">{propertyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Signer</span>
                <span className="font-black text-slate-900">{activeTab === "TYPE" ? typedName : tenantName}</span>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-700 leading-relaxed">
              By continuing, your electronic signature will be permanently recorded against this agreement.
            </p>

            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                className="h-11 rounded-xl border-slate-300 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeSigning}
                disabled={signMutation.isPending}
                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                {signMutation.isPending ? "Signing…" : "Confirm & Sign"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF VIEWER MODAL */}
      <FileViewer
        open={pdfViewerOpen}
        name={`Agreement-${agrNo}.pdf`}
        url={docUrl}
        onClose={() => setPdfViewerOpen(false)}
      />
    </div>
  );
}

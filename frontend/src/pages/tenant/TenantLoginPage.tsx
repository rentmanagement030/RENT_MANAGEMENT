import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Phone, ArrowRight, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, Input, Label } from "@/components/ui/primitives";

export default function TenantLoginPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone || !form.password) {
      toastError("Please enter your Phone Number and Password/PIN");
      return;
    }

    setLoading(true);
    try {
      const res = await api.tenantLogin({ phone: form.phone, password: form.password });
      if (res.token) {
        localStorage.setItem("c2d_tenant_token", res.token);
        success("Welcome back!", `Logged in as ${res.tenant.name}`);
        navigate("/tenant");
      }
    } catch (err) {
      toastError("Login Failed", err instanceof Error ? err.message : "Invalid phone number or PIN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 mb-2">
            <Building2 className="size-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">C2D Rentals Tenant Portal</h1>
          <p className="text-xs font-semibold text-slate-500">Sign in to view your rent dues, pay online, and track maintenance</p>
        </div>

        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-slate-700">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 size-4 text-slate-400" />
                  <Input
                    required
                    type="tel"
                    placeholder="Enter registered mobile number"
                    className="pl-10 h-11 text-xs font-bold"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-slate-700">Password / PIN *</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 size-4 text-slate-400" />
                  <Input
                    required
                    type="password"
                    placeholder="Enter password or 6-digit PIN"
                    className="pl-10 h-11 text-xs font-bold"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <p className="text-[11px] font-semibold text-slate-400 pt-0.5">
                  Default PIN is the last 6 digits of your phone number if not customized.
                </p>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-extrabold text-xs shadow-md shadow-blue-600/20 rounded-xl"
              >
                Sign In to Dashboard <ArrowRight className="size-4 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs font-semibold text-slate-500">
          Need help accessing your account? Contact your property manager.
        </div>
      </div>
    </div>
  );
}

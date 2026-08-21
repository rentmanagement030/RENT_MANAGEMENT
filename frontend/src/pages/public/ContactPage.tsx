import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function ContactPage() {
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  const mutation = useMutation({
    mutationFn: () => api.publicContact(form),
    onSuccess: () => {
      success("Message sent", "We will get back to you within 24 hours.");
      setForm({ name: "", email: "", phone: "", message: "" });
    },
    onError: (e) => error("Failed to send", e instanceof Error ? e.message : undefined),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Contact Us</h1>
        <p className="mt-2 max-w-2xl text-base font-semibold text-slate-600">
          Looking for a home or PG, or want us to manage your property? Send us a message and our team will get in touch immediately.
        </p>

        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_380px]">
          <form
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" required value={form.name} onChange={set("name")} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" required value={form.phone} onChange={set("phone")} placeholder="+91 90000 00000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message *</Label>
              <Textarea id="message" required value={form.message} onChange={set("message")} placeholder="Tell us what property or service you need..." />
            </div>
            <Button type="submit" size="lg" className="w-full font-bold" loading={mutation.isPending}>
              Send Message
            </Button>
          </form>

          <div className="space-y-4">
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Phone className="mt-0.5 size-6 shrink-0 text-blue-600" />
              <div>
                <p className="text-base font-extrabold text-slate-900">Call Us</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">+91 90000 00000 (Mon–Sat, 9am–8pm)</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Mail className="mt-0.5 size-6 shrink-0 text-blue-600" />
              <div>
                <p className="text-base font-extrabold text-slate-900">Email Us</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">contact@c2dtech.in</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <MapPin className="mt-0.5 size-6 shrink-0 text-blue-600" />
              <div>
                <p className="text-base font-extrabold text-slate-900">Visit Office</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">C2D Tech Properties, Velachery, Chennai, Tamil Nadu</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

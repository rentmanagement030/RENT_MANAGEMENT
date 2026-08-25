import { Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/primitives";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const HomePage = lazyWithRetry(() => import("@/pages/public/HomePage"));
const PropertyListPage = lazyWithRetry(() => import("@/pages/public/PropertyListPage"));
const PropertyDetailPage = lazyWithRetry(() => import("@/pages/public/PropertyDetailPage"));
const AboutPage = lazyWithRetry(() => import("@/pages/public/AboutPage"));
const ContactPage = lazyWithRetry(() => import("@/pages/public/ContactPage"));
const PublicAgreementSignPage = lazyWithRetry(() => import("@/pages/public/PublicAgreementSignPage"));

const LoginPage = lazyWithRetry(() => import("@/pages/auth/LoginPage"));
const DashboardPage = lazyWithRetry(() => import("@/pages/admin/DashboardPage"));
const PropertiesPage = lazyWithRetry(() => import("@/pages/admin/PropertiesPage"));
const PropertyDetailAdminPage = lazyWithRetry(() => import("@/pages/admin/PropertyDetailAdminPage"));
const TenantsPage = lazyWithRetry(() => import("@/pages/admin/TenantsPage"));
const TenantDetailPage = lazyWithRetry(() => import("@/pages/admin/TenantDetailPage"));
const AgreementsPage = lazyWithRetry(() => import("@/pages/admin/AgreementsPage"));
const RentPage = lazyWithRetry(() => import("@/pages/admin/RentPage"));
const BillsPage = lazyWithRetry(() => import("@/pages/admin/BillsPage"));
const PaymentsPage = lazyWithRetry(() => import("@/pages/admin/PaymentsPage"));
const OutstandingPage = lazyWithRetry(() => import("@/pages/admin/OutstandingPage"));
const MaintenancePage = lazyWithRetry(() => import("@/pages/admin/MaintenancePage"));
const NotificationsPage = lazyWithRetry(() => import("@/pages/admin/NotificationsPage"));
const ReportsPage = lazyWithRetry(() => import("@/pages/admin/ReportsPage"));
const UsersPage = lazyWithRetry(() => import("@/pages/admin/UsersPage"));
const AuditPage = lazyWithRetry(() => import("@/pages/admin/AuditPage"));
const SettingsPage = lazyWithRetry(() => import("@/pages/admin/SettingsPage"));
const PropertyTaxesPage = lazyWithRetry(() => import("@/pages/admin/PropertyTaxesPage").then((m) => ({ default: m.PropertyTaxesPage })));

// SaaS Overhaul Pages
const TenantLoginPage = lazyWithRetry(() => import("@/pages/tenant/TenantLoginPage"));
const TenantDashboardPage = lazyWithRetry(() => import("@/pages/tenant/TenantDashboardPage"));
const LeadsPage = lazyWithRetry(() => import("@/pages/admin/LeadsPage"));
const VisitsPage = lazyWithRetry(() => import("@/pages/admin/VisitsPage"));
const BookingsPage = lazyWithRetry(() => import("@/pages/admin/BookingsPage"));
const ExpensesPage = lazyWithRetry(() => import("@/pages/admin/ExpensesPage"));
const AccountingPage = lazyWithRetry(() => import("@/pages/admin/AccountingPage"));
const StaffVendorPage = lazyWithRetry(() => import("@/pages/admin/StaffVendorPage"));
const PgOperationsPage = lazyWithRetry(() => import("@/pages/admin/PgOperationsPage"));
const NotFoundPage = lazyWithRetry(() => import("@/pages/NotFoundPage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Checking session…" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Checking session…" />;
  if (user) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <LazyPage><HomePage /></LazyPage> },
      { path: "houses", element: <LazyPage><PropertyListPage type="HOUSE" /></LazyPage> },
      { path: "pgs", element: <LazyPage><PropertyListPage type="PG" /></LazyPage> },
      { path: "properties/:id", element: <LazyPage><PropertyDetailPage /></LazyPage> },
      { path: "about", element: <LazyPage><AboutPage /></LazyPage> },
      { path: "contact", element: <LazyPage><ContactPage /></LazyPage> },
      { path: "agreements/sign/:token", element: <LazyPage><PublicAgreementSignPage /></LazyPage> },
    ],
  },
  {
    path: "/tenant/login",
    element: <LazyPage><TenantLoginPage /></LazyPage>,
  },
  {
    path: "/tenant/login/*",
    element: <LazyPage><TenantLoginPage /></LazyPage>,
  },
  {
    path: "/tenant",
    element: <LazyPage><TenantDashboardPage /></LazyPage>,
  },
  {
    path: "/admin/login",
    element: (
      <RequireGuest>
        <LazyPage><LoginPage /></LazyPage>
      </RequireGuest>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: "properties", element: <LazyPage><PropertiesPage /></LazyPage> },
      { path: "leads", element: <LazyPage><LeadsPage /></LazyPage> },
      { path: "property-taxes", element: <LazyPage><PropertyTaxesPage /></LazyPage> },
      { path: "properties/:id", element: <LazyPage><PropertyDetailAdminPage /></LazyPage> },
      { path: "tenants", element: <LazyPage><TenantsPage /></LazyPage> },
      { path: "tenants/:id", element: <LazyPage><TenantDetailPage /></LazyPage> },
      { path: "agreements", element: <LazyPage><AgreementsPage /></LazyPage> },
      { path: "rent", element: <LazyPage><RentPage /></LazyPage> },
      { path: "bills", element: <LazyPage><BillsPage /></LazyPage> },
      { path: "payments", element: <LazyPage><PaymentsPage /></LazyPage> },
      { path: "outstanding", element: <LazyPage><OutstandingPage /></LazyPage> },
      { path: "expenses", element: <LazyPage><ExpensesPage /></LazyPage> },
      { path: "accounting", element: <LazyPage><AccountingPage /></LazyPage> },
      { path: "staff-vendors", element: <LazyPage><StaffVendorPage /></LazyPage> },
      { path: "maintenance", element: <LazyPage><MaintenancePage /></LazyPage> },
      { path: "notifications", element: <LazyPage><NotificationsPage /></LazyPage> },
      { path: "reports", element: <LazyPage><ReportsPage /></LazyPage> },
      { path: "users", element: <LazyPage><UsersPage /></LazyPage> },
      { path: "audit", element: <LazyPage><AuditPage /></LazyPage> },
      { path: "settings", element: <LazyPage><SettingsPage /></LazyPage> },
    ],
  },
  { path: "*", element: <LazyPage><NotFoundPage /></LazyPage> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

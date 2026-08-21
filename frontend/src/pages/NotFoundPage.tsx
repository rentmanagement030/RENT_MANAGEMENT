import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you are looking for does not exist or has been moved.</p>
      <Link to="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
        Go home
      </Link>
    </div>
  );
}

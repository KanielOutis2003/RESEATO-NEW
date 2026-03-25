import Navbar from "../components/layouts/Navbar";
import VendorSidebar from "../components/vendor/VendorSidebar";
import AdminSidebar from "../components/admin/AdminSidebar";
import { Outlet, useLocation } from "react-router-dom";

export default function AppShell() {
  const location = useLocation();
  const { pathname } = location;

  const isAuthPage = pathname === "/log-in-sign-up" || pathname === "/forgot-password" || pathname === "/reset-password";
  const isHomePage = pathname === "/";
  const hideNavbar = isAuthPage || isHomePage;

  const isVendorRoute = pathname.startsWith("/vendor");
  const isAdminRoute = pathname.startsWith("/admin");
  const isSidebarRoute = isVendorRoute || isAdminRoute;

  const isCustomerFullBleed =
    pathname.startsWith("/restaurants") ||
    pathname === "/my-reservations" ||
    pathname === "/profile" ||
    pathname.startsWith("/payment/");

  const fullBleed = hideNavbar || isCustomerFullBleed || isSidebarRoute;

  // Sidebar layout for vendor/admin
  if (isSidebarRoute) {
    return (
      <div className="flex min-h-screen">
        {isVendorRoute ? <VendorSidebar /> : <AdminSidebar />}
        <main className={`flex-1 overflow-auto ${isAdminRoute ? "bg-[#f3f3f4]" : "bg-[#f5f3f4]"}`}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!hideNavbar && <Navbar />}

      {fullBleed ? (
        <main>
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      )}
    </div>
  );
}

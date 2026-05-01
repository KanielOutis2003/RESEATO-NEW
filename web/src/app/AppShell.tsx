import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Navbar from "../components/layouts/Navbar";
import Footer from "../components/layouts/Footer";
import VendorSidebar from "../components/vendor/VendorSidebar";
import AdminSidebar from "../components/admin/AdminSidebar";
import NotificationPanel from "../components/NotificationPanel";
import { Outlet, useLocation } from "react-router-dom";

export default function AppShell() {
  const location = useLocation();
  const { pathname } = location;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isAuthPage = pathname === "/log-in-sign-up" || pathname === "/forgot-password" || pathname === "/reset-password";
  const isHomePage = pathname === "/";
  const isDarkLuxuryPage = pathname.startsWith("/restaurants") || pathname === "/my-reservations" || pathname.startsWith("/payment/");
  const hideNavbar = isAuthPage || isHomePage || isDarkLuxuryPage;

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
      <div className="flex h-screen overflow-hidden">
        {isVendorRoute ? (
          <VendorSidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        ) : (
          <AdminSidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        )}
        <main className={`flex-1 overflow-y-auto ${isAdminRoute ? "bg-[#f3f3f4]" : "bg-[#f5f3f4]"}`}>
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="fixed left-4 top-4 z-[80] grid h-10 w-10 place-items-center rounded-xl border border-[#e5e7eb] bg-white text-[#374151] shadow-md lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Outlet />
        </main>
        <NotificationPanel variant={isAdminRoute ? "admin" : "vendor"} />
      </div>
    );
  }

  const showFooter = !hideNavbar;

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

      {showFooter && <Footer />}
    </div>
  );
}

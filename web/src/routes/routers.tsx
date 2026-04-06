import { Navigate, createBrowserRouter } from "react-router-dom";
import AppShell from "../app/AppShell";
import HomePage from "../pages/HomePage";
import RestaurantsPage from "../pages/RestaurantsPage";
import RestaurantDetailsPage from "../pages/RestaurantDetailsPage";
import AuthPage from "../pages/AuthPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import AboutPage from "../pages/AboutPage";
import TermsPage from "../pages/TermsPage";
import MyReservationsPage from "../pages/MyReservationsPage";

import PaymentPage from "../pages/PaymentPage";
import VendorDashboardPage from "../pages/VendorDashboardPage";
import VendorTablesPage from "../pages/VendorTablesPage";
import VendorSlotsPage from "../pages/VendorSlotsPage";
import VendorReservationsPage from "../pages/VendorReservationsPage";
import VendorAnalyticsPage from "../pages/VendorAnalyticsPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/restaurants", element: <RestaurantsPage /> },
      { path: "/restaurants/:id", element: <RestaurantDetailsPage /> },
      { path: "/log-in-sign-up", element: <AuthPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/my-reservations", element: <MyReservationsPage /> },

      { path: "/payment/:reservationId", element: <PaymentPage /> },
      { path: "/vendor", element: <VendorDashboardPage /> },
      { path: "/vendor/tables", element: <VendorTablesPage /> },
      {
        path: "/vendor/restaurants",
        element: <Navigate to="/vendor/tables" replace />,
      },
      { path: "/vendor/restaurants/:restaurantId/slots", element: <VendorSlotsPage /> },
      { path: "/vendor/reservations", element: <VendorReservationsPage /> },
      { path: "/vendor/analytics", element: <VendorAnalyticsPage /> },
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/admin/:section", element: <AdminDashboardPage /> },
    ],
  },
]);

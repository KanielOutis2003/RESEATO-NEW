import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Store } from "lucide-react";
import { listVendorRestaurants, VendorRestaurant } from "../lib/api/vendor.api";
import { ApiError } from "../lib/api/client";
import { useAuth } from "../lib/auth/useAuth";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: string } | undefined;
    return payload?.message ?? fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export default function VendorTablesPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage(null);
        const data = await listVendorRestaurants();
        if (!alive) return;

        const restaurants: VendorRestaurant[] = Array.isArray(data) ? data : [];

        if (restaurants.length > 0) {
          navigate(`/vendor/restaurants/${restaurants[0].id}/slots`, { replace: true });
        } else {
          setNoRestaurant(true);
          setLoading(false);
        }
      } catch (error) {
        if (!alive) return;
        setMessage(getErrorMessage(error, "Unable to load your restaurants."));
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [isAuthed, navigate]);

  if (authLoading || loading) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="inline-flex items-center gap-2 text-[#5b6374]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading table configuration...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#4b5563]">
            Login is required to access table controls.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <div className="rounded-2xl border border-[#f2cccf] bg-[#fff6f7] px-4 py-3 text-sm text-[#9f1239]">
            {message}
          </div>
        )}

        {noRestaurant && (
          <div className="rounded-3xl border border-[#e8e2e3] bg-white p-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#e5e7eb] bg-[#fcfcfd] text-[#8b3d4a]">
              <Store className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[#1f2937]">No restaurant yet</h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              Contact admin to set up your restaurant profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

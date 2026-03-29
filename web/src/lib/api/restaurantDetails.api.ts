import { api } from "./client";
import type { Restaurant } from "../types/restaurants";

export type RestaurantBestSeller = {
  id: string;
  name: string;
  priceMinor: number;
  imageUrl?: string | null;
  soldCount: number;
  stockQuantity: number;
};

export type RestaurantDetails = Restaurant & {
  description: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  galleryImages?: string[];
  bestSellers?: RestaurantBestSeller[];
};

export function getRestaurant(id: string) {
  return api<RestaurantDetails>(`/restaurants/${id}`);
}

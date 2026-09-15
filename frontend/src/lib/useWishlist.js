import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "trustdrive_saved_vehicles";

function getSavedList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useWishlist() {
  const [savedIds, setSavedIds] = useState(getSavedList);

  useEffect(() => {
    const handler = () => setSavedIds(getSavedList());
    window.addEventListener("trustdrive_wishlist_updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("trustdrive_wishlist_updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggleWishlist = useCallback((id) => {
    if (!id) return;
    const current = getSavedList();
    let next;
    if (current.includes(id)) {
      next = current.filter((x) => x !== id);
    } else {
      next = [id, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedIds(next);
    window.dispatchEvent(new Event("trustdrive_wishlist_updated"));
  }, []);

  const isSaved = useCallback((id) => savedIds.includes(id), [savedIds]);

  return {
    savedIds,
    count: savedIds.length,
    toggleWishlist,
    isSaved,
  };
}

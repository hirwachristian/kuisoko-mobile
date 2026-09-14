import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '../api/customer';

const GUEST_WISHLIST_KEY = 'kuisoko-wishlist-guest';

interface WishlistContextValue {
  productIds: string[];
  isLoading: boolean;
  toggleWishlist: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

// Same server-persisted-with-guest-merge pattern as CartContext (see there for the full rationale) -
// GET/POST/DELETE /api/wishlist for signed-in accounts, an AsyncStorage id list for guests, merged
// into the server list the moment they sign in.
export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const previousToken = useRef<string | null>(null);

  const loadGuestWishlist = async (): Promise<string[]> => {
    const raw = await AsyncStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  };
  const saveGuestWishlist = async (ids: string[]) => {
    await AsyncStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        if (token) {
          if (!previousToken.current) {
            const guestIds = await loadGuestWishlist();
            if (guestIds.length > 0) {
              const { productIds: serverIds } = await fetchWishlist(token);
              const serverSet = new Set(serverIds);
              for (const id of guestIds) {
                if (!serverSet.has(id)) await addToWishlist(id, token);
              }
              await AsyncStorage.removeItem(GUEST_WISHLIST_KEY);
            }
          }
          const { productIds: fetched } = await fetchWishlist(token);
          setProductIds(fetched);
        } else {
          setProductIds(await loadGuestWishlist());
        }
      } finally {
        setIsLoading(false);
        previousToken.current = token;
      }
    })();
  }, [token]);

  // Optimistic toggle with rollback on failure, matching the website's toggleWishlist.
  const toggleWishlist = async (productId: string) => {
    const wasWishlisted = productIds.includes(productId);
    const next = wasWishlisted ? productIds.filter((id) => id !== productId) : [...productIds, productId];
    setProductIds(next);
    try {
      if (token) {
        if (wasWishlisted) await removeFromWishlist(productId, token);
        else await addToWishlist(productId, token);
      } else {
        await saveGuestWishlist(next);
      }
    } catch {
      setProductIds(productIds);
    }
  };

  return (
    <WishlistContext.Provider value={{ productIds, isLoading, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}

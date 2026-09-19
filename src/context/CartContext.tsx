import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { fetchCart, upsertCartLine, removeCartLine, clearCart as clearCartApi } from '../api/customer';
import { CartLine } from '../types';

const GUEST_CART_KEY = 'kuisoko-cart-guest';

interface CartContextValue {
  items: CartLine[];
  isLoading: boolean;
  addToCart: (productId: string, quantity: number, selectedColor?: string, selectedSize?: string, unitPrice?: number, selectedImage?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, selectedColor?: string, selectedSize?: string) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const lineKey = (l: Pick<CartLine, 'productId' | 'selectedColor' | 'selectedSize'>) =>
  `${l.productId}__${l.selectedColor ?? ''}__${l.selectedSize ?? ''}`;

// Server-persisted per account (GET/PUT/DELETE /api/cart), matching the website exactly rather
// than a local-only cart - a shopper who adds items on the website and opens the app (or vice
// versa) sees the same cart. Guests get an AsyncStorage snapshot instead, merged into the server
// cart the moment they sign in (existing server quantities win per line, same as the website).
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<CartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const previousToken = useRef<string | null>(null);

  const loadGuestCart = async (): Promise<CartLine[]> => {
    const raw = await AsyncStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  };
  const saveGuestCart = async (lines: CartLine[]) => {
    await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  };

  const loadServerCart = useCallback(async (authToken: string) => {
    const { items: fetched } = await fetchCart(authToken);
    setItems(fetched);
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        if (token) {
          // Just signed in (or app opened already signed in) - merge any guest cart built up
          // before authenticating, then treat the server as the source of truth going forward.
          if (!previousToken.current) {
            const guestLines = await loadGuestCart();
            if (guestLines.length > 0) {
              const { items: serverLines } = await fetchCart(token);
              const serverIds = new Set(serverLines.map((l) => lineKey(l)));
              for (const line of guestLines) {
                if (!serverIds.has(lineKey(line))) {
                  await upsertCartLine(line.productId, line, token);
                }
              }
              await AsyncStorage.removeItem(GUEST_CART_KEY);
            }
          }
          await loadServerCart(token);
        } else {
          setItems(await loadGuestCart());
        }
      } finally {
        setIsLoading(false);
        previousToken.current = token;
      }
    })();
  }, [token, loadServerCart]);

  // selectedImage is remembered per line but doesn't affect which existing line a new "Add to
  // Cart" call matches - re-adding the same product+color+size just bumps its quantity and
  // updates the remembered photo to whichever one was on screen this time, the same way its price
  // can be refreshed by a later add. This keeps update/remove (which only key on
  // productId+color+size) correct without needing their own selectedImage plumbing.
  const addToCart: CartContextValue['addToCart'] = async (productId, quantity, selectedColor, selectedSize, unitPrice, selectedImage) => {
    // Rider/admin accounts aren't customers - the server rejects this too (requireCustomer), but
    // checking here first avoids an optimistic local update for an action that's about to fail.
    if (user && user.role !== 'user') {
      Alert.alert(t('mobile_customer_only_action'));
      return;
    }
    const existing = items.find((l) => l.productId === productId && l.selectedColor === selectedColor && l.selectedSize === selectedSize);
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    const line: CartLine = { productId, quantity: newQuantity, selectedColor, selectedSize, unitPrice, selectedImage: selectedImage ?? existing?.selectedImage };
    const next = existing
      ? items.map((l) => (l === existing ? line : l))
      : [...items, line];
    setItems(next);
    if (token) await upsertCartLine(productId, line, token);
    else await saveGuestCart(next);
  };

  const updateQuantity: CartContextValue['updateQuantity'] = async (productId, quantity, selectedColor, selectedSize) => {
    if (quantity <= 0) return removeFromCart(productId);
    const next = items.map((l) =>
      l.productId === productId && l.selectedColor === selectedColor && l.selectedSize === selectedSize ? { ...l, quantity } : l
    );
    setItems(next);
    const line = next.find((l) => l.productId === productId);
    if (token && line) await upsertCartLine(productId, line, token);
    else await saveGuestCart(next);
  };

  const removeFromCart = async (productId: string) => {
    const next = items.filter((l) => l.productId !== productId);
    setItems(next);
    if (token) await removeCartLine(productId, token);
    else await saveGuestCart(next);
  };

  const clear = async () => {
    setItems([]);
    if (token) await clearCartApi(token);
    else await AsyncStorage.removeItem(GUEST_CART_KEY);
  };

  const itemCount = items.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider value={{ items, isLoading, addToCart, updateQuantity, removeFromCart, clear, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

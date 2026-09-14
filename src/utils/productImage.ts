import { Product } from '../types';

// Picks the photo that should represent a cart line/order item everywhere (cart, checkout, the
// saved order) instead of always falling back to the product's first image, in priority order:
// 1. `selectedImage` - the exact photo the customer was looking at when they added it (the only
//    option for a product with no color variants, e.g. several plain photos of different cap
//    styles with nothing to hang the choice on otherwise).
// 2. `colorImages[selectedColor]` - for a proper color variant, its designated photo.
// 3. The product's first image, when neither of the above applies.
export function getLineImage(product: Product, selectedImage?: string | null, selectedColor?: string | null): string {
  return selectedImage || (selectedColor && product.colorImages?.[selectedColor]) || product.images[0];
}

import { Asset } from 'expo-asset';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Order } from '../types';

// The store deals exclusively in RWF (mirrors frontend/context/AppContext.tsx's getFormattedPrice
// comment). order.currency is a nullable free-text DB column that's almost never actually set at
// order-creation time - a default parameter here wouldn't help since `null` is an explicit value,
// not `undefined`, so this must hardcode the label rather than trust that column.
const formatPrice = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

let cachedStampBase64: string | null = null;

// The website embeds a rotated company-stamp PNG on every invoice (AdminManageOrders.tsx) -
// bundled as a local asset here (rather than fetched live) so invoice generation works offline
// and never depends on the website's own asset path staying reachable.
async function getStampDataUri(): Promise<string> {
  if (cachedStampBase64) return cachedStampBase64;
  const asset = Asset.fromModule(require('../../assets/invoice-stamp.png'));
  await asset.downloadAsync();
  const base64 = await readAsStringAsync(asset.localUri ?? asset.uri, { encoding: EncodingType.Base64 });
  cachedStampBase64 = `data:image/png;base64,${base64}`;
  return cachedStampBase64;
}

let cachedLogoBase64: string | null = null;

// Same bundled-asset/data-URI approach as the stamp above - the official circular badge artwork
// (frontend/public/branding/logo.png), not the old hand-drawn inline SVG this used to render.
async function getLogoDataUri(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;
  const asset = Asset.fromModule(require('../../assets/invoice-logo.png'));
  await asset.downloadAsync();
  const base64 = await readAsStringAsync(asset.localUri ?? asset.uri, { encoding: EncodingType.Base64 });
  cachedLogoBase64 = `data:image/png;base64,${base64}`;
  return cachedLogoBase64;
}

// Mirrors frontend/pages/AdminManageOrders.tsx's invoice markup (same layout, fonts sizes and
// colors) so a PDF generated from the app looks identical to one generated from the website.
export async function buildInvoiceHtml(order: Order, adminName: string, adminEmail: string): Promise<string> {
  const stampDataUri = await getStampDataUri();
  const logoDataUri = await getLogoDataUri();
  const itemsRows = order.items
    .map((item) => {
      const variant = [item.selectedSize, item.selectedColor].filter(Boolean).map((v) => `(${v})`).join(' ');
      return `<tr>
        <td style="width:40px;padding:12px 0;font-size:16px;border-bottom:1px solid #eee;">${item.quantity}x</td>
        <td style="padding:12px 0;font-size:16px;border-bottom:1px solid #eee;">${item.name} ${variant}</td>
        <td style="padding:12px 0;font-size:16px;border-bottom:1px solid #eee;">${formatPrice(item.price)}</td>
        <td style="text-align:right;padding:12px 0;font-size:16px;border-bottom:1px solid #eee;">${formatPrice(item.price * item.quantity)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;padding:64px 56px 48px;color:#1a1a1a;font-family:sans-serif;">
    <div style="margin-bottom:36px;"><img src="${logoDataUri}" style="height:56px;width:56px;" /></div>
    <div style="margin-bottom:28px;font-size:15px;">
      <div>${new Date(order.date).toLocaleDateString()}</div>
      <div><strong>Invoice No. ${order.orderNumber ?? order.id}</strong></div>
    </div>
    <hr style="border-top:1px solid #1a1a1a;border:none;border-top:1px solid #1a1a1a;" />

    <h2 style="font-size:22px;font-weight:800;margin:24px 0 18px;">BILL TO:</h2>
    <p style="font-size:17px;margin:0 0 4px;">${order.customerName}</p>
    ${order.deliveryAddress?.phoneNumber ? `<p style="font-size:17px;margin:0 0 4px;">${order.deliveryAddress.phoneNumber}</p>` : ''}
    ${order.deliveryAddress ? `<p style="font-size:17px;margin:0 0 4px;">${order.deliveryAddress.streetAddress}, ${order.deliveryAddress.cityTown}</p>` : ''}

    <table style="width:100%;border-collapse:collapse;margin-top:44px;">
      <thead>
        <tr>
          <th colspan="2" style="text-align:left;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">DESCRIPTION</th>
          <th style="text-align:left;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">PRICE</th>
          <th style="text-align:right;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:44px;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">SUBTOTAL</th>
          <th style="text-align:left;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">DELIVERY FEE</th>
          <th style="text-align:right;border-bottom:2px solid #1a1a1a;padding-bottom:14px;font-size:21px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding-top:14px;font-size:17px;">${formatPrice(order.subtotal ?? order.total)}</td>
          <td style="padding-top:14px;font-size:17px;">${formatPrice(order.shippingFee ?? 0)}</td>
          <td style="text-align:right;font-weight:800;font-size:18px;padding-top:14px;">${formatPrice(order.total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
      <div style="font-size:14px;color:#666;">
        <p><strong>Issued by:</strong> ${adminName}</p>
        <p><strong>Email:</strong> ${adminEmail}</p>
        <p><strong>Date Issued:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      </div>
      <img src="${stampDataUri}" style="width:120px;height:auto;opacity:0.9;transform:rotate(-14deg);flex-shrink:0;" />
    </div>

    <div style="margin-top:56px;padding-top:32px;border-top:2px solid #0B5D3B;text-align:center;">
      <p style="font-size:26px;font-weight:900;margin:0 0 6px;color:#0B5D3B;letter-spacing:0.02em;">Thank you for choosing KuISOKO!</p>
      <p style="font-size:14px;margin:0;color:#888;">We're grateful for your trust. See you again soon.</p>
    </div>
  </div>
</body>
</html>`;
}

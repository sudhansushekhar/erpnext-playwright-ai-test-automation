/**
 * Money as the screens show it, and GST worked out from a price that includes it.
 * Pure functions: no browser, no server.
 */

/** An amount as ERPNext shows it on the POS: 118 → "₹ 118.00". */
const rupees = (amount) => `₹ ${amount.toFixed(2)}`

/**
 * An item's price split into net and GST, GST being included in the price (CGST + SGST, half
 * each): QA-STOCK-001 at ₹118.00 with 18% → { gross: 118, net: 100, halfGst: 9 }.
 */
function gstSplit({ sellingPrice, gst }) {
  const net = Math.round((sellingPrice / (1 + gst / 100)) * 100) / 100
  return { gross: sellingPrice, net, halfGst: Math.round(((sellingPrice - net) / 2) * 100) / 100 }
}

module.exports = { rupees, gstSplit }

/**
 * Every value the seed prepares: the single place to read or change test and demo data.
 * docs/test-data.md explains each value; change both in the same commit.
 *
 * Market: India. Currency INR, GST split into CGST + SGST (a sale within the state), prices
 * INCLUDE GST (as an MRP does). ⚠ GST rates here are illustrative demo values: check the
 * current GST rate of a real product before using any of them for real.
 */
const COMPANY_ABBREVIATION = 'QAR' // ERPNext adds the company abbreviation to account, warehouse and template names

// GST slabs used here. Each slab is an Item Tax Template that sets CGST and SGST to half the rate.
const GST_SLABS = [0, 5, 18]
const gstTemplate = (rate) => `GST ${rate}% - ${COMPANY_ABBREVIATION}`

// A stock item at 18% GST included: 118.00 = 100.00 + CGST 9.00 + SGST 9.00. One per billing counter (below).
const stockItem = (number) => ({
  code: `QA-STOCK-00${number}`, name: number === 1 ? 'QA Stock Item' : `QA Stock Item ${number}`, group: 'Products', uom: 'Nos',
  buyingPrice: 60, sellingPrice: 118, gst: 18,
  stockQty: 50, // the seed tops stock back up to this before every run
})

// Billing counters, as in an Indian supermarket: one per parallel test worker, each with its own
// cashier, POS Profile and stock item, so tests running at the same time never share them. A cashier
// may be signed in once, a counter may have one open shift (POS session), and a test counts its item's
// stock: shared, they would collide. Worker 1 uses Billing Counter 1 (Anjali, QA-STOCK-001), worker 2
// Billing Counter 2, and so on. More workers than counters is refused (src/fixtures/base.js); add a
// counter here to run more in parallel (the seed creates its cashier, POS Profile and item).
const BILLING_COUNTERS = [
  { name: 'Billing Counter 1', cashier: { email: 'anjali.verma@qa-retail.test', first: 'Anjali', last: 'Verma' }, item: stockItem(1) },
  { name: 'Billing Counter 2', cashier: { email: 'rohit.kumar@qa-retail.test', first: 'Rohit', last: 'Kumar' }, item: stockItem(2) },
  { name: 'Billing Counter 3', cashier: { email: 'kavya.menon@qa-retail.test', first: 'Kavya', last: 'Menon' }, item: stockItem(3) },
  { name: 'Billing Counter 4', cashier: { email: 'farhan.ali@qa-retail.test', first: 'Farhan', last: 'Ali' }, item: stockItem(4) },
].map((counter, index) => ({ number: index + 1, ...counter }))

const TEST_DATA = {
  company: 'QA Retail',
  companyAbbreviation: COMPANY_ABBREVIATION,
  currency: 'INR',
  currencySymbol: '₹',
  country: 'India',
  timezone: 'Asia/Kolkata',
  // Financial year April to March (set by the setup wizard from these months).
  fiscalYearStartMonth: 4,
  warehouse: `Stores - ${COMPANY_ABBREVIATION}`,
  sellingPriceList: 'Standard Selling',
  buyingPriceList: 'Standard Buying',
  territory: 'India',

  // ── For the tests: stable, round numbers ───────────────────────────────────────────────
  customer: { name: 'QA Customer', group: 'Commercial', type: 'Company' },
  supplier: { name: 'QA Supplier', group: 'Local' },

  items: {
    // Billing Counter 1's item (QA-STOCK-001), the one in the worked examples. Tests use their counter's item.
    stock: BILLING_COUNTERS[0].item,
    // Service, 18% GST included: 59.00 = 50.00 + 4.50 + 4.50. No stock.
    service: { code: 'QA-ITEM-001', name: 'QA Service Item', group: 'Services', uom: 'Nos', sellingPrice: 59, gst: 18 },
    // The data-driven tests' stock item (testdata/sales): 118.00 = 100.00 + CGST 9.00 + SGST 9.00, like
    // QA-STOCK-001. Data tests never sell a billing counter's own item, whose stock its tests count exactly.
    data: { code: 'QA-DATA-001', name: 'QA Data Item', group: 'Products', uom: 'Nos', buyingPrice: 60, sellingPrice: 118, gst: 18, stockQty: 100 },
    // No GST; carries its own 5% eco fee (the item surcharge). No stock.
    eco: { code: 'QA-ECO-001', name: 'QA Eco Item', group: 'Products', uom: 'Nos', sellingPrice: 40 },
  },

  // ── GST ───────────────────────────────────────────────────────────────────────────────
  gst: {
    cgstAccount: `Output Tax CGST - ${COMPANY_ABBREVIATION}`,
    sgstAccount: `Output Tax SGST - ${COMPANY_ABBREVIATION}`,
    // The sales template: CGST and SGST lines at 0%, included in the price. Each item's GST
    // slab (an Item Tax Template) sets the real rates. The DEFAULT template: every new sale
    // on the screens gets GST, like a real Indian shop.
    template: `GST In-State - ${COMPANY_ABBREVIATION}`,
    slabs: Object.fromEntries(GST_SLABS.map((rate) => [rate, gstTemplate(rate)])),
  },

  // Surcharges: only when a test or a cashier picks their template.
  surcharges: {
    // On the whole sale: a fixed amount, whatever is in the basket.
    sale: { label: 'Home Delivery Charge', amount: 40, account: `Home Delivery Charge - ${COMPANY_ABBREVIATION}`, template: `Home Delivery Charge - ${COMPANY_ABBREVIATION}` },
    // On one item: a % of that item's lines only (QA-ECO-001).
    item: {
      label: 'QA Eco Fee', rate: 5, account: `QA Eco Fee - ${COMPANY_ABBREVIATION}`,
      itemTaxTemplate: `QA Eco Fee 5% - ${COMPANY_ABBREVIATION}`, template: `QA Item Surcharge - ${COMPANY_ABBREVIATION}`,
    },
  },

  // ── Payments and the point of sale ─────────────────────────────────────────────────────
  bankAccount: `QA Bank - ${COMPANY_ABBREVIATION}`,
  paymentModes: [
    { mode: 'Cash', type: 'Cash', account: `Cash - ${COMPANY_ABBREVIATION}`, default: true },
    { mode: 'UPI', type: 'Bank', account: `QA Bank - ${COMPANY_ABBREVIATION}`, default: false },
    { mode: 'Debit Card', type: 'Bank', account: `QA Bank - ${COMPANY_ABBREVIATION}`, default: false },
    { mode: 'Credit Card', type: 'Bank', account: `QA Bank - ${COMPANY_ABBREVIATION}`, default: false },
  ],
  costCenter: `Main - ${COMPANY_ABBREVIATION}`,
  posProfile: {
    name: 'QA POS',
    customer: 'Walk-in Customer', // the POS starts every sale with this customer
    writeOffAccount: `Write Off - ${COMPANY_ABBREVIATION}`,
    writeOffLimit: 1, // amounts up to ₹1.00 can be written off at payment
    openingCash: 1000, // the cash a test's shift opens with (the shift fixture)
  },
  // What a test types on the payment screen for a UPI or card payment (made-up values, not real).
  paymentDetails: {
    upiReference: '412345678901', // a 12-digit UTR
    card: { type: 'RuPay', last4: '4242', approval: 'a1b2c3', approvalSaved: 'A1B2C3' }, // saved in capitals
  },
  // ERPNext allows ONE open session per POS profile, so a profile is a billing counter: two cashiers
  // on one profile could not both start work ("QA POS is open"). Each counter's POS Profile is a copy
  // of QA POS for its cashier; QA POS itself is for Administrator, the manager and the admin.
  billingCounters: BILLING_COUNTERS,

  // ── People ───────────────────────────────────────────────────────────────────────────
  // Demo users on the reserved .test domain (it can never be a real address). All share one
  // password: DEMO_USER_PASSWORD in .env. All may use the QA POS profile.
  users: [
    ...BILLING_COUNTERS.map((counter) => ({ ...counter.cashier, role: 'Cashier' })), // one cashier per billing counter
    { email: 'meera.nair@qa-retail.test', first: 'Meera', last: 'Nair', role: 'Store Manager' },
    { email: 'vikram.singh@qa-retail.test', first: 'Vikram', last: 'Singh', role: 'Admin' },
    // Not a person: the tests' own API user (the `api` fixture), with the Admin roles. Tests do not
    // use Administrator for API work, so a browser test can sign Administrator in without another
    // Administrator sign-in from a parallel worker breaking its page (CLAUDE.md rule 12).
    { email: 'qa.automation@qa-retail.test', first: 'QA', last: 'Automation', role: 'Admin', automation: true },
  ],
  // What each demo role is, in ERPNext roles.
  roles: {
    Cashier: ['Cashier', 'Sales User', 'Stock User', 'Accounts User'],
    'Store Manager': ['Sales User', 'Stock User', 'Accounts User', 'Sales Manager', 'Stock Manager', 'Accounts Manager'],
    Admin: ['Sales User', 'Stock User', 'Accounts User', 'Sales Manager', 'Stock Manager', 'Accounts Manager', 'System Manager'],
  },

  // In standard ERPNext only a Sales Manager or System Manager may open or close a POS session
  // (POS Opening Entry, POS Closing Entry): a plain cashier got "403 Permission denied". This
  // role lets a cashier open, close and read ONLY the sessions they opened themselves.
  cashierRole: {
    name: 'Cashier',
    doctypes: ['POS Opening Entry', 'POS Closing Entry'],
    rights: ['read', 'write', 'create', 'submit'],
    // A cashier signs in straight to the Point of Sale (the role's Home Page; cashiers have no
    // Default Workspace, so this is where ERPNext sends them).
    homePage: 'desk/point-of-sale',
  },

  // One device at a time. With "Allow only one session per user" on, each user keeps at most
  // `Simultaneous Sessions` sessions: signing in again ends the oldest. Cashiers: 1. Everyone
  // else keeps more, because the tests sign Administrator in several times (seed, api fixture).
  sessions: { denyMultiple: true, cashier: 1, others: 10 },
  // The user the tests' API session signs in as (see users above).
  automationUser: 'qa.automation@qa-retail.test',

  // ── Demo data for trying things by hand ─────────────────────────────────────────────────
  // Generic product names, prices INCLUDE GST (MRP). Buying price is what the shop paid.
  demo: {
    itemGroups: ['Grocery', 'Personal Care', 'Home Care', 'Electronics', 'Apparel'],
    items: [
      { code: 'DEMO-ATTA-5KG', name: 'Wheat Atta 5 kg', group: 'Grocery', buyingPrice: 230, sellingPrice: 285, gst: 5, stockQty: 40 },
      { code: 'DEMO-RICE-5KG', name: 'Basmati Rice 5 kg', group: 'Grocery', buyingPrice: 420, sellingPrice: 549, gst: 5, stockQty: 30 },
      { code: 'DEMO-SALT-1KG', name: 'Iodised Salt 1 kg', group: 'Grocery', buyingPrice: 20, sellingPrice: 28, gst: 0, stockQty: 100 },
      { code: 'DEMO-DAL-1KG', name: 'Toor Dal 1 kg', group: 'Grocery', buyingPrice: 135, sellingPrice: 175, gst: 5, stockQty: 50 },
      { code: 'DEMO-OIL-1L', name: 'Sunflower Oil 1 L', group: 'Grocery', buyingPrice: 130, sellingPrice: 165, gst: 5, stockQty: 60 },
      { code: 'DEMO-TEA-500G', name: 'Assam Tea 500 g', group: 'Grocery', buyingPrice: 190, sellingPrice: 260, gst: 5, stockQty: 40 },
      { code: 'DEMO-BISC-250G', name: 'Glucose Biscuits 250 g', group: 'Grocery', buyingPrice: 22, sellingPrice: 30, gst: 5, stockQty: 120 },
      { code: 'DEMO-SOAP-4PK', name: 'Bath Soap 100 g (Pack of 4)', group: 'Personal Care', buyingPrice: 120, sellingPrice: 160, gst: 5, stockQty: 50 },
      { code: 'DEMO-DET-1KG', name: 'Detergent Powder 1 kg', group: 'Home Care', buyingPrice: 95, sellingPrice: 135, gst: 18, stockQty: 50 },
      { code: 'DEMO-EARPHONES', name: 'Bluetooth Earphones', group: 'Electronics', buyingPrice: 899, sellingPrice: 1499, gst: 18, stockQty: 15 },
      { code: 'DEMO-TSHIRT-M', name: 'Cotton T-Shirt (M)', group: 'Apparel', buyingPrice: 250, sellingPrice: 499, gst: 5, stockQty: 25 },
    ],
    customers: [
      { name: 'Walk-in Customer', group: 'Individual', type: 'Individual' },
      { name: 'Rahul Sharma', group: 'Individual', type: 'Individual', city: 'New Delhi', state: 'Delhi' },
      { name: 'Priya Iyer', group: 'Individual', type: 'Individual', city: 'Chennai', state: 'Tamil Nadu' },
      { name: 'Arjun Reddy', group: 'Individual', type: 'Individual', city: 'Hyderabad', state: 'Telangana' },
      { name: 'Sneha Patil', group: 'Individual', type: 'Individual', city: 'Pune', state: 'Maharashtra' },
      { name: 'Gupta General Store', group: 'Commercial', type: 'Company', city: 'Lucknow', state: 'Uttar Pradesh' },
    ],
    suppliers: [
      { name: 'Sri Krishna Wholesale (Demo)', group: 'Local' },
      { name: 'Western FMCG Distributors (Demo)', group: 'Distributor' },
    ],
  },

  // The QA Testing page (workspace and sidebar), and where Administrator lands after sign-in.
  qaPage: 'QA Testing',
  landingWorkspace: 'QA Testing',
}

module.exports = { TEST_DATA, COMPANY_ABBREVIATION }

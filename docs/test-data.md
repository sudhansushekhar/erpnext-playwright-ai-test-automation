# Test data (India)

Every value a test may use, and the demo data for trying things by hand. All of it is defined
once in [`src/seed/data.js`](../src/seed/data.js) and created by the seed before every run; tests read
it through the `testData` fixture (`.results/test-data.json`), so **a test never types a value
that is not here**. Change `data.js` and this page in the same commit.

⚠ **GST rates here are illustrative demo values.** Check a real product's current GST rate before
using any of them for real.

**See it in ERPNext:** sign in at http://localhost:8080. Administrator / admin lands on the
**QA Testing** page, which lists these values and links to every record (end of this page).

## Before you test by hand

1. Docker Desktop is running, ERPNext is up (`npm run erp:up`) and our app installed (`npm run erp:apps`).
2. Run **`npm run check`**. Every line must be ✅; it reads the site and changes nothing.
3. Any ❌? Run **`npm run seed`**, then `npm run check` again. The seed puts back anything missing or
   changed by hand (a price, the stock, a role, a setting).
4. Use the values on this page, so what you see by hand matches what the tests check.

## Company and settings

| What | Value | In a test |
|---|---|---|
| Company | **QA Retail** (abbreviation `QAR`), India | `testData.company` |
| Currency | **INR (₹)**, Indian number format **₹1,00,000.00**, dates **dd-mm-yyyy** | `testData.currency` |
| Time zone | Asia/Kolkata | `testData.timezone` |
| Financial year | **April to March** (e.g. 2026-2027: 01-04-2026 to 31-03-2027) | — |
| Warehouse | **Stores - QAR** | `testData.warehouse` |
| Price lists | Standard Selling, Standard Buying | `testData.sellingPriceList` |
| Rounding | Totals are **rounded to the rupee**: ₹212.40 is paid as **₹212** (`rounded_total`) | — |

ERPNext adds the company abbreviation to account, warehouse and template names: `Stores` → `Stores - QAR`.

## GST

ERPNext v16 itself ships no GST setup (that is the separate India Compliance app), so the seed
builds a simple one for a sale **within the state**: **CGST + SGST**, half the rate each.

| What | Value |
|---|---|
| Sales template | **GST In-State - QAR**: lines CGST and SGST, **included in the price** (like an MRP), **the default** (every new sale on the screens gets GST) |
| Slabs | Item Tax Templates **GST 0% - QAR**, **GST 5% - QAR** (CGST 2.5% + SGST 2.5%), **GST 18% - QAR** (CGST 9% + SGST 9%) |
| Accounts | Output Tax CGST - QAR, Output Tax SGST - QAR (under Duties and Taxes) |

Each item carries its slab, and the template's lines take the item's rate.
⚠ **Through the API**, pass the template's lines yourself: `taxes: await api.salesTaxRows(testData.gst.template)`
(the screens add the default template; the API does not).

## Test items (stable, round numbers)

| Item code | Name | GST | Buying | Selling (incl. GST) | Of which | Stock before every run |
|---|---|---|---|---|---|---|
| **QA-STOCK-001** | QA Stock Item | 18% | ₹60.00 | **₹118.00** | ₹100.00 + CGST ₹9.00 + SGST ₹9.00 | **50** |
| **QA-ITEM-001** | QA Service Item | 18% | — | **₹59.00** | ₹50.00 + ₹4.50 + ₹4.50 | no stock |
| **QA-ECO-001** | QA Eco Item | none | — | **₹40.00** | carries its own **5% eco fee** (the item surcharge) | no stock |

Test customer **QA Customer** (Commercial), test supplier **QA Supplier** (Local).
Stock and prices are put back before every run, so every run starts the same.

## Surcharges (only when picked)

| Template | What it adds |
|---|---|
| **Home Delivery Charge - QAR** | **Sale surcharge**: a fixed **₹40.00** on the whole sale (account Home Delivery Charge - QAR, Indirect Income) |
| **QA Item Surcharge - QAR** | **Item surcharge**: **5% eco fee** on QA-ECO-001 lines only (QA-ECO-001's Item Tax Template `QA Eco Fee 5% - QAR`) |

## Discounts

No prepared data: they are fields on the sale.

| Discount | Field | Note |
|---|---|---|
| Line discount, % | `discount_percentage` on the item line | |
| Line discount, amount | `discount_amount` on the item line | ⚠ **per unit**, and taken off the price **including GST** |
| Sale discount | `additional_discount_percentage` / `discount_amount` | Use **Apply On: Net Total** (the POS profiles do): GST then falls with the price. On Grand Total the GST does **not** fall (measured below) |

## Worked examples (measured on the site)

Every row was booked on a real invoice with GST In-State and read back.

| # | Sale | Line rate | Net | Tax and charges | Grand total | Paid (rounded) |
|---|---|---|---|---|---|---|
| 1 | 1 × QA-STOCK-001 | 118.00 | **100.00** | CGST 9.00, SGST 9.00 | **118.00** | 118 |
| 2 | 2 × QA-STOCK-001 | 118.00 | 200.00 | CGST 18.00, SGST 18.00 | **236.00** | 236 |
| 3 | 1 × QA-ITEM-001 | 59.00 | 50.00 | CGST 4.50, SGST 4.50 | **59.00** | 59 |
| 4 | 1 × QA-STOCK-001 + 1 × QA-ITEM-001 | 118.00 / 59.00 | 150.00 | CGST 13.50, SGST 13.50 | **177.00** | 177 |
| 5 | 2 × QA-STOCK-001, line discount 10% | **106.20** | 180.00 | CGST 16.20, SGST 16.20 | **212.40** | **212** |
| 6 | 2 × QA-STOCK-001, line discount ₹18 per unit | **100.00** | 169.49 | CGST 15.25, SGST 15.25 | **200.00** | 200 |
| 7 | 2 × QA-STOCK-001, sale discount 10% on **Net Total** | 118.00 | 180.00 (discount 20.00) | CGST **16.20**, SGST **16.20** | **212.40** | 212 |
| 8 | 2 × QA-STOCK-001, sale discount 10% on **Grand Total** | 118.00 | 180.00 (discount 23.60) | CGST **18.00**, SGST **18.00** ⚠ | **212.40** | 212 |
| 9 | 2 × QA-STOCK-001 + Home Delivery Charge | 118.00 | 200.00 | CGST 18.00, SGST 18.00, delivery **40.00** | **276.00** | 276 |
| 10 | 2 × QA-ECO-001 + 1 × QA-ITEM-001, + QA Item Surcharge | 40.00 / 59.00 | 130.00 | CGST 4.50, SGST 4.50, eco fee **4.00** | **143.00** | 143 |
| 11 | 1 × Wheat Atta 5 kg (5%) | 285.00 | 271.43 | CGST 6.79, SGST 6.79 | **285.00** | 285 |
| 12 | 1 × Iodised Salt 1 kg (0%) | 28.00 | 28.00 | CGST 0.00, SGST 0.00 | **28.00** | 28 |
| 13 | 1 × Bluetooth Earphones (18%) | 1,499.00 | 1,270.34 | CGST 114.33, SGST 114.33 | **1,499.00** | 1,499 |

What these show:

- GST is **inside** the price: the customer pays the shelf price (#1, #11-13).
- Totals are paid **rounded to the rupee** (#5: ₹212.40 → ₹212).
- A line discount **amount** comes off each unit's GST-inclusive price (#6: 118 − 18 = 100 per unit).
- A sale discount on **Net Total** lowers GST with the price (#7); on **Grand Total** it does not:
  GST stays ₹36.00 on a sale whose taxable value is ₹180.00 (#8). The POS profiles use Net Total.
- The delivery charge is not taxed here (#9); the eco fee touches only QA-ECO-001 (#10: 5% of 80.00).
- Inclusive-tax rounding: 271.43 + 6.79 + 6.79 = 285.01, booked as 285.00 (#11).

## Payments and the point of sale

| What | Value |
|---|---|
| Payment modes | **Cash** (default) → Cash - QAR · **UPI**, **Debit Card**, **Credit Card** → QA Bank - QAR |
| POS profiles (tills) | **QA POS** (Administrator, manager, admin; used by the tests) · **Till 1** (Anjali) · **Till 2** (Rohit). Managers and admins may use every till |
| Opening a till | The **Create POS Opening Entry** dialog lists **only Cash** (the drawer's opening float): click its Opening Amount, type the float, Submit. No row checkboxes, Delete row or Duplicate row (every listed row is submitted anyway) |
| Every profile | Stores - QAR, Standard Selling, **Walk-in Customer** to start each sale, **GST In-State**, sale discount on **Net Total**, stock updated by each sale, rate and discount changes allowed, write-off up to ₹1.00 |
| A POS sale is booked as | a **Sales Invoice** with `is_pos = 1` (POS Settings, the v16 default) |

**One open session per profile:** ERPNext allows only one open POS session on a profile, so each
cashier has their own till. On a shared profile the second cashier was refused: *"QA POS is open"*.

### The payment screen (Retail POS India app)

| | Behaviour |
|---|---|
| Number pad | **Whole amounts**: 5 0 0 → ₹500.00; the **.** key for decimals: 1 2 . 5 → ₹12.50; 2 decimals at most |
| Tapping a payment mode | Starts a new amount for it; a tap anywhere on the tile counts |
| **Card fields** (Card Type, Card Last 4 Digits, Card Approval Code) | Shown **only for Debit Card or Credit Card**, under the payment buttons. Card types: Visa, Mastercard, **RuPay**, Amex, Diners Club, Other. Last 4: exactly 4 digits; a full card number is refused |
| **UPI field** (UPI Transaction ID) | Shown **only for UPI**: the **12-digit UTR** from the payment confirmation |
| At Complete Order | A card payment needs the last 4 digits; a UPI payment needs the UTR. Details of a payment mode not used are cleared |
| Screen sizes | Checked at 1440×900, 1366×768 and 1280×720: the fields, the number pad, the totals and Complete Order are all visible |

**Selling by hand** (http://localhost:8080/desk/point-of-sale):

1. Sign in as a cashier (below). The POS asks for a **POS Opening Entry**: your till, opening cash
   (e.g. ₹1,000), Submit.
2. Add items, **Checkout**. Pay: tap **Cash**, **UPI** or a **card**, type the amount (5 0 0 = ₹500).
   For UPI enter the UTR; for a card, its type, last 4 digits and approval code. **Complete Order**, Yes.
3. When done: menu **⋯ → Close the POS** (Shift+Ctrl+C), **Save**, **Submit**.
   `npm run check` lists sessions still open.

## People

All demo users share one password: **`DEMO_USER_PASSWORD` in your `.env`**. Their addresses use
the reserved `.test` domain, which can never be a real address.

| User | Email | Role | ERPNext roles | POS |
|---|---|---|---|---|
| Anjali Verma | anjali.verma@qa-retail.test | Cashier | Cashier, Sales User, Stock User, Accounts User | Till 1 |
| Rohit Kumar | rohit.kumar@qa-retail.test | Cashier | Cashier, Sales User, Stock User, Accounts User | Till 2 |
| Meera Nair | meera.nair@qa-retail.test | Store Manager | + Sales, Stock and Accounts Manager | every till (default QA POS) |
| Vikram Singh | vikram.singh@qa-retail.test | Admin | + System Manager | every till (default QA POS) |

**The Cashier role:** standard ERPNext lets only a Sales Manager or System Manager open or close a
POS session; a plain cashier got *403 Permission denied*. The seed adds a **Cashier** role that
may open, close and read **only the sessions they opened** (read, create, write, submit, "Only If
Creator"; no cancel). Checked end to end: a cashier opened Till 1, sold by UPI and closed the till.

## Demo data (for trying things by hand)

Generic product names; prices **include GST** (MRP); buying price is what the shop paid.

| Item code | Name | Group | GST | Buying | Selling | Stock |
|---|---|---|---|---|---|---|
| DEMO-ATTA-5KG | Wheat Atta 5 kg | Grocery | 5% | ₹230 | ₹285 | 40 |
| DEMO-RICE-5KG | Basmati Rice 5 kg | Grocery | 5% | ₹420 | ₹549 | 30 |
| DEMO-SALT-1KG | Iodised Salt 1 kg | Grocery | 0% | ₹20 | ₹28 | 100 |
| DEMO-DAL-1KG | Toor Dal 1 kg | Grocery | 5% | ₹135 | ₹175 | 50 |
| DEMO-OIL-1L | Sunflower Oil 1 L | Grocery | 5% | ₹130 | ₹165 | 60 |
| DEMO-TEA-500G | Assam Tea 500 g | Grocery | 5% | ₹190 | ₹260 | 40 |
| DEMO-BISC-250G | Glucose Biscuits 250 g | Grocery | 5% | ₹22 | ₹30 | 120 |
| DEMO-SOAP-4PK | Bath Soap 100 g (Pack of 4) | Personal Care | 5% | ₹120 | ₹160 | 50 |
| DEMO-DET-1KG | Detergent Powder 1 kg | Home Care | 18% | ₹95 | ₹135 | 50 |
| DEMO-EARPHONES | Bluetooth Earphones | Electronics | 18% | ₹899 | ₹1,499 | 15 |
| DEMO-TSHIRT-M | Cotton T-Shirt (M) | Apparel | 5% | ₹250 | ₹499 | 25 |

Stock is topped back up before every run.

| Customers | | Suppliers |
|---|---|---|
| **Walk-in Customer** (Individual; the POS default) | Rahul Sharma, New Delhi | Sri Krishna Wholesale (Demo), Local |
| Priya Iyer, Chennai · Arjun Reddy, Hyderabad | Sneha Patil, Pune | Western FMCG Distributors (Demo), Distributor |
| Gupta General Store, Lucknow (Commercial) | | |

Customer addresses are marked *Demo address (not real)*; no phone numbers or GSTINs are stored.

## The QA Testing page

Administrator lands on **QA Testing** (http://localhost:8080/desk/qa-testing). The seed rebuilds it
from `data.js` on every run: the values above, shortcuts (Point of Sale, Item, Item Price, Customer,
Supplier, Sales Invoice, Stock Balance, User), and a sidebar: *Selling* (Point of Sale, Sales
Invoice, POS Profile), *Test data*, *Taxes and charges*, *Stock*, *Accounts and people*.

## Other settings the seed changes

| Setting | Value | Why |
|---|---|---|
| Setup wizard | India, INR, Asia/Kolkata, FY April-March | A fresh site has no company until it runs |
| Default sales tax | **GST In-State - QAR**, and only it | Every sale on the screens gets GST; no other template sneaks in |
| Payment modes UPI, Debit Card | created, linked to QA Bank - QAR | A POS profile needs every payment mode linked to an account |
| Role Cashier | own POS sessions only | Cashiers could not open a till |
| Administrator → Default Workspace | QA Testing | Every sign-in lands on the same page (v16 ignores "Default App" for system users) |

## Not prepared yet

Added when a test case needs it: GST for sales **between states** (IGST), GSTINs and e-invoicing
(the India Compliance app), batch and serial-numbered items, pricing rules and promotions,
loyalty, gift cards.

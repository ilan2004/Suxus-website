import ExcelJS from "exceljs";
import { asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fabricsWithStock, ordersWithBalance, bulkList, suppliersWithBalance } from "@/lib/queries";
import { summary } from "@/lib/reports";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Col = { header: string; key: string; width?: number; money?: boolean; date?: boolean };

function sheet(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.mergeCells(1, 1, 1, Math.max(cols.length, 1));
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF153D33" } };
  ws.getRow(1).height = 22;
  const head = ws.getRow(2);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FF153D33" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE6D2" } };
    ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 2);
    if (c.money) ws.getColumn(i + 1).numFmt = "#,##0.00";
    if (c.date) ws.getColumn(i + 1).numFmt = "dd-mm-yyyy";
  });
  for (const r of rows) {
    ws.addRow(cols.map((c) => {
      const v = r[c.key];
      if (c.date && typeof v === "string" && v) return new Date(v + "T00:00:00Z");
      return v ?? null;
    }));
  }
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };
}

/** Full backup / report: every table as a sheet, in the same order as the original Daily Operations Book. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "partner") return NextResponse.json({ error: "Partners only" }, { status: 403 });
  const from = req.nextUrl.searchParams.get("from") ?? "2020-01-01";
  const to = req.nextUrl.searchParams.get("to") ?? today();
  const db = await getDb();
  const s = schema;

  const wb = new ExcelJS.Workbook();
  wb.creator = "SUXUS ERP";
  wb.created = new Date();

  // Summary first
  const sm = await summary(from, to);
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 44 }, { width: 18 }];
  const rows: [string, number | string][] = [
    [`SUMMARY  ${from} to ${to}`, ""],
    ["INCOME", ""],
    ["Fabric Sales", sm.income.fabricSales],
    ["Metres Sold", sm.income.metres],
    ["Stitching — Shop Fabric", sm.income.shopStitch],
    ["Stitching — Outside Fabric", sm.income.outsideStitch],
    ["Alteration", sm.income.alteration],
    ["Bulk / Institution Orders", sm.income.bulk],
    ["TOTAL INCOME", sm.income.total],
    ["RUNNING EXPENSES", ""],
    ["Fabric Purchases", sm.expenses.purchases],
    ["Tailor Wages", sm.expenses.wages],
    ["Incentive", sm.expenses.incentive],
    ["Other Expenses (Cash Book)", sm.expenses.other],
    ["TOTAL EXPENSES", sm.expenses.total],
    ["SURPLUS", sm.surplus],
    ["PENDING", ""],
    ["Customer Balance (Stitching)", sm.pending.stitching],
    ["Customer Balance (Bulk)", sm.pending.bulk],
    ["Supplier Balance", sm.pending.suppliers],
    ["Tailor Wage Balance", sm.pending.wages],
    ["Incentive Balance", sm.pending.incentive],
    ["STOCK & CAPITAL", ""],
    ["Fabric Balance Metres", sm.stock.metres],
    ["Fabric Stock Value", sm.stock.value],
    ["Opening Stock & Assets", sm.stock.opening],
    ["Total Setup Spend", sm.setup.total],
    ...sm.capital.map((c) => [`${c.name} share %`, Math.round(c.share * 10000) / 100] as [string, number]),
  ];
  rows.forEach((r) => {
    const row = ws.addRow(r);
    if (typeof r[1] === "string") row.font = { bold: true, color: { argb: "FF153D33" } };
    if (/^TOTAL|^SURPLUS/.test(r[0])) row.font = { bold: true };
    row.getCell(2).numFmt = "#,##0.00";
  });

  const customers = await db.select().from(s.customers).orderBy(asc(s.customers.code));
  sheet(wb, "Customers", "CUSTOMERS", [
    { header: "Customer ID", key: "code" }, { header: "Name", key: "name", width: 24 }, { header: "Phone", key: "phone", width: 14 },
    { header: "Place", key: "place" }, { header: "Type", key: "type" }, { header: "First Visit", key: "firstVisit", date: true }, { header: "Remarks", key: "remarks", width: 30 },
  ], customers);

  const fabrics = await fabricsWithStock();
  sheet(wb, "Fabric Stock", "FABRIC STOCK", [
    { header: "Fabric Code", key: "code" }, { header: "Barcode", key: "barcode" }, { header: "Brand / Quality", key: "brand", width: 26 }, { header: "Type", key: "type" },
    { header: "Shade", key: "shade" }, { header: "Purchase Date", key: "purchaseDate", date: true }, { header: "Purchase Mtr", key: "purchaseMtr", money: true },
    { header: "Cost / Mtr", key: "costPerMtr", money: true }, { header: "Total Cost", key: "totalCost", money: true }, { header: "Sale Rate / Mtr", key: "saleRate", money: true },
    { header: "Sold Mtr", key: "soldMtr", money: true }, { header: "Balance Mtr", key: "balanceMtr", money: true }, { header: "Stock Value", key: "stockValue", money: true },
    { header: "Composition", key: "composition" }, { header: "Colour Family", key: "colourFamily" }, { header: "Remarks", key: "remarks", width: 30 },
  ], fabrics);

  const saleLines = await db
    .select({ date: s.sales.date, billNo: s.sales.billNo, customer: s.sales.customerName, phone: s.sales.phone, fabricCode: s.fabrics.code, fabric: s.saleItems.description, metres: s.saleItems.metres, rate: s.saleItems.rate, amount: s.saleItems.amount, discount: s.sales.discount, net: s.sales.net, mode: s.sales.paymentMode, stitchingHere: s.sales.stitchingHere, cancelled: s.sales.cancelled, soldBy: s.staff.name })
    .from(s.saleItems)
    .innerJoin(s.sales, eq(s.sales.id, s.saleItems.saleId))
    .leftJoin(s.fabrics, eq(s.fabrics.id, s.saleItems.fabricId))
    .leftJoin(s.staff, eq(s.staff.id, s.sales.soldById))
    .orderBy(asc(s.sales.date), asc(s.sales.id));
  sheet(wb, "Fabric Sales", "DAILY FABRIC SALES (one row per fabric line; discount/net are per bill)", [
    { header: "Date", key: "date", date: true }, { header: "Bill No", key: "billNo" }, { header: "Customer", key: "customer", width: 20 }, { header: "Phone", key: "phone" },
    { header: "Fabric Code", key: "fabricCode" }, { header: "Fabric", key: "fabric", width: 26 }, { header: "Metres", key: "metres", money: true }, { header: "Rate / Mtr", key: "rate", money: true },
    { header: "Amount", key: "amount", money: true }, { header: "Bill Discount", key: "discount", money: true }, { header: "Bill Net", key: "net", money: true },
    { header: "Payment Mode", key: "mode" }, { header: "Stitching Here?", key: "stitchingHere" }, { header: "Cancelled", key: "cancelled" }, { header: "Sold By", key: "soldBy" },
  ], saleLines.map((l) => ({ ...l, stitchingHere: l.stitchingHere ? "Yes" : "No", cancelled: l.cancelled ? "Yes" : "" })));

  const orders = await ordersWithBalance();
  sheet(wb, "Stitching Orders", "STITCHING & ALTERATION ORDERS", [
    { header: "Order No", key: "orderNo" }, { header: "Order Date", key: "date", date: true }, { header: "Customer", key: "customerName", width: 20 }, { header: "Phone", key: "phone" },
    { header: "Work Type", key: "workType", width: 22 }, { header: "Items", key: "items", width: 30 }, { header: "Total", key: "total", money: true }, { header: "Paid", key: "paid", money: true },
    { header: "Balance", key: "balance", money: true }, { header: "Trial", key: "trialDate", date: true }, { header: "Delivery", key: "deliveryDate", date: true }, { header: "Status", key: "status" },
    { header: "Tailor", key: "tailorName" }, { header: "Urgency", key: "urgency" },
  ], [...orders].reverse());

  const ms = await db.select({ m: s.measurements, name: s.customers.name, phone: s.customers.phone }).from(s.measurements).innerJoin(s.customers, eq(s.customers.id, s.measurements.customerId));
  sheet(wb, "Measurements", "MEASUREMENTS (inches)", [
    { header: "Customer", key: "name", width: 20 }, { header: "Phone", key: "phone" }, { header: "Date", key: "date", date: true }, { header: "Garment Type", key: "garmentType", width: 20 },
    { header: "Size", key: "size" }, { header: "Fit", key: "fit" }, { header: "Measurements", key: "values", width: 60 }, { header: "Remarks", key: "remarks", width: 30 },
  ], ms.map((x) => ({ ...x.m, name: x.name, phone: x.phone, values: Object.entries(x.m.values).map(([k, v]) => `${k} ${v}`).join(", ") })));

  const bulkLines = await db
    .select({ orderNo: s.bulkOrders.orderNo, date: s.bulkOrders.date, institution: s.bulkOrders.institution, contact: s.bulkOrders.contactPerson, phone: s.bulkOrders.phone, fabricBy: s.bulkOrders.fabricBy, item: s.bulkOrderItems.item, description: s.bulkOrderItems.description, size: s.bulkOrderItems.size, qty: s.bulkOrderItems.qty, rate: s.bulkOrderItems.rate, amount: s.bulkOrderItems.amount, delivery: s.bulkOrders.deliveryDate, status: s.bulkOrders.status })
    .from(s.bulkOrderItems)
    .innerJoin(s.bulkOrders, eq(s.bulkOrders.id, s.bulkOrderItems.bulkOrderId))
    .orderBy(asc(s.bulkOrders.id), asc(s.bulkOrderItems.id));
  sheet(wb, "Bulk Orders", "BULK / INSTITUTION ORDERS (one row per size)", [
    { header: "Order No", key: "orderNo" }, { header: "Date", key: "date", date: true }, { header: "Institution", key: "institution", width: 26 }, { header: "Contact", key: "contact" },
    { header: "Phone", key: "phone" }, { header: "Fabric By", key: "fabricBy" }, { header: "Item", key: "item" }, { header: "Description", key: "description" }, { header: "Size", key: "size" },
    { header: "Qty", key: "qty" }, { header: "Rate", key: "rate", money: true }, { header: "Amount", key: "amount", money: true }, { header: "Delivery", key: "delivery", date: true }, { header: "Status", key: "status" },
  ], bulkLines);
  const bulk = await bulkList();
  sheet(wb, "Bulk Balances", "BULK ORDER TOTALS & BALANCES", [
    { header: "Order No", key: "orderNo" }, { header: "Institution", key: "institution", width: 26 }, { header: "Pieces", key: "pieces" }, { header: "Total", key: "total", money: true },
    { header: "Received", key: "paid", money: true }, { header: "Balance", key: "balance", money: true }, { header: "Status", key: "status" },
  ], bulk);

  const staffRows = await db.select().from(s.staff).orderBy(asc(s.staff.code));
  sheet(wb, "Staff", "STAFF", [
    { header: "Staff ID", key: "code" }, { header: "Name", key: "name", width: 20 }, { header: "Role", key: "role" }, { header: "Phone", key: "phone" }, { header: "Join Date", key: "joinDate", date: true },
    { header: "Pay Type", key: "payType", width: 20 }, { header: "Monthly Salary", key: "monthlySalary", money: true }, { header: "Piece Rate", key: "pieceRate", money: true },
    { header: "Incentive?", key: "incentive" }, { header: "Own Incentive %", key: "ownIncentivePct" }, { header: "Status", key: "status" }, { header: "Remarks", key: "remarks", width: 30 },
  ], staffRows.map((r) => ({ ...r, incentive: r.incentive ? "Yes" : "No", pinHash: undefined })));

  const wages = await db.select({ w: s.tailorWages, name: s.staff.name }).from(s.tailorWages).innerJoin(s.staff, eq(s.staff.id, s.tailorWages.tailorId)).orderBy(asc(s.tailorWages.date));
  sheet(wb, "Tailor Wages", "TAILOR WAGES", [
    { header: "Date", key: "date", date: true }, { header: "Tailor", key: "name" }, { header: "Order No", key: "orderNo" }, { header: "Item", key: "item" }, { header: "Qty", key: "qty" },
    { header: "Rate / Piece", key: "rate", money: true }, { header: "Amount", key: "amount", money: true }, { header: "Paid then", key: "paid", money: true }, { header: "Remarks", key: "remarks", width: 30 },
  ], wages.map((x) => ({ ...x.w, name: x.name })));

  const purchases = await db.select({ p: s.purchases, supplier: s.suppliers.name }).from(s.purchases).leftJoin(s.suppliers, eq(s.suppliers.id, s.purchases.supplierId)).orderBy(asc(s.purchases.date));
  sheet(wb, "Purchases", "PURCHASES", [
    { header: "Date", key: "date", date: true }, { header: "Supplier", key: "supplier", width: 24 }, { header: "Invoice No", key: "invoiceNo" }, { header: "Description", key: "description", width: 28 },
    { header: "Qty / Mtr", key: "qty", money: true }, { header: "Rate", key: "rate", money: true }, { header: "Taxable Amt", key: "taxable", money: true }, { header: "GST %", key: "gstPct" },
    { header: "GST Amt", key: "gstAmount", money: true }, { header: "Total", key: "total", money: true }, { header: "Paid", key: "paid", money: true }, { header: "Remarks", key: "remarks", width: 30 },
  ], purchases.map((x) => ({ ...x.p, supplier: x.supplier })));

  const setup = await db.select().from(s.setupExpenses).orderBy(asc(s.setupExpenses.date));
  sheet(wb, "Setup Expenses", "SETUP & RENOVATION EXPENSES", [
    { header: "Date", key: "date", date: true }, { header: "Category", key: "category", width: 24 }, { header: "Description", key: "description", width: 34 }, { header: "Paid To", key: "paidTo", width: 24 },
    { header: "Paid By", key: "paidBy" }, { header: "Amount", key: "amount", money: true }, { header: "Mode", key: "mode" }, { header: "Bill No", key: "billNo" }, { header: "Bill?", key: "hasBill" }, { header: "Remarks", key: "remarks", width: 30 },
  ], setup.map((r) => ({ ...r, hasBill: r.hasBill ? "Yes" : "No" })));

  const sup = await suppliersWithBalance();
  sheet(wb, "Suppliers", "SUPPLIERS & PAYMENT DETAILS", [
    { header: "Supplier", key: "name", width: 30 }, { header: "Type", key: "type" }, { header: "Place", key: "place" }, { header: "Phone", key: "phone", width: 18 }, { header: "UPI ID", key: "upi", width: 22 },
    { header: "Bank A/c & IFSC", key: "bank", width: 30 }, { header: "GST No", key: "gstNo", width: 18 }, { header: "Supplies", key: "supplies", width: 24 }, { header: "On credit", key: "owed", money: true },
    { header: "Paid on account", key: "paid", money: true }, { header: "Balance due", key: "balance", money: true }, { header: "Setup paid", key: "setupPaid", money: true }, { header: "Notes", key: "notes", width: 40 },
  ], sup);

  const poa = await db
    .select({ p: s.supplierPayments, supplier: s.suppliers.name })
    .from(s.supplierPayments)
    .innerJoin(s.suppliers, eq(s.suppliers.id, s.supplierPayments.supplierId))
    .orderBy(asc(s.supplierPayments.date));
  sheet(wb, "Payments on Account", "PAYMENTS ON ACCOUNT", [
    { header: "Date", key: "date", date: true }, { header: "Supplier", key: "supplier", width: 30 }, { header: "Amount", key: "amount", money: true },
    { header: "Mode", key: "mode" }, { header: "UPI / Ref no.", key: "ref", width: 18 }, { header: "Paid by", key: "paidBy" }, { header: "Notes", key: "note", width: 40 },
  ], poa.map((x) => ({ ...x.p, supplier: x.supplier })));

  const assets = await db.select().from(s.openingStock).orderBy(asc(s.openingStock.id));
  sheet(wb, "Opening Stock", "OPENING STOCK & ASSETS", [
    { header: "Asset Type", key: "assetType" }, { header: "Description", key: "description", width: 30 }, { header: "Qty / Mtr", key: "qty", money: true }, { header: "Unit Value", key: "unitValue", money: true },
    { header: "Total Value", key: "total", money: true }, { header: "Owned By", key: "ownedBy" }, { header: "Age / Condition", key: "condition" }, { header: "Valuation Date", key: "valuationDate", date: true }, { header: "Remarks", key: "remarks", width: 30 },
  ], assets.map((a) => ({ ...a, total: a.qty * a.unitValue })));

  const cash = await db.select().from(s.cashBook).orderBy(asc(s.cashBook.date), asc(s.cashBook.id));
  let bal = 0;
  sheet(wb, "Cash Book", "DAILY CASH BOOK", [
    { header: "Date", key: "date", date: true }, { header: "Particulars", key: "particulars", width: 40 }, { header: "Category", key: "category", width: 20 }, { header: "In (₹)", key: "amountIn", money: true },
    { header: "Out (₹)", key: "amountOut", money: true }, { header: "Mode", key: "mode" }, { header: "Running Balance", key: "balance", money: true }, { header: "Remarks", key: "remarks", width: 30 }, { header: "Partner", key: "partner" }, { header: "Auto from", key: "source" },
  ], cash.map((r) => ({ ...r, balance: (bal += r.amountIn - r.amountOut) })));

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SUXUS-ERP-${today()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

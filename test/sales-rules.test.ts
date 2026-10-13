import { describe, expect, it } from "vitest";
import { saleSaveFailureMessage, saleVoidFailureMessage } from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";
import { parseLotFinder, parseSaleForm, parseSaleNumber } from "../src/lib/sale-input.js";

const fields = {
  productCode: "502",
  lbs: "100",
  pricePerLb: "3.29",
  customerId: "",
  saleDate: "2026-10-08",
  today: "2026-10-09",
};

describe("sale form rules", () => {
  // STUB: AC-0029
  it("AC-0029: a price per lb of 100,000,000 is refused", () => {
    expect(parseSaleForm({ ...fields, pricePerLb: "100000000" }, new Set(["502"]), new Set())).toEqual({
      ok: false,
      errors: { pricePerLb: "Price must be below 100,000,000." },
    });
  });
});

describe("sale messages", () => {
  // STUB: AC-0050
  it("AC-0050: a shortfall names the finished stock, the date, and the lbs needed", () => {
    const error = new RpcError(
      "recordSale failed: record_sale: shortfall, only 4620.000 lbs finished available on or before 2026-10-06, need 5000",
      "P0001",
    );
    expect(saleSaveFailureMessage(error, "write")).toBe(
      "The sale wasn't saved. Only 4,620 lbs of finished stock made on or before Oct 6, 2026 is on hand, and this sale needs 5,000 lbs.",
    );
  });
});

const codes = new Set(["502"]);
const customers = new Set(["c-1"]);
const refuse = (over: Partial<typeof fields>) => {
  const result = parseSaleForm({ ...fields, ...over }, codes, customers);
  return result.ok ? null : result.errors;
};

describe("sale form rules by table row", () => {
  it.each([
    [{ productCode: "" }, { productCode: "Enter a product code." }],
    [{ productCode: "   " }, { productCode: "Enter a product code." }],
    [{ productCode: "999" }, { productCode: "No active finished product has code 999." }],
    [{ lbs: "" }, { lbs: "Enter the lbs sold, like 500 or 32.5." }],
    [{ lbs: "12a" }, { lbs: "Enter the lbs sold, like 500 or 32.5." }],
    [{ lbs: "1.2.3" }, { lbs: "Enter the lbs sold, like 500 or 32.5." }],
    [{ lbs: "1.2345" }, { lbs: "Use at most 3 decimal places for weight." }],
    [{ lbs: "0.0001" }, { lbs: "Use at most 3 decimal places for weight." }],
    [{ lbs: "0" }, { lbs: "Lbs must be above 0." }],
    [{ lbs: "0.0" }, { lbs: "Lbs must be above 0." }],
    [{ lbs: "000" }, { lbs: "Lbs must be above 0." }],
    [{ pricePerLb: "" }, { pricePerLb: "Enter the price per lb, like 3.29." }],
    [{ pricePerLb: "$3" }, { pricePerLb: "Enter the price per lb, like 3.29." }],
    [{ pricePerLb: "3.291" }, { pricePerLb: "Use at most 2 decimal places for a price." }],
    [{ pricePerLb: "100000000" }, { pricePerLb: "Price must be below 100,000,000." }],
    [{ pricePerLb: "100000001.555" }, { pricePerLb: "Use at most 2 decimal places for a price." }],
    [{ saleDate: "" }, { saleDate: "Enter the sale date." }],
    [{ saleDate: "2026-02-30" }, { saleDate: "Enter the sale date." }],
    [{ saleDate: "10/08/2026" }, { saleDate: "Enter the sale date." }],
    [{ saleDate: "2026-10-10" }, { saleDate: "The sale date can't be after today." }],
  ])("AC-0029: %j is refused", (over, expected) => {
    expect(refuse(over)).toEqual(expected);
  });

  it("AC-0029: every field is refused at once, one message each", () => {
    expect(refuse({ productCode: "", lbs: "", pricePerLb: "", saleDate: "" })).toEqual({
      productCode: "Enter a product code.",
      lbs: "Enter the lbs sold, like 500 or 32.5.",
      pricePerLb: "Enter the price per lb, like 3.29.",
      saleDate: "Enter the sale date.",
    });
  });

  it("AC-0030: a customer id outside the list is refused", () => {
    expect(refuse({ customerId: "c-9" })).toEqual({ customerId: "Choose a customer from the list." });
  });

  it("AC-0030: an empty customer id is no customer and a listed id is kept", () => {
    expect(parseSaleForm(fields, codes, customers)).toEqual({
      ok: true,
      value: { productCode: "502", lbs: 100, pricePerLb: 3.29, saleDate: "2026-10-08" },
    });
    expect(parseSaleForm({ ...fields, customerId: "c-1" }, codes, customers)).toMatchObject({
      ok: true,
      value: { customerId: "c-1" },
    });
  });

  it("AC-0031: a today that is not a calendar date refuses the sale date", () => {
    expect(refuse({ today: "2026-13-01" })).toEqual({ saleDate: "Enter the sale date." });
    expect(refuse({ today: "" })).toEqual({ saleDate: "Enter the sale date." });
  });

  it("AC-0032: lbs 0.001 at price 0, and lbs 1540 at 99999999.99, are accepted", () => {
    expect(refuse({ lbs: "0.001", pricePerLb: "0", saleDate: "2026-10-09" })).toBeNull();
    expect(refuse({ lbs: "1540", pricePerLb: "99999999.99", saleDate: "2026-10-09" })).toBeNull();
    expect(parseSaleForm({ ...fields, lbs: "0.001", pricePerLb: "0" }, codes, customers)).toMatchObject({
      ok: true,
      value: { lbs: 0.001, pricePerLb: 0 },
    });
  });

  it("AC-0029: the code is trimmed in the value", () => {
    expect(parseSaleForm({ ...fields, productCode: " 502 " }, codes, customers)).toMatchObject({
      ok: true,
      value: { productCode: "502" },
    });
  });
});

describe("sale number and lot finder rules", () => {
  it("AC-0091: spaces around a sale number are trimmed", () => {
    expect(parseSaleNumber("  12 ")).toEqual({ ok: true, value: "12" });
  });

  it.each(["", "   "])("AC-0092: %j is refused", (text) => {
    expect(parseSaleNumber(text)).toEqual({ ok: false, error: "Enter a sale number." });
  });

  it.each([
    [{ rawCode: "", received: "" }, { rawCode: "Enter a raw product code." }],
    [{ rawCode: "  ", received: "2026-10-05" }, { rawCode: "Enter a raw product code." }],
    [{ rawCode: "RAW-TOM", received: "2026-02-30" }, { received: "Enter the received date, or leave it blank." }],
    [{ rawCode: "RAW-TOM", received: "10/05/2026" }, { received: "Enter the received date, or leave it blank." }],
    [
      { rawCode: "", received: "nope" },
      { rawCode: "Enter a raw product code.", received: "Enter the received date, or leave it blank." },
    ],
  ])("AC-0119: %j is refused", (input, errors) => {
    expect(parseLotFinder(input)).toEqual({ ok: false, errors });
  });

  it("AC-0119: a blank received date means no date, and the code is trimmed", () => {
    expect(parseLotFinder({ rawCode: " RAW-TOM ", received: "" })).toEqual({ ok: true, value: { rawCode: "RAW-TOM" } });
    expect(parseLotFinder({ rawCode: "RAW-TOM", received: "2026-10-05" })).toEqual({
      ok: true,
      value: { rawCode: "RAW-TOM", received: "2026-10-05" },
    });
  });
});

describe("sale failure messages", () => {
  const engine = (text: string) => new RpcError(text, "P0001");

  it("AC-0053: a failure before the write says to try again", () => {
    expect(saleSaveFailureMessage(new Error("down"), "before-write")).toBe(
      "The sale wasn't saved. Try again in a moment.",
    );
  });

  it("AC-0054: no answer from the write says the sale may not be saved", () => {
    expect(saleSaveFailureMessage(new RpcError("recordSale failed: aborted", ""), "write")).toBe(
      "The sale may not have been saved. Reload this page and check Recent sales before saving again.",
    );
  });

  it("AC-0057: a 42501 says the account is not allowed", () => {
    expect(saleSaveFailureMessage(new RpcError("recordSale failed: denied", "42501"), "write")).toBe(
      "The sale wasn't saved. This account isn't allowed to use Meat Ops.",
    );
  });

  it("AC-0051: an inactive product says it is no longer active", () => {
    expect(
      saleSaveFailureMessage(engine("recordSale failed: record_sale: product 502 is inactive"), "write"),
    ).toBe("The sale wasn't saved. This product is no longer active.");
  });

  it("AC-0056: any other engine text follows the lead sentence unchanged", () => {
    expect(
      saleSaveFailureMessage(engine("recordSale failed: record_sale: invalid lbs, must be above 0"), "write"),
    ).toBe("The sale wasn't saved. invalid lbs, must be above 0");
  });

  it("AC-0087: a failure before the void write says to try again", () => {
    expect(saleVoidFailureMessage(new Error("down"), "before-write")).toBe(
      "The sale wasn't voided. Try again in a moment.",
    );
  });

  it("AC-0088: no answer from the void write says the sale may not be voided", () => {
    expect(saleVoidFailureMessage(new RpcError("voidSale failed: aborted", ""), "write")).toBe(
      "The sale may not have been voided. Reload this page to see whether it was.",
    );
  });

  it("AC-0057: a 42501 on a void says the account is not allowed", () => {
    expect(saleVoidFailureMessage(new RpcError("voidSale failed: denied", "42501"), "write")).toBe(
      "The sale wasn't voided. This account isn't allowed to use Meat Ops.",
    );
  });

  it("AC-0084: an engine refusal of a void starts with the lead sentence and gives the reason", () => {
    expect(
      saleVoidFailureMessage(engine("voidSale failed: void_sale: sale 7 is already void"), "write"),
    ).toBe("The sale wasn't voided. sale 7 is already void.");
  });
});

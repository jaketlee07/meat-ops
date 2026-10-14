"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface VoidedSales {
  voided: ReadonlySet<string>;
  markVoided: (saleId: string) => void;
}

const VoidedSalesContext = createContext<VoidedSales>({ voided: new Set(), markVoided: () => undefined });

// Holds the ids of sales voided from this page's list, so the "Sale saved" panel
// can say its sale was voided without a database read. Both the form and the
// list sit inside it; its state outlives the page's re-render after a void.
export function VoidedSalesProvider({ children }: { children: ReactNode }) {
  const [voided, setVoided] = useState<ReadonlySet<string>>(new Set());
  const markVoided = useCallback((saleId: string) => setVoided((current) => new Set(current).add(saleId)), []);
  const value = useMemo(() => ({ voided, markVoided }), [voided, markVoided]);
  return <VoidedSalesContext.Provider value={value}>{children}</VoidedSalesContext.Provider>;
}

export function useVoidedSales(): VoidedSales {
  return useContext(VoidedSalesContext);
}

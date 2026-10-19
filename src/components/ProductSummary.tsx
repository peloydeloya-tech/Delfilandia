import React, { useMemo, useState } from 'react';
import { Order, ProductSummaryItem } from '../types';
import { formatKz, formatDatePT } from '../utils/formatters';
import { ShoppingBag, TrendingUp, DollarSign, Search, Tag, Eye } from 'lucide-react';

interface ProductSummaryProps {
  orders: Order[];
  onOpenOrderDetailsModal?: (order: Order) => void;
}

export const ProductSummary: React.FC<ProductSummaryProps> = ({
  orders,
  onOpenOrderDetailsModal,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Group orders by product name to build product summary
  const productSummaries: ProductSummaryItem[] = useMemo(() => {
    const map = new Map<string, {
      totalSalesCount: number;
      totalRevenue: number;
      totalEstimatedProfit: number;
      lastSaleDate: string;
      prices: number[];
    }>();

    orders.forEach((o) => {
      const name = o.productName.trim();
      const qty = o.quantity || 1;
      const profit = o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? 0) - (o.otherCosts ?? 0));

      if (!map.has(name)) {
        map.set(name, {
          totalSalesCount: qty,
          totalRevenue: o.resalePrice,
          totalEstimatedProfit: profit,
          lastSaleDate: o.createdAt,
          prices: [o.resalePrice / qty],
        });
      } else {
        const item = map.get(name)!;
        item.totalSalesCount += qty;
        item.totalRevenue += o.resalePrice;
        item.totalEstimatedProfit += profit;
        item.prices.push(o.resalePrice / qty);

        if (new Date(o.createdAt).getTime() > new Date(item.lastSaleDate).getTime()) {
          item.lastSaleDate = o.createdAt;
        }
      }
    });

    return Array.from(map.entries()).map(([productName, val]) => {
      const avgPrice = val.prices.reduce((a, b) => a + b, 0) / val.prices.length;
      return {
        productName,
        totalSalesCount: val.totalSalesCount,
        totalRevenue: val.totalRevenue,
        totalEstimatedProfit: val.totalEstimatedProfit,
        lastSaleDate: val.lastSaleDate,
        averagePrice: avgPrice,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders]);

  const filtered = productSummaries.filter((p) =>
    p.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Pesquisar resumo de produtos vendidos localmente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
          {filtered.length} produto(s) no histórico
        </div>
      </div>

      {/* Banner Notice */}
      <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3.5 rounded-2xl text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
        <Tag className="w-4 h-4 text-sky-600 shrink-0" />
        <span>
          <strong>Resumo de Revendas Locais:</strong> Relatório sintético dos produtos encomendados e revendidos no mercado em Angola.
        </span>
      </div>

      {/* Product Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {item.productName}
                </h3>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800 shrink-0">
                  {item.totalSalesCount} venda(s)
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                Última venda: <strong>{formatDatePT(item.lastSaleDate)}</strong>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Preço Médio</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {formatKz(item.averagePrice)}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Receita Total</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {formatKz(item.totalRevenue)}
                </span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-200/60 dark:border-blue-800">
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-bold">Lucro Est.</span>
                <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                  {formatKz(item.totalEstimatedProfit)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { Order, Client, ProductSummaryItem } from '../types';
import { exportOrdersCSV, exportClientsCSV, exportProductsCSV, exportFinancialsCSV } from '../utils/exportUtils';
import { X, Download, FileSpreadsheet, Package, Users, DollarSign, ShieldCheck } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  clients: Client[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  orders,
  clients,
}) => {
  if (!isOpen) return null;

  // Build product summary items for export
  const productSummaries: ProductSummaryItem[] = (() => {
    const map = new Map<string, {
      count: number;
      revenue: number;
      profit: number;
      lastDate: string;
      prices: number[];
    }>();

    orders.forEach((o) => {
      const name = o.productName.trim();
      const qty = o.quantity || 1;
      const profit = o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? 0) - (o.otherCosts ?? 0));

      if (!map.has(name)) {
        map.set(name, {
          count: qty,
          revenue: o.resalePrice,
          profit,
          lastDate: o.createdAt,
          prices: [o.resalePrice / qty],
        });
      } else {
        const item = map.get(name)!;
        item.count += qty;
        item.revenue += o.resalePrice;
        item.profit += profit;
        item.prices.push(o.resalePrice / qty);
        if (new Date(o.createdAt).getTime() > new Date(item.lastDate).getTime()) {
          item.lastDate = o.createdAt;
        }
      }
    });

    return Array.from(map.entries()).map(([productName, val]) => ({
      productName,
      totalSalesCount: val.count,
      totalRevenue: val.revenue,
      totalEstimatedProfit: val.profit,
      lastSaleDate: val.lastDate,
      averagePrice: val.prices.reduce((a, b) => a + b, 0) / val.prices.length,
    }));
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Exportar Dados Administrativos</h2>
              <p className="text-xs text-slate-400">Somente para Administradores (CSV / Excel)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          
          <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Os ficheiros são exportados no formato <strong>CSV com marcação UTF-8 BOM</strong> para abertura direta e sem erros de acentuação ou moeda no Microsoft Excel.
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Export Orders */}
            <button
              onClick={() => exportOrdersCSV(orders)}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:border-blue-700 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    Exportar Encomendas
                  </h3>
                  <p className="text-xs text-slate-500">{orders.length} registos com custos internos, lucros e clientes</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Export Clients */}
            <button
              onClick={() => exportClientsCSV(clients)}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:border-blue-700 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    Exportar Clientes
                  </h3>
                  <p className="text-xs text-slate-500">{clients.length} clientes com contactos e histórico de compras</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Export Products */}
            <button
              onClick={() => exportProductsCSV(productSummaries)}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:border-blue-700 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    Exportar Resumo de Produtos
                  </h3>
                  <p className="text-xs text-slate-500">{productSummaries.length} produtos com receitas e lucros estimados</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Export Financials */}
            <button
              onClick={() => exportFinancialsCSV(orders)}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:border-blue-700 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    Exportar Relatório Financeiro
                  </h3>
                  <p className="text-xs text-slate-500">Resumo completo de receitas, custos, margens e lucros</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

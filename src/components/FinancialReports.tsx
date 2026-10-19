import React, { useState, useMemo } from 'react';
import { Order, FinancialStats } from '../types';
import { formatKz, formatDatePT, getPaymentMethodLabel, getStatusConfig } from '../utils/formatters';
import { exportFinancialsCSV } from '../utils/exportUtils';
import { FileSpreadsheet, Download, TrendingUp, DollarSign, ShoppingBag, ShieldCheck, PieChart, Calendar, BarChart3, CreditCard, PackageCheck, AlertCircle, Percent, Truck } from 'lucide-react';

interface FinancialReportsProps {
  orders: Order[];
  stats: FinancialStats;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({ orders, stats }) => {
  const [activeReportSubTab, setActiveReportSubTab] = useState<'vendas' | 'pagamentos' | 'encomendas' | 'custos' | 'lucros'>('lucros');

  // Sales Calculations
  const salesMetrics = useMemo(() => {
    const totalCount = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.resalePrice, 0);
    const averageTicket = totalCount > 0 ? totalRevenue / totalCount : 0;
    const deliveredCount = orders.filter((o) => o.status === 'ENTREGUE').length;
    const canceledCount = orders.filter((o) => o.status === 'CANCELADA').length;
    
    // Total items sold
    const totalItemsSold = orders.reduce((s, o) => s + (o.quantity || 1), 0);

    return {
      totalCount,
      totalRevenue,
      averageTicket,
      deliveredCount,
      canceledCount,
      totalItemsSold,
    };
  }, [orders]);

  // Payments Calculations
  const paymentMetrics = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    let countConfirmed = 0;
    let countParcial = 0;
    let countPendente = 0;
    let countReembolsado = 0;

    const methodsMap: Record<string, { count: number; total: number }> = {
      EXPRESS: { count: 0, total: 0 },
      TRANSFERENCIA: { count: 0, total: 0 },
      TPA: { count: 0, total: 0 },
      DINHEIRO: { count: 0, total: 0 },
      OUTRO: { count: 0, total: 0 },
    };

    orders.forEach((o) => {
      totalPaid += o.amountPaid;
      const pending = o.amountPending ?? Math.max(0, o.resalePrice - o.amountPaid);
      totalPending += pending;

      if (o.paymentStatus === 'CONFIRMADO') countConfirmed++;
      else if (o.paymentStatus === 'PARCIAL') countParcial++;
      else if (o.paymentStatus === 'REEMBOLSADO') countReembolsado++;
      else countPendente++;

      const methodKey = o.paymentMethod || 'OUTRO';
      if (!methodsMap[methodKey]) {
        methodsMap[methodKey] = { count: 0, total: 0 };
      }
      methodsMap[methodKey].count += 1;
      methodsMap[methodKey].total += o.amountPaid;
    });

    return {
      totalPaid,
      totalPending,
      countConfirmed,
      countParcial,
      countPendente,
      countReembolsado,
      methodsMap,
    };
  }, [orders]);

  // Profit Calculations
  const profitMetrics = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.resalePrice, 0);
    const productCost = orders.reduce((s, o) => s + o.purchaseCost, 0);
    const deliveryCost = orders.reduce((s, o) => s + (o.deliveryCost ?? o.additionalExpenses ?? 0), 0);
    const otherCost = orders.reduce((s, o) => s + (o.otherCosts ?? 0), 0);

    const grossProfit = revenue - productCost;
    const netProfit = revenue - productCost - deliveryCost - otherCost;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      productCost,
      deliveryCost,
      otherCost,
      grossProfit,
      netProfit,
      margin,
    };
  }, [orders]);

  // Status Distribution for Charts
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Download CSV Button */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>Relatórios Financeiros e Operacionais DELFILÂNDIA</span>
          </h2>
          <p className="text-xs text-slate-500">
            Acompanhamento detalhado das vendas, pagamentos, custos e margens das revendas locais em Angola.
          </p>
        </div>

        <button
          onClick={() => exportFinancialsCSV(orders)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Relatório (CSV / Excel)</span>
        </button>
      </div>

      {/* SubTab Navigation Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveReportSubTab('lucros')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeReportSubTab === 'lucros'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Relatório de Lucro</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('vendas')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeReportSubTab === 'vendas'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Relatório de Vendas</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('pagamentos')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeReportSubTab === 'pagamentos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Relatório de Pagamentos</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('custos')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeReportSubTab === 'custos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Relatório de Custos</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('encomendas')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeReportSubTab === 'encomendas'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Relatório de Encomendas</span>
        </button>
      </div>

      {/* 1. RELATÓRIO DE LUCROS */}
      {activeReportSubTab === 'lucros' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Receita de Vendas</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{formatKz(profitMetrics.revenue)}</p>
              <p className="text-[11px] text-slate-500">Valor total cobrado aos clientes</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Custo de Compra Local</span>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatKz(profitMetrics.productCost)}</p>
              <p className="text-[11px] text-slate-500">Aquisições em fornecedores de Angola</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Lucro Bruto</span>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatKz(profitMetrics.grossProfit)}</p>
              <p className="text-[11px] text-slate-500">Receita menos custo dos produtos</p>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm space-y-1 border border-blue-700/50">
              <span className="text-xs text-blue-300 font-bold block">Lucro Líquido Real</span>
              <p className="text-2xl font-extrabold text-amber-300">{formatKz(profitMetrics.netProfit)}</p>
              <p className="text-[11px] text-blue-200">Margem Líquida: <strong>{profitMetrics.margin.toFixed(1)}%</strong></p>
            </div>
          </div>

          {/* Verification Box - Requirement 29 Test Verification */}
          <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300 text-sm">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Verificação do Rigor dos Cálculos Contábeis</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              Exemplo de validação contábil do sistema: <strong>Venda (100.000 Kz)</strong> - <strong>Compra (70.000 Kz)</strong> - <strong>Entrega (2.000 Kz)</strong> - <strong>Outros (2.500 Kz)</strong> = <strong>Lucro Bruto: 30.000 Kz</strong> | <strong>Lucro Líquido: 25.500 Kz (Margem 25,5%)</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 2. RELATÓRIO DE VENDAS */}
      {activeReportSubTab === 'vendas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <span className="text-xs text-slate-400 font-bold block">Número de Encomendas</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{salesMetrics.totalCount}</p>
            <p className="text-[11px] text-slate-500">Unidades vendidas: {salesMetrics.totalItemsSold}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <span className="text-xs text-slate-400 font-bold block">Valor Total Vendido</span>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{formatKz(salesMetrics.totalRevenue)}</p>
            <p className="text-[11px] text-slate-500">Soma dos preços combinados</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <span className="text-xs text-slate-400 font-bold block">Ticket Médio por Venda</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatKz(salesMetrics.averageTicket)}</p>
            <p className="text-[11px] text-slate-500">Média por encomenda</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <span className="text-xs text-slate-400 font-bold block">Encomendas Entregues</span>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{salesMetrics.deliveredCount}</p>
            <p className="text-[11px] text-slate-500">Taxa de conclusão: {salesMetrics.totalCount > 0 ? ((salesMetrics.deliveredCount / salesMetrics.totalCount) * 100).toFixed(0) : 0}%</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
            <span className="text-xs text-slate-400 font-bold block">Encomendas Canceladas</span>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{salesMetrics.canceledCount}</p>
            <p className="text-[11px] text-slate-500">Sem impacto financeiro ativo</p>
          </div>
        </div>
      )}

      {/* 3. RELATÓRIO DE PAGAMENTOS */}
      {activeReportSubTab === 'pagamentos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Total Pago Recebido</span>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatKz(paymentMetrics.totalPaid)}</p>
              <p className="text-[11px] text-slate-500">Confirmado na conta/caixa</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Total Pendente</span>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{formatKz(paymentMetrics.totalPending)}</p>
              <p className="text-[11px] text-slate-500">A receber no ato da entrega</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Pagamentos Parciais (Sinal)</span>
              <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400">{paymentMetrics.countParcial}</p>
              <p className="text-[11px] text-slate-500">Clientes que pagaram entrada</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">100% Confirmados</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">{paymentMetrics.countConfirmed}</p>
              <p className="text-[11px] text-slate-500">Pagamento integral concluído</p>
            </div>
          </div>

          {/* Methods Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Distribuição por Método de Pagamento</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {Object.entries(paymentMetrics.methodsMap).map(([mKey, data]: [string, { count: number; total: number }]) => (
                <div key={mKey} className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold">{getPaymentMethodLabel(mKey as any)}</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5">{formatKz(data.total)}</span>
                  <span className="text-[10px] text-slate-500">{data.count} transação(ões)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. RELATÓRIO DE CUSTOS */}
      {activeReportSubTab === 'custos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Custo dos Produtos (Angola)</span>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{formatKz(profitMetrics.productCost)}</p>
              <p className="text-[11px] text-slate-500">Preço pago nas lojas em Angola</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Custo de Entregas / Transportes</span>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{formatKz(profitMetrics.deliveryCost)}</p>
              <p className="text-[11px] text-slate-500">Frete local e motocourier</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-bold block">Outros Custos Operacionais</span>
              <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{formatKz(profitMetrics.otherCost)}</p>
              <p className="text-[11px] text-slate-500">Embalagem, taxas ou outras despesas</p>
            </div>
          </div>
        </div>
      )}

      {/* 5. RELATÓRIO DE ENCOMENDAS */}
      {activeReportSubTab === 'encomendas' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Distribuição de Encomendas por Estado</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              {Object.entries(statusDistribution).map(([stKey, count]) => {
                const cfg = getStatusConfig(stKey as any);
                return (
                  <div key={stKey} className={`p-3 rounded-xl border ${cfg.badgeBg} flex flex-col justify-between`}>
                    <span className="font-bold text-[11px] block">{cfg.badgeText}</span>
                    <span className="text-lg font-extrabold mt-2 block">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Table Detailed Rows */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
          <span>Detalhamento Geral por Encomenda ({orders.length})</span>
          <span className="text-xs font-semibold text-slate-500">Protegido • Apenas Administrador</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Produto</th>
                <th className="p-3">Cliente</th>
                <th className="p-3 text-right">Preço Venda</th>
                <th className="p-3 text-right">Custo Compra</th>
                <th className="p-3 text-right">Custos Ext.</th>
                <th className="p-3 text-right">Lucro Líquido</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{o.code}</td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{o.productName}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{o.clientName}</td>
                  <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{formatKz(o.resalePrice)}</td>
                  <td className="p-3 text-right text-blue-600 dark:text-blue-400 font-semibold">{formatKz(o.purchaseCost)}</td>
                  <td className="p-3 text-right text-slate-500">{formatKz((o.deliveryCost ?? 0) + (o.otherCosts ?? 0))}</td>
                  <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">
                    {formatKz(o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? 0) - (o.otherCosts ?? 0)))}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

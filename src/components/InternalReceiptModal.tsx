import React, { useState } from 'react';
import { Order } from '../types';
import { formatKz, formatDatePT, getStatusConfig } from '../utils/formatters';
import { X, Printer, ShieldAlert, Lock, TrendingUp, DollarSign, Building2, MapPin, User, Package, Calendar, Download, Loader2 } from 'lucide-react';
import { downloadInternalReceiptPdf, printInternalReceipt } from '../utils/printPdf';

interface InternalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const InternalReceiptModal: React.FC<InternalReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const statusConfig = getStatusConfig(order.status);
  const deliveryCost = order.deliveryCost ?? order.additionalExpenses ?? 0;
  const otherCosts = order.otherCosts ?? 0;
  const totalInternalCosts = order.purchaseCost + deliveryCost + otherCosts;
  const grossProfit = order.grossProfit ?? (order.resalePrice - order.purchaseCost);
  const netProfit = order.netProfit ?? (order.resalePrice - totalInternalCosts);
  const marginPercent = order.resalePrice > 0 ? (netProfit / order.resalePrice) * 100 : 0;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printInternalReceipt(order);
    } catch (e) {
      console.error('Print internal failed:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadInternalReceiptPdf(order);
    } catch (e) {
      console.error('Download internal PDF failed:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-150 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white print:text-black">
        
        {/* Controls Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
            <Lock className="w-5 h-5" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              Comprovativo Interno (EXCLUSIVO VENDEDORA ADMIN)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Salvar como ficheiro PDF"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPdf ? 'A Gerar...' : 'Salvar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? 'A Processar...' : 'Imprimir'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE INTERNAL CONTENT */}
        <div id="internal-receipt-printable" className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 print:border-none print:p-0">
          
          {/* Header Warning */}
          <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl flex items-center justify-between text-rose-950 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>CONFIDENCIAL — DADOS FINANCEIROS INTERNOS</span>
            </div>
            <span className="font-mono font-bold text-rose-700">{order.code}</span>
          </div>

          {/* Client & Product Summary */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
              <p className="font-bold text-slate-900">{order.clientName} ({order.clientPhone})</p>
              <p className="text-slate-600">{order.clientProvince}, {order.clientDistrict || ''}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Produto</span>
              <p className="font-bold text-slate-900">{order.productName} ({order.quantity} un)</p>
              <p className="text-slate-600">Estado: {statusConfig.label}</p>
            </div>
          </div>

          {/* FINANCIAL BREAKDOWN TABLE */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>Demonstrativo Financeiro & Margens</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-2.5">Item Financeiro</th>
                    <th className="p-2.5 text-right">Valor (Kz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="p-2.5 font-bold">Preço de Venda Combinado com Cliente</td>
                    <td className="p-2.5 text-right font-black text-slate-900">{formatKz(order.resalePrice)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-blue-700 font-medium">
                      (-) Custo de Compra Local do Produto em Angola
                      <span className="block text-[10px] text-slate-400">Local: {order.purchaseLocation || 'Não especificado'}</span>
                    </td>
                    <td className="p-2.5 text-right font-bold text-blue-700">-{formatKz(order.purchaseCost)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50 text-slate-800">(=) Lucro Bruto</td>
                    <td className="p-2.5 text-right font-bold bg-slate-50 text-slate-900">{formatKz(grossProfit)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-600">(-) Custo de Entrega / Transporte Local</td>
                    <td className="p-2.5 text-right font-medium text-slate-700">-{formatKz(deliveryCost)}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-600">(-) Outros Custos Operacionais / Taxas</td>
                    <td className="p-2.5 text-right font-medium text-slate-700">-{formatKz(otherCosts)}</td>
                  </tr>
                  <tr className="bg-blue-900 text-white font-extrabold text-sm">
                    <td className="p-3">(=) LUCRO LÍQUIDO ESTIMADO</td>
                    <td className="p-3 text-right text-amber-300">{formatKz(netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-blue-950 font-bold">
              <span>Margem Líquida da Operação:</span>
              <span className="font-black text-blue-700 text-sm">{marginPercent.toFixed(1)}%</span>
            </div>
          </div>

          {/* INTERNAL ADMIN NOTES */}
          {order.adminNotes && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-500 uppercase text-[10px] block">Observações Internas da Vendedora</span>
              <p className="text-slate-800 italic">{order.adminNotes}</p>
            </div>
          )}

          {/* FOOTER */}
          <div className="text-center text-[10px] text-slate-400 pt-2 border-t">
            DELFILÂNDIA — Sistema Administrativo Interno de Revenda Local
          </div>

        </div>

      </div>
    </div>
  );
};

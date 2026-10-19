import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import QRCode from 'qrcode';
import { formatKz, formatDatePT, getStatusConfig } from '../utils/formatters';
import { X, Printer, ShieldCheck, Download, Package, MapPin, Calendar, CheckCircle2, Building2, Loader2 } from 'lucide-react';
import { getPublicTrackingUrl } from '../utils/whatsapp';
import { DelfilandiaWordmark, DELFILANDIA_LOGO_SRC } from './DelfilandiaWordmark';
import { downloadClientReceiptPdf, printClientReceipt } from '../utils/printPdf';

interface ClientReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  showSalesPriceToClient?: boolean;
}

export const ClientReceiptModal: React.FC<ClientReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  showSalesPriceToClient = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  useEffect(() => {
    if (order && canvasRef.current) {
      const trackingUrl = getPublicTrackingUrl(order.code);
      QRCode.toCanvas(canvasRef.current, trackingUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const statusConfig = getStatusConfig(order.status);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printClientReceipt(order, showSalesPriceToClient);
    } catch (e) {
      console.error('Print failed:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadClientReceiptPdf(order, showSalesPriceToClient);
    } catch (e) {
      console.error('PDF generation failed:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-150 print:p-0 print:shadow-none print:border-none print:max-w-none print:bg-white print:text-black">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              Comprovativo do Cliente (DELFILÂNDIA)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Descarregar ficheiro PDF para o dispositivo"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPdf ? 'A Gerar PDF...' : 'Salvar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Abrir diálogo de impressão"
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

        {/* PRINTABLE RECEIPT CONTENT AREA */}
        <div id="client-receipt-printable" className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 print:border-none print:p-0">
          
          {/* Header Branding */}
          <div className="flex items-start justify-between border-b-2 border-blue-600 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-500 shadow-sm flex items-center justify-center bg-white shrink-0 p-0.5">
                  <img 
                    src={DELFILANDIA_LOGO_SRC} 
                    alt="DELFILÂNDIA - Um mundo de produtos à sua porta" 
                    className="w-full h-full object-contain rounded-full" 
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
                  />
                </div>
                <div>
                  <DelfilandiaWordmark size="md" lightModeForce={true} />
                  <p className="text-[10px] text-amber-600 font-extrabold tracking-tight">UM MUNDO DE PRODUTOS À SUA PORTA</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Comprovativo de Registo e Acompanhamento Transparente
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Código do Pedido</span>
              <span className="font-mono font-black text-xl text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {order.code}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Emitido em: {formatDatePT(order.createdAt)}
              </span>
            </div>
          </div>

          {/* Client & Delivery Info Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase text-[10px] block">Cliente Destinatário</span>
              <p className="font-extrabold text-sm text-slate-900">{order.clientName}</p>
              <p className="text-slate-600">Telefone: {order.clientPhone}</p>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase text-[10px] block">Local de Entrega em Angola</span>
              <p className="font-extrabold text-slate-900">{order.clientProvince}, {order.clientDistrict || ''}</p>
              <p className="text-slate-600">{order.clientAddress}</p>
              {order.referencePoint && (
                <p className="text-slate-500 italic text-[11px]">Ref: {order.referencePoint}</p>
              )}
            </div>
          </div>

          {/* Product & Order Details Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Descrição do Produto</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3 text-center">Estado do Pagamento</th>
                  {showSalesPriceToClient && <th className="p-3 text-right">Valor Combinado</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                <tr>
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{order.productName}</p>
                    {order.productDescription && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{order.productDescription}</p>
                    )}
                  </td>
                  <td className="p-3 text-center font-bold">{order.quantity}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">
                      {order.paymentStatus}
                    </span>
                  </td>
                  {showSalesPriceToClient && (
                    <td className="p-3 text-right font-extrabold text-slate-900">
                      {formatKz(order.resalePrice)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Status & Estimated Delivery & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-blue-50/60 p-4 rounded-xl border border-blue-200">
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-slate-900">Estado Atual da Encomenda:</span>
                <span className="font-bold text-xs px-2.5 py-0.5 rounded bg-blue-600 text-white">
                  {statusConfig.label}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Previsão de Entrega: <strong>{order.estimatedDeliveryDate}</strong></span>
              </div>

              {order.deliveredAt && (
                <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-blue-200">
                  <p><strong>Entregue a:</strong> {order.receivedBy || order.clientName}</p>
                  <p><strong>Data/Hora:</strong> {order.deliveredAt} {order.deliveryTime ? `às ${order.deliveryTime}` : ''}</p>
                </div>
              )}
            </div>

            {/* QR Code Canvas */}
            <div className="flex flex-col items-center justify-center space-y-1 text-center border-t sm:border-t-0 sm:border-l border-blue-200 pt-3 sm:pt-0">
              <canvas ref={canvasRef} className="rounded shadow-sm border border-slate-200" />
              <span className="text-[9px] font-mono font-bold text-slate-500">Escanear para Acompanhar</span>
            </div>
          </div>

          {/* Verification Footer Message */}
          <div className="border-t border-slate-200 pt-3 text-center space-y-1">
            <p className="text-[11px] font-bold text-slate-700">
              ✓ Compra acompanhada com transparência pela DELFILÂNDIA
            </p>
            <p className="text-[10px] text-slate-400">
              Acompanhe cada etapa da sua encomenda, desde a confirmação do pagamento até à entrega local em Angola.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

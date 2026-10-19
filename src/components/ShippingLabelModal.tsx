import React, { useState, useEffect, useRef } from 'react';
import { Order } from '../types';
import QRCode from 'qrcode';
import { X, Printer, Tag, MapPin, Phone, User, Package, Download, Loader2 } from 'lucide-react';
import { getPublicTrackingUrl } from '../utils/whatsapp';
import { DelfilandiaWordmark, DELFILANDIA_LOGO_SRC } from './DelfilandiaWordmark';
import { downloadShippingLabelPdf, printShippingLabel } from '../utils/printPdf';

interface ShippingLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  useEffect(() => {
    if (order && canvasRef.current) {
      const trackingUrl = getPublicTrackingUrl(order.code);
      QRCode.toCanvas(canvasRef.current, trackingUrl, {
        width: 90,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printShippingLabel(order);
    } catch (e) {
      console.error('Print label failed:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadShippingLabelPdf(order);
    } catch (e) {
      console.error('Label PDF download failed:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150 print:p-0 print:border-none print:shadow-none print:max-w-none print:bg-white print:text-black">
        
        {/* Controls Header (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
            <Tag className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Etiqueta de Envio (Sem Valores)
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
              <span>{isGeneratingPdf ? 'PDF...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Imprimir etiqueta"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? '...' : 'Imprimir'}</span>
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

        {/* PRINTABLE SHIPPING LABEL CARD */}
        <div
          id="shipping-label-printable"
          className="border-2 border-slate-900 bg-white p-5 rounded-2xl text-slate-900 space-y-4 max-w-sm mx-auto shadow-inner print:border-2 print:border-black print:shadow-none print:p-4"
        >
          {/* Header Label Branding */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-amber-500 shadow-sm flex items-center justify-center bg-white shrink-0 p-0.5">
                <img 
                  src={DELFILANDIA_LOGO_SRC} 
                  alt="DELFILÂNDIA" 
                  className="w-full h-full object-contain rounded-full" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
                />
              </div>
              <div>
                <DelfilandiaWordmark size="sm" lightModeForce={true} />
                <span className="text-[9px] font-bold text-slate-600 uppercase block">Etiqueta de Entrega Local em Angola</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-black text-base bg-slate-900 text-white px-2 py-0.5 rounded">
                {order.code}
              </span>
            </div>
          </div>

          {/* Client Destination Box */}
          <div className="space-y-2 border-b border-slate-300 pb-3">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">DESTINATÁRIO:</span>
            <div className="pl-1 space-y-1">
              <p className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-700 shrink-0" />
                <span>{order.clientName}</span>
              </p>
              <p className="text-xs text-slate-800 font-bold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>{order.clientPhone}</span>
              </p>
            </div>
          </div>

          {/* Location Details */}
          <div className="space-y-1.5 border-b border-slate-300 pb-3 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">LOCAL DE ENTREGA:</span>
            <div className="bg-slate-100 p-2.5 rounded-xl space-y-1 border border-slate-200">
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{order.clientProvince} — {order.clientDistrict || 'Luanda'}</span>
              </p>
              <p className="text-slate-800 text-xs font-medium">{order.clientAddress}</p>
              {order.referencePoint && (
                <p className="text-slate-600 italic text-[11px] pt-1">
                  <strong>Ponto de Ref:</strong> {order.referencePoint}
                </p>
              )}
            </div>
          </div>

          {/* Product & QR Code Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-1 max-w-[200px]">
              <span className="text-[9px] font-black uppercase text-slate-400 block">CONTEÚDO / PRODUTO:</span>
              <p className="font-bold text-xs text-slate-900 truncate">{order.productName}</p>
              <p className="text-[11px] text-slate-600">Qtd: <strong>{order.quantity} item(s)</strong></p>
              <p className="text-[10px] text-slate-500">Prev: <strong>{order.estimatedDeliveryDate}</strong></p>
            </div>

            <div className="flex flex-col items-center justify-center">
              <canvas ref={canvasRef} className="rounded border border-slate-300" />
              <span className="text-[8px] font-mono font-bold text-slate-500 mt-0.5">Rastreio QR</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

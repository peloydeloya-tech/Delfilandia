import React, { useEffect, useRef, useState } from 'react';
import { Order } from '../types';
import QRCode from 'qrcode';
import { X, QrCode, Copy, Download, Printer, Check, ExternalLink, Loader2 } from 'lucide-react';
import { getPublicTrackingUrl } from '../utils/whatsapp';
import { DelfilandiaWordmark } from './DelfilandiaWordmark';
import { printQrCard } from '../utils/printPdf';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onLogAuditAction?: (action: string, description: string, orderId?: string, orderCode?: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  order,
  onLogAuditAction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [dataUrl, setDataUrl] = useState<string>('');

  const trackingUrl = order ? getPublicTrackingUrl(order.code) : '';

  useEffect(() => {
    if (order && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, trackingUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }, (err) => {
        if (!err && canvasRef.current) {
          setDataUrl(canvasRef.current.toDataURL('image/png'));
        }
      });
    }
  }, [order, isOpen, trackingUrl]);

  if (!isOpen || !order) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);

    if (onLogAuditAction) {
      onLogAuditAction(
        'Link Copiado',
        `Link de rastreio público copiado para a encomenda ${order.code}`,
        order.id,
        order.code
      );
    }
  };

  const handleDownloadQR = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QRCode_Rastreio_${order.code}.png`;
    link.click();

    if (onLogAuditAction) {
      onLogAuditAction(
        'QR Code Baixado',
        `QR Code da encomenda ${order.code} baixado como imagem PNG`,
        order.id,
        order.code
      );
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printQrCard(order);
    } catch (e) {
      console.error('Print QR failed:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150 print:p-0 print:border-none print:shadow-none">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
            <QrCode className="w-5 h-5" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              QR Code de Acompanhamento
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Canvas Display */}
        <div id="qrcode-printable-card" className="text-center space-y-4 py-2 bg-white rounded-2xl p-4">
          <div className="inline-block p-4 bg-white rounded-2xl border-2 border-blue-500 shadow-md">
            <canvas ref={canvasRef} className="mx-auto" />
            <span className="block text-xs font-mono font-black text-slate-900 mt-2">
              {order.code}
            </span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <DelfilandiaWordmark size="xs" lightModeForce={true} />
              <span className="text-[10px] text-slate-500 font-bold uppercase">— Um mundo de produtos à sua porta</span>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <p className="font-bold text-slate-800">
              Cliente: {order.clientName}
            </p>
            <p className="text-slate-500 text-[11px] truncate max-w-xs mx-auto">
              {trackingUrl}
            </p>
          </div>
        </div>

        {/* Actions (Hidden in print) */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 print:hidden">
          <button
            type="button"
            onClick={handleCopyLink}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isCopied
                ? 'bg-blue-100 border-blue-300 text-blue-800'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'Link Copiado!' : 'Copiar Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadQR}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar PNG</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="col-span-2 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            <span>{isPrinting ? 'A Processar...' : 'Imprimir QR Code'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};


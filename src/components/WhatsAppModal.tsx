import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { getWhatsAppLink, generateWhatsAppMessage } from '../utils/whatsapp';
import { getStatusConfig } from '../utils/formatters';
import { X, Send, Copy, Check, MessageSquare, ExternalLink, User, Package, Code, Phone, Clock, ShoppingBag, Truck, CheckCheck, AlertTriangle, XCircle } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  suggestedStatus?: OrderStatus | 'CONFIRMACAO_ENTREGA';
  onLogAuditAction?: (action: string, description: string, orderId?: string, orderCode?: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  order,
  suggestedStatus,
  onLogAuditAction,
}) => {
  if (!isOpen || !order) return null;

  const targetStatus = (suggestedStatus as OrderStatus) || order.status;
  const statusCfg = getStatusConfig(targetStatus);

  const [message, setMessage] = useState<string>(() => {
    return generateWhatsAppMessage(order, suggestedStatus || order.status);
  });
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Re-generate if order or status changes
  useEffect(() => {
    if (order) {
      setMessage(generateWhatsAppMessage(order, suggestedStatus || order.status));
    }
  }, [order, suggestedStatus]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);

    if (onLogAuditAction) {
      onLogAuditAction(
        'WhatsApp Copiado',
        `Texto de WhatsApp copiado para ${order.clientName} (${order.code})`,
        order.id,
        order.code
      );
    }
  };

  const handleSend = () => {
    const link = getWhatsAppLink(order.clientPhone, message);
    window.open(link, '_blank');

    if (onLogAuditAction) {
      onLogAuditAction(
        'Envio WhatsApp',
        `Envio de WhatsApp iniciado para ${order.clientName} (${order.code})`,
        order.id,
        order.code
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <MessageSquare className="w-5 h-5" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              Enviar Atualização pelo WhatsApp
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order & Current Status Summary Header */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Cliente: <strong>{order.clientName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Código: <strong className="font-mono">{order.code}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Produto: <strong>{order.productName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Telefone: <strong className="font-mono">{order.clientPhone}</strong></span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Estado Selecionado:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {order.status === 'AGUARDANDO_PAGAMENTO' && <Clock className="w-3.5 h-3.5 text-emerald-600" />}
              {order.status === 'PAGAMENTO_CONFIRMADO' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              {order.status === 'PRODUTO_COMPRADO' && <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />}
              {order.status === 'SAIU_PARA_ENTREGA' && <Truck className="w-3.5 h-3.5 text-emerald-600" />}
              {order.status === 'ENTREGUE' && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
              {order.status === 'PROBLEMA' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
              {order.status === 'CANCELADA' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
              <span>{statusCfg?.label || order.status}</span>
            </div>
          </div>
        </div>

        {/* Predefined Message Editor (according to chosen status) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Mensagem Predefinida do Estado (Edição Livre):
            </label>
            <span className="text-[10px] text-slate-400">
              Gerada automaticamente com base no estado gravado
            </span>
          </div>
          <textarea
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl p-3.5 text-xs sm:text-sm font-sans text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isCopied
                ? 'bg-blue-100 border-blue-300 text-blue-800'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'Texto Copiado!' : 'Copiar Texto'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar pelo WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

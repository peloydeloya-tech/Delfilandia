import React, { useState } from 'react';
import { Order } from '../types';
import { getWhatsAppLink, replaceTemplateVariables, getPublicTrackingUrl } from '../utils/whatsapp';
import { X, CheckCircle, User, Calendar, Clock, FileText, Send, ExternalLink, Sparkles } from 'lucide-react';

interface MarkAsDeliveredModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirmDelivery: (
    orderId: string,
    receivedBy: string,
    deliveredDate: string,
    deliveryTime: string,
    deliveryNote: string
  ) => void;
}

export const MarkAsDeliveredModal: React.FC<MarkAsDeliveredModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirmDelivery,
}) => {
  if (!isOpen || !order) return null;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [receivedBy, setReceivedBy] = useState<string>(order.clientName || '');
  const [deliveredDate, setDeliveredDate] = useState<string>(todayStr);
  const [deliveryTime, setDeliveryTime] = useState<string>(currentTimeStr);
  const [deliveryNote, setDeliveryNote] = useState<string>('Entrega em mão própria com sucesso no endereço do cliente.');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedBy.trim()) return;

    onConfirmDelivery(order.id, receivedBy, deliveredDate, deliveryTime, deliveryNote);
    setIsSuccess(true);
  };

  const handleSendWhatsAppConfirmation = () => {
    const trackingLink = getPublicTrackingUrl(order.code);
    const confirmMessage = `Olá, ${order.clientName}! 👋\n\nA sua encomenda ${order.code} (*${order.productName}*) foi entregue com sucesso! 🎉🎁\n\n🗓 Entregue em: ${deliveredDate} às ${deliveryTime}\n👤 Recebido por: *${receivedBy}*\n\n🔗 Acompanhe e consulte o seu comprovativo digital aqui:\n${trackingLink}\n\nObrigado por confiar na DELFILÂNDIA! ❤️`;
    const link = getWhatsAppLink(order.clientPhone, confirmMessage);
    window.open(link, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <CheckCircle className="w-6 h-6" />
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              Marcar Encomenda como Entregue
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isSuccess ? (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800/80 text-xs text-blue-900 dark:text-blue-200">
              <p className="font-bold">Encomenda: <span className="font-mono">{order.code}</span> - {order.productName}</p>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
                Cliente: {order.clientName} ({order.clientProvince}, {order.clientDistrict || ''})
              </p>
            </div>

            {/* Recebedor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Nome de quem recebeu a encomenda: *</span>
              </label>
              <input
                type="text"
                required
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Ex: Maria Silva (Própria) ou Porteiro João"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            {/* Data & Hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Data da Entrega: *</span>
                </label>
                <input
                  type="date"
                  required
                  value={deliveredDate}
                  onChange={(e) => setDeliveredDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hora da Entrega: *</span>
                </label>
                <input
                  type="time"
                  required
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Observação da Entrega:</span>
              </label>
              <textarea
                rows={2}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Ex: Entregue sem sobressaltos, produto verificado no local."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-xs sm:text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirmar Entrega</span>
              </button>
            </div>
          </form>
        ) : (
          /* SUCCESS SCREEN AFTER CONFIRMING */
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 border-2 border-blue-300">
              <Sparkles className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Encomenda entregue com sucesso! 🎉
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                O estado da encomenda <strong className="font-mono">{order.code}</strong> foi atualizado para ENTREGUE e o recebedor <strong>{receivedBy}</strong> foi registrado.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <p><strong>Recebido por:</strong> {receivedBy}</p>
              <p><strong>Data/Hora:</strong> {deliveredDate} às {deliveryTime}</p>
              {deliveryNote && <p><strong>Obs:</strong> {deliveryNote}</p>}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Concluir
              </button>
              
              <button
                type="button"
                onClick={handleSendWhatsAppConfirmation}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Confirmação pelo WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

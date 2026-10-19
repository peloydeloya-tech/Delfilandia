import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, PaymentStatus } from '../types';
import { formatKz, STATUS_FLOW, getStatusConfig, formatDatePT } from '../utils/formatters';
import { X, Lock, Check, Truck, MessageSquare, Building2, Calendar, MapPin, DollarSign, Clock, Printer, User, Phone, Save, ChevronRight, AlertCircle, Trash2, AlertTriangle, Edit3, Package, CreditCard, Image as ImageIcon, Upload, Star, Plus, Eye, ZoomIn, Link as LinkIcon, Sparkles } from 'lucide-react';

const ANGOLAN_PROVINCES = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huíla',
  'Cabinda',
  'Cuanza Sul',
  'Cuanza Norte',
  'Namibe',
  'Malanje',
  'Uíge',
  'Zaire',
  'Bié',
  'Moxico',
  'Cuando Cubango',
  'Cunene',
  'Lunda Norte',
  'Lunda Sul',
  'Bengo',
];

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, customNote?: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onSendWhatsApp: (order: Order) => void;
  onSaveAdminNotes: (orderId: string, notes: string) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onDeleteOrder,
  onSendWhatsApp,
  onSaveAdminNotes,
  onUpdateOrder,
}) => {
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [timelinePublicNote, setTimelinePublicNote] = useState<string>('');
  const [isSavedNotes, setIsSavedNotes] = useState<boolean>(false);
  const [activeStatus, setActiveStatus] = useState<OrderStatus | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);

  // Edit Public Data States
  const [isEditingPublicData, setIsEditingPublicData] = useState<boolean>(false);
  const [isPublicSaved, setIsPublicSaved] = useState<boolean>(false);
  const [editProductName, setEditProductName] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editEstimatedDeliveryDate, setEditEstimatedDeliveryDate] = useState<string>('');
  const [editResalePrice, setEditResalePrice] = useState<number | string>(0);
  const [editAmountPaid, setEditAmountPaid] = useState<number | string>(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('PENDENTE');
  const [editClientName, setEditClientName] = useState<string>('');
  const [editClientPhone, setEditClientPhone] = useState<string>('');
  const [editClientProvince, setEditClientProvince] = useState<string>('Luanda');
  const [editClientDistrict, setEditClientDistrict] = useState<string>('');
  const [editClientAddress, setEditClientAddress] = useState<string>('');
  const [editReferencePoint, setEditReferencePoint] = useState<string>('');
  const [editProductImageUrls, setEditProductImageUrls] = useState<string[]>([]);
  const [editImageUrlInput, setEditImageUrlInput] = useState<string>('');
  const [showEditUrlInput, setShowEditUrlInput] = useState<boolean>(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (order) {
      setAdminNotes(order.adminNotes || '');
      setActiveStatus(order.status);
      setIsConfirmingDelete(false);
      setIsEditingPublicData(false);

      // Populate editable fields with current order data
      setEditProductName(order.productName || '');
      setEditQuantity(order.quantity || 1);
      setEditEstimatedDeliveryDate(order.estimatedDeliveryDate || '');
      setEditResalePrice(order.resalePrice ?? 0);
      setEditAmountPaid(order.amountPaid ?? 0);
      setEditPaymentStatus(order.paymentStatus || 'PENDENTE');
      setEditClientName(order.clientName || '');
      setEditClientPhone(order.clientPhone || '');
      setEditClientProvince(order.clientProvince || 'Luanda');
      setEditClientDistrict(order.clientDistrict || '');
      setEditClientAddress(order.clientAddress || '');
      setEditReferencePoint(order.referencePoint || '');

      const imgs = (order.productImageUrls && order.productImageUrls.length > 0)
        ? order.productImageUrls
        : (order.productImageUrl ? [order.productImageUrl] : []);
      setEditProductImageUrls(imgs);
      setEditImageUrlInput('');
      setShowEditUrlInput(false);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const currentEffectiveStatus = activeStatus || order.status;
  const currentStatusConfig = getStatusConfig(currentEffectiveStatus);

  const handleSaveNotes = () => {
    onSaveAdminNotes(order.id, adminNotes);
    setIsSavedNotes(true);
    setTimeout(() => setIsSavedNotes(false), 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleStatusSelect = (statusKey: OrderStatus) => {
    setActiveStatus(statusKey);
    onUpdateStatus(order.id, statusKey, timelinePublicNote.trim() || undefined);
    setTimelinePublicNote('');
  };

  const handleConfirmDelete = () => {
    if (onDeleteOrder) {
      onDeleteOrder(order.id);
      setIsConfirmingDelete(false);
      onClose();
    }
  };

  // Edit photo handlers
  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    fileList.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditProductImageUrls((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handleAddEditImageUrl = () => {
    if (editImageUrlInput.trim()) {
      setEditProductImageUrls((prev) => [...prev, editImageUrlInput.trim()]);
      setEditImageUrlInput('');
    }
  };

  const handleRemoveEditImage = (indexToRemove: number) => {
    setEditProductImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryEditImage = (indexToPrimary: number) => {
    setEditProductImageUrls((prev) => {
      const selected = prev[indexToPrimary];
      const rest = prev.filter((_, idx) => idx !== indexToPrimary);
      return [selected, ...rest];
    });
  };

  const handleSavePublicData = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const resale = Math.max(0, Number(editResalePrice) || 0);
    const paid = Math.max(0, Number(editAmountPaid) || 0);
    const pending = Math.max(0, resale - paid);

    let paymentStatus = editPaymentStatus;
    if (paid >= resale && resale > 0 && editPaymentStatus === 'PENDENTE') {
      paymentStatus = 'CONFIRMADO';
    } else if (paid > 0 && paid < resale && editPaymentStatus === 'PENDENTE') {
      paymentStatus = 'PARCIAL';
    }

    const updated: Order = {
      ...order,
      productName: editProductName.trim() || order.productName,
      quantity: Math.max(1, editQuantity || 1),
      estimatedDeliveryDate: editEstimatedDeliveryDate.trim() || order.estimatedDeliveryDate,
      resalePrice: resale,
      amountPaid: paid,
      amountPending: pending,
      paymentStatus,
      clientName: editClientName.trim() || order.clientName,
      clientPhone: editClientPhone.trim() || order.clientPhone,
      clientProvince: editClientProvince.trim() || order.clientProvince,
      clientDistrict: editClientDistrict.trim() || '',
      clientAddress: editClientAddress.trim() || order.clientAddress,
      referencePoint: editReferencePoint.trim() || undefined,
      productImageUrl: editProductImageUrls[0] || undefined,
      productImageUrls: editProductImageUrls.length > 0 ? editProductImageUrls : undefined,
    };

    if (onUpdateOrder) {
      onUpdateOrder(updated);
    }
    setIsEditingPublicData(false);
    setIsPublicSaved(true);
    setTimeout(() => setIsPublicSaved(false), 2500);
  };

  const handleCancelEdit = () => {
    if (order) {
      setEditProductName(order.productName || '');
      setEditQuantity(order.quantity || 1);
      setEditEstimatedDeliveryDate(order.estimatedDeliveryDate || '');
      setEditResalePrice(order.resalePrice ?? 0);
      setEditAmountPaid(order.amountPaid ?? 0);
      setEditPaymentStatus(order.paymentStatus || 'PENDENTE');
      setEditClientName(order.clientName || '');
      setEditClientPhone(order.clientPhone || '');
      setEditClientProvince(order.clientProvince || 'Luanda');
      setEditClientDistrict(order.clientDistrict || '');
      setEditClientAddress(order.clientAddress || '');
      setEditReferencePoint(order.referencePoint || '');
      const imgs = (order.productImageUrls && order.productImageUrls.length > 0)
        ? order.productImageUrls
        : (order.productImageUrl ? [order.productImageUrl] : []);
      setEditProductImageUrls(imgs);
      setEditImageUrlInput('');
      setShowEditUrlInput(false);
    }
    setIsEditingPublicData(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 relative">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded border border-slate-700">
                {order.code}
              </span>
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Painel Interno da Vendedora
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {order.productName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Imprimir Recibo"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* Status Stepper Action Row */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Atualizar Estado da Encomenda:
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${currentStatusConfig.badgeBg}`}>
                {currentStatusConfig.label}
              </span>
            </div>

            {/* Quick Status Buttons + Eliminar button */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_FLOW.map((s) => {
                const isActive = currentEffectiveStatus === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleStatusSelect(s.key)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-left cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{s.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-white" />}
                  </button>
                );
              })}

              {/* Eliminar Encomenda Button right after Cancelada */}
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                title="Eliminar esta encomenda permanentemente"
                className="px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-left cursor-pointer bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-600 hover:text-white hover:border-rose-600 active:scale-95 group"
              >
                <span className="truncate">Eliminar</span>
                <Trash2 className="w-3.5 h-3.5 shrink-0 ml-1 text-rose-600 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Optional Public Note for Timeline */}
            <div className="pt-1">
              <input
                type="text"
                placeholder="Obs pública para a linha do tempo (ex: 'Estafeta Mário a caminho')"
                value={timelinePublicNote}
                onChange={(e) => setTimelinePublicNote(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* INTERNAL vs PUBLIC FINANCIAL COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* PUBLIC DATA (CLIENT SEES) - EDITABLE */}
            <div className={`p-4 rounded-xl border transition-all ${
              isEditingPublicData
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
                : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 space-y-2'
            }`}>
              <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2 mb-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <span>👁️ DADOS PÚBLICOS (Visível pelo Cliente)</span>
                </span>
                
                <div className="flex items-center gap-1.5">
                  {isPublicSaved && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                      <Check className="w-3 h-3" /> Alterações Salvas
                    </span>
                  )}

                  {!isEditingPublicData ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPublicData(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
                      title="Editar dados da encomenda e do cliente"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePublicData}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!isEditingPublicData ? (
                /* READ-ONLY VIEW */
                <div className="space-y-2.5 text-xs text-blue-950 dark:text-blue-100">
                  
                  {/* Product Photos Gallery Strip in Read-Only */}
                  {(() => {
                    const readImages = (order.productImageUrls && order.productImageUrls.length > 0)
                      ? order.productImageUrls
                      : (order.productImageUrl ? [order.productImageUrl] : []);
                    
                    if (readImages.length === 0) return null;

                    return (
                      <div className="p-2.5 bg-white dark:bg-slate-900/80 rounded-xl border border-blue-200/70 dark:border-blue-800/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>Fotos do Artigo ({readImages.length})</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Clique na foto para ampliar
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {readImages.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImageModal(img)}
                              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm hover:ring-2 hover:ring-blue-500 transition-all"
                              title="Clique para ampliar a foto"
                            >
                              <img
                                src={img}
                                alt={`Foto ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ZoomIn className="w-4 h-4" />
                              </div>
                              {idx === 0 && (
                                <span className="absolute top-0.5 left-0.5 bg-amber-500 text-slate-900 text-[8px] font-black px-1 rounded shadow">
                                  CAPA
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5 pt-1">
                    <p><strong>Produto:</strong> {order.productName}</p>
                    <p>
                      <strong>Quantidade:</strong>{' '}
                      <span className="font-bold text-blue-900 dark:text-blue-200">
                        {order.quantity || 1} {(order.quantity || 1) > 1 ? 'unidades' : 'unidade'}
                      </span>
                    </p>
                    <p>
                      <strong>Previsão de Entrega:</strong>{' '}
                      <span className="font-bold text-blue-900 dark:text-blue-200">
                        {order.estimatedDeliveryDate || 'A confirmar'}
                      </span>
                    </p>
                    <p><strong>Preço Combinado:</strong> <span className="font-bold text-blue-900 dark:text-blue-200">{formatKz(order.resalePrice)}</span></p>
                    <p>
                      <strong>Valor Pago:</strong> {formatKz(order.amountPaid)}{' '}
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ml-1 ${
                        order.paymentStatus === 'CONFIRMADO'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : order.paymentStatus === 'PARCIAL'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {order.paymentStatus === 'CONFIRMADO' ? 'PAGO' : order.paymentStatus === 'PARCIAL' ? 'PARCIAL' : 'PENDENTE'}
                      </span>
                      {order.amountPending > 0 && (
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1">
                          (Falta: {formatKz(order.amountPending)})
                        </span>
                      )}
                    </p>
                    <p>
                      <strong>Destinatário:</strong> {order.clientName}
                      {order.clientPhone && (
                        <span className="text-slate-600 dark:text-slate-400 ml-1">({order.clientPhone})</span>
                      )}
                    </p>
                    <p>
                      <strong>Endereço:</strong> {order.clientProvince}{order.clientDistrict ? `, ${order.clientDistrict}` : ''} - {order.clientAddress}
                    </p>
                    {order.referencePoint && (
                      <p className="text-[11px] text-blue-800 dark:text-blue-300">
                        <strong>Ref:</strong> {order.referencePoint}
                      </p>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPublicData(true)}
                      className="w-full py-1.5 bg-blue-100/70 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800/80"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Alterar Informações do Cliente / Fotos / Produto</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* EDITING FORM */
                <form onSubmit={handleSavePublicData} className="space-y-3 pt-1">
                  
                  {/* MULTI-IMAGE MANAGEMENT IN EDIT MODE */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Fotos do Artigo ({editProductImageUrls.length})</span>
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {editProductImageUrls.length > 0 ? 'A 1ª foto é a capa' : 'Nenhuma foto adicionada'}
                      </span>
                    </div>

                    {/* Image Thumbnails Strip */}
                    {editProductImageUrls.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto p-1 scrollbar-thin">
                        {editProductImageUrls.map((img, idx) => (
                          <div
                            key={idx}
                            className={`relative group w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 bg-slate-100 dark:bg-slate-800 transition-all ${
                              idx === 0 ? 'border-amber-500 ring-2 ring-amber-400/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            
                            {/* Primary Badge */}
                            {idx === 0 && (
                              <span className="absolute top-0.5 left-0.5 bg-amber-500 text-slate-950 font-black text-[8px] px-1 py-0.2 rounded shadow">
                                CAPA
                              </span>
                            )}

                            {/* Actions Overlay */}
                            <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-0.5">
                              {idx !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryEditImage(idx)}
                                  className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors cursor-pointer"
                                  title="Tornar capa"
                                >
                                  <Star className="w-3 h-3 fill-current" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveEditImage(idx)}
                                className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                                title="Remover foto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditFileUpload}
                        className="hidden"
                        id="edit-modal-photo-upload"
                      />
                      <label
                        htmlFor="edit-modal-photo-upload"
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Carregar Fotos (Computador / Celular)</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowEditUrlInput(!showEditUrlInput)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{showEditUrlInput ? 'Ocultar Link' : 'Adicionar via Link'}</span>
                      </button>
                    </div>

                    {showEditUrlInput && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="url"
                          value={editImageUrlInput}
                          onChange={(e) => setEditImageUrlInput(e.target.value)}
                          placeholder="https://exemplo.com/foto-do-artigo.jpg"
                          className="flex-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddEditImageUrl}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Nome do Produto / Artigo *
                      </label>
                      <input
                        type="text"
                        required
                        value={editProductName}
                        onChange={(e) => setEditProductName(e.target.value)}
                        placeholder="Ex: Conjunto de colcha e fronhas"
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Qtd (Unidades) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                      Previsão de Entrega (Manual)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <input
                        type="date"
                        value={editEstimatedDeliveryDate}
                        onChange={(e) => setEditEstimatedDeliveryDate(e.target.value)}
                        className="w-full sm:w-48 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-1 text-[10px] flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            setEditEstimatedDeliveryDate(d.toISOString().slice(0, 10));
                          }}
                          className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 text-blue-800 dark:text-blue-200 cursor-pointer"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            setEditEstimatedDeliveryDate(d.toISOString().slice(0, 10));
                          }}
                          className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 text-blue-800 dark:text-blue-200 cursor-pointer"
                        >
                          Amanhã
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 2);
                            setEditEstimatedDeliveryDate(d.toISOString().slice(0, 10));
                          }}
                          className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 text-blue-800 dark:text-blue-200 cursor-pointer"
                        >
                          Em 2 dias
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Preço Venda (Kz)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editResalePrice}
                        onChange={(e) => setEditResalePrice(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Valor Pago (Kz)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editAmountPaid}
                        onChange={(e) => setEditAmountPaid(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Estado Pagamento
                      </label>
                      <select
                        value={editPaymentStatus}
                        onChange={(e) => setEditPaymentStatus(e.target.value as PaymentStatus)}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="PENDENTE">Pendente</option>
                        <option value="PARCIAL">Pago Parcial</option>
                        <option value="CONFIRMADO">Totalmente Pago</option>
                        <option value="REEMBOLSADO">Reembolsado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Nome do Cliente / Destinatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={editClientName}
                        onChange={(e) => setEditClientName(e.target.value)}
                        placeholder="Ex: Esmeraldo"
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Telefone (WhatsApp)
                      </label>
                      <input
                        type="tel"
                        value={editClientPhone}
                        onChange={(e) => setEditClientPhone(e.target.value)}
                        placeholder="Ex: 932 520 782"
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Província
                      </label>
                      <select
                        value={editClientProvince}
                        onChange={(e) => setEditClientProvince(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {ANGOLAN_PROVINCES.map((prov) => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                        Município / Bairro / Distrito
                      </label>
                      <input
                        type="text"
                        value={editClientDistrict}
                        onChange={(e) => setEditClientDistrict(e.target.value)}
                        placeholder="Ex: Maianga, Rocha Pinto..."
                        className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                      Endereço Completo de Entrega
                    </label>
                    <textarea
                      rows={2}
                      value={editClientAddress}
                      onChange={(e) => setEditClientAddress(e.target.value)}
                      placeholder="Ex: Bairro Rocha Pinto, Rua da Igreja Católica..."
                      className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 mb-1">
                      Ponto de Referência (Opcional)
                    </label>
                    <input
                      type="text"
                      value={editReferencePoint}
                      onChange={(e) => setEditReferencePoint(e.target.value)}
                      placeholder="Ex: Próximo à Padaria Rocha..."
                      className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-200 dark:border-blue-800">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar Alterações</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* INTERNAL DATA (STRICTLY HIDDEN FROM CLIENT) */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-600" /> DADOS ADMINISTRATIVOS (Privado)
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                  Proibido ao Cliente
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
                <p><strong>Preço de Compra Local:</strong> <span className="font-extrabold text-amber-900 dark:text-amber-300">{formatKz(order.purchaseCost)}</span></p>
                <p><strong>Local de Compra em Angola:</strong> {order.purchaseLocation}</p>
                <p><strong>Despesas Adicionais:</strong> {formatKz(order.additionalExpenses)}</p>
                <p className="pt-1 text-sm font-black text-blue-700 dark:text-blue-400 border-t border-amber-200 dark:border-amber-800">
                  LUCRO LÍQUIDO: {formatKz(order.netProfit)}
                </p>
              </div>
            </div>

          </div>

          {/* INTERNAL ADMIN NOTES */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Observações Internas da Vendedora (Apenas para o Admin):</span>
              </label>
              {isSavedNotes && (
                <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </span>
              )}
            </div>
            
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Ex: 'Fornecedor confirmou estoque na loja da Mutamba', 'Troca efetuada com sucesso'..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Notas Internas</span>
              </button>
            </div>
          </div>

          {/* WHATSAPP DISPATCH BAR */}
          <div className="bg-blue-600 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <p className="font-bold text-sm">Notificar Cliente no WhatsApp</p>
              <p className="text-xs text-blue-100">
                Enviar mensagem com link de rastreio e estado atual ({currentStatusConfig.label}) para {order.clientName}.
              </p>
            </div>
            <button
              onClick={() => onSendWhatsApp(order)}
              className="bg-white hover:bg-blue-50 text-blue-800 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shrink-0 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Enviar WhatsApp</span>
            </button>
          </div>

        </div>

        {/* CONFIRM DELETE MODAL DIALOG */}
        {isConfirmingDelete && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-rose-300 dark:border-rose-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/50 text-rose-600 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Confirmar Eliminação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {order.code} - {order.clientName}
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Tem a certeza absoluta de que deseja eliminar a encomenda <strong>{order.code}</strong> ({order.productName})?
                <span className="block mt-1 font-semibold text-rose-600 dark:text-rose-400">
                  Esta ação é irreversível e os dados desta encomenda serão apagados.
                </span>
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Eliminar Encomenda</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE PREVIEW MODAL */}
        {previewImageModal && (
          <div 
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewImageModal(null)}
          >
            <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-2 border-b border-slate-800 text-white">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-400" /> Visualização Ampliada
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden max-h-[70vh]">
                <img
                  src={previewImageModal}
                  alt="Visualização do produto"
                  className="max-h-[65vh] w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Order, Client, OrderStatus } from '../types';
import { formatKz, LINEAR_STATUS_FLOW, STATUS_FLOW, getStatusConfig } from '../utils/formatters';
import { 
  X, 
  Plus, 
  Calculator, 
  Building2, 
  ShoppingBag, 
  DollarSign, 
  User, 
  Phone, 
  MapPin, 
  Check, 
  Lock, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Link as LinkIcon, 
  Calendar, 
  Star, 
  Sparkles,
  Truck,
  Clock,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  XCircle,
  PackageCheck
} from 'lucide-react';

const getFormattedDate = (daysAhead: number = 2) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSaveOrder: (newOrder: Order, newClient?: Client) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  clients,
  onSaveOrder,
}) => {
  const [clientMode, setClientMode] = useState<'EXISTING' | 'NEW'>('NEW');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Client Fields
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientProvince, setClientProvince] = useState<string>('Luanda');
  const [clientAddress, setClientAddress] = useState<string>('');

  // Product Fields
  const [productName, setProductName] = useState<string>('');
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<string>(getFormattedDate(2));
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Financial Fields
  const [resalePrice, setResalePrice] = useState<string>('');
  const [purchaseCost, setPurchaseCost] = useState<string>('');
  const [purchaseLocation, setPurchaseLocation] = useState<string>('');
  const [deliveryCost, setDeliveryCost] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'EXPRESS' | 'TRANSFERENCIA' | 'TPA' | 'DINHEIRO' | 'OUTRO'>('EXPRESS');
  const [paymentReceiptRef, setPaymentReceiptRef] = useState<string>('');

  // Initial Order Status selected by Admin
  const [initialStatus, setInitialStatus] = useState<OrderStatus>('AGUARDANDO_PAGAMENTO');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setClientMode('NEW');
      setSelectedClientId('');
      setClientName('');
      setClientPhone('');
      setClientProvince('Luanda');
      setClientAddress('');
      setProductName('');
      setProductImageUrls([]);
      setUrlInputValue('');
      setQuantity(1);
      setEstimatedDeliveryDate(getFormattedDate(2));
      setShowUrlInput(false);
      setResalePrice('');
      setPurchaseCost('');
      setPurchaseLocation('');
      setDeliveryCost('0');
      setPaymentMethod('EXPRESS');
      setPaymentReceiptRef('');
      setInitialStatus('AGUARDANDO_PAGAMENTO');
    }
  }, [isOpen]);

  const numResalePrice = Number(resalePrice) || 0;
  const numPurchaseCost = Number(purchaseCost) || 0;
  const numDeliveryCost = Number(deliveryCost) || 0;

  // Profit calculation
  const grossProfit = numResalePrice - numPurchaseCost;
  const netProfit = numResalePrice - numPurchaseCost - numDeliveryCost;

  // Multiple Files Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    fileList.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProductImageUrls((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (urlInputValue.trim()) {
      setProductImageUrls((prev) => [...prev, urlInputValue.trim()]);
      setUrlInputValue('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setProductImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryImage = (indexToPrimary: number) => {
    setProductImageUrls((prev) => {
      const selected = prev[indexToPrimary];
      const rest = prev.filter((_, idx) => idx !== indexToPrimary);
      return [selected, ...rest];
    });
  };

  const handleClearAllImages = () => {
    setProductImageUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim() || numResalePrice <= 0 || numPurchaseCost <= 0) {
      alert('Por favor, preencha o nome do produto, o preço combinado e o custo de compra local.');
      return;
    }

    let finalClient: {
      id: string;
      name: string;
      phone: string;
      province: string;
      address: string;
    };

    let newClientObj: Client | undefined;

    if (clientMode === 'EXISTING' && selectedClientId) {
      const existing = clients.find((c) => c.id === selectedClientId);
      if (existing) {
        finalClient = existing;
      } else {
        alert('Cliente selecionado não encontrado.');
        return;
      }
    } else {
      const newId = `cli-${Date.now()}`;
      newClientObj = {
        id: newId,
        name: clientName.trim() || 'Cliente sem nome',
        phone: clientPhone.trim() || 'Sem contacto',
        province: clientProvince,
        address: clientAddress.trim() || 'Endereço a combinar',
        totalOrders: 1,
        totalSpent: numResalePrice,
        createdAt: new Date().toISOString(),
      };
      finalClient = newClientObj;
    }

    // Payment calculation based on status
    const isPaidStatus = initialStatus !== 'AGUARDANDO_PAGAMENTO' && initialStatus !== 'CANCELADA';
    const computedAmountPaid = isPaidStatus ? numResalePrice : 0;
    const computedAmountPending = isPaidStatus ? 0 : numResalePrice;
    const computedPaymentStatus = isPaidStatus ? 'CONFIRMADO' : (initialStatus === 'CANCELADA' ? 'REEMBOLSADO' : 'PENDENTE');

    // Generate unique code
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const code = `AO-${randomDigits}`;
    const nowIso = new Date().toISOString();
    const statusCfg = getStatusConfig(initialStatus);

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      code,
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
      clientId: finalClient.id,
      clientName: finalClient.name,
      clientPhone: finalClient.phone,
      clientProvince: finalClient.province,
      clientAddress: finalClient.address,
      productName,
      productImageUrl: productImageUrls[0] || undefined,
      productImageUrls: productImageUrls.length > 0 ? productImageUrls : undefined,
      quantity,
      resalePrice: numResalePrice,
      amountPaid: computedAmountPaid,
      amountPending: computedAmountPending,
      paymentStatus: computedPaymentStatus,
      paymentMethod,
      paymentReceiptRef: paymentReceiptRef.trim() || undefined,
      status: initialStatus,
      estimatedDeliveryDate: estimatedDeliveryDate || getFormattedDate(2),
      purchaseCost: numPurchaseCost,
      purchaseLocation: purchaseLocation.trim() || 'Luanda, Angola',
      deliveryCost: numDeliveryCost,
      otherCosts: 0,
      grossProfit,
      netProfit,
      adminNotes: 'Encomenda registada pela vendedora. Compra local pendente/em curso.',
      timeline: [
        {
          id: `tm-${Date.now()}-1`,
          status: initialStatus,
          title: statusCfg.label,
          description: statusCfg.description,
          timestamp: nowIso,
          isCompleted: true,
        },
      ],
    };

    onSaveOrder(newOrder, newClientObj);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-5 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              <span>Registrar Nova Encomenda</span>
            </h2>
            <p className="text-xs text-slate-300">
              Registo de produto, valores, cliente e estado inicial de rastreio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* CLIENT SECTION */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Dados do Cliente em Angola</span>
              </h3>
              
              <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setClientMode('NEW')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${clientMode === 'NEW' ? 'bg-white dark:bg-slate-900 text-blue-600 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Novo Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('EXISTING')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${clientMode === 'EXISTING' ? 'bg-white dark:bg-slate-900 text-blue-600 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Existente ({clients.length})
                </button>
              </div>
            </div>

            {clientMode === 'EXISTING' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Selecionar Cliente Registado:
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- Escolha um cliente --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone} ({c.province})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome Completo do Cliente:
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telefone / WhatsApp (Angola):
                  </label>
                  <input
                    type="text"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: 923881920"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Província:
                  </label>
                  <select
                    value={clientProvince}
                    onChange={(e) => setClientProvince(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  >
                    {['Luanda', 'Benguela', 'Huambo', 'Huíla', 'Cabinda', 'Namibe', 'Malanje', 'Kwanza Sul', 'Uíge', 'Zaire', 'Lunda Norte', 'Lunda Sul', 'Moxico', 'Kuando Kubango', 'Bié', 'Cunene', 'Bengo', 'Kwanza Norte'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Endereço de Entrega:
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Ex: Rua Direita do Kero, Casa nº 12"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* PRODUCT SECTION */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>Detalhes do Produto</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Produto / Artigo:
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Vestido feminino, Ténis Nike, Telemóvel Samsung..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade Solicitada pelo Cliente:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-semibold">
                    {quantity > 1 ? 'unidades' : 'unidade'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Previsão de Entrega (Manual):
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={estimatedDeliveryDate}
                  onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {/* Fast Date Selection Chips */}
                <div className="flex items-center gap-1 mt-1.5 text-[11px] flex-wrap">
                  <span className="text-slate-400 text-[10px]">Atalhos:</span>
                  <button
                    type="button"
                    onClick={() => setEstimatedDeliveryDate(getFormattedDate(0))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      estimatedDeliveryDate === getFormattedDate(0)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedDeliveryDate(getFormattedDate(1))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      estimatedDeliveryDate === getFormattedDate(1)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedDeliveryDate(getFormattedDate(2))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      estimatedDeliveryDate === getFormattedDate(2)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Em 2 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedDeliveryDate(getFormattedDate(5))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      estimatedDeliveryDate === getFormattedDate(5)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Em 5 dias
                  </button>
                </div>
              </div>

              {/* MULTI-IMAGE UPLOAD & GALLERY PREVIEW */}
              <div className="sm:col-span-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Fotos do Produto / Artigo (Várias fotos permitidas):</span>
                    {productImageUrls.length > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        {productImageUrls.length} {productImageUrls.length === 1 ? 'foto carregada' : 'fotos carregadas'}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {productImageUrls.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllImages}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Limpar todas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{showUrlInput ? 'Ocultar Link' : 'Colar link URL'}</span>
                    </button>
                  </div>
                </div>

                {/* Hidden Multi-file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="product-image-upload"
                />

                {/* Upload Action Bar & Hint */}
                {productImageUrls.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 p-3.5 bg-white dark:bg-slate-900 hover:bg-blue-50/70 dark:hover:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl transition-all text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer group shadow-sm"
                    >
                      <Upload className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                      <span>Carregar Fotos (1 ou várias ao mesmo tempo)</span>
                    </button>

                    <div className="flex items-center justify-center p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 text-center">
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5 shrink-0 text-slate-400" />
                      <span>Selecione múltiplas fotos da galeria ou câmara</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Gallery Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      {productImageUrls.map((url, idx) => {
                        const isPrimary = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`relative group rounded-lg overflow-hidden border transition-all ${
                              isPrimary
                                ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Foto ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-24 sm:h-28 object-cover"
                            />

                            {/* Badge */}
                            <div className="absolute top-1.5 left-1.5">
                              {isPrimary ? (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-current" /> Capa
                                </span>
                              ) : (
                                <span className="bg-slate-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-[2px]">
                                  {idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Action Buttons Overlay */}
                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1 text-white">
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryImage(idx)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded shadow transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                                >
                                  <Star className="w-2.5 h-2.5" /> Tornar Capa
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded shadow transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-2.5 h-2.5" /> Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add more button tile inside grid */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-24 sm:h-28 border-2 border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 rounded-lg flex flex-col items-center justify-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all cursor-pointer"
                        title="Adicionar mais fotos a este artigo"
                      >
                        <Plus className="w-5 h-5" />
                        <span>+ Mais Fotos</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>A primeira foto é a <strong>Capa</strong> do produto. O cliente poderá navegar por todas as fotos no rastreio.</span>
                    </p>
                  </div>
                )}

                {/* URL input field */}
                {showUrlInput && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="url"
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddImageUrl();
                        }
                      }}
                      placeholder="https://exemplo.com/foto-do-produto.jpg"
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!urlInputValue.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FINANCIALS & PROFIT CALCULATION SECTION */}
          <div className="space-y-3 bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>Financeiro & Lucro da Vendedora</span>
              </h3>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded">
                Cálculo Automático
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Preço Combinado (Cliente Paga):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={resalePrice}
                    onChange={(e) => setResalePrice(e.target.value)}
                    placeholder="Ex: 25000"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">Kz</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Preço de Compra Local (Custo Interno):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    placeholder="Ex: 18000"
                    className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">Kz</span>
                </div>
                <span className="text-[10px] text-slate-500">Nunca visível para o cliente!</span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Local da Compra em Angola:
                </label>
                <input
                  type="text"
                  required
                  value={purchaseLocation}
                  onChange={(e) => setPurchaseLocation(e.target.value)}
                  placeholder="Ex: Loja local em Luanda / Mutamba / Saidy Mingas"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custo de Entrega (Transporte Local):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={deliveryCost}
                    onChange={(e) => setDeliveryCost(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400">Kz</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Método de Pagamento do Cliente:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="EXPRESS">Multicaixa Express</option>
                  <option value="TRANSFERENCIA">Transferência Bancária</option>
                  <option value="TPA">TPA / Cartão</option>
                  <option value="DINHEIRO">Numerário / Cash</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nº do Comprovativo / Ref:
                </label>
                <input
                  type="text"
                  value={paymentReceiptRef}
                  onChange={(e) => setPaymentReceiptRef(e.target.value)}
                  placeholder="Ex: EXP-123456 ou ref do talão"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* LIVE PROFIT SUMMARY BADGE */}
            <div className="bg-blue-900 text-white p-3.5 rounded-xl flex items-center justify-between mt-3 shadow-md">
              <div>
                <span className="text-xs text-blue-200 block">Lucro Previsto desta Encomenda:</span>
                <span className="text-lg sm:text-xl font-black text-amber-300">
                  {formatKz(netProfit)}
                </span>
              </div>
              <div className="text-right text-[11px] text-blue-200">
                <p>Receita: {formatKz(numResalePrice)}</p>
                <p>Gasto Total: {formatKz(numPurchaseCost + numDeliveryCost)}</p>
              </div>
            </div>
          </div>

          {/* ORDER INITIAL STATUS SELECTION SECTION */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Estado Inicial da Encomenda</span>
              </h3>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                Visível no Rastreio
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha o estado inicial em que esta encomenda será registada para o cliente:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {LINEAR_STATUS_FLOW.map((s) => {
                const isSelected = initialStatus === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setInitialStatus(s.key)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 ring-2 ring-blue-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-100/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {s.key === 'AGUARDANDO_PAGAMENTO' && <Clock className="w-4 h-4 text-emerald-600" />}
                        {s.key === 'PAGAMENTO_CONFIRMADO' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {s.key === 'PRODUTO_COMPRADO' && <ShoppingBag className="w-4 h-4 text-emerald-600" />}
                        {s.key === 'SAIU_PARA_ENTREGA' && <Truck className="w-4 h-4 text-emerald-600" />}
                        {s.key === 'ENTREGUE' && <CheckCheck className="w-4 h-4 text-emerald-600" />}
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'}`}>
                          {s.label}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                      {s.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Exception Statuses (Problema / Cancelada) */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Outros estados:</span>
              <button
                type="button"
                onClick={() => setInitialStatus('PROBLEMA')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  initialStatus === 'PROBLEMA'
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Problema
              </button>
              <button
                type="button"
                onClick={() => setInitialStatus('CANCELADA')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  initialStatus === 'CANCELADA'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <XCircle className="w-3 h-3" />
                Cancelada
              </button>
            </div>
          </div>

          {/* Submit Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Registrar Encomenda</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

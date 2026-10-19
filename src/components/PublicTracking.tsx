import React, { useState, useEffect, useRef } from 'react';
import { PublicOrderView } from '../types';
import { 
  formatKz, 
  STATUS_FLOW, 
  getStatusConfig, 
  formatDatePT, 
  getCustomerStatusFlow, 
  getCustomerStepIndex,
  CUSTOMER_BASE_STATUS_FLOW,
  matchOrderCode 
} from '../utils/formatters';
import { sanitizeOrderForPublic } from '../utils/security';
import { 
  Search, 
  Package, 
  CheckCircle2, 
  Clock, 
  Truck, 
  MapPin, 
  Calendar, 
  ShoppingBag, 
  MessageSquare, 
  QrCode, 
  ShieldAlert, 
  AlertCircle,
  AlertTriangle,
  XCircle,
  CheckCheck,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  ZoomIn,
  Maximize2,
  X,
  Eye,
  Info,
  Tag,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Images,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPublicTrackingUrl } from '../utils/whatsapp';
import { DelfilandiaWordmark, DelfilandiaBrand, DELFILANDIA_LOGO_SRC } from './DelfilandiaWordmark';

interface PublicTrackingProps {
  initialCode?: string;
  onSearchCode: (code: string) => PublicOrderView | null;
  onWhatsAppContact: (code: string) => void;
  isCustomerMode?: boolean;
  onNewSearch?: () => void;
  whatsappNumber?: string;
  brandName?: string;
  ordersCount?: number;
}

export const PublicTracking: React.FC<PublicTrackingProps> = ({
  initialCode = '',
  onSearchCode,
  onWhatsAppContact,
  isCustomerMode = false,
  onNewSearch,
  whatsappNumber = '923000000',
  brandName = 'DELFILÂNDIA',
  ordersCount,
}) => {
  const [searchCodeInput, setSearchCodeInput] = useState<string>(initialCode || '');
  const [currentOrder, setCurrentOrder] = useState<PublicOrderView | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const getWhatsAppLinkForOrder = (order: PublicOrderView) => {
    const rawNumber = whatsappNumber || '923000000';
    const cleanPhone = rawNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone}`;
    
    const message = `Olá ${brandName || 'DELFILÂNDIA'}! 👋\n\nGostaria de tirar uma dúvida sobre o meu pedido:\n📦 Artigo: ${order.productName}\n🏷️ Código: ${order.code}\n📍 Local de Entrega: ${order.deliveryProvince}${order.deliveryDistrict ? ' - ' + order.deliveryDistrict : ''}\n\nPodem ajudar-me? Obrigado!`;
    
    return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
  };

  const getWhatsAppHelpLink = (queryCode: string) => {
    const rawNumber = whatsappNumber || '923000000';
    const cleanPhone = rawNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone}`;
    
    const message = `Olá ${brandName || 'DELFILÂNDIA'}! 👋\n\nPreciso de ajuda com a minha encomenda. Não consegui localizar o código de rastreio "${queryCode || 'informado'}". Podem ajudar-me a verificar?`;
    
    return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
  };

  const handleResetSearch = () => {
    setHasSearched(false);
    setCurrentOrder(null);
    setSearchCodeInput('');
    setIsSearching(false);
    if (onNewSearch) {
      onNewSearch();
    }
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      searchInputRef.current?.focus();
    }, 80);
  };

  const executeSearch = async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;
    const cleanCode = rawCode.trim().toUpperCase();

    // 1. INSTANT ZERO-LATENCY CACHE CHECK
    // If order exists in initial/local cache, render immediately so user never sees blank skeleton
    const localResult = onSearchCode(cleanCode);
    if (localResult) {
      setCurrentOrder(localResult);
      setHasSearched(true);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }

    // 2. Authoritative Server Lookup (/api/track/:code) in background/parallel
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(cleanCode)}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.order) {
          setCurrentOrder(data.order);
          setHasSearched(true);
          setIsSearching(false);
          return;
        }
      } else if (res.status === 404) {
        // Authoritative: Server confirmed this order does NOT exist or was deleted by admin
        setCurrentOrder(null);
        setHasSearched(true);
        setIsSearching(false);
        return;
      }
    } catch {
      // Network/offline fallback
    }

    // If server failed and localResult was not found
    if (!localResult) {
      const fallbackLocal = onSearchCode(cleanCode);
      if (fallbackLocal) {
        setCurrentOrder(fallbackLocal);
      } else {
        setCurrentOrder(null);
      }
      setHasSearched(true);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      const cleanCode = initialCode.trim().toUpperCase();
      setSearchCodeInput(cleanCode);
      executeSearch(cleanCode);
    } else {
      setSearchCodeInput('');
      setCurrentOrder(null);
      setHasSearched(false);
      setIsSearching(false);
    }
  }, [initialCode]);

  // Generate QR Code image when modal opens or order changes (Dynamic lazy import)
  useEffect(() => {
    if (currentOrder && showQrModal) {
      const trackingUrl = getPublicTrackingUrl(currentOrder.code);
      import('qrcode')
        .then((module) => {
          const qr = module.default || module;
          return qr.toDataURL(trackingUrl, {
            width: 240,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
        })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch(() => {
          // Ignore fallback
        });
    }
  }, [currentOrder, showQrModal]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCodeInput.trim()) return;
    executeSearch(searchCodeInput);
  };

  const handleCopyLink = () => {
    if (!currentOrder) return;
    const link = getPublicTrackingUrl(currentOrder.code);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const customerSteps = currentOrder
    ? getCustomerStatusFlow(currentOrder.status)
    : CUSTOMER_BASE_STATUS_FLOW;
  const currentStepIndex = currentOrder ? getCustomerStepIndex(currentOrder.status) : 0;
  const currentStatusConfig = currentOrder ? getStatusConfig(currentOrder.status) : null;
  const isOrderProblem = currentOrder?.status === 'PROBLEMA';
  const isOrderCancelled = currentOrder?.status === 'CANCELADA';

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      
      {/* 1. CUSTOMER MODE HERO BANNER vs STANDARD SEARCH HERO */}
      {isCustomerMode ? (
        // Dedicated Customer Welcome Banner (Clean, Compact, No Clutter)
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Slogan Emblem Logo Before Wordmark */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-amber-400 shadow-md flex items-center justify-center bg-white shrink-0 p-0.5 ring-2 ring-blue-500/30">
                <img
                  src={DELFILANDIA_LOGO_SRC}
                  alt="DELFILÂNDIA - Um mundo de produtos à sua porta"
                  className="w-full h-full object-contain rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
                />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DelfilandiaWordmark size="lg" />
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Acompanhamento
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm font-medium">
                  Estado da sua encomenda em tempo real • 🇦🇴 Mercado Angolano
                </p>
              </div>
            </div>

            <button
              onClick={handleResetSearch}
              className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all shadow-sm shrink-0 cursor-pointer active:scale-95"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>Nova Consulta</span>
            </button>
          </div>
        </div>
      ) : (
        // Standard Public Search Box (When arriving at initial home page / or /consulta)
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-white shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center max-w-2xl mx-auto space-y-5">
            {/* Slogan Emblem Badge Placed Before Wordmark */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-400 shadow-xl flex items-center justify-center bg-white shrink-0 p-0.5 ring-4 ring-blue-500/20 hover:scale-105 transition-transform">
                <img
                  src={DELFILANDIA_LOGO_SRC}
                  alt="DELFILÂNDIA - Um mundo de produtos à sua porta"
                  className="w-full h-full object-contain rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
                />
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <DelfilandiaWordmark size="xl" />
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    🇦🇴 Angola
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-300/90 font-medium">
                  Um mundo de produtos à sua porta
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Acompanhe a sua Encomenda
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto">
                Insira o seu código de rastreio para consultar a localização e o estado de entrega da sua encomenda.
              </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="pt-1">
              <div className="flex flex-col sm:flex-row items-stretch gap-2.5 bg-slate-900/90 p-2 rounded-xl sm:rounded-2xl border border-slate-700 shadow-2xl">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3.5 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchCodeInput}
                    onChange={(e) => setSearchCodeInput(e.target.value.toUpperCase())}
                    placeholder="ESCREVA O SEU CÓDIGO DE RASTREIO AQUI (EX: AO-XXXXXX)"
                    className="w-full pl-10 sm:pl-11 pr-9 sm:pr-10 py-2.5 sm:py-3 bg-transparent text-white placeholder-slate-400/80 text-xs sm:text-sm font-mono font-medium focus:outline-none uppercase tracking-tight sm:tracking-normal placeholder:text-[11px] sm:placeholder:text-xs md:placeholder:text-sm placeholder:font-sans sm:placeholder:font-mono placeholder:tracking-tight sm:placeholder:tracking-normal"
                    autoFocus={!isCustomerMode}
                  />
                  {searchCodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchCodeInput('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Limpar campo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchCodeInput.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 shrink-0 cursor-pointer"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <span>Buscar</span>
                      <Package className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Order View */}
      {hasSearched && currentOrder ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Card with Product & Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Código de Rastreio:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    {currentOrder.code}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {currentOrder.productName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Destinatário(a): <span className="font-semibold text-slate-700 dark:text-slate-300">{currentOrder.clientFirstName}</span> • {currentOrder.deliveryProvince} {currentOrder.deliveryDistrict ? `(${currentOrder.deliveryDistrict})` : ''}
                </p>
              </div>

              {/* Status Badge */}
              {currentStatusConfig && (
                <div className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-2 self-start sm:self-center shadow-sm ${currentStatusConfig.badgeBg}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-current animate-ping" />
                  <span>{currentStatusConfig.badgeText}</span>
                </div>
              )}
            </div>

            {/* Product & Price Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
              
              {/* Product Thumbnail / Multi-Image Showcase - CLICKABLE TO EXPAND */}
              {(() => {
                const images = (currentOrder.productImageUrls && currentOrder.productImageUrls.length > 0)
                  ? currentOrder.productImageUrls
                  : (currentOrder.productImageUrl ? [currentOrder.productImageUrl] : []);
                
                if (images.length > 0) {
                  const displayImg = images[activeImageIndex < images.length ? activeImageIndex : 0];
                  return (
                    <div className="space-y-2">
                      <div
                        onClick={() => setShowProductModal(true)}
                        className="w-full h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative group cursor-pointer shadow-sm hover:shadow-md transition-all ring-1 hover:ring-2 hover:ring-emerald-500/50"
                        title="Clique para ver a galeria completa de fotos e detalhes do artigo"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowProductModal(true);
                          }
                        }}
                      >
                        <img
                          src={displayImg}
                          alt={currentOrder.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white backdrop-blur-[2px]">
                          <ZoomIn className="w-5 h-5 drop-shadow" />
                          <span className="text-xs font-bold drop-shadow">Ver Fotos Completas</span>
                        </div>

                        <span className="absolute bottom-2 left-2 text-[10px] bg-slate-900/80 group-hover:bg-emerald-700 text-white px-2 py-0.5 rounded backdrop-blur flex items-center gap-1 font-medium transition-colors">
                          <Eye className="w-3 h-3" /> Foto do Artigo
                        </span>

                        {images.length > 1 && (
                          <span className="absolute top-2 right-2 text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 backdrop-blur animate-pulse">
                            <Images className="w-3 h-3" /> {images.length} fotos
                          </span>
                        )}
                      </div>

                      {/* Mini Thumbnail Navigation Strip */}
                      {images.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          {images.map((img, idx) => {
                            const isSelected = (activeImageIndex < images.length ? activeImageIndex : 0) === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImageIndex(idx);
                                }}
                                className={`w-9 h-9 rounded-lg overflow-hidden border shrink-0 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105'
                                    : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                                }`}
                                title={`Ver foto ${idx + 1}`}
                              >
                                <img
                                  src={img}
                                  alt={`Miniatura ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setShowProductModal(true)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline whitespace-nowrap pl-1"
                          >
                            + Ver todas
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    onClick={() => setShowProductModal(true)}
                    className="w-full h-40 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center p-4 text-center group cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors"
                    role="button"
                    tabIndex={0}
                    title="Clique para ver os detalhes completos deste artigo"
                  >
                    <Package className="w-8 h-8 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                      Produto em Angola
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-semibold flex items-center gap-1">
                      <Info className="w-3 h-3" /> Ver detalhes
                    </span>
                  </div>
                );
              })()}

              {/* Public Details */}
              <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  
                  {currentOrder.showSalesPrice && currentOrder.resalePrice !== undefined ? (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Valor Combinado:</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                        {formatKz(currentOrder.resalePrice)}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Quantidade:</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                        {currentOrder.quantity} {currentOrder.quantity > 1 ? 'unidades' : 'unidade'}
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Estado do Pagamento:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-sm mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{currentOrder.paymentStatus === 'CONFIRMADO' || currentOrder.paymentStatus === 'PAGO_TOTAL' ? 'Totalmente pago ✓' : currentOrder.paymentStatus}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Previsão de Entrega:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {currentOrder.estimatedDeliveryDate}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Local de Entrega:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {currentOrder.deliveryProvince} {currentOrder.deliveryDistrict ? `- ${currentOrder.deliveryDistrict}` : ''}
                    </span>
                  </div>

                </div>

                {/* Quick Share / WhatsApp Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <a
                    href={getWhatsAppLinkForOrder(currentOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      onWhatsAppContact(currentOrder.code);
                    }}
                    className="flex-1 min-w-[180px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer decoration-0 no-underline"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Perguntar no WhatsApp</span>
                  </a>

                  <button
                    onClick={handleCopyLink}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copiar link de acompanhamento exclusivo"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar link'}</span>
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Ver QR Code do acompanhamento"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                  </button>
                </div>

              </div>

            </div>
          </div>

          {/* Status Stepper - Circles 1, 5, and 6 removed; 9 and 10 only shown when marked by admin */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  <span>Progresso da Encomenda Local</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Acompanhe os passos da sua compra efetuada no mercado angolano.
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                isOrderProblem
                  ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                  : isOrderCancelled
                  ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700'
                  : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
              }`}>
                {isOrderProblem
                  ? 'Atenção: Situação a Resolver'
                  : isOrderCancelled
                  ? 'Encomenda Cancelada'
                  : `Passo ${Math.min(currentStepIndex + 1, customerSteps.length)} de ${customerSteps.length}`}
              </span>
            </div>

            {/* Visual Stepper */}
            <div className="relative pt-4 pb-2">
              {/* Background connecting bar */}
              <div className="hidden md:block absolute top-[28px] left-8 right-8 h-1 bg-slate-200 dark:bg-slate-800 rounded -z-0" />
              
              {/* Active progress bar */}
              <div
                className={`hidden md:block absolute top-[28px] left-8 h-1 rounded transition-all duration-500 -z-0 ${
                  isOrderProblem ? 'bg-amber-500' : isOrderCancelled ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${customerSteps.length > 1 ? Math.min(100, Math.max(0, (currentStepIndex / (customerSteps.length - 1)) * 90)) : 0}%`,
                }}
              />

              <div className={`grid grid-cols-2 sm:grid-cols-3 ${customerSteps.length >= 6 ? 'md:grid-cols-6' : 'md:grid-cols-5'} gap-3 md:gap-4 relative z-10`}>
                {customerSteps.map((step, idx) => {
                  const isDone = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  let circleStyle = '';
                  let textStyle = '';

                  if (step.key === 'PROBLEMA') {
                    // Circle Problema: Amber
                    circleStyle = isCurrent
                      ? 'bg-amber-500 text-white ring-4 ring-amber-200 dark:ring-amber-900/60 scale-110 shadow-md'
                      : isDone
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700';
                    textStyle = isCurrent || isDone
                      ? 'text-amber-700 dark:text-amber-300 font-extrabold'
                      : 'text-amber-600/80 dark:text-amber-400/80 font-semibold';
                  } else if (step.key === 'CANCELADA') {
                    // Circle Cancelada: Red
                    circleStyle = isCurrent
                      ? 'bg-red-600 text-white ring-4 ring-red-200 dark:ring-red-900/60 scale-110 shadow-md'
                      : isDone
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700';
                    textStyle = isCurrent || isDone
                      ? 'text-red-700 dark:text-red-300 font-extrabold'
                      : 'text-red-600/80 dark:text-red-400/80 font-semibold';
                  } else {
                    // Standard Customer Circles (1 to 5): Green / Emerald
                    circleStyle = isCurrent
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 dark:ring-emerald-900/60 scale-110 shadow-md'
                      : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700';
                    textStyle = isCurrent
                      ? 'text-emerald-700 dark:text-emerald-300 font-extrabold'
                      : isDone
                      ? 'text-slate-900 dark:text-white font-bold'
                      : 'text-slate-400 dark:text-slate-500';
                  }

                  return (
                    <div key={step.key} className="flex md:flex-col items-center md:items-center text-left md:text-center gap-3 md:gap-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-xs transition-all shadow-sm shrink-0 ${circleStyle}`}
                      >
                        {step.key === 'PROBLEMA' ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : step.key === 'CANCELADA' ? (
                          <XCircle className="w-5 h-5" />
                        ) : isDone && !isCurrent ? (
                          <Check className="w-5 h-5" />
                        ) : step.key === 'ENTREGUE' && isDone ? (
                          <CheckCheck className="w-5 h-5" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      <div>
                        <p className={`text-xs ${textStyle}`}>
                          {step.label}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden md:block mt-0.5 line-clamp-2">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Special Notification when status is marked as PROBLEMA by Administrator */}
            {isOrderProblem && (
              <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    Aviso Importante: Ocorrência em Resolução
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300">
                    A nossa equipa identificou uma situação que requer atenção no seu pedido e estamos já a tratar com prioridade. Se desejar esclarecimentos adicionais imediatos, fale diretamente connosco pelo WhatsApp.
                  </p>
                </div>
              </div>
            )}

            {/* Special Notification when status is marked as CANCELADA by Administrator */}
            {isOrderCancelled && (
              <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-xl border border-red-200 dark:border-red-800 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 dark:text-red-200 space-y-1">
                  <p className="font-bold">
                    Encomenda Cancelada
                  </p>
                  <p className="text-red-800/90 dark:text-red-300">
                    Esta encomenda foi cancelada pela administração. Se tiver alguma dúvida, questão sobre reembolso ou precisar de suporte, contacte a nossa equipa.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Timeline Events Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Linha do Tempo da Encomenda</span>
            </h3>

            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {currentOrder.timeline.map((event, idx) => (
                <div key={event.id || idx} className="relative flex items-start gap-4 pl-8">
                  <div className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${event.isCompleted ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-700'}`} />
                  
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {event.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {formatDatePT(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {event.description}
                    </p>
                    {event.publicNote && (
                      <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 bg-blue-50 dark:bg-blue-950/40 p-2 rounded border border-blue-200 dark:border-blue-800">
                        💬 Obs: {event.publicNote}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee of Authenticity & Angola Territory Banner */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
              <p className="font-bold">
                Garantia de Transparência e Origem Local em Angola
              </p>
              <p className="text-emerald-900/90 dark:text-emerald-300">
                Esta encomenda foi adquirida diretamente no comércio de Angola e entregue com suporte contínuo via WhatsApp.
              </p>
            </div>
          </div>

        </motion.div>
      ) : hasSearched && !currentOrder ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 translate="no" className="notranslate text-lg font-bold text-slate-900 dark:text-white">
            Encomenda não encontrada ou link inativo
          </h3>
          <p translate="no" className="notranslate text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Não encontramos nenhuma encomenda ativa associada ao código <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono font-bold text-slate-800 dark:text-slate-200">{searchCodeInput}</code>. O pedido pode ter sido cancelado, removido pela administração da loja ou o código informado está incorreto.
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            💡 <strong>Dica:</strong> Verifique o código recebido no seu WhatsApp. Pode pesquisar apenas os dígitos (ex: <code>160166</code>), o código completo (ex: <code>AO-160166</code>) ou o número de telefone da compra.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Fazer nova consulta</span>
            </button>

            <a
              href={getWhatsAppHelpLink(searchCodeInput)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onWhatsAppContact(searchCodeInput)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer no-underline active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Pedir ajuda no WhatsApp</span>
            </a>
          </div>
        </motion.div>
      ) : isSearching ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Skeleton Header Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg animate-pulse space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-48" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-36" />
              </div>
              <div className="h-8 bg-blue-100 dark:bg-blue-900/40 rounded-xl w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
          </div>

          {/* Skeleton Timeline Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-lg animate-pulse space-y-4">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-40" />
            <div className="space-y-3 pt-2">
              <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* QR Code Modal */}
      {showQrModal && currentOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              QR Code da Encomenda
            </h3>
            <div className="p-3 bg-white rounded-xl border border-slate-200 inline-block shadow-inner">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  Carregando QR Code...
                </div>
              )}
            </div>
            <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {currentOrder.code}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escaneie este QR Code para abrir o acompanhamento diretamente no seu telemóvel.
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* PRODUCT PHOTO & FULL DETAILS MODAL */}
      <AnimatePresence>
        {showProductModal && currentOrder && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto relative flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold border border-blue-400/30">
                      {currentOrder.code}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                      {currentOrder.productName}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                
                {/* Full Photo Showcase / Multi-Photo Gallery */}
                {(() => {
                  const modalImages = (currentOrder.productImageUrls && currentOrder.productImageUrls.length > 0)
                    ? currentOrder.productImageUrls
                    : (currentOrder.productImageUrl ? [currentOrder.productImageUrl] : []);

                  if (modalImages.length > 0) {
                    const currentImg = modalImages[activeImageIndex < modalImages.length ? activeImageIndex : 0];
                    const hasMultiple = modalImages.length > 1;

                    return (
                      <div className="space-y-3">
                        <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center relative group p-2 shadow-inner">
                          <img
                            src={currentImg}
                            alt={`${currentOrder.productName} - Foto ${(activeImageIndex < modalImages.length ? activeImageIndex : 0) + 1}`}
                            className="max-h-[48vh] sm:max-h-[52vh] w-full object-contain rounded-xl select-none"
                          />

                          {/* Top Navigation Badge */}
                          <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow">
                            <Images className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {hasMultiple ? `Foto ${(activeImageIndex < modalImages.length ? activeImageIndex : 0) + 1} de ${modalImages.length}` : 'Foto do Artigo'}
                            </span>
                          </div>

                          {/* Prev / Next Chevrons on Carousel */}
                          {hasMultiple && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImageIndex((prev) => (prev - 1 + modalImages.length) % modalImages.length);
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-md transition-all active:scale-95 cursor-pointer border border-white/10"
                                title="Foto anterior"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImageIndex((prev) => (prev + 1) % modalImages.length);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-md transition-all active:scale-95 cursor-pointer border border-white/10"
                                title="Próxima foto"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 pointer-events-none">
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Foto Real do Artigo</span>
                          </div>
                        </div>

                        {/* Thumbnail Strip if Multiple Photos */}
                        {hasMultiple && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 overflow-x-auto p-1 scrollbar-thin">
                              {modalImages.map((img, idx) => {
                                const isSelected = (activeImageIndex < modalImages.length ? activeImageIndex : 0) === idx;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                                        : 'border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
                                    }`}
                                    title={`Ver foto ${idx + 1}`}
                                  >
                                    <img
                                      src={img}
                                      alt={`Miniatura ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-0.5 right-1 text-[9px] bg-slate-900/80 text-white px-1 rounded font-bold">
                                      {idx + 1}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                              Clique nas miniaturas ou use as setas para alternar entre as fotos deste produto.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-8 text-center flex flex-col items-center justify-center">
                      <Package className="w-14 h-14 text-blue-500 mb-2 animate-bounce" />
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        {currentOrder.productName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        Produto registrado e com entrega programada em Angola.
                      </p>
                    </div>
                  );
                })()}

                {/* Product Information Cards */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Detalhes e Informações do Pedido</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                        Artigo / Produto:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                        {currentOrder.productName}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                        Quantidade Solicitada:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 block">
                        {currentOrder.quantity} {currentOrder.quantity > 1 ? 'unidades' : 'unidade'}
                      </span>
                    </div>

                    {currentOrder.showSalesPrice && currentOrder.resalePrice !== undefined && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                          Preço Combinado:
                        </span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm mt-0.5 block">
                          {formatKz(currentOrder.resalePrice)}
                        </span>
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                        Estado do Pagamento:
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {currentOrder.paymentStatus === 'CONFIRMADO' || currentOrder.paymentStatus === 'PAGO_TOTAL' ? 'Totalmente Pago ✓' : currentOrder.paymentStatus}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                        Previsão de Entrega:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {currentOrder.estimatedDeliveryDate || 'A confirmar'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
                        Local de Entrega:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {currentOrder.deliveryProvince} {currentOrder.deliveryDistrict ? ` - ${currentOrder.deliveryDistrict}` : ''}
                      </span>
                    </div>

                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <a
                  href={getWhatsAppLinkForOrder(currentOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onWhatsAppContact(currentOrder.code)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer no-underline"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Tirar Dúvidas deste Artigo no WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

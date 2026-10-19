import React, { useState, useCallback } from 'react';
import { Order, OrderStatus } from './types';
import { matchOrderCode } from './utils/formatters';
import { useRouteNavigation } from './hooks/useRouteNavigation';
import { useAuth } from './hooks/useAuth';
import { useOrdersData } from './hooks/useOrdersData';

import { Navbar } from './components/Navbar';
import { PublicTracking } from './components/PublicTracking';
import { DelfilandiaWordmark, DELFILANDIA_LOGO_SRC } from './components/DelfilandiaWordmark';

// Code Splitting: Lazy-load all Admin views and heavy Operational/PDF Modals
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const NewOrderModal = React.lazy(() => import('./components/NewOrderModal').then(m => ({ default: m.NewOrderModal })));
const OrderDetailsModal = React.lazy(() => import('./components/OrderDetailsModal').then(m => ({ default: m.OrderDetailsModal })));
const ClientManagement = React.lazy(() => import('./components/ClientManagement').then(m => ({ default: m.ClientManagement })));
const FinancialReports = React.lazy(() => import('./components/FinancialReports').then(m => ({ default: m.FinancialReports })));
const ProductSummary = React.lazy(() => import('./components/ProductSummary').then(m => ({ default: m.ProductSummary })));
const WhatsAppCentral = React.lazy(() => import('./components/WhatsAppCentral').then(m => ({ default: m.WhatsAppCentral })));
const FutureArchitecturePanel = React.lazy(() => import('./components/FutureArchitecturePanel').then(m => ({ default: m.FutureArchitecturePanel })));
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const PinModal = React.lazy(() => import('./components/PinModal').then(m => ({ default: m.PinModal })));
const InitialSetupModal = React.lazy(() => import('./components/InitialSetupModal').then(m => ({ default: m.InitialSetupModal })));

// Action Modals (Heavy PDF / QR rendering)
const MarkAsDeliveredModal = React.lazy(() => import('./components/MarkAsDeliveredModal').then(m => ({ default: m.MarkAsDeliveredModal })));
const ClientReceiptModal = React.lazy(() => import('./components/ClientReceiptModal').then(m => ({ default: m.ClientReceiptModal })));
const InternalReceiptModal = React.lazy(() => import('./components/InternalReceiptModal').then(m => ({ default: m.InternalReceiptModal })));
const QRCodeModal = React.lazy(() => import('./components/QRCodeModal').then(m => ({ default: m.QRCodeModal })));
const ShippingLabelModal = React.lazy(() => import('./components/ShippingLabelModal').then(m => ({ default: m.ShippingLabelModal })));
const WhatsAppModal = React.lazy(() => import('./components/WhatsAppModal').then(m => ({ default: m.WhatsAppModal })));

export default function App() {
  // Authentication & Security Hook
  const {
    isAdminAuthenticated,
    setIsAdminAuthenticated,
    isPinModalOpen,
    setIsPinModalOpen,
    isInitialSetupModalOpen,
    setIsInitialSetupModalOpen,
    isCheckingAuth,
    handleAdminLogout,
    openPinModal,
    openInitialSetupModal,
  } = useAuth();

  // Navigation & Routing Hook
  const {
    routeInfo,
    activeTab,
    setActiveTab,
    adminSubTab,
    setAdminSubTab,
    navigate,
  } = useRouteNavigation(
    isAdminAuthenticated,
    true, // admin configured check handled dynamically in handler
    openPinModal,
    openInitialSetupModal
  );

  // Orders, Clients, Settings & Synchronization Hook
  const {
    orders,
    clients,
    appSettings,
    setAppSettings,
    auditLogs,
    financialStats,
    apiErrorMessage,
    setApiErrorMessage,
    logAuditAction,
    handleSearchCode,
    handleAdvanceStatus,
    handleUpdateStatus,
    handleConfirmDelivery,
    handleDeleteOrder,
    handleSaveAdminNotes,
    handleUpdateOrder,
    handleSaveOrder,
    handleUpdateClientInfo,
    handleSaveSettings,
  } = useOrdersData(isAdminAuthenticated, activeTab);

  // When route is /admin on direct navigation, prompt login if unauthenticated once auth check finishes
  React.useEffect(() => {
    if (!isCheckingAuth && !isAdminAuthenticated && routeInfo.isAdminRoute) {
      if (!appSettings.adminConfigured) {
        openInitialSetupModal();
      } else {
        openPinModal();
      }
    }
  }, [isCheckingAuth, isAdminAuthenticated, routeInfo.isAdminRoute, appSettings.adminConfigured, openPinModal, openInitialSetupModal]);

  // Main Modals State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);

  // Action Modals State
  const [selectedOrderForDelivered, setSelectedOrderForDelivered] = useState<Order | null>(null);
  const [selectedOrderForClientReceipt, setSelectedOrderForClientReceipt] = useState<Order | null>(null);
  const [selectedOrderForInternalReceipt, setSelectedOrderForInternalReceipt] = useState<Order | null>(null);
  const [selectedOrderForQRCode, setSelectedOrderForQRCode] = useState<Order | null>(null);
  const [selectedOrderForShippingLabel, setSelectedOrderForShippingLabel] = useState<Order | null>(null);
  const [selectedOrderForWhatsApp, setSelectedOrderForWhatsApp] = useState<Order | null>(null);

  // Public WhatsApp Contact Action
  const handlePublicWhatsAppContact = useCallback((orderCode: string) => {
    const rawNumber = appSettings.whatsappNumber || appSettings.phoneNumber || '923000000';
    const cleanPhone = rawNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone}`;

    const matchedOrder = orders.find((o) => matchOrderCode(o, orderCode));
    let message = `Olá ${appSettings.brandName || 'DELFILÂNDIA'}! 👋\n\nGostaria de tirar uma dúvida sobre o meu pedido com o código ${orderCode}.`;
    if (matchedOrder) {
      message = `Olá ${appSettings.brandName || 'DELFILÂNDIA'}! 👋\n\nGostaria de tirar uma dúvida sobre o meu pedido:\n📦 Artigo: ${matchedOrder.productName}\n🏷️ Código: ${matchedOrder.code}\n📍 Local de Entrega: ${matchedOrder.clientProvince}${matchedOrder.clientDistrict ? ' - ' + matchedOrder.clientDistrict : ''}\n\nPodem ajudar-me? Obrigado!`;
    }

    const fullUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }, [appSettings, orders]);

  // Order Details Modal Action Handlers
  const handleUpdateStatusInDetails = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    const updated = await handleUpdateStatus(orderId, newStatus, note);
    if (updated && (selectedOrderForDetails?.id === updated.id || selectedOrderForDetails?.code === updated.code)) {
      setSelectedOrderForDetails(updated);
    }
  };

  const handleSaveAdminNotesInDetails = async (orderId: string, notes: string) => {
    const updated = await handleSaveAdminNotes(orderId, notes);
    if (updated && (selectedOrderForDetails?.id === updated.id || selectedOrderForDetails?.code === updated.code)) {
      setSelectedOrderForDetails(updated);
    }
  };

  const handleUpdateOrderInDetails = async (orderToUpdate: Order) => {
    const updated = await handleUpdateOrder(orderToUpdate);
    if (updated && (selectedOrderForDetails?.id === updated.id || selectedOrderForDetails?.code === updated.code)) {
      setSelectedOrderForDetails(updated);
    }
  };

  const handleConfirmDeliveryFromModal = async (
    orderId: string,
    recipientName: string,
    recipientDoc: string,
    photoUrl?: string,
    deliveryNote?: string
  ) => {
    const updated = await handleConfirmDelivery(orderId, recipientName, recipientDoc, photoUrl, deliveryNote);
    if (updated && (selectedOrderForDetails?.id === updated.id || selectedOrderForDetails?.code === updated.code)) {
      setSelectedOrderForDetails(updated);
    }
    setSelectedOrderForDelivered(null);
  };

  const handleSaveNewOrder = async (newOrderData: Partial<Order>, newClientObj?: any) => {
    const saved = await handleSaveOrder(newOrderData, newClientObj);
    if (saved) {
      setIsNewOrderModalOpen(false);
      setSelectedOrderForWhatsApp(saved);
    }
  };

  const handleLogoutAction = async () => {
    await handleAdminLogout();
    setApiErrorMessage(null);
    setActiveTab('public');
    navigate('/');
  };

  // Determine if we are currently in exclusive customer tracking mode
  const isCustomerTrackingPage = routeInfo.isCustomerTrackingPage;

  // Determine if Admin Panel button should be visible in Navbar
  const isDevHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev-') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.search.includes('admin') ||
    window.location.search.includes('dev')
  );
  const showAdminAccess = isAdminAuthenticated || routeInfo.isAdminRoute || isDevHost;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'admin') {
            if (isAdminAuthenticated) {
              setActiveTab('admin');
              navigate('/admin');
            } else {
              if (!appSettings.adminConfigured) {
                openInitialSetupModal();
              } else {
                openPinModal();
              }
            }
          } else {
            setActiveTab('public');
            navigate('/');
          }
        }}
        isAdminAuthenticated={isAdminAuthenticated}
        setIsAdminAuthenticated={setIsAdminAuthenticated}
        adminPin={appSettings.adminPin}
        onOpenPinModal={() => {
          if (!appSettings.adminConfigured) {
            openInitialSetupModal();
          } else {
            openPinModal();
          }
        }}
        isCustomerTrackingPage={isCustomerTrackingPage}
        onNewSearch={isCustomerTrackingPage ? () => navigate('/') : undefined}
        showAdminAccess={showAdminAccess}
        onLogout={handleLogoutAction}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-16">
        
        {/* Error Notification Banner - Only shown for truly authenticated operations that fail */}
        {isAdminAuthenticated && activeTab === 'admin' && apiErrorMessage && (
          <div id="api-error-banner" className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-500/50 flex items-center justify-between shadow-lg backdrop-blur-sm animate-fadeIn">
            <div className="flex items-center space-x-3 text-red-200">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-100 text-sm">Falha na Operação</p>
                <p className="text-xs text-red-300">{apiErrorMessage}</p>
              </div>
            </div>
            <button
              id="btn-close-error-banner"
              onClick={() => setApiErrorMessage(null)}
              className="px-3 py-1 text-xs bg-red-900/60 hover:bg-red-800/80 text-red-100 rounded-lg border border-red-700/50 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* PUBLIC TAB / CUSTOMER TRACKING MODE */}
        {activeTab === 'public' && (
          <PublicTracking
            key={routeInfo.trackingCode || 'public-home'}
            initialCode={routeInfo.trackingCode || ''}
            onSearchCode={handleSearchCode}
            onWhatsAppContact={handlePublicWhatsAppContact}
            isCustomerMode={isCustomerTrackingPage}
            onNewSearch={() => navigate('/')}
            whatsappNumber={appSettings.whatsappNumber}
            brandName={appSettings.brandName}
            ordersCount={orders.length}
          />
        )}

        {/* ADMIN TAB (PROTECTED) */}
        {activeTab === 'admin' && isAdminAuthenticated && (
          <React.Suspense fallback={
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <div className="space-y-6">
              <AdminDashboard
                orders={orders}
                clients={clients}
                stats={financialStats}
                adminPin={appSettings.adminPin}
                onUpdateAdminPin={(newPin) => {
                  const updatedSettings = { ...appSettings, adminPin: newPin };
                  handleSaveSettings(updatedSettings);
                  logAuditAction(
                    'Alteração de Senha',
                    'A senha/PIN de administrador do Painel da Vendedora foi alterada com sucesso.'
                  );
                }}
                onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
                onOpenOrderDetailsModal={(ord) => setSelectedOrderForDetails(ord)}
                onAdvanceStatus={handleAdvanceStatus}
                onUpdateStatus={handleUpdateStatus}
                onDeleteOrder={handleDeleteOrder}
                onSendWhatsAppUpdate={(ord) => setSelectedOrderForWhatsApp(ord)}
                onOpenMarkAsDelivered={(ord) => setSelectedOrderForDelivered(ord)}
                onOpenClientReceipt={(ord) => setSelectedOrderForClientReceipt(ord)}
                onOpenInternalReceipt={(ord) => setSelectedOrderForInternalReceipt(ord)}
                onOpenQRCode={(ord) => setSelectedOrderForQRCode(ord)}
                onOpenShippingLabel={(ord) => setSelectedOrderForShippingLabel(ord)}
                activeSubTab={adminSubTab}
                setActiveSubTab={(sub) => {
                  setAdminSubTab(sub);
                  navigate(`/admin/${sub}`);
                }}
              />

              {/* SubTab Views */}
              {adminSubTab === 'whatsapp' && (
                <WhatsAppCentral
                  orders={orders}
                  onLogAuditAction={logAuditAction}
                />
              )}

              {adminSubTab === 'products' && (
                <ProductSummary
                  orders={orders}
                  onOpenOrderDetailsModal={(ord) => setSelectedOrderForDetails(ord)}
                />
              )}

              {adminSubTab === 'clients' && (
                <ClientManagement
                  clients={clients}
                  orders={orders}
                  onOpenNewOrderForClient={() => {
                    setIsNewOrderModalOpen(true);
                  }}
                  onOpenOrderDetailsModal={(ord) => setSelectedOrderForDetails(ord)}
                  onUpdateClientInfo={handleUpdateClientInfo}
                />
              )}

              {adminSubTab === 'financials' && (
                <FinancialReports orders={orders} stats={financialStats} />
              )}

              {adminSubTab === 'settings' && (
                <SettingsPanel
                  settings={appSettings}
                  auditLogs={auditLogs}
                  onUpdateSettings={handleSaveSettings}
                />
              )}

              {adminSubTab === 'future' && <FutureArchitecturePanel />}
            </div>
          </React.Suspense>
        )}

      </main>

      {/* Lazy Modals within Suspense */}
      <React.Suspense fallback={null}>
        {/* Initial Admin Setup Modal */}
        {isInitialSetupModalOpen && (
          <InitialSetupModal
            isOpen={isInitialSetupModalOpen}
            onClose={() => {
              setIsInitialSetupModalOpen(false);
              if (!isAdminAuthenticated && activeTab === 'admin') {
                setActiveTab('public');
                navigate('/');
              }
            }}
            onSuccessSetup={(newSettings) => {
              setAppSettings((prev) => ({ ...prev, ...newSettings }));
              setIsAdminAuthenticated(true);
              setIsInitialSetupModalOpen(false);
              setActiveTab('admin');
              navigate('/admin');
            }}
          />
        )}

        {/* Security Login Modal (Email & Senha) */}
        {isPinModalOpen && (
          <PinModal
            isOpen={isPinModalOpen}
            appSettings={appSettings}
            onOpenSetup={() => {
              setIsPinModalOpen(false);
              setIsInitialSetupModalOpen(true);
            }}
            onClose={() => {
              setIsPinModalOpen(false);
              if (!isAdminAuthenticated && activeTab === 'admin') {
                setActiveTab('public');
                navigate('/');
              }
            }}
            onSuccess={() => {
              setApiErrorMessage(null);
              setIsAdminAuthenticated(true);
              setActiveTab('admin');
              setIsPinModalOpen(false);
              navigate('/admin');
            }}
            adminEmail={appSettings.adminEmail}
            adminPassword={appSettings.adminPassword}
            currentPin={appSettings.adminPin}
          />
        )}

        {/* Operational Modals */}
        {isNewOrderModalOpen && (
          <NewOrderModal
            isOpen={isNewOrderModalOpen}
            onClose={() => setIsNewOrderModalOpen(false)}
            clients={clients}
            onSaveOrder={handleSaveNewOrder}
          />
        )}

        {!!selectedOrderForDetails && (
          <OrderDetailsModal
            order={orders.find((o) => o.id === selectedOrderForDetails?.id) || selectedOrderForDetails}
            isOpen={!!selectedOrderForDetails}
            onClose={() => setSelectedOrderForDetails(null)}
            onUpdateStatus={handleUpdateStatusInDetails}
            onDeleteOrder={handleDeleteOrder}
            onSendWhatsApp={(ord) => setSelectedOrderForWhatsApp(ord)}
            onSaveAdminNotes={handleSaveAdminNotesInDetails}
            onUpdateOrder={handleUpdateOrderInDetails}
          />
        )}

        {!!selectedOrderForDelivered && (
          <MarkAsDeliveredModal
            isOpen={!!selectedOrderForDelivered}
            onClose={() => setSelectedOrderForDelivered(null)}
            order={selectedOrderForDelivered}
            onConfirmDelivery={handleConfirmDeliveryFromModal}
          />
        )}

        {!!selectedOrderForClientReceipt && (
          <ClientReceiptModal
            isOpen={!!selectedOrderForClientReceipt}
            onClose={() => setSelectedOrderForClientReceipt(null)}
            order={selectedOrderForClientReceipt}
            showSalesPriceToClient={appSettings.showSalesPriceToClient}
          />
        )}

        {!!selectedOrderForInternalReceipt && (
          <InternalReceiptModal
            isOpen={!!selectedOrderForInternalReceipt}
            onClose={() => setSelectedOrderForInternalReceipt(null)}
            order={selectedOrderForInternalReceipt}
          />
        )}

        {!!selectedOrderForQRCode && (
          <QRCodeModal
            isOpen={!!selectedOrderForQRCode}
            onClose={() => setSelectedOrderForQRCode(null)}
            order={selectedOrderForQRCode}
            onLogAuditAction={logAuditAction}
          />
        )}

        {!!selectedOrderForShippingLabel && (
          <ShippingLabelModal
            isOpen={!!selectedOrderForShippingLabel}
            onClose={() => setSelectedOrderForShippingLabel(null)}
            order={selectedOrderForShippingLabel}
          />
        )}

        {!!selectedOrderForWhatsApp && (
          <WhatsAppModal
            isOpen={!!selectedOrderForWhatsApp}
            onClose={() => setSelectedOrderForWhatsApp(null)}
            order={selectedOrderForWhatsApp}
            onLogAuditAction={logAuditAction}
          />
        )}
      </React.Suspense>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-center text-xs space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-400/90 shadow-sm flex items-center justify-center bg-white shrink-0 p-0.5">
            <img 
              src={DELFILANDIA_LOGO_SRC} 
              alt="DELFILÂNDIA" 
              className="w-full h-full object-contain rounded-full"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
            />
          </div>
          <DelfilandiaWordmark size="sm" />
          <span className="text-[11px] text-slate-400 font-medium">🇦🇴 Angola</span>
        </div>
        <p className="text-amber-300/80 font-medium text-xs">
          Um mundo de produtos à sua porta
        </p>
        <p className="text-slate-500 text-[11px]">
          Produtos adquiridos no comércio de Angola e entregues com rastreamento transparente em tempo real.
        </p>
        
        {/* Subtle Admin Access for Seller on Mobile/Preview */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isAdminAuthenticated) {
                setActiveTab('admin');
                navigate('/admin');
              } else if (!appSettings.adminConfigured) {
                openInitialSetupModal();
              } else {
                openPinModal();
              }
            }}
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="Acesso reservado à administração"
          >
            <span>🔒</span>
            <span>Área da Vendedora</span>
          </button>
        </div>
      </footer>

    </div>
  );
}

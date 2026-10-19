import React from 'react';
import { Search, Lock, Unlock, LogOut } from 'lucide-react';
import { DelfilandiaWordmark, DELFILANDIA_LOGO_SRC } from './DelfilandiaWordmark';

interface NavbarProps {
  activeTab: 'public' | 'admin';
  setActiveTab: (tab: 'public' | 'admin') => void;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
  adminPin: string;
  onOpenPinModal: () => void;
  isCustomerTrackingPage?: boolean;
  onNewSearch?: () => void;
  showAdminAccess?: boolean;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isAdminAuthenticated,
  setIsAdminAuthenticated,
  onOpenPinModal,
  isCustomerTrackingPage = false,
  onNewSearch,
  showAdminAccess = false,
  onLogout,
}) => {
  // 1. CUSTOMER TRACKING MODE HEADER (Simplified & Exclusive for Clients)
  if (isCustomerTrackingPage && !isAdminAuthenticated) {
    return (
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Customer Logo & Title */}
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={onNewSearch ? onNewSearch : () => setActiveTab('public')}
              title="DELFILÂNDIA - Acompanhamento de Encomendas"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-amber-400/90 shadow-md flex items-center justify-center bg-white shrink-0 p-0.5 ring-2 ring-blue-500/20">
                <img
                  src={DELFILANDIA_LOGO_SRC}
                  alt="DELFILÂNDIA - Um mundo de produtos à sua porta"
                  className="w-full h-full object-contain rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <DelfilandiaWordmark size="md" />
                  <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    🇦🇴 Angola
                  </span>
                </div>
                {/* Desktop subtitle */}
                <p className="text-xs text-slate-300 hidden sm:block font-medium">
                  Acompanhamento de Encomendas
                </p>
                {/* Mobile subtitle */}
                <p className="text-[11px] text-amber-300 sm:hidden font-semibold">
                  Acompanhamento
                </p>
              </div>
            </div>

            {/* Customer Header Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onNewSearch || (() => setActiveTab('public'))}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition-all active:scale-95"
                title="Consultar código de encomenda"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Consulta Pública</span>
              </button>
            </div>

          </div>
        </div>
      </header>
    );
  }

  // 2. STANDARD / PUBLIC & SELLER NAVBAR
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Angola Badge */}
          <div 
            className="flex items-center space-x-3 cursor-pointer" 
            onClick={() => setActiveTab('public')}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-amber-400/90 shadow-md flex items-center justify-center bg-white shrink-0 p-0.5 ring-2 ring-blue-500/20">
              <img
                src={DELFILANDIA_LOGO_SRC}
                alt="DELFILÂNDIA - Um mundo de produtos à sua porta"
                className="w-full h-full object-contain rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <DelfilandiaWordmark size="md" />
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  🇦🇴 Angola
                </span>
              </div>
              <p className="text-xs text-slate-300 hidden sm:block font-medium">
                Um mundo de produtos à sua porta
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Public Search Button - Always visible */}
            <button
              onClick={() => setActiveTab('public')}
              className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'public'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Consulta Pública</span>
            </button>

            {/* Admin Panel Button - Only visible when showAdminAccess or already authenticated */}
            {(showAdminAccess || isAdminAuthenticated) && (
              <button
                onClick={() => {
                  if (!isAdminAuthenticated) {
                    onOpenPinModal();
                  } else {
                    setActiveTab('admin');
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30 font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                {isAdminAuthenticated ? (
                  <Unlock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                <span>Painel Vendedora</span>
                {isAdminAuthenticated && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            )}

            {isAdminAuthenticated && (
              <button
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  } else {
                    setIsAdminAuthenticated(false);
                    setActiveTab('public');
                  }
                }}
                className="p-2 sm:px-3 sm:py-2.5 rounded-lg text-xs bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Bloquear / Terminar Sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


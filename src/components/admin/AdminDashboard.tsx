import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  MapPin,
  Store,
  UtensilsCrossed,
  Table,
  Upload,
  ShieldAlert,
  ChevronLeft,
  Activity,
  Users
} from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { UniversityManager } from './UniversityManager';
import { FoodZoneManager } from './FoodZoneManager';
import { VendorManager } from './VendorManager';
import { MenuBuilder } from './MenuBuilder';
import { ExcelAdminTable } from './ExcelAdminTable';
import { BulkDataEntry } from './BulkDataEntry';
import { VerificationManager } from './VerificationManager';
import { LiveOrdersMonitor } from './LiveOrdersMonitor';
import { UserManager } from './UserManager';
import { triggerHaptic } from '../../utils/haptics';

interface AdminDashboardProps {
  onBackToApp?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const [activeTab, setActiveTab] = useState<
    'orders' | 'users' | 'universities' | 'zones' | 'vendors' | 'menu' | 'excel' | 'csv' | 'verification'
  >('orders');

  const {
    universities,
    campuses,
    foodZones,
    vendors,
    categories,
    menuItems
  } = useMarketplaceStore();

  const pendingVerificationCount = menuItems.filter(m => m.verification_status === 'pending').length;

  const tabs = [
    { id: 'orders', label: 'Live Orders Stream', icon: Activity },
    { id: 'users', label: 'Users & RBAC Roles', icon: Users },
    { id: 'universities', label: 'Universities & Campuses', icon: Building2 },
    { id: 'zones', label: 'Food Zones', icon: MapPin },
    { id: 'vendors', label: 'Vendors & Outlets', icon: Store },
    { id: 'menu', label: 'Menu Builder', icon: UtensilsCrossed },
    { id: 'excel', label: 'Excel Grid Editor', icon: Table },
    { id: 'csv', label: 'Bulk CSV Import', icon: Upload },
    { id: 'verification', label: 'Data Verification', icon: ShieldAlert, badge: pendingVerificationCount },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-slate-50 text-slate-900 pb-20"
    >
      
      {/* Top Admin Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToApp && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  triggerHaptic(20);
                  onBackToApp();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Back to Marketplace"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">NIGERIAN UNIVERSITY FOOD MARKETPLACE</span>
                <span className="bg-[#D6001C] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  ADMIN CONTROL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Centralized Operations, RBAC Roles, Live Deliveries & Catalog</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <span className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              {universities.length} {universities.length === 1 ? 'University' : 'Universities'}
            </span>
            <span className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              {vendors.length} Vendors
            </span>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="bg-slate-950/80 backdrop-blur-md border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 py-2 text-xs font-extrabold min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerHaptic(20);
                    setActiveTab(tab.id as any);
                  }}
                  className={`px-4 py-2.5 rounded-xl flex items-center gap-2 relative transition-colors cursor-pointer ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeAdminTab"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 bg-[#D6001C] rounded-xl shadow-md shadow-red-500/20"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge && tab.badge > 0 ? (
                      <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1">
                        {tab.badge}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Admin Body Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'orders' && (
              <LiveOrdersMonitor />
            )}

            {activeTab === 'users' && (
              <UserManager />
            )}

            {activeTab === 'universities' && (
              <UniversityManager universities={universities} campuses={campuses} />
            )}

            {activeTab === 'zones' && (
              <FoodZoneManager universities={universities} campuses={campuses} foodZones={foodZones} />
            )}

            {activeTab === 'vendors' && (
              <VendorManager universities={universities} campuses={campuses} foodZones={foodZones} vendors={vendors} />
            )}

            {activeTab === 'menu' && (
              <MenuBuilder vendors={vendors} categories={categories} menuItems={menuItems} />
            )}

            {activeTab === 'excel' && (
              <ExcelAdminTable vendors={vendors} categories={categories} menuItems={menuItems} />
            )}

            {activeTab === 'csv' && (
              <BulkDataEntry />
            )}

            {activeTab === 'verification' && (
              <VerificationManager vendors={vendors} menuItems={menuItems} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

    </motion.div>
  );
};


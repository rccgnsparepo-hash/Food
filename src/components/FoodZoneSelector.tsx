import React from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import { useMarketplaceStore } from '../stores/useMarketplaceStore';
import { triggerHaptic } from '../utils/haptics';

export const FoodZoneSelector: React.FC = () => {
  const {
    foodZones,
    selectedCampusId,
    selectedZoneId,
    setSelectedZoneId
  } = useMarketplaceStore();

  const availableZones = foodZones.filter(z => z.campus_id === selectedCampusId);

  if (availableZones.length === 0) return null;

  return (
    <div className="py-2 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 min-w-max text-xs font-extrabold">
        
        {/* All Zones Tab */}
        <button
          onClick={() => {
            triggerHaptic(20);
            setSelectedZoneId('all');
          }}
          className={`px-4 py-2 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedZoneId === 'all'
              ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>All Campus Food Zones</span>
        </button>

        {/* Individual Zone Pills */}
        {availableZones.map(z => {
          const isSelected = selectedZoneId === z.id;
          return (
            <button
              key={z.id}
              onClick={() => {
                triggerHaptic(20);
                setSelectedZoneId(z.id);
              }}
              className={`px-4 py-2 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{z.name}</span>
            </button>
          );
        })}

      </div>
    </div>
  );
};

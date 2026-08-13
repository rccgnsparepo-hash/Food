import React from 'react';
import { Building2, MapPin, ChevronDown } from 'lucide-react';
import { useMarketplaceStore } from '../stores/useMarketplaceStore';
import { triggerHaptic } from '../utils/haptics';

export const UniversitySelector: React.FC = () => {
  const {
    universities,
    campuses,
    selectedUniversityId,
    selectedCampusId,
    setSelectedUniversityId,
    setSelectedCampusId
  } = useMarketplaceStore();

  const activeUni = universities.find(u => u.id === selectedUniversityId) || universities[0];
  const availableCampuses = campuses.filter(c => c.university_id === selectedUniversityId);
  const activeCampus = availableCampuses.find(c => c.id === selectedCampusId) || availableCampuses[0];

  return (
    <div className="bg-white border-b border-rose-100 py-2.5 px-4 sm:px-6 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        
        {/* University Picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#D6001C]" />
            <span>University:</span>
          </span>

          <div className="relative inline-block">
            <select
              value={selectedUniversityId}
              onChange={e => {
                triggerHaptic(30);
                setSelectedUniversityId(e.target.value);
              }}
              className="appearance-none bg-rose-50 hover:bg-rose-100/80 text-slate-900 font-extrabold pl-3 pr-8 py-1.5 rounded-xl border border-rose-200 outline-none cursor-pointer"
            >
              {universities.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.short_name})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Campus Picker */}
          {availableCampuses.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Campus:</span>
              </span>

              <div className="relative inline-block">
                <select
                  value={activeCampus?.id || ''}
                  onChange={e => {
                    triggerHaptic(30);
                    setSelectedCampusId(e.target.value);
                  }}
                  className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold pl-3 pr-8 py-1.5 rounded-xl border border-slate-200 outline-none cursor-pointer"
                >
                  {availableCampuses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Info Tag */}
        <div className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
          📍 Food options around <span className="text-[#D6001C] font-extrabold">{activeUni?.short_name || 'MTU'}</span>
        </div>

      </div>
    </div>
  );
};

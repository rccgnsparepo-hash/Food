import React, { useState, useEffect } from 'react';
import { ArrowRight, Utensils, Building2, MapPin, CheckCircle2, GraduationCap } from 'lucide-react';
import { BukkitLogo, BukkitIcon } from '../common/BukkitLogo';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface SplashOnboardingProps {
  onStart: () => void;
}

export const SplashOnboarding: React.FC<SplashOnboardingProps> = ({ onStart }) => {
  const { universities, campuses, selectedUniversityId, selectedCampusId, setSelectedUniversityId, setSelectedCampusId, initMarketplace } = useMarketplaceStore();
  const { user } = useAuthStore();

  const [step, setStep] = useState<'intro' | 'select_university'>('intro');
  const [chosenUniId, setChosenUniId] = useState<string>('uni_mtu');
  const [chosenCampusId, setChosenCampusId] = useState<string>('campus_mtu_main');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    initMarketplace();
  }, [initMarketplace]);

  useEffect(() => {
    if (selectedUniversityId) setChosenUniId(selectedUniversityId);
    if (selectedCampusId) setChosenCampusId(selectedCampusId);
  }, [selectedUniversityId, selectedCampusId]);

  const availableCampuses = campuses.filter(c => c.university_id === chosenUniId);

  const handleUniversityChange = (uniId: string) => {
    setChosenUniId(uniId);
    const camps = campuses.filter(c => c.university_id === uniId);
    if (camps.length > 0) {
      setChosenCampusId(camps[0].id);
    } else {
      setChosenCampusId('');
    }
  };

  const handleConfirmPreferences = async () => {
    setIsSaving(true);
    try {
      setSelectedUniversityId(chosenUniId);
      if (chosenCampusId) setSelectedCampusId(chosenCampusId);

      // Save preference to Firestore user profile
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          university_id: chosenUniId,
          campus_id: chosenCampusId,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to save user university preferences:', err);
    } finally {
      setIsSaving(false);
      onStart();
    }
  };

  return (
    <div className="min-h-screen bg-[#D6001C] flex flex-col items-center justify-between p-6 sm:p-8 text-white relative overflow-hidden select-none">
      
      {/* Background Decorative Blurs */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Branding */}
      <div className="pt-8 text-center z-10">
        <BukkitLogo variant="badge" size="sm" theme="dark" subtitleText="CAMPUS FOOD DELIVERY" />
      </div>

      {step === 'intro' ? (
        <>
          {/* Main Center Logo & Statement */}
          <div className="text-center my-auto z-10 max-w-sm px-4">
            <div className="relative inline-block mb-6">
              <div className="p-4 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl backdrop-blur-md">
                <BukkitLogo variant="stacked" size="xl" theme="light" subtitleText="MOUNTAIN TOP UNIVERSITY" />
              </div>
              <span className="text-[10px] font-bold text-orange-200 uppercase tracking-widest absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 px-3 py-0.5 rounded-full border border-orange-500/40 shadow-sm">
                Prayer City, Ogun State
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Fast Campus Meals
            </h1>
            <p className="text-xs sm:text-sm text-red-100/90 leading-relaxed font-medium max-w-xs mx-auto">
              Order food from verified kitchen stands & canteens with live courier tracking.
            </p>
          </div>

          {/* Bottom Action CTA */}
          <div className="w-full max-w-sm pb-6 z-10">
            <button
              onClick={() => setStep('select_university')}
              className="w-full bg-white hover:bg-rose-50 active:scale-[0.98] text-[#D6001C] font-extrabold text-base py-4 rounded-full shadow-2xl shadow-black/20 flex items-center justify-center gap-3 transition-all cursor-pointer group"
            >
              <span>Select Your Campus</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Step 2: University & Campus Selection */}
          <div className="my-auto z-10 w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-rose-100 text-[#D6001C] rounded-2xl flex items-center justify-center mx-auto mb-2">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">Choose Your University</h2>
              <p className="text-xs text-slate-500">Personalize your food feed with verified campus vendors</p>
            </div>

            <div className="space-y-4">
              {/* Select University */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#D6001C]" />
                  <span>University</span>
                </label>
                <select
                  value={chosenUniId}
                  onChange={(e) => handleUniversityChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D6001C]"
                >
                  {universities.map(uni => (
                    <option key={uni.id} value={uni.id}>
                      {uni.name} ({uni.short_name}) - {uni.state} State
                    </option>
                  ))}
                  {universities.length === 0 && (
                    <option value="uni_mtu">Mountain Top University (MTU) - Ogun State</option>
                  )}
                </select>
              </div>

              {/* Select Campus */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D6001C]" />
                  <span>Campus Location</span>
                </label>
                <select
                  value={chosenCampusId}
                  onChange={(e) => setChosenCampusId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D6001C]"
                >
                  {availableCampuses.map(camp => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} ({camp.address || 'Prayer City, Ogun State'})
                    </option>
                  ))}
                  {availableCampuses.length === 0 && (
                    <option value="campus_mtu_main">Main Campus (Prayer City, Ogun State)</option>
                  )}
                </select>
              </div>

              {/* Details Banner */}
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-[#D6001C] shrink-0 mt-0.5" />
                <p>
                  Selected: <strong className="text-[#D6001C]">Mountain Top University (Main Campus)</strong>. Your preferences will be saved to your profile for seamless food discovery.
                </p>
              </div>
            </div>

            <button
              onClick={handleConfirmPreferences}
              disabled={isSaving}
              className="w-full bg-[#D6001C] hover:bg-rose-700 active:scale-[0.98] text-white font-extrabold text-sm py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isSaving ? 'Saving Preferences...' : 'Enter MTU Food Marketplace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

    </div>
  );
};


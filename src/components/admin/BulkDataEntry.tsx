import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, Database, Download, Store, Sparkles, Clock, DollarSign, Filter, RefreshCw } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { initializeKitchenProfile } from '../../services/kitchenService';
import { University, Campus, FoodZone, Vendor, MenuItem, FoodCategory } from '../../types';

interface ParsedRow {
  rowNum: number;
  university: string;
  campus: string;
  food_zone: string;
  vendor: string;
  vendor_type: string;
  slogan: string;
  opening_time: string;
  closing_time: string;
  delivery_time: string;
  category: string;
  dish: string;
  description: string;
  variant: string;
  price: number | null;
  available: boolean;
  image_url: string;
  isValid: boolean;
  error?: string;
}

export const BulkDataEntry: React.FC = () => {
  const store = useMarketplaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [overrideVendorId, setOverrideVendorId] = useState<string>('auto');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Sample Multi-Campus Templates
  const mtuCsvTemplate = `university,campus,food_zone,vendor,vendor_type,slogan,opening_time,closing_time,delivery_time,category,dish,description,variant,price,available,image_url
Mountain Top University,Main Campus,Central Cafeteria,Mama Blessing Kitchen,cafeteria,Fresh hot campus jollof & local soups,07:30,21:00,15-20 min,Rice & Grains,Special Smokey Jollof Rice with Fried Chicken,Firewood party jollof rice served with spiced chicken and plantain,Plate,1800,true,https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800
Mountain Top University,Main Campus,Central Cafeteria,Mama Blessing Kitchen,cafeteria,Fresh hot campus jollof & local soups,07:30,21:00,15-20 min,Swallow & Soups,Hot Amala with Gbegiri & Ewedu,Smooth black amala served with assorted goat meat and fresh ewedu,Portion,2200,true,https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800
Mountain Top University,Main Campus,Prayer City Food Hub,Pastor T Shawarma & Grills,shawarma,Crispy shawarma and sizzling grills,10:00,22:30,10-15 min,Fast Food & Snacks,Double Sausage Beef Shawarma,Loaded double sausage beef shawarma with special garlic cream sauce,Standard,2500,true,https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800
Mountain Top University,Main Campus,Hostel Dining Hall,Divine Pasta & Noodles,fast_food,Fast campus pasta & stir-fry,08:00,22:00,15-20 min,Pasta & Noodles,Spicy Stir-Fry Spaghetti with Turkey,Campus style spicy peppered spaghetti with fried turkey cutlet,Plate,2000,true,https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800
Mountain Top University,Main Campus,Prayer City Food Hub,Fresh Bakes & Smoothies,bakery,Fresh bakery treats and natural juices,08:00,20:00,10-15 min,Drinks & Beverages,Chilled Parfait & Tigernut Milk,Creamy greek yoghurt parfait with granola and fruits,Cup,1500,true,https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=800
Mountain Top University,Main Campus,Hostel Dining Hall,Divine Pasta & Noodles,fast_food,Fast campus pasta & stir-fry,08:00,22:00,15-20 min,Snacks & Sides,Crispy Fried Plantain (Dodo),Sweet ripe fried plantain cubes,Side,500,true,https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800`;

  const unilagCsvTemplate = `university,campus,food_zone,vendor,vendor_type,slogan,opening_time,closing_time,delivery_time,category,dish,description,variant,price,available,image_url
University of Lagos,Akoka Main Campus,New Hall Complex,2001 Cafeteria,cafeteria,Legendary UNILAG student meals,07:00,21:30,15-25 min,Rice & Grains,Fried Rice with Peppered Beef,Golden fried rice with sweet corn, carrots, and spicy beef,Plate,1600,true,https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800
University of Lagos,Akoka Main Campus,New Hall Complex,Mavise Kitchen,buka,Home away from home,08:00,20:00,15-20 min,Swallow & Soups,Pounded Yam with Egusi Soup,Freshly pounded yam with rich egusi soup and stockfish,Plate,2200,true,https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800
University of Lagos,Akoka Main Campus,Amphitheatre,Korede Spaghetti,fast_food,The iconic campus spicy spaghetti,09:00,22:00,10-15 min,Pasta & Noodles,Signature Korede Spaghetti,Original UNILAG spicy spaghetti with boiled egg & sausage,Plate,1800,true,https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800
University of Lagos,Akoka Main Campus,Faculty of Arts,Iya Moria Kitchen,buka,Authentic Amala with Gbegiri & Ewedu,08:00,18:00,15-20 min,Swallow & Soups,Hot Amala with Assorted Meat,Classic hot amala with gbegiri, ewedu and cow leg,Plate,2000,true,https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800`;

  const covenantCsvTemplate = `university,campus,food_zone,vendor,vendor_type,slogan,opening_time,closing_time,delivery_time,category,dish,description,variant,price,available,image_url
Covenant University,Canaanland Campus,Cafeteria 1,Hebron Fast Food,fast_food,Fast & hygienic student dining,07:00,21:00,10-15 min,Fast Food & Snacks,Grilled Chicken Burger Combo,Juicy chicken burger with crispy fries and coleslaw,Combo,2600,true,https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800
Covenant University,Canaanland Campus,Cafeteria 2,Eagles Delicacies,cafeteria,Excellence on every plate,07:30,20:30,15-20 min,Rice & Grains,Basmati Fried Rice & Peppered Chicken,Fragrant basmati rice served with tender spicy peppered chicken,Plate,2400,true,https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800
Covenant University,Canaanland Campus,Sub Food Court,Campus Smoothies & Crepes,bakery,Fresh natural fruit mixes,08:30,20:00,10-15 min,Drinks & Beverages,Tropical Berry Blast Smoothie,Real strawberries, bananas, and pure honey blend,Large,1800,true,https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=800`;

  const parseCsvContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());

      const getCol = (name: string) => {
        const idx = headers.indexOf(name);
        return idx !== -1 && cols[idx] !== undefined ? cols[idx] : '';
      };

      const university = getCol('university') || 'Mountain Top University';
      const campus = getCol('campus') || 'Main Campus';
      const food_zone = getCol('food_zone') || 'Central Food Hub';
      const vendor = getCol('vendor');
      const vendor_type = getCol('vendor_type') || 'cafeteria';
      const slogan = getCol('slogan') || 'Fresh, delicious meals made daily on campus!';
      const opening_time = getCol('opening_time') || '07:30';
      const closing_time = getCol('closing_time') || '21:00';
      const delivery_time = getCol('delivery_time') || '15-25 min';
      const category = getCol('category') || 'Main Dishes';
      const dish = getCol('dish');
      const description = getCol('description');
      const variant = getCol('variant');
      const rawPrice = getCol('price');
      const price = rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null;
      const rawAvail = getCol('available').toLowerCase();
      const available = rawAvail === 'true' || rawAvail === '1' || rawAvail === 'yes' || rawAvail === '';
      const image_url = getCol('image_url') || 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800';

      let isValid = true;
      let error = '';

      if (!vendor && overrideVendorId === 'auto') {
        isValid = false;
        error = 'Missing vendor name';
      }
      if (!dish) {
        isValid = false;
        error = 'Missing dish name';
      }
      if (price === null) {
        isValid = false;
        error = 'Missing/invalid price';
      }

      rows.push({
        rowNum: i,
        university,
        campus,
        food_zone,
        vendor: overrideVendorId !== 'auto' ? (store.vendors.find(v => v.id === overrideVendorId)?.name || vendor) : vendor,
        vendor_type,
        slogan,
        opening_time,
        closing_time,
        delivery_time,
        category,
        dish,
        description,
        variant,
        price,
        available,
        image_url,
        isValid,
        error
      });
    }

    setParsedRows(rows);
    setImportSuccess(false);
  };

  const processUploadedFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      toast.error('Please upload a CSV formatted file (.csv).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCsvContent(text);
      toast.success(`Loaded "${file.name}" with ${text.split('\n').length - 1} rows.`);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([mtuCsvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bukkit_campus_foods_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded CSV template for Excel / Google Sheets!');
  };

  const executeBatchImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }

    setIsImporting(true);
    triggerHaptic(50);

    const createdUnis: University[] = [];
    const createdCampuses: Campus[] = [];
    const createdZones: FoodZone[] = [];
    const createdVendors: Vendor[] = [];
    const createdItems: MenuItem[] = [];

    try {
      let count = 0;
      for (const row of validRows) {
        // IDs
        const uniId = `uni_${row.university.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const campusId = `campus_${row.campus.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const zoneId = `zone_${row.food_zone.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        
        let targetVendorId = overrideVendorId !== 'auto'
          ? overrideVendorId
          : `vendor_${row.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

        const catId = `cat_${row.category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const dishId = `dish_${row.dish.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}_${count}`;

        // 1. Ensure University
        const uniObj: University = {
          id: uniId,
          name: row.university,
          short_name: row.university.includes('Mountain') ? 'MTU' : row.university.includes('Lagos') ? 'UNILAG' : row.university.includes('Covenant') ? 'CU' : 'UNI',
          slug: row.university.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          state: row.university.includes('Mountain') || row.university.includes('Covenant') ? 'Ogun' : 'Lagos',
          city: row.university.includes('Mountain') ? 'Prayer City' : row.university.includes('Covenant') ? 'Ota' : 'Lagos',
          country: 'Nigeria',
          latitude: 6.783,
          longitude: 3.441,
          is_active: true,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'universities', uniId), uniObj, { merge: true });
        createdUnis.push(uniObj);

        // 2. Ensure Campus
        const campusObj: Campus = {
          id: campusId,
          university_id: uniId,
          name: row.campus,
          slug: row.campus.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          address: `${row.campus} Gate, ${row.university}`,
          latitude: 6.783,
          longitude: 3.441,
          is_active: true,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'campuses', campusId), campusObj, { merge: true });
        createdCampuses.push(campusObj);

        // 3. Ensure Food Zone
        const zoneObj: FoodZone = {
          id: zoneId,
          campus_id: campusId,
          university_id: uniId,
          name: row.food_zone,
          description: `Food hub in ${row.campus}`,
          latitude: 6.783,
          longitude: 3.441,
          is_active: true,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'food_zones', zoneId), zoneObj, { merge: true });
        createdZones.push(zoneObj);

        // 4. Ensure Vendor / Kitchen Stand
        const vendorCover = row.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800';
        const vendorObj: Vendor = {
          id: targetVendorId,
          university_id: uniId,
          campus_id: campusId,
          food_zone_id: zoneId,
          name: row.vendor,
          slug: row.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          slogan: row.slogan,
          description: `Campus food vendor serving fresh hot meals at ${row.food_zone}.`,
          vendor_type: (row.vendor_type as any) || 'cafeteria',
          opening_time: row.opening_time,
          closing_time: row.closing_time,
          estimated_delivery_time: row.delivery_time,
          delivery_fee: 300,
          minimum_order: 500,
          delivery_available: true,
          pickup_available: true,
          is_open: true,
          is_verified: true,
          is_active: true,
          rating: 4.8,
          review_count: 15,
          logo_url: vendorCover,
          cover_image_url: vendorCover,
          worker_ids: ['w_head_chef', 'w_cashier_01'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'vendors', targetVendorId), vendorObj, { merge: true });
        await setDoc(doc(db, 'restaurants', targetVendorId), {
          id: targetVendorId,
          name: row.vendor,
          slogan: row.slogan,
          logo_url: vendorCover,
          cover_image_url: vendorCover,
          rating: 4.8,
          delivery_fee: 300,
          estimated_delivery_time: row.delivery_time,
          minimum_order: 500,
          address: row.food_zone,
          is_open: true,
          created_at: new Date().toISOString()
        }, { merge: true });

        // Initialize kitchen profile details
        await initializeKitchenProfile(targetVendorId, {
          slogan: row.slogan,
          cover_image_url: vendorCover,
          worker_ids: ['w_head_chef', 'w_cashier_01'],
          bio: `Specializing in ${row.category} and fresh student food.`
        });
        createdVendors.push(vendorObj);

        // 5. Ensure Category
        await setDoc(doc(db, 'food_categories', catId), {
          id: catId,
          name: row.category,
          slug: row.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          is_active: true
        }, { merge: true });

        // 6. Ensure Dish / Menu Item
        const itemObj: MenuItem = {
          id: dishId,
          vendor_id: targetVendorId,
          restaurant_id: targetVendorId,
          category_id: catId,
          name: row.dish,
          description: row.description || '',
          image_url: row.image_url,
          base_price: row.price,
          price: row.price || 0,
          available: row.available,
          student_friendly: true,
          spicy_level: 1,
          preparation_time: row.delivery_time,
          verification_status: 'verified',
          status: row.available ? 'Published' : 'Sold Out',
          variants: row.variant ? [
            {
              id: `var_${dishId}_0`,
              menu_item_id: dishId,
              name: row.variant,
              price: row.price,
              available: true,
              created_at: new Date().toISOString()
            }
          ] : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'menu_items', dishId), itemObj, { merge: true });
        createdItems.push(itemObj);

        count++;
      }

      // Optimistically push all records to active Zustand Store
      store.bulkAddRecords({
        universities: createdUnis,
        campuses: createdCampuses,
        foodZones: createdZones,
        vendors: createdVendors,
        menuItems: createdItems
      });

      setImportedCount(count);
      setImportSuccess(true);
      setIsImporting(false);
      triggerHaptic([30, 30, 50]);
      toast.success(`Imported ${count} menu items across universities and vendors into database!`);
    } catch (err: any) {
      console.error('Error executing batch CSV import:', err);
      setIsImporting(false);
      toast.error(`Import error: ${err?.message || 'Failed to save batch data'}`);
    }
  };

  const filteredPreviewRows = parsedRows.filter(r => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return (
      r.dish.toLowerCase().includes(q) ||
      r.vendor.toLowerCase().includes(q) ||
      r.university.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#D6001C]" />
              Bulk CSV Importer & University Seeder
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload spreadsheets with full columns (University, Campus, Zone, Kitchen Vendor, Slogan, Dish, Price, Delivery Time, Image).
            </p>
          </div>
          <button
            onClick={downloadCsvTemplate}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#D6001C]" />
            Download Excel Template (.csv)
          </button>
        </div>

        {/* 1-Click Campus Sample Buttons */}
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 space-y-1.5 text-xs">
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            1-Click Load Campus Data Presets:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCsvText(mtuCsvTemplate);
                parseCsvContent(mtuCsvTemplate);
                toast.info('Loaded Mountain Top University (MTU) full menu preset.');
              }}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 transition-colors shadow-2xs"
            >
              🏔️ Mountain Top University (MTU)
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvText(unilagCsvTemplate);
                parseCsvContent(unilagCsvTemplate);
                toast.info('Loaded University of Lagos (UNILAG) preset.');
              }}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 transition-colors shadow-2xs"
            >
              🌊 UNILAG (2001, Korede, Mavise, Iya Moria)
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvText(covenantCsvTemplate);
                parseCsvContent(covenantCsvTemplate);
                toast.info('Loaded Covenant University (CU) preset.');
              }}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 transition-colors shadow-2xs"
            >
              🦅 Covenant University (CU Cafeterias)
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,application/vnd.ms-excel"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-3xl p-8 text-center transition-all bg-white ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
            : 'border-slate-300 hover:border-[#D6001C] hover:bg-rose-50/30 shadow-xs'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-[#D6001C] flex items-center justify-center shadow-xs">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Click to browse or Drag & Drop your CSV file here
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports bulk foods, prices, vendor covers, slogans, and campus zones in a single file.
            </p>
          </div>
          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
            Supported format: .csv UTF-8
          </span>
        </div>
      </div>

      {/* Manual CSV Textarea / Direct Paste */}
      <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-500" />
            Paste CSV Data Raw Text (Optional)
          </label>
          {csvText && (
            <button
              type="button"
              onClick={() => {
                setCsvText('');
                setParsedRows([]);
              }}
              className="text-rose-600 hover:underline font-bold"
            >
              Clear Editor
            </button>
          )}
        </div>
        <textarea
          rows={5}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            parseCsvContent(e.target.value);
          }}
          placeholder="university,campus,food_zone,vendor,vendor_type,slogan,opening_time,closing_time,delivery_time,category,dish,description,variant,price,available,image_url&#10;Mountain Top University,Main Campus,Central Cafeteria,Mama Blessing,cafeteria,Fresh hot food,07:30,21:00,15 min,Rice,Jollof Rice,Tasty meal,Plate,1800,true,https://..."
          className="w-full font-mono text-[11px] p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#D6001C] outline-none"
        />
      </div>

      {/* Parsed Results & Validation Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Parsed Records Preview ({parsedRows.length} Rows, {parsedRows.filter(r => r.isValid).length} Valid)
              </h3>
              <p className="text-xs text-slate-500">
                Review data before writing to live Firestore database collections.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search rows..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-[#D6001C] outline-none"
              />

              <button
                onClick={executeBatchImport}
                disabled={isImporting || parsedRows.filter(r => r.isValid).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer transition-transform hover:scale-102"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing to Firestore...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Execute Import ({parsedRows.filter(r => r.isValid).length} Items)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {importSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs animate-in zoom-in-95">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                Successfully seeded {importedCount} dishes, vendors, and universities!
              </div>
              <span className="text-[11px] bg-white px-3 py-1 rounded-lg font-bold shadow-2xs">
                Live & Synced
              </span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">University</th>
                  <th className="p-3">Vendor / Kitchen</th>
                  <th className="p-3">Dish / Food Item</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPreviewRows.map((row) => (
                  <tr key={row.rowNum} className={row.isValid ? 'hover:bg-slate-50/80' : 'bg-rose-50/40 hover:bg-rose-50'}>
                    <td className="p-3 font-mono text-slate-400">{row.rowNum}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{row.university}</div>
                      <div className="text-[10px] text-slate-400">{row.campus} • {row.food_zone}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{row.vendor}</div>
                      <div className="text-[10px] text-amber-700 italic line-clamp-1">{row.slogan}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{row.dish}</div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{row.description}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-[#D6001C]">
                      {row.price !== null ? `₦${row.price.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-3">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded-md">
                          <AlertCircle className="w-3 h-3" /> {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

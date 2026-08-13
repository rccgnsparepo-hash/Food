import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, Database, Download } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { triggerHaptic } from '../../utils/haptics';

interface ParsedRow {
  rowNum: number;
  university: string;
  campus: string;
  food_zone: string;
  vendor: string;
  vendor_type: string;
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
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [importedCount, setImportedCount] = useState<number>(0);

  const sampleCsvTemplate = `university,campus,food_zone,vendor,vendor_type,category,dish,description,variant,price,available,image_url
University of Lagos,Akoka Main Campus,New Hall Complex,2001 Cafeteria,cafeteria,Rice,Jollof Rice with Chicken,Delicious campus jollof rice,Regular,1500,true,https://images.unsplash.com/photo-1512058564366-18510be2db19
University of Lagos,Akoka Main Campus,New Hall Complex,Mavise,cafeteria,Swallow,Amala,Fresh hot amala,Portion,,false,https://images.unsplash.com/photo-1604329760661-e71dc83f8f26
University of Lagos,Akoka Main Campus,Amphitheatre,Korede Spaghetti,fast_food,Pasta,Korede Spaghetti,Special custom campus spag,Plate,1800,true,https://images.unsplash.com/photo-1551183053-bf91a1d81141`;

  const parseCsvContent = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV splitter respecting quoted strings
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

      const university = getCol('university') || 'University of Lagos';
      const campus = getCol('campus') || 'Akoka Main Campus';
      const food_zone = getCol('food_zone') || 'New Hall Complex';
      const vendor = getCol('vendor');
      const vendor_type = getCol('vendor_type') || 'cafeteria';
      const category = getCol('category') || 'General';
      const dish = getCol('dish');
      const description = getCol('description');
      const variant = getCol('variant');
      const rawPrice = getCol('price');
      const price = rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null;
      const rawAvail = getCol('available').toLowerCase();
      const available = rawAvail === 'true' || rawAvail === '1' || rawAvail === 'yes';
      const image_url = getCol('image_url');

      let isValid = true;
      let error = '';

      if (!vendor || !dish) {
        isValid = false;
        error = 'Missing vendor or dish name';
      }

      rows.push({
        rowNum: i,
        university,
        campus,
        food_zone,
        vendor,
        vendor_type,
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
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    parseCsvContent(text);
  };

  const loadSample = () => {
    setCsvText(sampleCsvTemplate);
    parseCsvContent(sampleCsvTemplate);
  };

  const executeBatchImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    triggerHaptic(50);

    try {
      let count = 0;
      for (const row of validRows) {
        // Slugs
        const uniId = `uni_${row.university.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const campusId = `campus_${row.campus.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const zoneId = `zone_${row.food_zone.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const vendorId = `vendor_${row.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const catId = `cat_${row.category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const dishId = `dish_${row.dish.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${count}`;

        // 1. Ensure University
        await setDoc(doc(db, 'universities', uniId), {
          id: uniId,
          name: row.university,
          short_name: row.university.includes('Lagos') ? 'UNILAG' : 'UNI',
          slug: row.university.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          state: 'Lagos',
          city: 'Lagos',
          country: 'Nigeria',
          is_active: true,
          created_at: new Date().toISOString()
        }, { merge: true });

        // 2. Ensure Campus
        await setDoc(doc(db, 'campuses', campusId), {
          id: campusId,
          university_id: uniId,
          name: row.campus,
          slug: row.campus.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          is_active: true,
          created_at: new Date().toISOString()
        }, { merge: true });

        // 3. Ensure Food Zone
        await setDoc(doc(db, 'food_zones', zoneId), {
          id: zoneId,
          campus_id: campusId,
          university_id: uniId,
          name: row.food_zone,
          is_active: true,
          created_at: new Date().toISOString()
        }, { merge: true });

        // 4. Ensure Vendor
        await setDoc(doc(db, 'vendors', vendorId), {
          id: vendorId,
          university_id: uniId,
          campus_id: campusId,
          food_zone_id: zoneId,
          name: row.vendor,
          slug: row.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          vendor_type: row.vendor_type || 'cafeteria',
          is_open: true,
          is_verified: true,
          is_active: true,
          rating: 4.5,
          created_at: new Date().toISOString()
        }, { merge: true });

        // Sync to restaurants
        await setDoc(doc(db, 'restaurants', vendorId), {
          id: vendorId,
          name: row.vendor,
          logo_url: row.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
          rating: 4.5,
          delivery_fee: 300,
          estimated_delivery_time: '15-25 min',
          minimum_order: 500,
          address: row.food_zone,
          is_open: true,
          created_at: new Date().toISOString()
        }, { merge: true });

        // 5. Ensure Category
        await setDoc(doc(db, 'food_categories', catId), {
          id: catId,
          name: row.category,
          slug: row.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          is_active: true
        }, { merge: true });

        // 6. Ensure Dish / Menu Item
        await setDoc(doc(db, 'menu_items', dishId), {
          id: dishId,
          vendor_id: vendorId,
          restaurant_id: vendorId,
          category_id: catId,
          name: row.dish,
          description: row.description || '',
          image_url: row.image_url || null,
          base_price: row.price,
          price: row.price || 0,
          available: row.available,
          verification_status: row.price !== null ? 'verified' : 'pending',
          status: 'Published',
          created_at: new Date().toISOString()
        });

        count++;
      }

      setImportedCount(count);
      setImportSuccess(true);
      triggerHaptic([30, 30, 50]);
    } catch (err) {
      console.error('Error executing batch CSV import:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">📥 Bulk CSV Import System</h2>
          <p className="text-xs text-slate-500 mt-0.5">Import universities, vendors, and food menus in bulk from spreadsheets.</p>
        </div>
        <button
          onClick={loadSample}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Load UNILAG Sample CSV</span>
        </button>
      </div>

      {/* Input Methods Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upload File Card */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#D6001C]" />
            <span>Option 1: Upload .CSV File</span>
          </h3>

          <div className="border-2 border-dashed border-slate-200 hover:border-rose-300 rounded-2xl p-8 text-center bg-slate-50/50 transition-colors">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="csv_file_input"
            />
            <label htmlFor="csv_file_input" className="cursor-pointer space-y-2 block">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-extrabold text-xs text-slate-700">Click to upload or drag & drop CSV file</p>
              <p className="text-[11px] text-slate-400">Supports comma-separated files (.csv)</p>
            </label>
          </div>
        </div>

        {/* Paste Raw CSV */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D6001C]" />
            <span>Option 2: Paste Raw CSV Text</span>
          </h3>

          <textarea
            rows={6}
            placeholder={`university,campus,food_zone,vendor,vendor_type,category,dish,description,variant,price,available,image_url\n...`}
            value={csvText}
            onChange={handleTextareaChange}
            className="w-full p-3 rounded-2xl border border-slate-300 font-mono text-[11px] focus:ring-2 focus:ring-[#D6001C] outline-none"
          />
        </div>
      </div>

      {/* Validation Summary & Preview */}
      {parsedRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-slate-900 text-base">CSV Parsing & Validation Preview</h3>
              <div className="flex items-center gap-3 mt-1 text-xs font-bold">
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {validCount} Valid Rows
                </span>
                {invalidCount > 0 && (
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {invalidCount} Invalid Rows
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={executeBatchImport}
              disabled={isImporting || validCount === 0}
              className="bg-[#D6001C] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold px-6 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>{isImporting ? 'Importing Data...' : `Commit ${validCount} Items to Database`}</span>
            </button>
          </div>

          {importSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-extrabold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Successfully imported {importedCount} university records and food items into Firestore!</span>
            </div>
          )}

          {/* Table Preview */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[10px] sticky top-0">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">University</th>
                  <th className="p-3">Campus</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Dish</th>
                  <th className="p-3">Price (₦)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {parsedRows.map((r, i) => (
                  <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                    <td className="p-3 font-mono font-bold">{r.rowNum}</td>
                    <td className="p-3 font-bold">{r.university}</td>
                    <td className="p-3">{r.campus}</td>
                    <td className="p-3">{r.food_zone}</td>
                    <td className="p-3 font-bold text-slate-900">{r.vendor}</td>
                    <td className="p-3">{r.category}</td>
                    <td className="p-3 font-bold text-[#D6001C]">{r.dish}</td>
                    <td className="p-3 font-mono font-bold">
                      {r.price !== null ? `₦${r.price.toLocaleString()}` : <span className="text-amber-600">NULL</span>}
                    </td>
                    <td className="p-3">
                      {r.isValid ? (
                        <span className="text-emerald-600 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                          READY
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded-full" title={r.error}>
                          INVALID: {r.error}
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

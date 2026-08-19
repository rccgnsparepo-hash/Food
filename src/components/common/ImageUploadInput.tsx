import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, Sparkles, Check, Link, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ImagePreset {
  title: string;
  category: 'dish' | 'vendor' | 'campus' | 'logo';
  url: string;
}

const PRESET_GALLERY: ImagePreset[] = [
  // Dishes
  {
    title: 'Smokey Jollof Rice',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Hot Amala & Ewedu',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Korede Spicy Spaghetti',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Suya & Chicken Grills',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Double Beef Shawarma',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Fresh Bakery & Snacks',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Cold Drinks & Parfait',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Fried Plantain & Sauce',
    category: 'dish',
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800'
  },

  // Kitchen & Vendor Covers
  {
    title: 'Campus Cafeteria Interior',
    category: 'vendor',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Modern Food Hub',
    category: 'vendor',
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Chef Kitchen Station',
    category: 'vendor',
    url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Grill & BBQ Stand',
    category: 'vendor',
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Cozy Bakery & Cafe',
    category: 'vendor',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=800'
  },

  // Campus & University
  {
    title: 'University Campus Gate',
    category: 'campus',
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Modern Academic Quad',
    category: 'campus',
    url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Student Hall & Complex',
    category: 'campus',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800'
  },

  // Logos
  {
    title: 'Golden Chef Emblem',
    category: 'logo',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'
  },
  {
    title: 'Buka Pot Icon',
    category: 'logo',
    url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=200'
  },
  {
    title: 'Fresh Bakes Badge',
    category: 'logo',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200'
  }
];

interface ImageUploadInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  presetCategory?: 'dish' | 'vendor' | 'campus' | 'logo';
  placeholder?: string;
  helperText?: string;
  aspectRatio?: 'landscape' | 'square' | 'wide';
  className?: string;
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  label,
  value,
  onChange,
  presetCategory = 'dish',
  placeholder = 'Click to upload image or drag & drop',
  helperText,
  aspectRatio = 'landscape',
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activePresetTab, setActivePresetTab] = useState<'dish' | 'vendor' | 'campus' | 'logo'>(presetCategory);
  const [showUrlInput, setShowUrlInput] = useState(false);

  /**
   * Compresses image using canvas to ensure fast load and safe storage
   */
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    // Limit check (10MB max raw)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 10MB.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = aspectRatio === 'square' ? 500 : 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          onChange(compressedDataUrl);
          setIsProcessing(false);
          toast.success('Image uploaded and optimized!');
        } else {
          onChange(e.target?.result as string);
          setIsProcessing(false);
        }
      };

      img.onerror = () => {
        setIsProcessing(false);
        toast.error('Failed to process image file.');
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessing(false);
      toast.error('Failed to read file.');
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
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
    if (file) {
      processImageFile(file);
    }
  };

  const handleSelectPreset = (url: string) => {
    onChange(url);
    setShowPresets(false);
    toast.success('Selected preset photo!');
  };

  const filteredPresets = PRESET_GALLERY.filter(p => p.category === activePresetTab);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-emerald-600" />
            {showPresets ? 'Close Presets' : 'Quick Presets'}
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-neutral-500 hover:text-neutral-700 flex items-center gap-0.5"
            title="Toggle URL input"
          >
            <Link className="w-3 h-3" />
            {showUrlInput ? 'Hide URL' : 'Paste Link'}
          </button>
        </div>
      </div>

      {/* Manual URL Input (Optional) */}
      {showUrlInput && (
        <div className="flex gap-2 mb-2 animate-in fade-in duration-200">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Preset Gallery Drawer */}
      {showPresets && (
        <div className="p-3 bg-neutral-900 text-white rounded-xl mb-3 shadow-lg border border-neutral-800 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Pick Verified High-Res Image
            </span>
            <div className="flex gap-1">
              {(['dish', 'vendor', 'campus', 'logo'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivePresetTab(tab)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold transition-all ${
                    activePresetTab === tab ? 'bg-emerald-500 text-white' : 'text-neutral-400 hover:text-white bg-neutral-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset.url)}
                className="group relative rounded-lg overflow-hidden border border-neutral-700 hover:border-emerald-400 transition-all text-left bg-neutral-800 aspect-video"
              >
                <img
                  src={preset.url}
                  alt={preset.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1">
                  <span className="text-[9px] text-white font-medium line-clamp-1">
                    {preset.title}
                  </span>
                </div>
                {value === preset.url && (
                  <div className="absolute top-1 right-1 bg-emerald-500 text-white p-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Visual Upload & Preview Box */}
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50 shadow-xs">
          <div className={`w-full overflow-hidden ${aspectRatio === 'square' ? 'h-32' : 'h-36'} bg-neutral-900`}>
            <img
              src={value}
              alt="Uploaded Preview"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />
          </div>

          {/* Action Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-neutral-900 text-xs font-semibold rounded-lg shadow-sm hover:bg-neutral-100 flex items-center gap-1.5 transition-transform hover:scale-105"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              Change Photo
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 flex items-center gap-1 transition-transform hover:scale-105"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>

          <div className="px-3 py-1.5 bg-white border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="flex items-center gap-1 text-emerald-700 font-medium truncate max-w-[200px]">
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              Image Loaded
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-emerald-600 hover:underline font-medium text-[11px]"
            >
              Click to replace
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
              : 'border-neutral-200 hover:border-emerald-400 hover:bg-emerald-50/40 bg-neutral-50/70'
          }`}
        >
          {isProcessing ? (
            <div className="py-4 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <span className="text-xs font-medium text-neutral-600">Processing & compressing image...</span>
            </div>
          ) : (
            <div className="py-2 flex flex-col items-center justify-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-neutral-800">
                Click to Upload or Drag & Drop
              </div>
              <div className="text-[11px] text-neutral-500 max-w-[240px]">
                {placeholder} (PNG, JPG, WebP)
              </div>
            </div>
          )}
        </div>
      )}

      {helperText && <p className="text-[10px] text-neutral-400">{helperText}</p>}
    </div>
  );
};

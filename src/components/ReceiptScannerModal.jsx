import React, { useState, useEffect, useId, useRef } from 'react';
import { sanitizeCurrency } from '../services/aiVerification.js';
import { runPaddleOCR, parseStructuredReceiptText } from '../services/paddleOcrService.js';

/**
 * ReceiptScannerModal
 *
 * Fully mobile-responsive, dual-theme (Light/Dark) modal component for scanning
 * and verifying supermarket receipts, grocery scale weights, and itemized purchases.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls visibility of the modal
 * @param {Function} props.onClose - Dismiss callback
 * @param {Function} props.onSave - Callback when verified trip is saved: (tripData, items) => void
 * @param {Object} [props.initialData] - Extracted receipt data (storeName, purchaseDate, etc.)
 * @param {string} [props.initialImage] - Initial image preview URL if available
 * @param {boolean} [props.isScanning] - Loading state during OCR processing
 * @param {number} [props.scanProgress] - OCR progress ratio (0 to 1)
 * @param {string} [props.scanStatusMsg] - OCR status text
 */
export default function ReceiptScannerModal({
  isOpen = true,
  onClose,
  onSave,
  onPhotoSelected,
  onRetake,
  onScanWithPaddle,
  onRescanGemini,
  initialData,
  initialImage = null,
  isScanning: propIsScanning = false,
  scanProgress: propScanProgress = 0,
  scanStatusMsg: propScanStatusMsg = 'Processing receipt...'
}) {
  // Theme state: defaults to dark or stored preference
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // Dark mode default as specified
    }
    return 'dark';
  });

  // Persistent refs for file input and media streams
  const fileInputRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Sync theme class to document element and persist in localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // Clean up any active media stream tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Form Fields State
  const [storeName, setStoreName] = useState('SM Supermarket');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scaleWeight, setScaleWeight] = useState('');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [tripType, setTripType] = useState('Supermarket');
  const [venueMode, setVenueMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kosherai_venue_mode') || 'supermarket';
    }
    return 'supermarket';
  });
  const [portraitTipDismissed, setPortraitTipDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('kosherai_portrait_tip_dismissed') === '1';
    }
    return false;
  });
  const [previewUrl, setPreviewUrl] = useState(initialImage);
  const [currentImageBlob, setCurrentImageBlob] = useState(null);
  const [items, setItems] = useState([
    { id: 1, name: 'Chicken Breast (Fresh)', quantity: 1.2, unit: 'kg', unitPrice: 280, totalPrice: 336 }
  ]);

  const handleVenueChange = (mode) => {
    setVenueMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kosherai_venue_mode', mode);
    }
    if (mode === 'wet_market' && storeName === 'SM Supermarket') {
      setStoreName('Wet Market / Palengke');
    } else if (mode === 'supermarket' && storeName === 'Wet Market / Palengke') {
      setStoreName('SM Supermarket');
    }
  };

  // On-Device OCR & Scanner Execution State Coordination
  const [internalScanning, setInternalScanning] = useState(false);
  const [internalProgress, setInternalProgress] = useState(0);
  const [internalStatusMsg, setInternalStatusMsg] = useState('');
  const [activeEngine, setActiveEngine] = useState(null); // 'gemini' | 'paddle' | null
  const [ocrStatusBadge, setOcrStatusBadge] = useState(null);

  const isScanning = propIsScanning || internalScanning;
  const scanProgress = internalScanning ? internalProgress : propScanProgress;
  const scanStatusMsg = internalScanning ? internalStatusMsg : propScanStatusMsg;

  // Unique IDs for accessibility
  const storeNameId = useId();
  const purchaseDateId = useId();
  const scaleWeightId = useId();
  const totalAmountId = useId();
  const tripTypeId = useId();

  // Populate from initialData when provided
  useEffect(() => {
    if (initialData) {
      if (initialData.storeName) setStoreName(initialData.storeName);
      if (initialData.purchaseDate) setPurchaseDate(initialData.purchaseDate);
      if (initialData.totalScaleWeightKg !== undefined) setScaleWeight(sanitizeCurrency(initialData.totalScaleWeightKg));
      if (initialData.totalAmountPaid !== undefined) setTotalAmount(sanitizeCurrency(initialData.totalAmountPaid));
      if (initialData.tripType) setTripType(initialData.tripType);
      if (Array.isArray(initialData.items) && initialData.items.length > 0) {
        setItems(
          initialData.items.map((item, idx) => {
            const qty = sanitizeCurrency(item.quantity ?? item.qty ?? 1) || 1;
            const price = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
            const total = sanitizeCurrency(item.totalPrice ?? item.lineTotal ?? item.total ?? (qty * price));
            return {
              id: item.id || idx + 1,
              name: item.name || item.description || '',
              quantity: qty,
              unit: item.unit || 'pcs',
              unitPrice: price,
              totalPrice: total
            };
          })
        );
      }
    }
  }, [initialData]);

  useEffect(() => {
    if (initialImage) setPreviewUrl(initialImage);
  }, [initialImage]);

  // Retake photo: cleans up any streams, resets preview, and triggers camera/file input
  const handleRetake = () => {
    // 3. Camera Stream Cleanup (if active)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    // 4. Reset Scanning and Preview State Cleanly (keep form text fields intact)
    setPreviewUrl(null);
    setCurrentImageBlob(null);
    setOcrStatusBadge(null);
    setActiveEngine(null);
    if (typeof onRetake === 'function') {
      onRetake();
    }
    // 1. Clear input value & programmatically click ref
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset cached file value
      fileInputRef.current.click();   // Programmatically trigger camera/file picker
    }
  };

  // Handle Photo / File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentImageBlob(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      if (typeof onPhotoSelected === 'function') {
        onPhotoSelected(file, objectUrl);
      }
    }
    // Always clear input value after reading so consecutive retakes re-trigger
    if (e.target) {
      e.target.value = '';
    }
  };

  // Trigger Direct PaddleOCR Processing Flow (bypasses /api/receipt-scan entirely)
  const handleManualPaddleScan = async () => {
    const targetSource = currentImageBlob || previewUrl;
    if (!targetSource || isScanning) return;

    if (typeof onScanWithPaddle === 'function') {
      onScanWithPaddle(targetSource);
      return;
    }

    try {
      setActiveEngine('paddle');
      setInternalScanning(true);
      setInternalProgress(0.15);
      setInternalStatusMsg('⚡ Running local PaddleOCR on receipt...');

      const ocrResult = await runPaddleOCR(targetSource, (p) => {
        setInternalProgress(p.progress || 0.5);
        if (p.message) setInternalStatusMsg(p.message);
      });

      const parsed = parseStructuredReceiptText(ocrResult);
      if (parsed) {
        if (parsed.storeName) setStoreName(parsed.storeName);
        if (parsed.purchaseDate || parsed.date) setPurchaseDate(parsed.purchaseDate || parsed.date);
        if (parsed.totalAmountPaid !== undefined) {
          setTotalAmount(sanitizeCurrency(parsed.totalAmountPaid).toFixed(2));
        }
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          setItems(
            parsed.items.map((item, idx) => {
              const qty = sanitizeCurrency(item.quantity ?? item.qty ?? 1) || 1;
              const price = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
              const total = sanitizeCurrency(item.totalPrice ?? item.lineTotal ?? item.total ?? (qty * price));
              return {
                id: item.id || idx + 1,
                name: item.name || item.description || '',
                quantity: qty,
                unit: item.unit || 'pcs',
                unitPrice: price,
                totalPrice: total
              };
            })
          );
        }
        setOcrStatusBadge('Scanned with on-device PaddleOCR');
        setTimeout(() => setOcrStatusBadge(null), 5000);
      }
    } catch (err) {
      console.error('[PaddleOCR] Manual on-device scan failed:', err);
      alert('Local OCR failed to recognize receipt text. Please adjust photo angle or enter details manually.');
    } finally {
      setInternalScanning(false);
      setActiveEngine(null);
    }
  };

  // Trigger Re-scan with Gemini Vision
  const handleRescanGemini = async () => {
    const targetSource = currentImageBlob || previewUrl;
    if (!targetSource || isScanning) return;

    if (typeof onRescanGemini === 'function') {
      onRescanGemini(targetSource);
      return;
    }

    try {
      setActiveEngine('gemini');
      setInternalScanning(true);
      setInternalProgress(0.15);
      setInternalStatusMsg('✨ Gemini Vision is analyzing receipt items...');

      let dataUrl = targetSource;
      if (typeof targetSource !== 'string') {
        const { compressImageForOCR } = await import('../services/aiVerification.js');
        dataUrl = await compressImageForOCR(targetSource, 1600, 0.8);
      }

      const { scanSupermarketReceipt } = await import('../services/aiVerification.js');
      const result = await scanSupermarketReceipt(
        dataUrl,
        (p) => {
          setInternalProgress(p.progress || 0.45);
          if (p.message) setInternalStatusMsg(p.message);
        }
      );

      if (result) {
        if (result.storeName) setStoreName(result.storeName);
        if (result.purchaseDate || result.date) setPurchaseDate(result.purchaseDate || result.date);
        if (result.totalAmountPaid !== undefined) {
          setTotalAmount(sanitizeCurrency(result.totalAmountPaid).toFixed(2));
        }
        if (Array.isArray(result.items) && result.items.length > 0) {
          setItems(
            result.items.map((item, idx) => {
              const qty = sanitizeCurrency(item.quantity ?? item.qty ?? 1) || 1;
              const price = sanitizeCurrency(item.unitPrice ?? item.price ?? 0);
              const total = sanitizeCurrency(item.totalPrice ?? item.lineTotal ?? item.total ?? (qty * price));
              return {
                id: item.id || idx + 1,
                name: item.name || item.description || '',
                quantity: qty,
                unit: item.unit || 'pcs',
                unitPrice: price,
                totalPrice: total
              };
            })
          );
        }
        setOcrStatusBadge('Scanned with Gemini Vision');
        setTimeout(() => setOcrStatusBadge(null), 5000);
      }
    } catch (err) {
      console.error('[Gemini] Re-scan failed:', err);
      alert('Cloud vision scan failed. You can use on-device OCR instead.');
    } finally {
      setInternalScanning(false);
      setActiveEngine(null);
    }
  };

  // Item List Actions
  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        name: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        totalPrice: 0
      }
    ]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'price') updated.unitPrice = value;
        if (field === 'unitPrice') updated.price = value;
        if (field === 'quantity' || field === 'unitPrice' || field === 'price') {
          const qty = field === 'quantity' ? Number(value) || 0 : (Number(item.quantity) || 0);
          const price = (field === 'unitPrice' || field === 'price') ? Number(value) || 0 : (Number(item.price !== undefined ? item.price : item.unitPrice) || 0);
          updated.totalPrice = Math.round(qty * price * 100) / 100;
        }
        return updated;
      })
    );
  };

  const updateItem = (idOrIndex, field, value) => {
    if (typeof idOrIndex === 'number' && items[idOrIndex] && items[idOrIndex].id !== undefined) {
      handleUpdateItem(items[idOrIndex].id, field, value);
    } else {
      handleUpdateItem(idOrIndex, field, value);
    }
  };

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const removeItem = (idOrIndex) => {
    if (typeof idOrIndex === 'number' && items[idOrIndex] && items[idOrIndex].id !== undefined) {
      handleRemoveItem(items[idOrIndex].id);
    } else {
      handleRemoveItem(idOrIndex);
    }
  };

  // Math Discrepancy Check
  const sumItems = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  const parsedTotal = parseFloat(totalAmount) || 0;
  const hasDiscrepancy = Math.abs(sumItems - parsedTotal) > 1.0 && items.length > 0;

  // Form Submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const trip_type = venueMode === 'wet_market' ? 'wet_market' : 'supermarket';
    const tripData = {
      storeName: storeName.trim() || (venueMode === 'wet_market' ? 'Wet Market / Palengke' : 'Supermarket'),
      date: purchaseDate,
      totalScaleWeightKg: parseFloat(scaleWeight) || 0,
      totalAmountPaid: parsedTotal,
      tripType: trip_type,
      trip_type,
      receiptImageUrl: venueMode === 'wet_market' ? null : previewUrl,
      notes: venueMode === 'wet_market'
        ? (items.length > 0 ? `Wet market trip (${items.length} item${items.length === 1 ? '' : 's'} recorded)` : 'Manual wet market entry')
        : `Receipt scanned (${items.length} items verified)`
    };

    if (onSave) {
      onSave(tripData, items);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-heading"
    >
      {/* Modal Surface */}
      <div
        className={`relative w-full max-w-5xl my-auto rounded-2xl shadow-2xl transition-colors duration-200 overflow-hidden flex flex-col max-h-[92vh] ${theme === 'dark'
          ? 'bg-slate-950 text-white border border-teal-500/30 shadow-teal-950/40'
          : 'bg-slate-50 text-slate-900 border border-slate-200 shadow-slate-300/50'
          }`}
      >
        {/* Header Bar */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b shrink-0 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'
            }`}
        >
          <div className="flex-1 pr-4 min-w-0">
            <h2
              id="receipt-modal-heading"
              className={`text-lg sm:text-xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
            >
              {venueMode === 'wet_market' ? 'Wet Market Food Intake & Manual Log' : 'Intelligent Supermarket Receipt Scanner'}
            </h2>
            <p
              className={`text-xs sm:text-sm mt-0.5 line-clamp-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}
            >
              {venueMode === 'wet_market'
                ? 'Record palengke and receipt-less produce, scale weights, and itemized batch purchases.'
                : 'AI document OCR extracts store details, itemized purchases, and final amount paid for side-by-side verification.'}
            </p>
          </div>

          {/* Controls: Theme Toggle & Dismiss */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2.5 rounded-lg border transition-all duration-150 flex items-center justify-center ${theme === 'dark'
                ? 'bg-slate-900 text-amber-300 border-slate-700 hover:bg-slate-800 hover:border-slate-600 focus:ring-2 focus:ring-amber-400/30'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus:ring-2 focus:ring-teal-500/30'
                }`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                // Sun Icon for Dark Mode (indicating switch to light)
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                // Moon Icon for Light Mode (indicating switch to dark)
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2.5 rounded-lg border transition-all duration-150 flex items-center justify-center ${theme === 'dark'
                ? 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-800'
                }`}
              title="Close modal"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* In-Modal Venue Mode Toggle (Segmented Switch) */}
        <div className="venue-mode-toggle-container pt-3">
          <div className="venue-mode-toggle" role="tablist" aria-label="Grocery Venue Mode">
            <button
              type="button"
              onClick={() => handleVenueChange('supermarket')}
              className={`venue-toggle-btn ${venueMode === 'supermarket' ? 'active' : ''}`}
              role="tab"
              aria-selected={venueMode === 'supermarket'}
            >
              🛒 Supermarket
            </button>
            <button
              type="button"
              onClick={() => handleVenueChange('wet_market')}
              className={`venue-toggle-btn ${venueMode === 'wet_market' ? 'active' : ''}`}
              role="tab"
              aria-selected={venueMode === 'wet_market'}
            >
              🥬 Wet Market
            </button>
          </div>
        </div>

        {/* Modal Body: Responsive Layout Container */}
        {isScanning ? (
          <div className="flex flex-col items-center justify-center p-12 text-center min-h-[380px]">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Scanning Supermarket Receipt...
            </h3>
            <p className={`text-sm mt-1 max-w-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {scanStatusMsg}
            </p>
            <div className="w-full max-w-xs mt-6 h-2 rounded-full overflow-hidden bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${Math.round((scanProgress || 0.2) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Main responsive grid: Split 5/7 on Supermarket, centered max-w-3xl on Wet Market */}
            <div className={`flex flex-col ${venueMode === 'supermarket' ? 'md:grid md:grid-cols-12' : 'max-w-3xl mx-auto'} gap-6`}>
              {/* Left Column / Upload Card: only shown when venueMode === 'supermarket' */}
              {venueMode === 'supermarket' && (
                <div className="w-full md:col-span-5 flex flex-col">
                  {/* Persistently mounted file input - never unmounted, ref-triggered */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    disabled={isScanning}
                    onChange={handleFileChange}
                    className="sr-only hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                  />

                  <div
                    className={`w-full h-full min-h-[280px] sm:min-h-[340px] md:min-h-[440px] rounded-xl border flex flex-col items-center justify-center p-4 transition-colors ${theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-white border-slate-200 shadow-sm'
                      }`}
                  >
                    {previewUrl ? (
                      <div className="w-full h-full flex flex-col justify-between items-center gap-3">
                        <div className={`relative w-full flex-1 max-h-[380px] rounded-lg overflow-hidden bg-black/90 flex items-center justify-center border border-slate-700/50 ${isScanning ? 'scanning-thumbnail-box' : ''
                          }`}>
                          <img
                            src={previewUrl}
                            alt="Scanned Receipt Preview"
                            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${isScanning ? 'opacity-80' : 'opacity-100'
                              }`}
                          />
                          {isScanning && <div className="scanning-laser-beam" />}
                        </div>

                        {/* Toast / Status Badge for OCR Engine */}
                        {ocrStatusBadge && (
                          <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 animate-fadeIn">
                            <span>✓</span>
                            <span>{ocrStatusBadge}</span>
                          </div>
                        )}

                        {/* Receipt Action Toolbar */}
                        <div className="w-full flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRetake}
                            disabled={isScanning}
                            className={`flex-1 min-w-[110px] min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold border transition-all ${isScanning ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                              } ${theme === 'dark'
                                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                              }`}
                          >
                            🔄 Retake Photo
                          </button>

                          <button
                            type="button"
                            onClick={handleRescanGemini}
                            disabled={isScanning || !previewUrl}
                            title="Re-scan receipt using Gemini Flash Vision"
                            className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${isScanning || !previewUrl
                              ? 'opacity-50 pointer-events-none'
                              : 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20'
                              }`}
                          >
                            {activeEngine === 'gemini' ? (
                              <span className="spinner-micro"></span>
                            ) : (
                              <span>✨</span>
                            )}
                            <span>Re-scan with Gemini</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleManualPaddleScan}
                            disabled={isScanning || !previewUrl}
                            title="Force local on-device PaddleOCR extraction without Gemini"
                            className={`border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors min-h-[38px] ${isScanning || !previewUrl
                              ? 'opacity-50 pointer-events-none'
                              : 'cursor-pointer'
                              }`}
                          >
                            {activeEngine === 'paddle' ? (
                              <span className="spinner-micro"></span>
                            ) : (
                              <span>⚡</span>
                            )}
                            <span>On-Device OCR</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center border-cyan-500/40 bg-teal-500/5">
                        <div className="text-4xl sm:text-5xl mb-3">📷</div>
                        <div
                          className={`font-bold text-base sm:text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'
                            }`}
                        >
                          Take Photo or Upload Receipt
                        </div>
                        <p
                          className={`text-xs sm:text-sm max-w-xs mb-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}
                        >
                          Supports high-resolution JPG or PNG directly from your mobile camera
                        </p>
                        <button
                          type="button"
                          onClick={handleRetake}
                          disabled={isScanning}
                          className="min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                        >
                          Choose File or Camera
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Column / Extracted Editable Form (Full width on mobile, 7 cols on desktop) */}
              <div className="relative w-full md:col-span-7 flex flex-col">
                {isScanning && (
                  <div className="active-scanning-overlay">
                    <div className="w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin mb-3" />
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-2">
                      <span className="animate-pulse">{scanStatusMsg?.includes('PaddleOCR') ? '⚡' : '✨'}</span> {scanStatusMsg?.includes('PaddleOCR') ? 'PaddleOCR Engine Active' : 'Gemini Vision Active'}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                      Analyzing Supermarket Receipt...
                    </h3>
                    <p className="text-xs sm:text-sm text-teal-800 dark:text-teal-300 text-center max-w-xs font-medium">
                      {scanStatusMsg || '✨ Gemini Vision is analyzing receipt details & line items...'}
                    </p>
                    <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.round(scanProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Math Discrepancy Alert */}
                  {hasDiscrepancy && (
                    <div className="p-3.5 rounded-xl text-xs sm:text-sm font-medium border bg-amber-500/10 border-amber-500/40 text-amber-400">
                      ⚠️ <strong>Discrepancy Detected:</strong> Sum of item prices (₱{sumItems.toFixed(2)}) differs from
                      Final Amount Paid (₱{parsedTotal.toFixed(2)}). Please adjust items or total before saving.
                    </div>
                  )}

                  {/* 1. Store Name & Purchase Date (2-column responsive subgrid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={storeNameId}
                        className={`text-xs sm:text-sm font-semibold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                          }`}
                      >
                        Store Name
                      </label>
                      <input
                        id={storeNameId}
                        type="text"
                        required
                        disabled={isScanning}
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        placeholder="e.g. SM Supermarket"
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm transition-colors border outline-none ${theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                          : 'bg-white text-slate-900 border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                          }`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={purchaseDateId}
                        className={`text-xs sm:text-sm font-semibold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                          }`}
                      >
                        Purchase Date
                      </label>
                      <input
                        id={purchaseDateId}
                        type="date"
                        required
                        disabled={isScanning}
                        value={purchaseDate}
                        onChange={e => setPurchaseDate(e.target.value)}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm transition-colors border outline-none ${theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                          : 'bg-white text-slate-900 border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                          }`}
                      />
                    </div>
                  </div>

                  {/* 2. Whole-Grocery Scale Weight Card */}
                  <div
                    className={`rounded-2xl p-4 transition-colors w-full border ${theme === 'dark'
                      ? 'bg-slate-900/60 border-slate-700/60'
                      : 'bg-emerald-50/70 border-emerald-200/80'
                      } dark:bg-slate-900/60 dark:border-slate-700/60`}
                  >
                    <label
                      htmlFor={scaleWeightId}
                      className={`text-xs sm:text-sm font-semibold flex items-center gap-1.5 mb-1.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800'
                        } dark:text-emerald-400`}
                    >
                      ⚖️ Whole-Grocery Scale Weight (kg)
                    </label>

                    {/* Padded input group with embedded trailing unit badge */}
                    <div
                      className={`relative mt-1 flex items-center rounded-lg border px-3 py-2 transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 ${theme === 'dark'
                        ? 'border-slate-700 bg-slate-800/80 text-white'
                        : 'border-slate-300 bg-white text-slate-900'
                        } dark:border-slate-700 dark:bg-slate-800/80 dark:text-white`}
                    >
                      <input
                        id={scaleWeightId}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        disabled={isScanning}
                        value={scaleWeight}
                        onChange={e => setScaleWeight(e.target.value)}
                        placeholder="e.g. 2.20"
                        className={`w-full bg-transparent text-base font-semibold outline-none ${theme === 'dark'
                          ? 'text-white placeholder-slate-500'
                          : 'text-slate-900 placeholder-slate-400'
                          } dark:text-white dark:placeholder-slate-500`}
                      />
                      <span
                        className={`ml-2 select-none text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          } dark:text-slate-400`}
                      >
                        kg
                      </span>
                    </div>

                    <p
                      className={`text-[11px] sm:text-xs mt-2 font-normal leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-emerald-900/80'
                        } dark:text-slate-400`}
                    >
                      Measured physical weight of food haul on your home scale before unpacking. Kept separate from receipt item weights for academic rigor.
                    </p>
                  </div>

                  {/* 3. Final Amount Paid & Trip Type (2-column responsive subgrid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={totalAmountId}
                        className={`text-xs sm:text-sm font-semibold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                          }`}
                      >
                        Final Amount Paid (₱ PHP)
                      </label>
                      <input
                        id={totalAmountId}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={totalAmount}
                        onChange={e => setTotalAmount(e.target.value)}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-base font-bold font-mono transition-colors border outline-none ${theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                          : 'bg-white text-slate-900 border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                          }`}
                      />
                      <span
                        className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}
                      >
                        Recorded ONCE as household food expense.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={tripTypeId}
                        className={`text-xs sm:text-sm font-semibold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                          }`}
                      >
                        Trip Type
                      </label>
                      <select
                        id={tripTypeId}
                        value={tripType}
                        onChange={e => setTripType(e.target.value)}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm transition-colors border outline-none appearance-none bg-no-repeat bg-[right_12px_center] cursor-pointer ${theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                          : 'bg-white text-slate-900 border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                          }`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='${theme === 'dark' ? '%2394a3b8' : '%2364748b'
                            }' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundSize: '16px'
                        }}
                      >
                        <option value="Supermarket">Supermarket</option>
                        <option value="Wet Market / Palengke">Wet Market / Palengke</option>
                        <option value="Specialty Grocery">Specialty Grocery</option>
                        <option value="Convenience Store">Convenience Store</option>
                      </select>
                      <span
                        className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}
                      >
                        Venue classification for cost density analysis.
                      </span>
                    </div>
                  </div>

                  {/* 4. Extracted Items Table */}
                  <div
                    className={`rounded-xl border p-3.5 sm:p-4 flex flex-col gap-3 transition-colors ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                          }`}
                      >
                        Extracted Line Items ({items.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="text-xs sm:text-sm font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300 transition-colors flex items-center gap-1"
                      >
                        <span>➕</span> Add Item Row
                      </button>
                    </div>

                    {/* Desktop Column Header Bar - Hidden on Mobile Screens */}
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800 mb-2">
                      <div className="sm:col-span-4">Item Name</div>
                      <div className="sm:col-span-3 text-center">Qty &amp; Unit</div>
                      <div className="sm:col-span-2 text-right">Price (₱)</div>
                      <div className="sm:col-span-2 text-right">Line Total</div>
                      <div className="sm:col-span-1 text-center" aria-label="Actions"></div>
                    </div>

                    {/* Items List: Stacked 2-Tier Cards on Mobile, 12-Col Grid on Desktop */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {items.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500 rounded-xl border border-dashed border-slate-800">
                          No items extracted yet. Click &quot;Add Item Row&quot; to add manually.
                        </div>
                      ) : (
                        items.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 sm:space-y-0 sm:bg-slate-900/30 sm:p-2 sm:border-slate-800/80 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center transition-colors hover:border-slate-700"
                          >
                            {/* Tier 1: Full-width Item Name with delete button */}
                            <div className="flex items-center gap-2 sm:col-span-4">
                              <input
                                type="text"
                                placeholder="Item Name (e.g., Sayote, Pork Liempo)"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 placeholder-slate-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="sm:hidden p-2 text-slate-400 hover:text-rose-400 rounded-lg bg-slate-800/50 flex-shrink-0 transition-colors cursor-pointer"
                                title="Remove Item"
                                aria-label="Remove Item"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Tier 2: 3-column cluster for numeric values */}
                            <div className="grid grid-cols-12 gap-2 sm:contents">
                              {/* Qty & Unit selector grouped together (5 cols on mobile, 3 cols on desktop) */}
                              <div className="col-span-5 flex items-center gap-1 sm:col-span-3">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="Qty"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                                  className="w-full min-w-0 bg-slate-950/80 border border-slate-700/80 rounded-lg px-2 py-2 text-sm text-center text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                                />
                                <select
                                  value={item.unit || 'kg'}
                                  onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                                  className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-2 py-2 text-xs text-slate-100 appearance-none focus:outline-none focus:border-teal-500 cursor-pointer"
                                >
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                  <option value="pcs">pcs</option>
                                  <option value="pack">pack</option>
                                  <option value="bundle">bundle</option>
                                  <option value="can">can</option>
                                  <option value="bottle">bottle</option>
                                </select>
                              </div>

                              {/* Price Input (4 cols on mobile, 2 cols on desktop) */}
                              <div className="col-span-4 sm:col-span-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="₱ Price"
                                  value={item.price !== undefined ? item.price : (item.unitPrice !== undefined ? item.unitPrice : '')}
                                  onChange={(e) => handleUpdateItem(item.id, 'price', e.target.value)}
                                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-2 py-2 text-sm text-right text-slate-100 font-mono focus:outline-none focus:border-teal-500 placeholder-slate-500"
                                />
                              </div>

                              {/* Line Total Badge (3 cols on mobile, 2 cols on desktop) */}
                              <div className="col-span-3 sm:col-span-2 flex items-center justify-end px-2 py-2 bg-slate-950/40 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-400 font-semibold truncate">
                                ₱{(Number(item.quantity || 0) * Number(item.price !== undefined ? item.price : (item.unitPrice || 0))).toFixed(2)}
                              </div>

                              {/* Desktop-only delete button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="hidden sm:flex sm:col-span-1 items-center justify-center p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remove Item"
                                aria-label="Remove Item"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div
                    className={`flex items-center justify-end gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isScanning}
                      className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all ${isScanning ? 'opacity-50 cursor-not-allowed' : ''
                        } ${theme === 'dark'
                          ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isScanning}
                      className={`min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-teal-900/30 ${isScanning ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                        }`}
                    >
                      <span>💾</span> Save Verified Shopping Trip
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

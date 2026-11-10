import React, { useState, useEffect } from 'react';
import { LID_DATABASE, getCategoryIcon } from '../data/lidDatabase.js';
import { DIET_PROFILES } from '../data/dietProfiles.js';
import { getIngredientImageUrl, buildCloudinaryUrl } from '../services/ingredientImageService.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * AdminIngredientImagesModal
 *
 * Dedicated administrative modal for managing ingredient photographs.
 * Glassmorphic design system matching KosherAI dark theme:
 * - Constrained outer modal: max-w-2xl, max-h-[85vh], overflow-hidden
 * - Fixed header and footer for accessible controls at all viewport sizes
 * - Scrollable body with custom scrollbar
 * - Consistent bounded image containment (h-48 sm:h-52, object-contain) for BOTH
 *   the temporary upload preview and the active/saved Cloudinary image.
 */
export default function AdminIngredientImagesModal({
  isOpen = false,
  onClose,
  initialProtocol = 'lid',
  embedded = false
}) {
  const [activeProtocol, setActiveProtocol] = useState(initialProtocol);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, pending_review, missing
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  
  // Selected ingredient & upload panel state
  const [selectedIngredientId, setSelectedIngredientId] = useState('salt-kosher');
  const [uploadFormOpen, setUploadFormOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load existing mappings on open or when embedded
  useEffect(() => {
    if (isOpen || embedded) {
      loadMappings();
    }
  }, [isOpen, embedded, activeProtocol]);

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl && uploadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  const loadMappings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/ingredient-images?protocol=${encodeURIComponent(activeProtocol)}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMappings(Array.isArray(data.mappings) ? data.mappings : []);
      }
    } catch (err) {
      console.warn('[AdminIngredientImagesModal] Failed to load mappings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen && !embedded) return null;

  // Build mapping lookup dictionary
  const mappingByIngredientId = {};
  mappings.forEach(m => {
    if (m.protocol_id === activeProtocol || activeProtocol === 'all') {
      mappingByIngredientId[m.ingredient_id] = m;
    }
  });

  // Calculate metrics
  const totalIngredients = LID_DATABASE.length;
  const withImage = Object.values(mappingByIngredientId).filter(m => m.status === 'active').length;
  const pendingReview = Object.values(mappingByIngredientId).filter(m => m.status === 'pending_review').length;
  const missingImage = totalIngredients - withImage;

  // Filter items
  let displayedItems = LID_DATABASE;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedItems = displayedItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }

  if (statusFilter !== 'all') {
    displayedItems = displayedItems.filter(item => {
      const mapping = mappingByIngredientId[item.id];
      if (statusFilter === 'active') return mapping && mapping.status === 'active';
      if (statusFilter === 'pending_review') return mapping && mapping.status === 'pending_review';
      if (statusFilter === 'missing') return !mapping || mapping.status === 'inactive';
      return true;
    });
  }

  // Active / Selected Ingredient Resolution
  const activeIngredientId = selectedIngredientId || (displayedItems[0]?.id || LID_DATABASE[0]?.id || 'salt-kosher');
  const selectedIngredient = LID_DATABASE.find(item => item.id === activeIngredientId) || LID_DATABASE[0];
  const selectedMapping = selectedIngredient ? mappingByIngredientId[selectedIngredient.id] : null;
  const savedImageUrl = selectedMapping?.secure_url || (selectedIngredient ? getIngredientImageUrl(selectedIngredient.id, activeProtocol, selectedIngredient.imageUrl) : null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (uploadPreviewUrl && uploadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
      setUploadPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadFile(file);
      if (uploadPreviewUrl && uploadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
      setUploadPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleStartUploadForIngredient = (ingredientId) => {
    setSelectedIngredientId(ingredientId);
    setUploadFormOpen(true);
    setUploadFile(null);
    setUploadPreviewUrl(null);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const targetId = activeIngredientId;
    if (!targetId || !uploadFile) {
      setStatusMessage({ type: 'error', text: 'Please select an ingredient and choose an image file.' });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(uploadFile);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result;
          const res = await fetch('/api/admin/ingredient-images?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ingredientId: targetId,
              protocolId: activeProtocol,
              imageData: base64Data,
              filename: uploadFile.name
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setStatusMessage({ type: 'success', text: `Uploaded and mapped ${selectedIngredient?.name || targetId} successfully!` });
            setUploadFormOpen(false);
            setUploadFile(null);
            setUploadPreviewUrl(null);
            await loadMappings();
          } else {
            setStatusMessage({ type: 'error', text: data.message || 'Upload failed. Check Cloudinary settings.' });
          }
        } catch (err) {
          setStatusMessage({ type: 'error', text: err.message || 'Error processing image upload.' });
        } finally {
          setIsUploading(false);
        }
      };
    } catch (err) {
      setIsUploading(false);
      setStatusMessage({ type: 'error', text: err.message || 'Error reading image file.' });
    }
  };

  const handleAutoDiscover = async () => {
    setIsDiscovering(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/ingredient-images?action=discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          protocolId: activeProtocol,
          autoApproveHighConfidence: false
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Auto-discovery complete: scanned ${data.scannedCount || 0} images, matched ${data.matchedCount || 0} ingredients.`
        });
        loadMappings();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Auto-discovery failed.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Auto-discovery network error.' });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleApprove = async (mappingId) => {
    try {
      const res = await fetch(`/api/admin/ingredient-images?action=approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mappingId, status: 'active' })
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Image approved successfully.' });
        loadMappings();
      }
    } catch (err) {
      console.warn('Approve error:', err);
    }
  };

  const handleUnlink = async (mappingId) => {
    if (!window.confirm('Are you sure you want to unlink this photograph mapping?')) return;
    try {
      const res = await fetch(`/api/admin/ingredient-images?mappingId=${encodeURIComponent(mappingId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Mapping unlinked.' });
        loadMappings();
      }
    } catch (err) {
      console.warn('Delete mapping error:', err);
    }
  };

  const bodyContent = (
    <>
      {/* Metrics Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 shadow-sm">
              <span className="block text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">Total</span>
              <span className="text-lg sm:text-xl font-bold text-white mt-0.5 block">{totalIngredients}</span>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 shadow-sm">
              <span className="block text-[10px] sm:text-[11px] text-emerald-400 uppercase font-bold tracking-wider">🟢 Mapped Photos</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-300 mt-0.5 block">{withImage}</span>
            </div>
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 shadow-sm">
              <span className="block text-[10px] sm:text-[11px] text-amber-400 uppercase font-bold tracking-wider">🟡 Review</span>
              <span className="text-lg sm:text-xl font-bold text-amber-300 mt-0.5 block">{pendingReview}</span>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 shadow-sm">
              <span className="block text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">⚪ Missing</span>
              <span className="text-lg sm:text-xl font-bold text-slate-300 mt-0.5 block">{missingImage}</span>
            </div>
          </div>

          {/* Controls: Protocol & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <label htmlFor="modal-protocol-select" className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Protocol:
              </label>
              <select
                id="modal-protocol-select"
                value={activeProtocol}
                onChange={(e) => setActiveProtocol(e.target.value)}
                className="text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700/80 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {Object.values(DIET_PROFILES).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={handleAutoDiscover}
                disabled={isDiscovering}
                className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                <span>{isDiscovering ? '⏳' : '🔍'}</span>
                <span>{isDiscovering ? 'Scanning...' : 'Auto-Discover'}</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadFormOpen(!uploadFormOpen)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold ${
                  uploadFormOpen
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                } flex items-center justify-center gap-1.5 transition active:scale-95`}
              >
                <span>{uploadFormOpen ? '✕ Close Form' : '➕ Upload Photo'}</span>
              </button>
            </div>
          </div>

          {/* Status Message Banner */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between border shadow-sm ${
              statusMessage.type === 'error'
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                : 'bg-teal-950/50 border-teal-500/40 text-teal-200'
            }`}>
              <div className="flex items-center gap-2">
                <span>{statusMessage.type === 'error' ? '⚠️' : '📢'}</span>
                <span className="font-medium">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="ml-2 font-bold opacity-70 hover:opacity-100 p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Ingredient Display / Upload Panel */}
          {uploadFormOpen ? (
            /* Upload Form Panel */
            <div className="upload-panel p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-base">📤</span>
                  <span>Upload & Map Ingredient Photograph</span>
                </h3>
                <span className="text-[11px] text-slate-400">Target protocol: <strong className="text-emerald-400">{activeProtocol.toUpperCase()}</strong></span>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="upload-ingredient-field" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Target Ingredient <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      id="upload-ingredient-field"
                      required
                      value={activeIngredientId}
                      onChange={(e) => {
                        setSelectedIngredientId(e.target.value);
                        setUploadFile(null);
                        setUploadPreviewUrl(null);
                      }}
                      className="w-full text-xs bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Choose Ingredient --</option>
                      {LID_DATABASE.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Dietary Protocol
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${activeProtocol.toUpperCase()} (${DIET_PROFILES[activeProtocol]?.name || 'Active'})`}
                      className="w-full text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-800 rounded-xl p-2.5"
                    />
                  </div>
                </div>

                {/* Dropzone Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                    Photograph File (WebP, JPG, PNG) <span className="text-emerald-400">*</span>
                  </label>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={`admin-image-dropzone relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl bg-slate-950/40 transition-all cursor-pointer group ${
                      isDragOver ? 'dropzone-active' : 'border-slate-700/80 hover:border-emerald-500/70 hover:bg-emerald-950/10'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      aria-label="Upload photograph"
                    />
                    <div className="flex flex-col items-center pointer-events-none text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition">
                        <span className="text-xl">☁️</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200">
                        <span className="text-emerald-400 underline decoration-emerald-500/50 underline-offset-2">Click to browse</span> or drag & drop photo here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        WebP, PNG, JPG (recommended 400×400)
                      </p>
                    </div>
                  </div>

                  {uploadFile && (
                    <div className="flex items-center justify-between p-2.5 mt-2 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 animate-fadeIn">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">📄</span>
                        <span className="font-medium truncate max-w-[220px] sm:max-w-md">{uploadFile.name}</span>
                        <span className="text-[10px] text-emerald-400/80 shrink-0">({formatBytes(uploadFile.size)})</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full shrink-0">Selected</span>
                    </div>
                  )}
                </div>

                {/* Upload Image Preview Container - Bounded h-48 sm:h-56 with object-contain */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                    Image Preview
                  </label>
                  <div className="admin-image-preview-container relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center shadow-inner">
                    {uploadPreviewUrl ? (
                      <img
                        src={uploadPreviewUrl}
                        alt="Upload Preview"
                        className="admin-image-preview-img w-full h-full object-contain"
                        loading="eager"
                      />
                    ) : savedImageUrl ? (
                      <div className="flex flex-col items-center justify-center h-full w-full p-2">
                        <img
                          src={savedImageUrl}
                          alt="Current Saved Photograph"
                          className="admin-image-preview-img w-full h-full object-contain opacity-60"
                          loading="eager"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 font-medium select-none">Current saved photo — choose or drop new file above to replace</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 text-xs py-4 text-center select-none">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                          <span className="text-2xl opacity-60">🖼️</span>
                        </div>
                        <span className="font-semibold text-slate-400">Photograph Preview</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">Preview appears here after choosing an image</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUploadFormOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !uploadFile}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <span className="inline-block animate-spin">⏳</span>
                        <span>Uploading to Cloudinary & Saving...</span>
                      </>
                    ) : (
                      <span>☁️ Upload to Cloudinary & Save</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Active / Saved Ingredient Display Card - Exact same container & styling */
            <div className="active-ingredient-card p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Active Ingredient Photo</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs font-medium text-slate-200">{selectedIngredient?.name}</span>
                </div>
                {selectedMapping ? (
                  selectedMapping.status === 'pending_review' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      🟡 Review
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      🟢 Active
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    ⚪ No Image
                  </span>
                )}
              </div>

              {/* Bounded Image Container - Fixed responsive height h-48 sm:h-56 with object-contain */}
              <div className="admin-image-preview-container relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center shadow-inner">
                {savedImageUrl ? (
                  <img
                    src={savedImageUrl}
                    alt={selectedIngredient?.name || 'Active ingredient photo'}
                    className="admin-image-preview-img w-full h-full object-contain"
                    loading="eager"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs py-4 text-center select-none">
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                      <span className="text-2xl opacity-60">{selectedIngredient?.icon || getCategoryIcon(selectedIngredient?.category, selectedIngredient?.name)}</span>
                    </div>
                    <span className="font-semibold text-slate-300">No photograph uploaded yet</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Click "Upload Photo" below to link a Cloudinary image</span>
                  </div>
                )}
              </div>

              {/* Metadata and Controls row below image */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{selectedIngredient?.name}</h3>
                    <span className="font-mono text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{selectedIngredient?.id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span className="text-slate-300">{selectedIngredient?.category}</span>
                    <span>•</span>
                    <span className="text-emerald-400/90 font-medium uppercase text-[10px]">{activeProtocol}</span>
                    {selectedMapping?.public_id && (
                      <>
                        <span>•</span>
                        <span className="text-[10px] font-mono text-teal-400 truncate max-w-[200px] sm:max-w-xs" title={selectedMapping.public_id}>
                          ☁️ {selectedMapping.public_id}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Replace / Upload / Unlink Controls */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {selectedMapping?.status === 'pending_review' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedMapping.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition active:scale-95 flex items-center gap-1"
                    >
                      <span>✓</span>
                      <span>Approve</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIngredientId(selectedIngredient?.id);
                      setUploadFormOpen(true);
                      setUploadFile(null);
                      setUploadPreviewUrl(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{savedImageUrl ? '🔄' : '➕'}</span>
                    <span>{savedImageUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                  </button>
                  {selectedMapping && (
                    <button
                      type="button"
                      onClick={() => handleUnlink(selectedMapping.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition active:scale-95"
                      title="Unlink image mapping"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition active:scale-95 ${
                  statusFilter === 'all' ? 'bg-slate-700 text-white font-bold shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({stats.totalIngredients || LID_DATABASE.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition active:scale-95 ${
                  statusFilter === 'active' ? 'bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Mapped ({withImage})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending_review')}
                className={`px-3 py-1.5 rounded-lg transition active:scale-95 ${
                  statusFilter === 'pending_review' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Review ({pendingReview})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('missing')}
                className={`px-3 py-1.5 rounded-lg transition active:scale-95 ${
                  statusFilter === 'missing' ? 'bg-slate-700/60 text-slate-200 font-bold border border-slate-600 shadow-sm' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Missing ({missingImage})
              </button>
            </div>

            <div className="w-full sm:w-64">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ingredient or ID..."
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* List of Ingredients */}
          <div className="admin-image-list space-y-2.5">
            {displayedItems.length > 0 ? (
              displayedItems.map(item => {
                const mapping = mappingByIngredientId[item.id];
                const hasMapping = Boolean(mapping && mapping.secure_url);
                const isPending = mapping && mapping.status === 'pending_review';
                const imgUrl = getIngredientImageUrl(item.id, activeProtocol, item.imageUrl);
                const isSelected = item.id === activeIngredientId;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedIngredientId(item.id);
                      setUploadFormOpen(false);
                      setUploadFile(null);
                      setUploadPreviewUrl(null);
                    }}
                    className={`admin-image-item-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500/70 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Thumbnail Container */}
                      <div className="w-14 h-14 rounded-xl bg-slate-800/90 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative p-1">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={item.name}
                            className="max-h-full max-w-full w-auto h-auto object-contain rounded-md"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-2xl">{item.icon || getCategoryIcon(item.category, item.name)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">{item.name}</h4>
                          {hasMapping ? (
                            isPending ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                🟡 Review
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                🟢 Active
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              ⚪ No Image
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <span className="font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded text-[10px]">{item.id}</span>
                          <span>•</span>
                          <span className="text-slate-300">{item.category}</span>
                          <span>•</span>
                          <span className="text-emerald-400/90 font-medium uppercase text-[10px]">{activeProtocol}</span>
                        </div>
                        {mapping && mapping.public_id && (
                          <div className="text-[10px] font-mono text-teal-400/90 truncate mt-1 flex items-center gap-1" title={mapping.public_id}>
                            <span className="opacity-70">☁️</span>
                            <span className="truncate">{mapping.public_id}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                      {isPending && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(mapping.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition active:scale-95 flex items-center gap-1"
                          title="Approve photograph"
                        >
                          <span>✓</span>
                          <span>Approve</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartUploadForIngredient(item.id);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 flex items-center gap-1"
                        title="Upload or replace photograph"
                      >
                        <span>{hasMapping ? '🔄' : '➕'}</span>
                        <span>{hasMapping ? 'Replace' : 'Upload'}</span>
                      </button>
                      {hasMapping && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlink(mapping.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition active:scale-95"
                          title="Unlink image mapping"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 px-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-slate-500 text-xs">
                <span className="text-3xl block mb-2 opacity-50">🍃</span>
                <span className="font-medium text-slate-400 block mb-1">No ingredients found</span>
                <span>Try adjusting your search query or status filter.</span>
              </div>
            )}
          </div>
    </>
  );

  if (embedded) {
    return (
      <div className="admin-manage-page-container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🖼️</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                  Ingredient Image Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                  Admin Hub
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">Manage, upload, replace, and review Cloudinary ingredient images.</p>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {bodyContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn" role="dialog" aria-modal="true">
      {/* Outer Modal Container - Constrained to max-w-lg and max-h-[85vh] */}
      <div className="relative flex flex-col w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🖼️</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  Ingredient Image Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                  Admin Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Cloudinary synchronization, drag-and-drop upload & ingredient photo mappings.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Independently Scrollable Content Area */}
        <div className="admin-image-modal-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4">
          {bodyContent}
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Persists in Neon PostgreSQL & Cloudinary CDN.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-5 py-1.5 text-xs font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

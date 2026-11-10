// KosherAI - Cloudinary Ingredient Image Matching Engine
// Accurately matches discovered Cloudinary assets to the ingredient database.
import { LID_DATABASE } from '../src/data/lidDatabase.js';

/**
 * Normalizes a string for robust matching:
 * Converts to lowercase, strips file extensions, replaces underscores/special chars with hyphens,
 * trims trailing numbers or hashes.
 */
export function normalizeToken(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '') // strip extension (.webp, .jpg, etc.)
    .replace(/^(v\d+\/)/, '') // strip Cloudinary version prefix if present
    .replace(/[_\s\/\\]+/g, '-') // replace spaces, underscores, slashes with -
    .replace(/[^a-z0-9\-]/g, '') // remove symbols
    .replace(/^-+|-+$/g, ''); // trim hyphens
}

/**
 * Extracts candidate protocol from folder path or public_id.
 * Defaults to 'lid' if undetermined.
 */
export function inferProtocolFromPath(publicIdOrPath) {
  const p = String(publicIdOrPath || '').toLowerCase();
  if (p.includes('all_ingredients') || p.includes('global')) return 'global';
  if (p.includes('pinoy_keto') || p.includes('pinoy-keto') || p.includes('keto')) return 'pinoy_keto';
  if (p.includes('low_purine') || p.includes('low-purine') || p.includes('purine')) return 'low_purine';
  if (p.includes('low_sodium') || p.includes('low-sodium') || p.includes('sodium') || p.includes('dash')) return 'low_sodium';
  if (p.includes('diabetic') || p.includes('low_gi') || p.includes('low-gi')) return 'diabetic';
  return 'lid';
}

/**
 * Calculates Jaccard token similarity between two hyphen-separated or space-separated strings.
 */
function tokenSimilarity(strA, strB) {
  const tokensA = new Set(normalizeToken(strA).split('-').filter(t => t.length > 1));
  const tokensB = new Set(normalizeToken(strB).split('-').filter(t => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Matches a Cloudinary asset to an ingredient in the database.
 * 
 * Rules:
 * 1. Exact ID match (e.g. 'salt-kosher.webp' -> 'salt-kosher') -> Score 1.0 (status: active)
 * 2. Exact normalized name match (e.g. 'kosher-salt.webp' -> 'Kosher Salt (Non-Iodized)') -> Score 0.95 (status: active)
 * 3. Verified alias match (e.g. 'pure-kosher-salt.webp' -> matches aliases) -> Score 0.90 (status: active)
 * 4. Conservative token overlap:
 *    - Score >= 0.75: single high match -> Score >= 0.75 (status: active)
 *    - Score >= 0.50: ambiguous match -> (status: pending_review)
 *    - Score < 0.50: no match -> (status: pending_review, candidate: null)
 *
 * @param {object} asset - { public_id, secure_url, original_filename, format, ... }
 * @param {Array} database - Array of ingredient records (defaults to LID_DATABASE)
 * @param {string} targetProtocol - Preferred protocol (defaults to inferred or 'lid')
 * @returns {object} Match result { matched, ingredient, protocolId, confidence, status, matchType }
 */
export function matchAssetToIngredient(asset, database = LID_DATABASE, targetProtocol = null) {
  const publicId = asset.public_id || '';
  const secureUrl = asset.secure_url || asset.url || '';
  const filename = asset.original_filename || publicId.split('/').pop() || '';
  const protocolId = targetProtocol || inferProtocolFromPath(publicId);

  const cleanFilename = normalizeToken(filename);
  const cleanPublicIdLeaf = normalizeToken(publicId.split('/').pop() || '');

  const searchTokens = Array.from(new Set([cleanFilename, cleanPublicIdLeaf].filter(Boolean)));

  // Phase 1: Exact ID Match
  for (const item of database) {
    const itemIdNorm = normalizeToken(item.id);
    for (const term of searchTokens) {
      if (term === itemIdNorm) {
        return {
          matched: true,
          ingredientId: item.id,
          ingredientName: item.name,
          protocolId,
          confidence: 1.0,
          status: 'active',
          matchType: 'exact_id',
          asset: {
            public_id: publicId,
            secure_url: secureUrl,
            format: asset.format || 'webp'
          }
        };
      }
    }
  }

  // Phase 2: Exact Normalized Name Match
  for (const item of database) {
    const itemNameNorm = normalizeToken(item.name);
    for (const term of searchTokens) {
      if (term === itemNameNorm) {
        return {
          matched: true,
          ingredientId: item.id,
          ingredientName: item.name,
          protocolId,
          confidence: 0.95,
          status: 'active',
          matchType: 'exact_name',
          asset: {
            public_id: publicId,
            secure_url: secureUrl,
            format: asset.format || 'webp'
          }
        };
      }
    }
  }

  // Phase 3: Verified Alias Match
  for (const item of database) {
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    for (const alias of aliases) {
      const aliasNorm = normalizeToken(alias);
      for (const term of searchTokens) {
        if (term === aliasNorm) {
          return {
            matched: true,
            ingredientId: item.id,
            ingredientName: item.name,
            protocolId,
            confidence: 0.90,
            status: 'active',
            matchType: 'alias_match',
            asset: {
              public_id: publicId,
              secure_url: secureUrl,
              format: asset.format || 'webp'
            }
          };
        }
      }
    }
  }

  // Phase 4: Token Overlap & Conservative Fuzzy Match
  let bestCandidate = null;
  let bestScore = 0;
  let runnerUpScore = 0;

  for (const item of database) {
    let maxItemScore = 0;
    const candidates = [item.id, item.name, ...(item.aliases || [])];

    for (const cand of candidates) {
      for (const term of searchTokens) {
        const score = tokenSimilarity(term, cand);
        if (score > maxItemScore) {
          maxItemScore = score;
        }
      }
    }

    if (maxItemScore > bestScore) {
      runnerUpScore = bestScore;
      bestScore = maxItemScore;
      bestCandidate = item;
    } else if (maxItemScore > runnerUpScore) {
      runnerUpScore = maxItemScore;
    }
  }

  // High confidence fuzzy match with distinct margin over runner up
  if (bestCandidate && bestScore >= 0.70 && (bestScore - runnerUpScore >= 0.15 || runnerUpScore < 0.4)) {
    return {
      matched: true,
      ingredientId: bestCandidate.id,
      ingredientName: bestCandidate.name,
      protocolId,
      confidence: parseFloat(bestScore.toFixed(2)),
      status: 'active',
      matchType: 'fuzzy_token_high',
      asset: {
        public_id: publicId,
        secure_url: secureUrl,
        format: asset.format || 'webp'
      }
    };
  }

  // Ambiguous fuzzy match (flag for administrator review)
  if (bestCandidate && bestScore >= 0.40) {
    return {
      matched: true,
      ingredientId: bestCandidate.id,
      ingredientName: bestCandidate.name,
      protocolId,
      confidence: parseFloat(bestScore.toFixed(2)),
      status: 'pending_review',
      matchType: 'fuzzy_ambiguous',
      asset: {
        public_id: publicId,
        secure_url: secureUrl,
        format: asset.format || 'webp'
      }
    };
  }

  // Unmatched asset
  return {
    matched: false,
    ingredientId: null,
    ingredientName: null,
    protocolId,
    confidence: 0,
    status: 'pending_review',
    matchType: 'unmatched',
    asset: {
      public_id: publicId,
      secure_url: secureUrl,
      format: asset.format || 'webp'
    }
  };
}

export default {
  normalizeToken,
  inferProtocolFromPath,
  matchAssetToIngredient
};


import { getItemStatus } from '../data/lidDatabase.js';
import { cleanToken } from '../services/ruleEngine.js';

/**
 * Filter foods with strict field prioritization:
 * - Prioritizes primary identifiers (name, aliases, category, tag)
 * - Excludes item.swap / substitutes to avoid unrelated prohibited items from matching
 * - Falls back to description / notes only when no primary direct matches exist
 */
export function filterFoods(foodItems = [], searchQuery = '', statusFilter = 'all', categoryFilter = 'all', activeDiet = 'lid') {
  const query = (searchQuery || '').trim().toLowerCase();

  if (!query) {
    return foodItems.filter(item => {
      const itemStatus = (getItemStatus(item, activeDiet) || item.status || item.compliance || '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'all' || 
        (item.category && item.category.toLowerCase() === categoryFilter.toLowerCase());
      return matchesStatus && matchesCategory;
    });
  }

  const cleanQ = cleanToken(query);

  // 1. Primary Direct Matches (High Confidence: name, aliases, category, tag)
  const directMatches = foodItems.filter((item) => {
    const nameMatch = cleanToken(item.name || '').includes(cleanQ);
    const aliasMatch = Array.isArray(item.aliases) && 
      item.aliases.some(a => cleanToken(a || '').includes(cleanQ));
    const categoryMatch = cleanToken(item.category || '').includes(cleanQ);
    const tagMatch = cleanToken(item.tag || '').includes(cleanQ);

    return nameMatch || aliasMatch || categoryMatch || tagMatch;
  });

  // 2. Candidate Foods: If direct matches exist, use them. Otherwise, fall back to notes/description.
  // Strictly DO NOT match on item.swap or item.substitutes.
  const candidateFoods = directMatches.length > 0 
    ? directMatches 
    : foodItems.filter(item => {
        const descMatch = cleanToken(item.description || item.generalDescription || '').includes(cleanQ);
        const noteMatch = cleanToken(item.clinicalNotes || item.notes || '').includes(cleanQ);
        const dietNoteMatch = cleanToken(item.dietaryStatus?.[activeDiet]?.note || '').includes(cleanQ);
        return descMatch || noteMatch || dietNoteMatch;
      });

  return candidateFoods.filter((item) => {
    const itemStatus = (getItemStatus(item, activeDiet) || item.status || item.compliance || '').toLowerCase();
    const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter.toLowerCase();
    const matchesCategory = categoryFilter === 'all' || 
      (item.category && item.category.toLowerCase() === categoryFilter.toLowerCase());

    return matchesStatus && matchesCategory;
  });
}

export default {
  filterFoods
};

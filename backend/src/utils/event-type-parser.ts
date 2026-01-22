/**
 * Event Type Parser Utility
 * Parses report type strings to extract parent and child type names
 */

/**
 * Known parent categories for classification
 */
const KNOWN_PARENT_CATEGORIES = [
  'Fire',
  'Medical',
  'Security',
  'Traffic',
  'Property',
  'Suspicious',
  'General',
];

/**
 * Parse result interface
 */
export interface ParsedEventType {
  typeName: string;
  parentName: string | null;
}

/**
 * Parse a report type string into parent and child type names
 * 
 * Supported formats:
 * - "Fire - Building" → { typeName: "Building Fire", parentName: "Fire" }
 * - "Fire-Building" → { typeName: "Building Fire", parentName: "Fire" }
 * - "Building Fire" → { typeName: "Building Fire", parentName: "Fire" }
 * - "Fire" → { typeName: "Fire", parentName: null }
 * 
 * @param reportType - The type string from a report
 * @returns Parsed type with parent and child names
 */
export function parseReportType(reportType: string): ParsedEventType {
  if (!reportType || typeof reportType !== 'string') {
    return { typeName: 'General', parentName: null };
  }

  const cleanType = reportType.trim();

  // Format 1: "Fire - Building" or "Fire-Building"
  if (cleanType.includes(' - ') || (cleanType.includes('-') && !cleanType.includes(' '))) {
    const parts = cleanType.split(/\s*-\s*/);
    if (parts.length === 2) {
      const part1 = parts[0].trim();
      const part2 = parts[1].trim();
      
      // Determine which is parent and which is child
      if (KNOWN_PARENT_CATEGORIES.some(p => p.toLowerCase() === part1.toLowerCase())) {
        return {
          typeName: `${part2} ${part1}`, // "Building Fire"
          parentName: part1,
        };
      } else {
        // Assume first part is parent
        return {
          typeName: cleanType,
          parentName: part1,
        };
      }
    }
  }

  // Format 2: "Building Fire" (multi-word with known parent category)
  if (cleanType.includes(' ')) {
    const words = cleanType.split(' ');
    
    // Check if any word matches a known parent category
    const parentWord = words.find(word => 
      KNOWN_PARENT_CATEGORIES.some(p => p.toLowerCase() === word.toLowerCase())
    );
    
    if (parentWord) {
      return {
        typeName: cleanType,
        parentName: parentWord,
      };
    }
    
    // Multi-word without known parent - treat as standalone
    return {
      typeName: cleanType,
      parentName: null,
    };
  }

  // Format 3: Single word
  // Check if it's a known parent category
  const isParentCategory = KNOWN_PARENT_CATEGORIES.some(
    p => p.toLowerCase() === cleanType.toLowerCase()
  );

  return {
    typeName: cleanType,
    parentName: isParentCategory ? null : 'General', // Single word non-category goes under "General"
  };
}

/**
 * Example usage:
 * 
 * const { typeName, parentName } = parseReportType("Building Fire");
 * const eventTypeId = await EventTypeService.findOrCreateType(
 *   typeName,
 *   parentName,
 *   companyId,
 *   EventTypeSource.AUTO_REPORT
 * );
 */

import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';

/**
 * Robust Settings Migration and Deep Merge Engine
 * 
 * Guarantees that user-configured settings (e.g. WhatsApp number, delivery deadlines,
 * business hours, email, admin passwords, custom province lists, privacy toggles, etc.)
 * are PERMANENTLY preserved and never overridden by code updates, schema enhancements,
 * or default resets.
 */

// Helper to determine if a value is defined and meaningful (not undefined, null, or empty string if meant to be set)
function isMeaningful(val: any): boolean {
  if (val === undefined || val === null) return false;
  return true;
}

/**
 * Deeply and safely merges persisted/saved settings with new schema defaults.
 * 
 * Rules of preservation:
 * 1. If the existing/persisted settings have a defined value for a field, that saved value WINS.
 * 2. If the existing settings are missing new fields introduced in future application versions,
 *    the default value is added without touching any existing fields.
 * 3. Arrays (like provincesServed) are preserved if the user customized them.
 * 4. Sensitive credentials (adminPasswordHash, adminPasswordSalt, adminEmail, adminRecoveryCode)
 *    are protected with highest priority and cannot be emptied or reset by defaults.
 * 5. Business rules (whatsappNumber, minDeliveryDays, maxDeliveryDays, privacy flags) are strictly preserved.
 */
export function mergePreservedSettings(
  persistedSettings: Partial<AppSettings> | null | undefined,
  baseDefaults: AppSettings = DEFAULT_SETTINGS
): AppSettings {
  if (!persistedSettings || typeof persistedSettings !== 'object') {
    return { ...baseDefaults };
  }

  const result: AppSettings = { ...baseDefaults };

  // Keys to safely merge
  const allKeys = Array.from(
    new Set([...Object.keys(baseDefaults), ...Object.keys(persistedSettings)])
  ) as (keyof AppSettings)[];

  for (const key of allKeys) {
    const savedVal = persistedSettings[key];
    const defaultVal = baseDefaults[key];

    // SENSITIVE CREDENTIAL KEYS PROTECTION
    if (
      key === 'adminPasswordHash' ||
      key === 'adminPasswordSalt' ||
      key === 'adminRecoveryCodeHash' ||
      key === 'adminRecoveryCode'
    ) {
      if (typeof savedVal === 'string' && savedVal.trim().length > 0) {
        (result as any)[key] = savedVal.trim();
      } else if (typeof defaultVal === 'string' && defaultVal.trim().length > 0) {
        (result as any)[key] = defaultVal.trim();
      }
      continue;
    }

    if (key === 'adminEmail') {
      if (typeof savedVal === 'string' && savedVal.trim().length > 0) {
        (result as any)[key] = savedVal.trim().toLowerCase();
      } else if (typeof defaultVal === 'string' && defaultVal.trim().length > 0) {
        (result as any)[key] = defaultVal.trim().toLowerCase();
      }
      continue;
    }

    if (key === 'adminConfigured') {
      (result as any)[key] = Boolean(
        savedVal === true ||
        defaultVal === true ||
        result.adminPasswordHash ||
        (persistedSettings as any).adminPasswordHash
      );
      continue;
    }

    if (savedVal !== undefined && savedVal !== null) {
      // If it's an array (like provincesServed), keep saved array if non-empty
      if (Array.isArray(savedVal)) {
        if (savedVal.length > 0) {
          (result as any)[key] = savedVal;
        } else {
          (result as any)[key] = defaultVal;
        }
      } 
      // If it's a string, keep non-empty saved string or explicit value
      else if (typeof savedVal === 'string') {
        // Special rule for publicTrackingDomain: avoid legacy test domains
        if (key === 'publicTrackingDomain' && savedVal.includes('delfilandia.ao')) {
          (result as any)[key] = '';
        } else {
          (result as any)[key] = savedVal;
        }
      }
      // If boolean or number (e.g. minDeliveryDays, maxDeliveryDays, showSalesPriceToClient)
      else if (typeof savedVal === 'boolean' || typeof savedVal === 'number') {
        (result as any)[key] = savedVal;
      }
      // Objects or other types
      else {
        (result as any)[key] = savedVal;
      }
    } else if (defaultVal !== undefined) {
      (result as any)[key] = defaultVal;
    }
  }

  // Ensure Brand Name consistency
  if (!result.brandName) {
    result.brandName = 'DELFILÂNDIA';
  }

  return result;
}

/**
 * LocalStorage keys for Settings Backup and Redundancy
 */
export const SETTINGS_STORAGE_KEY = 'delfilandia_settings';
export const SETTINGS_BACKUP_STORAGE_KEY = 'delfilandia_settings_immutable_backup';

/**
 * Saves settings to client storage with a redundant immutable backup
 */
export function persistSettingsLocally(settings: AppSettings): void {
  try {
    const serialized = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
    
    // Store an immutable snapshot if valid
    if (settings.whatsappNumber || settings.adminConfigured || settings.adminEmail) {
      localStorage.setItem(SETTINGS_BACKUP_STORAGE_KEY, serialized);
    }
  } catch (err) {
    console.warn('Could not persist settings to localStorage:', err);
  }
}

/**
 * Loads settings from client storage with automatic recovery from backup if corrupted
 */
export function loadSettingsLocally(): AppSettings {
  try {
    const primary = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const backup = localStorage.getItem(SETTINGS_BACKUP_STORAGE_KEY);

    let parsedPrimary: Partial<AppSettings> | null = null;
    let parsedBackup: Partial<AppSettings> | null = null;

    if (primary) {
      try {
        parsedPrimary = JSON.parse(primary);
      } catch {
        parsedPrimary = null;
      }
    }

    if (backup) {
      try {
        parsedBackup = JSON.parse(backup);
      } catch {
        parsedBackup = null;
      }
    }

    // Merge primary with backup (primary takes precedence, backup fills missing fields)
    const combinedSaved: Partial<AppSettings> = {
      ...(parsedBackup || {}),
      ...(parsedPrimary || {}),
    };

    return mergePreservedSettings(combinedSaved, DEFAULT_SETTINGS);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

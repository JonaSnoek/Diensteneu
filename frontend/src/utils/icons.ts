import * as LucideIcons from 'lucide-react';
import React from 'react';

export const getIconComponent = (name: string): React.ComponentType<any> => {
  if (!name) return LucideIcons.Link;

  // Convert dash-case/snake_case to CamelCase
  // E.g. "external-link" -> "ExternalLink"
  // E.g. "database_sync" -> "DatabaseSync"
  const formattedName = name
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // Attempt to resolve
  const Icon = 
    (LucideIcons as any)[formattedName] || 
    (LucideIcons as any)[name] || 
    (LucideIcons as any)[name.charAt(0).toUpperCase() + name.slice(1)] ||
    LucideIcons.Link;

  return Icon;
};

// Export a list of common icons for the tile dropdown chooser
export const COMMON_ICONS = [
  'link',
  'calculator',
  'database',
  'users',
  'settings',
  'file-text',
  'key',
  'activity',
  'globe',
  'package',
  'terminal',
  'server',
  'shield',
  'folder',
  'help-circle',
  'cpu',
  'wifi',
  'mail',
  'calendar',
  'book-open',
  'chart-pie',
  'lock'
];

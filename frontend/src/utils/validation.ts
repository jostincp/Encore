// Utilidades de validación para Encore

/**
 * Valida número de mesa
 */
export const validateTableNumber = (tableNumber: number): boolean => {
  return Number.isInteger(tableNumber) && tableNumber > 0 && tableNumber <= 100;
};

/**
 * Valida cantidad de puntos
 */
export const validatePoints = (points: number): boolean => {
  return Number.isInteger(points) && points >= 0;
};

/**
 * Valida precio
 */
export const validatePrice = (price: number): boolean => {
  return typeof price === 'number' && price >= 0 && Number.isFinite(price);
};

/**
 * Valida URL de imagen
 */
export const validateImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

/**
 * Valida duración de canción (en segundos)
 */
export const validateSongDuration = (duration: number): boolean => {
  return Number.isInteger(duration) && duration > 0 && duration <= 3600; // Máximo 1 hora
};

/**
 * Valida nombre de producto del menú
 */
export const validateMenuItemName = (name: string): boolean => {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;
};

/**
 * Valida descripción de producto
 */
export const validateDescription = (description: string): boolean => {
  return typeof description === 'string' && description.trim().length <= 500;
};

/**
 * Valida categoría de menú
 */
export const validateMenuCategory = (category: string): boolean => {
  const validCategories = ['bebidas', 'comidas', 'postres', 'especiales'];
  return validCategories.includes(category);
};

/**
 * Valida cantidad en carrito
 */
export const validateCartQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 20;
};

/**
 * Valida título de canción
 */
export const validateSongTitle = (title: string): boolean => {
  return typeof title === 'string' && title.trim().length >= 1 && title.trim().length <= 200;
};

/**
 * Valida nombre de artista
 */
export const validateArtistName = (artist: string): boolean => {
  return typeof artist === 'string' && artist.trim().length >= 1 && artist.trim().length <= 100;
};

/**
 * Valida ID único
 */
export const validateId = (id: string): boolean => {
  return typeof id === 'string' && id.trim().length > 0;
};

/**
 * Valida estado de cola
 */
export const validateQueueStatus = (status: string): boolean => {
  const validStatuses = ['pending', 'approved', 'rejected', 'playing', 'completed'];
  return validStatuses.includes(status);
};

/**
 * Valida estado de pedido
 */
export const validateOrderStatus = (status: string): boolean => {
  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
  return validStatuses.includes(status);
};

/**
 * Valida tipo de transacción de puntos
 */
export const validateTransactionType = (type: string): boolean => {
  return ['earned', 'spent'].includes(type);
};

/**
 * Valida proveedor de música
 */
export const validateMusicProvider = (provider: string): boolean => {
  return ['youtube', 'spotify'].includes(provider);
};

/**
 * Valida configuración de bar
 */
export const validateBarConfig = (config: unknown): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Configuración de bar inválida');
    return { isValid: false, errors };
  }
  
  const barConfig = config as {
    id?: string;
    name?: string;
    musicProvider?: { type?: string };
    pointsPerEuro?: number;
    songBaseCost?: number;
    priorityMultiplier?: number;
    welcomeBonus?: number;
    maxSongsPerTable?: number;
  };
  
  if (!barConfig.id || !validateId(barConfig.id)) {
    errors.push('ID de bar inválido');
  }
  
  if (!barConfig.name || typeof barConfig.name !== 'string' || barConfig.name.trim().length < 2) {
    errors.push('Nombre de bar debe tener al menos 2 caracteres');
  }
  
  if (!barConfig.musicProvider || !barConfig.musicProvider.type || !validateMusicProvider(barConfig.musicProvider.type)) {
    errors.push('Proveedor de música inválido');
  }
  
  if (barConfig.pointsPerEuro === undefined || !validatePoints(barConfig.pointsPerEuro)) {
    errors.push('Puntos por euro debe ser un número entero positivo');
  }
  
  if (barConfig.songBaseCost === undefined || !validatePoints(barConfig.songBaseCost)) {
    errors.push('Costo base de canción debe ser un número entero positivo');
  }
  
  if (typeof barConfig.priorityMultiplier !== 'number' || barConfig.priorityMultiplier < 1) {
    errors.push('Multiplicador de prioridad debe ser mayor o igual a 1');
  }
  
  if (barConfig.welcomeBonus === undefined || !validatePoints(barConfig.welcomeBonus)) {
    errors.push('Bono de bienvenida debe ser un número entero positivo o cero');
  }
  
  if (barConfig.maxSongsPerTable === undefined || !Number.isInteger(barConfig.maxSongsPerTable) || barConfig.maxSongsPerTable < 1) {
    errors.push('Máximo de canciones por mesa debe ser un número entero positivo');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida item del menú completo
 */
export const validateMenuItem = (item: unknown): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!item || typeof item !== 'object') {
    errors.push('Item de menú inválido');
    return { isValid: false, errors };
  }
  
  const menuItem = item as {
    id?: string;
    name?: string;
    description?: string;
    price?: number;
    pointsReward?: number;
    category?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  };
  
  if (!menuItem.id || !validateId(menuItem.id)) {
    errors.push('ID de item inválido');
  }
  
  if (!menuItem.name || !validateMenuItemName(menuItem.name)) {
    errors.push('Nombre debe tener entre 2 y 100 caracteres');
  }
  
  if (menuItem.description && !validateDescription(menuItem.description)) {
    errors.push('Descripción no puede exceder 500 caracteres');
  }
  
  if (menuItem.price === undefined || !validatePrice(menuItem.price)) {
    errors.push('Precio debe ser un número positivo');
  }
  
  if (menuItem.pointsReward === undefined || !validatePoints(menuItem.pointsReward)) {
    errors.push('Recompensa de puntos debe ser un número entero positivo o cero');
  }
  
  if (!menuItem.category || !validateMenuCategory(menuItem.category)) {
    errors.push('Categoría inválida');
  }
  
  if (menuItem.imageUrl && !validateImageUrl(menuItem.imageUrl)) {
    errors.push('URL de imagen inválida');
  }
  
  if (typeof menuItem.isAvailable !== 'boolean') {
    errors.push('Disponibilidad debe ser verdadero o falso');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida canción completa
 */
export const validateSong = (song: unknown): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!song || typeof song !== 'object') {
    errors.push('Canción inválida');
    return { isValid: false, errors };
  }
  
  const songItem = song as {
    id?: string;
    title?: string;
    artist?: string;
    duration?: number;
    thumbnailUrl?: string;
    pointsCost?: number;
  };
  
  if (!songItem.id || !validateId(songItem.id)) {
    errors.push('ID de canción inválido');
  }
  
  if (!songItem.title || !validateSongTitle(songItem.title)) {
    errors.push('Título debe tener entre 1 y 200 caracteres');
  }
  
  if (!songItem.artist || !validateArtistName(songItem.artist)) {
    errors.push('Artista debe tener entre 1 y 100 caracteres');
  }
  
  if (songItem.duration === undefined || !validateSongDuration(songItem.duration)) {
    errors.push('Duración debe ser un número entero positivo (máximo 3600 segundos)');
  }
  
  if (!songItem.thumbnailUrl || !validateImageUrl(songItem.thumbnailUrl)) {
    errors.push('URL de miniatura inválida');
  }
  
  if (songItem.pointsCost === undefined || !validatePoints(songItem.pointsCost)) {
    errors.push('Costo en puntos debe ser un número entero positivo');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitiza entrada de texto
 */
export const sanitizeText = (text: string): string => {
  return text.trim().replace(/[<>"'&]/g, '');
};

/**
 * Valida y sanitiza búsqueda
 */
export const validateAndSanitizeSearch = (query: string): { isValid: boolean; sanitized: string } => {
  const sanitized = sanitizeText(query);
  const isValid = sanitized.length >= 1 && sanitized.length <= 100;
  
  return { isValid, sanitized };
};
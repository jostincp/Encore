'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  Star, 
  DollarSign, 
  Tag, 
  ChefHat, 
  Coffee, 
  IceCream,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AdminLayout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/format';
import { MenuItem } from '@/types';
import { API_URLS, API_ENDPOINTS } from '@/utils/constants';

interface Category {
  id: string;
  name: string;
  icon?: any;
  description?: string;
}

export default function AdminMenuPage() {
  const { user, setUser } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  
  // State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [barId, setBarId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Authentication and Data Loading
  useEffect(() => {
    const initPage = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('encore_access_token') : null;
      
      if (!token) {
        // router.push('/'); // Comentado para debugging
        return;
      }

      try {
        // 1. Get User Profile & Bar ID
        const profileRes = await fetch(`${API_ENDPOINTS.base}/api/auth/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profileData = await profileRes.json();
        const userData = profileData.data || profileData;
        
        if (!user) {
          setUser({
            id: userData.id,
            email: userData.email,
            role: userData.role,
            points: 0
          } as any);
        }

        // Get Bar ID (assuming owner has one bar)
        const barsRes = await fetch(`${API_ENDPOINTS.base}/api/bars/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (barsRes.ok) {
          const barsData = await barsRes.json();
          const myBar = barsData.data?.bars?.[0];
          if (myBar) {
            setBarId(myBar.id);
            await loadMenuData(myBar.id, token);
          }
        }
      } catch (error) {
        console.error('Error initializing menu page:', error);
        showErrorToast('Error al cargar datos del menú');
      } finally {
        setIsLoading(false);
      }
    };

    initPage();
  }, []);

  const loadMenuData = async (currentBarId: string, token: string) => {
    try {
      // 2. Fetch Categories
      const catsRes = await fetch(`${API_URLS.menuBase}/bars/${currentBarId}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let fetchedCategories: Category[] = [];
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        fetchedCategories = catsData.data?.categories || [];
        setCategories(fetchedCategories);
      }

      // 3. Fetch Menu Items
      const menuRes = await fetch(`${API_URLS.menuBase}/bars/${currentBarId}/menu?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        const items = menuData.data?.items || [];
        
        // Map backend items to frontend MenuItem type
        const mappedItems: MenuItem[] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          pointsReward: item.points_reward || Math.floor(Number(item.price) * 0.01),
          category: item.category_id, // This is UUID now
          imageUrl: item.image_url,
          isAvailable: item.is_available,
          ingredients: item.ingredients || []
        }));
        
        setMenuItems(mappedItems);
      }
    } catch (error) {
      console.error('Error loading menu data:', error);
      showErrorToast('Error al cargar el menú');
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    if (!barId) return;
    
    // Optimistic update
    const previousItems = [...menuItems];
    setMenuItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i
    ));

    try {
      const token = localStorage.getItem('encore_access_token');
      const res = await fetch(`${API_URLS.menuBase}/bars/${barId}/menu/${item.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_available: !item.isAvailable })
      });

      if (!res.ok) throw new Error('Failed to update');
      
      showSuccessToast(`${item.name} ${!item.isAvailable ? 'habilitado' : 'deshabilitado'}`);
    } catch (error) {
      setMenuItems(previousItems); // Revert
      showErrorToast('Error al actualizar disponibilidad');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!barId || !confirm('¿Estás seguro de eliminar este item?')) return;

    try {
      const token = localStorage.getItem('encore_access_token');
      const res = await fetch(`${API_URLS.menuBase}/bars/${barId}/menu/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete');

      setMenuItems(prev => prev.filter(item => item.id !== itemId));
      showSuccessToast('Item eliminado del menú');
    } catch (error) {
      showErrorToast('Error al eliminar item');
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setSelectedItem(item);
    setEditForm(item);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!barId || !editForm.name || !editForm.price || !editForm.category) {
      showErrorToast('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('encore_access_token');
      const isNew = !selectedItem || selectedItem.id.startsWith('temp-');
      
      const endpoint = isNew 
        ? `${API_URLS.menuBase}/bars/${barId}/menu`
        : `${API_URLS.menuBase}/bars/${barId}/menu/${selectedItem.id}`;
      
      const method = isNew ? 'POST' : 'PUT';
      
      const payload = {
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        category_id: editForm.category,
        image_url: editForm.imageUrl,
        is_available: editForm.isAvailable,
        ingredients: editForm.ingredients,
        points_reward: editForm.pointsReward
      };

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error saving item');
      }

      const savedItemData = await res.json();
      const savedItem = savedItemData.data?.item || savedItemData.data;

      // Map back to frontend model
      const mappedItem: MenuItem = {
        id: savedItem.id,
        name: savedItem.name,
        description: savedItem.description,
        price: Number(savedItem.price),
        pointsReward: savedItem.points_reward,
        category: savedItem.category_id,
        imageUrl: savedItem.image_url,
        isAvailable: savedItem.is_available,
        ingredients: savedItem.ingredients || []
      };

      if (isNew) {
        setMenuItems(prev => [mappedItem, ...prev]);
      } else {
        setMenuItems(prev => prev.map(item => item.id === mappedItem.id ? mappedItem : item));
      }
      
      setIsEditing(false);
      setSelectedItem(null);
      setEditForm({});
      showSuccessToast('Item guardado correctamente');
    } catch (error) {
      console.error(error);
      showErrorToast('Error al guardar item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!barId || !newCategoryName.trim()) return;
    
    try {
      const token = localStorage.getItem('encore_access_token');
      const res = await fetch(`${API_URLS.menuBase}/bars/${barId}/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newCategoryName, is_active: true })
      });

      if (!res.ok) throw new Error('Failed to create category');
      
      const data = await res.json();
      const newCat = data.data?.category || data.data;
      
      setCategories(prev => [...prev, { id: newCat.id, name: newCat.name }]);
      setNewCategoryName('');
      showSuccessToast('Categoría creada');
    } catch (error) {
      showErrorToast('Error al crear categoría');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!barId || !confirm('¿Eliminar categoría? Esto podría fallar si tiene items asociados.')) return;
    
    try {
      const token = localStorage.getItem('encore_access_token');
      const res = await fetch(`${API_URLS.menuBase}/bars/${barId}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete');
      
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      showSuccessToast('Categoría eliminada');
    } catch (error) {
      showErrorToast('Error al eliminar categoría (¿tiene items?)');
    }
  };

  const handleAddNewItem = () => {
    const newItem: MenuItem = {
      id: `temp-${Date.now()}`,
      name: '',
      description: '',
      price: 0,
      pointsReward: 0,
      category: categories[0]?.id || '',
      imageUrl: '',
      isAvailable: true,
      ingredients: []
    };
    
    setSelectedItem(newItem); // Mark as selected so handleSave knows it's being edited
    setEditForm(newItem);
    setIsEditing(true);
  };

  const getCategoryIcon = (categoryId: string) => {
    // Default icons mapping if category doesn't have one
    const category = categories.find(c => c.id === categoryId);
    if (category?.name.toLowerCase().includes('bebida')) return Coffee;
    if (category?.name.toLowerCase().includes('postre')) return IceCream;
    if (category?.name.toLowerCase().includes('especial')) return Star;
    return ChefHat;
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => {
    const CategoryIcon = getCategoryIcon(item.category);
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`border rounded-lg overflow-hidden hover:shadow-lg transition-all ${
          !item.isAvailable ? 'opacity-60' : ''
        }`}
      >
        <div className="relative">
          <Image
            src={item.imageUrl || '/placeholder-food.jpg'}
            alt={item.name}
            width={400}
            height={192}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            {!item.isAvailable && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                No disponible
              </Badge>
            )}
          </div>
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-black/70 text-white">
              <CategoryIcon className="h-3 w-3 mr-1" />
              {getCategoryName(item.category)}
            </Badge>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-lg">{item.name}</h3>
          </div>
          
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
            {item.description || 'Sin descripción'}
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span className="font-semibold text-foreground">{formatPrice(item.price)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditItem(item)}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant={item.isAvailable ? "outline" : "default"}
              size="sm"
              onClick={() => handleToggleAvailability(item)}
            >
              {item.isAvailable ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteItem(item.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesAvailability = 
      availabilityFilter === 'all' || 
      (availabilityFilter === 'available' && item.isAvailable) ||
      (availabilityFilter === 'unavailable' && !item.isAvailable);
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageContainer className="p-6">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ChefHat className="h-8 w-8 text-primary" />
                Gestión del Menú
              </h1>
              <p className="text-muted-foreground mt-1">
                Administra los items del menú del restaurante
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} disabled={!barId}>
            <Tag className="h-4 w-4 mr-2" />
            Gestionar Categorías
          </Button>
          <Button onClick={handleAddNewItem} disabled={!barId}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Item
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{menuItems.length}</p>
                </div>
                <ChefHat className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disponibles</p>
                  <p className="text-2xl font-bold text-green-600">
                    {menuItems.filter(i => i.isAvailable).length}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">No Disponibles</p>
                  <p className="text-2xl font-bold text-red-600">
                    {menuItems.filter(i => !i.isAvailable).length}
                  </p>
                </div>
                <EyeOff className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categorías</p>
                  <p className="text-2xl font-bold">{categories.length}</p>
                </div>
                <Tag className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar items del menú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(category => {
                const Icon = getCategoryIcon(category.id);
                return (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {category.name}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="unavailable">No disponibles</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Menu Items Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <AnimatePresence>
            {filteredItems.map(item => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredItems.length === 0 && (
          <motion.div
            className="text-center py-12 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No hay items que coincidan</p>
            <p className="text-sm">
              {categories.length === 0 ? '¡Primero crea algunas categorías!' : 'Intenta ajustar los filtros de búsqueda'}
            </p>
          </motion.div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedItem?.id.startsWith('temp-') ? 'Agregar Nuevo Item' : 'Editar Item del Menú'}
              </DialogTitle>
            </DialogHeader>
            
            {editForm && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre del item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Precio *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={editForm.price || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                      placeholder="Precio en COP"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción del item"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="category">Categoría *</Label>
                    {categories.length > 0 ? (
                      <Select
                        value={editForm.category || ''}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => {
                            const Icon = getCategoryIcon(category.id);
                            return (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {category.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-red-500 mt-2">No hay categorías disponibles</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="pointsReward">Puntos de Recompensa</Label>
                    <Input
                      id="pointsReward"
                      type="number"
                      value={editForm.pointsReward || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pointsReward: Number(e.target.value) }))}
                      placeholder="Puntos"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="imageUrl">URL de Imagen</Label>
                  <Input
                    id="imageUrl"
                    value={editForm.imageUrl || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="URL de la imagen"
                  />
                </div>

                {/* Availability */}
                <div className="space-y-4">
                  <h4 className="font-medium">Disponibilidad</h4>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="available"
                      checked={editForm.isAvailable !== false}
                      onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isAvailable: checked }))}
                    />
                    <Label htmlFor="available">Disponible</Label>
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <Label htmlFor="ingredients">Ingredientes (separados por coma)</Label>
                  <Textarea
                    id="ingredients"
                    value={editForm.ingredients?.join(', ') || ''}
                    onChange={(e) => setEditForm(prev => ({ 
                      ...prev, 
                      ingredients: e.target.value.split(',').map(i => i.trim()).filter(i => i) 
                    }))}
                    placeholder="Ingrediente 1, Ingrediente 2, Ingrediente 3"
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedItem(null);
                      setEditForm({});
                    }}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isSaving || categories.length === 0}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gestionar Categorías</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Nueva categoría..." 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{cat.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500"
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No hay categorías</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AdminLayout>
  );
}
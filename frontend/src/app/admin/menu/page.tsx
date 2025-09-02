'use client';

import { useState, useEffect } from 'react';
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
  X
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

// Mock data para items del menú
const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Hamburguesa Clásica',
    description: 'Jugosa hamburguesa de carne con lechuga, tomate, cebolla y salsa especial',
    price: 15000,
    pointsReward: 150,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=delicious%20classic%20hamburger%20with%20lettuce%20tomato%20onion%20and%20special%20sauce%20on%20wooden%20board%20restaurant%20style&image_size=square',
    isAvailable: true,
    ingredients: ['Carne de res', 'Pan brioche', 'Lechuga', 'Tomate', 'Cebolla', 'Salsa especial']
  },
  {
    id: '2',
    name: 'Pizza Margherita',
    description: 'Pizza tradicional italiana con salsa de tomate, mozzarella fresca y albahaca',
    price: 18000,
    pointsReward: 180,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20italian%20margherita%20pizza%20with%20fresh%20mozzarella%20basil%20tomato%20sauce%20wood%20fired%20oven&image_size=square',
    isAvailable: true,
    ingredients: ['Masa de pizza', 'Salsa de tomate', 'Mozzarella fresca', 'Albahaca', 'Aceite de oliva']
  },
  {
    id: '3',
    name: 'Salmón a la Plancha',
    description: 'Filete de salmón fresco a la plancha con vegetales salteados y salsa de limón',
    price: 22000,
    pointsReward: 220,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=grilled%20salmon%20fillet%20with%20sauteed%20vegetables%20lemon%20sauce%20elegant%20restaurant%20plating&image_size=square',
    isAvailable: true,
    ingredients: ['Salmón fresco', 'Vegetales mixtos', 'Limón', 'Aceite de oliva', 'Hierbas finas']
  },
  {
    id: '4',
    name: 'Ensalada César',
    description: 'Ensalada fresca con lechuga romana, crutones, parmesano y aderezo césar',
    price: 12000,
    pointsReward: 120,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20caesar%20salad%20with%20romaine%20lettuce%20croutons%20parmesan%20cheese%20caesar%20dressing&image_size=square',
    isAvailable: true,
    ingredients: ['Lechuga romana', 'Crutones', 'Queso parmesano', 'Aderezo césar']
  },
  {
    id: '5',
    name: 'Mojito Clásico',
    description: 'Refrescante cóctel con ron blanco, menta fresca, limón y agua con gas',
    price: 8000,
    pointsReward: 80,
    category: 'bebidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=classic%20mojito%20cocktail%20with%20white%20rum%20fresh%20mint%20lime%20sparkling%20water%20ice%20cubes&image_size=square',
    isAvailable: true,
    ingredients: ['Ron blanco', 'Menta fresca', 'Limón', 'Azúcar', 'Agua con gas']
  },
  {
    id: '6',
    name: 'Tiramisú',
    description: 'Postre italiano tradicional con café, mascarpone y cacao en polvo',
    price: 9000,
    pointsReward: 90,
    category: 'postres',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20italian%20tiramisu%20dessert%20with%20coffee%20mascarpone%20cocoa%20powder%20elegant%20presentation&image_size=square',
    isAvailable: false,
    ingredients: ['Mascarpone', 'Café espresso', 'Bizcochos de soletilla', 'Cacao en polvo', 'Huevos']
  }
];

const categories = [
  { id: 'comidas', name: 'Comidas', icon: ChefHat },
  { id: 'bebidas', name: 'Bebidas', icon: Coffee },
  { id: 'postres', name: 'Postres', icon: IceCream },
  { id: 'especiales', name: 'Especiales', icon: Star }
];

export default function AdminMenuPage() {
  const { user } = useAppStore();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [menuItems, setMenuItems] = useState(mockMenuItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesAvailability = 
      availabilityFilter === 'all' || 
      (availabilityFilter === 'available' && item.isAvailable) ||
      (availabilityFilter === 'unavailable' && !item.isAvailable);
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  const handleToggleAvailability = (itemId: string) => {
    setMenuItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, isAvailable: !item.isAvailable }
        : item
    ));
    
    const item = menuItems.find(i => i.id === itemId);
    showSuccessToast(`${item?.name} ${item?.isAvailable ? 'deshabilitado' : 'habilitado'}`);
  };

  const handleDeleteItem = (itemId: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== itemId));
    showSuccessToast('Item eliminado del menú');
  };

  const handleEditItem = (item: MenuItem) => {
    setSelectedItem(item);
    setEditForm(item);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedItem || !editForm.name || !editForm.price) {
      showErrorToast('Por favor completa todos los campos requeridos');
      return;
    }

    setMenuItems(prev => prev.map(item => 
      item.id === selectedItem.id 
        ? { ...item, ...editForm }
        : item
    ));
    
    setIsEditing(false);
    setSelectedItem(null);
    setEditForm({});
    showSuccessToast('Item actualizado correctamente');
  };

  const handleAddNewItem = () => {
    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      name: 'Nuevo Item',
      description: 'Descripción del nuevo item',
      price: 10000,
      pointsReward: 100,
      category: 'comidas',
      imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=delicious%20restaurant%20food%20dish%20professional%20photography&image_size=square',
      isAvailable: true,
      ingredients: []
    };
    
    setMenuItems(prev => [newItem, ...prev]);
    handleEditItem(newItem);
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.icon : ChefHat;
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
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
            {/* Badges adicionales se pueden agregar aquí */}
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
            {/* Rating se puede agregar aquí si se incluye en el tipo MenuItem */}
          </div>
          
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
            {item.description}
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {/* Tiempo de preparación se puede agregar aquí si se incluye en el tipo MenuItem */}
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
              onClick={() => handleToggleAvailability(item.id)}
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
          <Button onClick={handleAddNewItem}>
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
                const Icon = category.icon;
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
            <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
          </motion.div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedItem?.id.startsWith('item-') ? 'Agregar Nuevo Item' : 'Editar Item del Menú'}
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
                    <Label htmlFor="category">Categoría</Label>
                    <Select
                      value={editForm.category || ''}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value as 'bebidas' | 'comidas' | 'postres' | 'especiales' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => {
                          const Icon = category.icon;
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
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AdminLayout>
  );
}
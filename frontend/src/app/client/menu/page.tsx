'use client';

import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Cylinder } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  Star,
  Utensils,
  Coffee,
  Cake
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useAppStore } from '@/stores/useAppStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/format';
import { MenuItem } from '@/types';


// Mock data para el menú
const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Hamburguesa Clásica',
    description: 'Carne de res, lechuga, tomate, cebolla, queso cheddar',
    price: 15000,
    pointsReward: 150,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=delicious%20classic%20hamburger%20with%20beef%20lettuce%20tomato%20cheese%20professional%20food%20photography&image_size=square',
    isAvailable: true,
    ingredients: ['Carne de res', 'Lechuga', 'Tomate', 'Cebolla', 'Queso cheddar']
  },
  {
    id: '2',
    name: 'Pizza Margherita',
    description: 'Salsa de tomate, mozzarella fresca, albahaca',
    price: 18000,
    pointsReward: 180,
    category: 'comidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=authentic%20margherita%20pizza%20with%20fresh%20mozzarella%20basil%20tomato%20sauce%20wood%20fired&image_size=square',
    isAvailable: true,
    ingredients: ['Salsa de tomate', 'Mozzarella fresca', 'Albahaca']
  },
  {
    id: '3',
    name: 'Cerveza Artesanal',
    description: 'Cerveza rubia artesanal de la casa',
    price: 8000,
    pointsReward: 80,
    category: 'bebidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=craft%20beer%20golden%20ale%20in%20glass%20with%20foam%20bar%20setting%20professional%20photography&image_size=square',
    isAvailable: true
  },
  {
    id: '4',
    name: 'Tiramisú',
    description: 'Postre italiano con café, mascarpone y cacao',
    price: 12000,
    pointsReward: 120,
    category: 'postres',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=elegant%20tiramisu%20dessert%20with%20cocoa%20powder%20coffee%20mascarpone%20italian%20style&image_size=square',
    isAvailable: true,
    ingredients: ['Café', 'Mascarpone', 'Cacao', 'Bizcochos']
  },
  {
    id: '5',
    name: 'Ensalada César',
    description: 'Lechuga romana, crutones, parmesano, aderezo césar',
    price: 13000,
    pointsReward: 130,
    category: 'especiales',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20caesar%20salad%20with%20romaine%20lettuce%20croutons%20parmesan%20cheese%20dressing&image_size=square',
    isAvailable: true,
    ingredients: ['Lechuga romana', 'Crutones', 'Parmesano', 'Aderezo césar']
  },
  {
    id: '6',
    name: 'Café Espresso',
    description: 'Café espresso italiano tradicional',
    price: 4000,
    pointsReward: 40,
    category: 'bebidas',
    imageUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=perfect%20espresso%20coffee%20in%20white%20cup%20with%20crema%20italian%20style%20coffee%20shop&image_size=square',
    isAvailable: true
  }
];

// Helper function for category icons
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'comidas': return <Utensils className="h-4 w-4" />;
    case 'bebidas': return <Coffee className="h-4 w-4" />;
    case 'postres': return <Cake className="h-4 w-4" />;
    case 'especiales': return <Star className="h-4 w-4" />;
    default: return <Utensils className="h-4 w-4" />;
  }
};

export default function MenuPage() {
  const { user, cart, addToCart } = useAppStore();
  const router = useRouter();
  const { success } = useToast();
  const [menuItems] = useState<MenuItem[]>(mockMenuItems);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [view3D, setView3D] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user, router]);

  const categories = ['all', 'comidas', 'bebidas', 'postres', 'especiales'];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAvailability = item.isAvailable;
    return matchesCategory && matchesSearch && matchesAvailability;
  });

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (menuItem: MenuItem) => {
    addToCart(menuItem, 1);
    success(`${menuItem.name} agregado al carrito`);
  };

  return (
    <Layout background="dark" animate>
      <PageContainer className="min-h-screen p-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Utensils className="h-6 w-6 text-primary" />
                Menú 3D
              </h1>
              <p className="text-sm text-muted-foreground">
                Explora nuestro menú interactivo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view3D ? "default" : "outline"}
              size="sm"
              onClick={() => setView3D(!view3D)}
            >
              {view3D ? '2D' : '3D'} Vista
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Carrito
                  {cartItemsCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {cartItemsCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Carrito de Compras</SheetTitle>
                </SheetHeader>
                <CartContent />
              </SheetContent>
            </Sheet>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          className="flex flex-col md:flex-row gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar platos, bebidas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.slice(1).map(category => (
                <SelectItem key={category} value={category}>
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {category}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* 3D Menu Display */}
        {view3D ? (
          <motion.div
            className="h-96 mb-8 rounded-lg overflow-hidden border bg-gradient-to-b from-background to-muted"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Suspense fallback={
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Cargando menú 3D...</p>
                </div>
              </div>
            }>
              <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
                <Menu3DScene items={filteredItems} onItemClick={setSelectedItem} />
              </Canvas>
            </Suspense>
          </motion.div>
        ) : null}

        {/* Menu Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <AnimatePresence>
            {filteredItems.map((item, index) => (
              <MenuItemCard 
                key={item.id} 
                item={item} 
                index={index}
                onAddToCart={handleAddToCart}
                onViewDetails={setSelectedItem}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Item Detail Modal */}
        <AnimatePresence>
          {selectedItem && (
            <ItemDetailModal 
              item={selectedItem} 
              onClose={() => setSelectedItem(null)}
              onAddToCart={handleAddToCart}
            />
          )}
        </AnimatePresence>
      </PageContainer>
    </Layout>
  );
}

// Componente 3D Scene
function Menu3DScene({ items, onItemClick }: { items: MenuItem[], onItemClick: (item: MenuItem) => void }) {
  const radius = 5;
  const itemsPerRing = 6;
  
  return (
    <group>
      {items.map((item, index) => {
        const angle = (index % itemsPerRing) * (Math.PI * 2) / itemsPerRing;
        const ring = Math.floor(index / itemsPerRing);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = ring * 2 - 2;
        
        return (
          <MenuItem3D 
            key={item.id}
            item={item}
            position={[x, y, z]}
            onClick={() => onItemClick(item)}
          />
        );
      })}
      <Text
        position={[0, -4, 0]}
        fontSize={1}
        color="#666"
        anchorX="center"
        anchorY="middle"
      >
        Menú Interactivo 3D
      </Text>
    </group>
  );
}

// Componente 3D MenuItem
function MenuItem3D({ item, position, onClick }: { 
  item: MenuItem, 
  position: [number, number, number], 
  onClick: () => void 
}) {
  const [hovered, setHovered] = useState(false);
  
  const getShapeByCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'platos principales':
        return <Box args={[1.5, 0.3, 1.5]} />;
      case 'bebidas':
        return <Cylinder args={[0.4, 0.4, 1.5]} />;
      case 'postres':
        return <Sphere args={[0.7]} />;
      default:
        return <Box args={[1, 1, 1]} />;
    }
  };
  
  const getColorByCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'platos principales': return '#ff6b6b';
      case 'bebidas': return '#4ecdc4';
      case 'postres': return '#ffe66d';
      case 'ensaladas': return '#95e1d3';
      default: return '#a8e6cf';
    }
  };
  
  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.2 : 1}
      >
        {getShapeByCategory(item.category)}
        <meshStandardMaterial 
          color={getColorByCategory(item.category)} 
          transparent
          opacity={hovered ? 0.8 : 0.6}
        />
      </mesh>
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={3}
      >
        {item.name}
      </Text>
      <Text
        position={[0, -1.6, 0]}
        fontSize={0.2}
        color="#ccc"
        anchorX="center"
        anchorY="middle"
      >
        {formatPrice(item.price)}
      </Text>
    </group>
  );
}

// Componente MenuItem Card
interface MenuItemCardProps {
  item: MenuItem;
  index: number;
  onAddToCart: (item: MenuItem) => void;
  onViewDetails: (item: MenuItem) => void;
}

function MenuItemCard({ item, index, onAddToCart, onViewDetails }: MenuItemCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
        <div className="relative" onClick={() => onViewDetails(item)}>
          <Image
            src={item.imageUrl || '/placeholder-food.jpg'}
            alt={item.name}
            width={400}
            height={192}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            {formatPrice(item.price)}
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-lg">{item.name}</h3>

          </div>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {item.description}
          </p>
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="text-xs">
              {getCategoryIcon(item.category)}
              <span className="ml-1">{item.category}</span>
            </Badge>

          </div>
          <Button 
            onClick={() => onAddToCart(item)}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar al Carrito
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Componente Cart Content
function CartContent() {
  const { cart, updateCartItemQuantity } = useAppStore();
  const router = useRouter();
  
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Tu carrito está vacío</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 py-4">
        {cart.map(item => (
          <div key={item.menuItem.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Image 
              src={item.menuItem.imageUrl || '/placeholder-food.jpg'} 
              alt={item.menuItem.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded object-cover"
            />
            <div className="flex-1">
              <h4 className="font-medium text-sm">{item.menuItem.name}</h4>
              <p className="text-xs text-muted-foreground">{formatPrice(item.menuItem.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => updateCartItemQuantity(item.menuItem.id, Math.max(0, item.quantity - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm w-8 text-center">{item.quantity}</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => updateCartItemQuantity(item.menuItem.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold">Total:</span>
          <span className="font-bold text-lg">{formatPrice(cartTotal)}</span>
        </div>
        <Button 
          className="w-full"
          onClick={() => router.push('/client/checkout')}
        >
          Proceder al Pago
        </Button>
      </div>
    </div>
  );
}

// Componente Item Detail Modal
interface ItemDetailModalProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
}

function ItemDetailModal({ item, onClose, onAddToCart }: ItemDetailModalProps) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-background rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Image 
            src={item.imageUrl || '/placeholder-food.jpg'} 
            alt={item.name}
            width={400}
            height={256}
            className="w-full h-64 object-cover"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{item.name}</h2>
              <p className="text-lg font-semibold text-primary">{formatPrice(item.price)}</p>
            </div>
          </div>
          <p className="text-muted-foreground mb-4">{item.description}</p>
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm">Categoría:</span>
              <Badge variant="outline">{item.category}</Badge>
            </div>


          </div>
          <Button 
            onClick={() => {
              onAddToCart(item);
              onClose();
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar al Carrito
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
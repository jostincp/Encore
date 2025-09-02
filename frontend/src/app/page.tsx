'use client';

import { motion } from 'framer-motion';
import { Music, Shield, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Layout, PageContainer } from '@/components/ui/layout';
// Animations removed - not currently used
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const handleRoleSelection = (role: 'client' | 'admin') => {
    if (role === 'client') {
      router.push('/qr');
    } else {
      router.push('/admin');
    }
  };

  return (
    <Layout background="gradient" animate>
      <PageContainer className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center mb-6">
              <div className="bg-primary/10 p-4 rounded-full">
                <Music className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
              Encore
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              La experiencia musical interactiva que transforma tu bar en un espacio único
            </p>
          </motion.div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {/* Cliente Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
                    onClick={() => handleRoleSelection('client')}>
                <CardContent className="p-8 text-center">
                  <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Soy Cliente</h2>
                  <p className="text-muted-foreground mb-6">
                    Accede con tu móvil, escanea el QR de tu mesa y disfruta de la experiencia musical completa
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Rockola digital interactiva
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Menú 3D inmersivo
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Sistema de puntos y recompensas
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Cola musical en tiempo real
                    </li>
                  </ul>
                  <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                    Comenzar Experiencia
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Admin Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
                    onClick={() => handleRoleSelection('admin')}>
                <CardContent className="p-8 text-center">
                  <div className="bg-orange-100 dark:bg-orange-900/20 p-4 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Monitor className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Soy Administrador</h2>
                  <p className="text-muted-foreground mb-6">
                    Panel de control completo para gestionar la experiencia musical y el negocio
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Gestión de cola musical
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Administración de menú
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Analytics e inteligencia
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Configuración de estrategias
                    </li>
                  </ul>
                  <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                    Acceder al Panel
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Features Preview */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Seguro y Confiable</span>
              </div>
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                <span>Tiempo Real</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span>Móvil First</span>
              </div>
            </div>
          </motion.div>
        </div>
      </PageContainer>
    </Layout>
  );
}

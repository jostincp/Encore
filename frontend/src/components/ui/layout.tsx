'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ANIMATIONS } from '@/utils/constants';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  sidebar?: ReactNode;
  background?: 'default' | 'gradient' | 'dark';
}

/**
 * Componente de layout principal
 */
export function Layout({
  children,
  className,
  animate = true,
  header,
  footer,
  sidebar,
  background = 'default'
}: LayoutProps) {
  const backgroundClasses = {
    default: 'bg-background',
    gradient: 'bg-gradient-to-br from-primary/5 via-background to-secondary/5',
    dark: 'bg-gray-900'
  };

  const content = (
    <div className={cn(
      'min-h-screen flex flex-col',
      backgroundClasses[background],
      className
    )}>
      {header && (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
          {header}
        </header>
      )}
      
      <div className="flex flex-1">
        {sidebar && (
          <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r">
            {sidebar}
          </aside>
        )}
        
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
      
      {footer && (
        <footer className="border-t bg-background/50">
          {footer}
        </footer>
      )}
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={ANIMATIONS.fadeIn.initial}
      animate={ANIMATIONS.fadeIn.animate}
      exit={ANIMATIONS.fadeIn.exit}
      transition={ANIMATIONS.fadeIn.transition}
    >
      {content}
    </motion.div>
  );
}

/**
 * Layout específico para páginas de cliente (móvil)
 */
export function ClientLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Layout
      className={cn('lg:max-w-md lg:mx-auto', className)}
      background="gradient"
    >
      <div className="flex-1 p-4 pb-20">
        {children}
      </div>
    </Layout>
  );
}

/**
 * Layout específico para páginas de administrador (desktop)
 */
export function AdminLayout({ 
  children, 
  className, 
  sidebar 
}: { 
  children: ReactNode; 
  className?: string;
  sidebar?: ReactNode;
}) {
  return (
    <Layout
      className={className}
      sidebar={sidebar}
      background="default"
    >
      <div className="flex-1 p-6">
        {children}
      </div>
    </Layout>
  );
}

/**
 * Contenedor con animación para páginas
 */
export function PageContainer({ 
  children, 
  className,
  animation = 'slideUp'
}: { 
  children: ReactNode; 
  className?: string;
  animation?: keyof typeof ANIMATIONS;
}) {
  return (
    <motion.div
      className={cn('w-full', className)}
      initial={ANIMATIONS[animation].initial}
      animate={ANIMATIONS[animation].animate}
      exit={ANIMATIONS[animation].exit}
      transition={ANIMATIONS[animation].transition}
    >
      {children}
    </motion.div>
  );
}

/**
 * Contenedor para secciones con espaciado consistente
 */
export function Section({ 
  children, 
  className,
  title,
  description,
  action
}: { 
  children: ReactNode; 
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn('space-y-6', className)}>
      {(title || description || action) && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {action && (
            <div className="flex items-center space-x-2">
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Grid responsivo para tarjetas
 */
export function CardGrid({ 
  children, 
  className,
  columns = 'auto'
}: { 
  children: ReactNode; 
  className?: string;
  columns?: 'auto' | 1 | 2 | 3 | 4;
}) {
  const gridClasses = {
    auto: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  return (
    <div className={cn(
      'grid gap-4',
      gridClasses[columns],
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Contenedor para formularios
 */
export function FormContainer({ 
  children, 
  className,
  title,
  description
}: { 
  children: ReactNode; 
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={cn(
      'mx-auto max-w-md space-y-6 p-6 bg-card rounded-lg border shadow-sm',
      className
    )}>
      {(title || description) && (
        <div className="space-y-2 text-center">
          {title && (
            <h1 className="text-2xl font-bold">{title}</h1>
          )}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Contenedor para estados vacíos
 */
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-8 space-y-4',
      className
    )}>
      {icon && (
        <div className="text-4xl text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && action}
    </div>
  );
}

/**
 * Contenedor para estados de carga
 */
export function LoadingState({ 
  message = 'Cargando...', 
  className 
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 space-y-4',
      className
    )}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Contenedor para estados de error
 */
export function ErrorState({ 
  title = 'Error', 
  description, 
  action,
  className
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-8 space-y-4',
      className
    )}>
      <div className="text-4xl text-destructive">⚠️</div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-destructive">{title}</h3>
        {description && (
          <p className="text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && action}
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout, PageContainer } from '@/components/ui/layout';
import { useToast } from '@/hooks/useToast';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Building2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/utils/constants';
import { useAppStore } from '@/stores/useAppStore';

export default function RegisterBarOwnerPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const { setUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [barName, setBarName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Validaciones en frontend
  const validateEmailLocal = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validatePasswordLocal = (val: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(val);
  const validatePhoneLocal = (val: string) => val.trim() === '' || /^[+]?[\d\s()-]{7,20}$/.test(val);
  const validateNonEmpty = (val: string, min = 2, max = 100) => typeof val === 'string' && val.trim().length >= min && val.trim().length <= max;

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string | null }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const newErrors: { [key: string]: string | null } = {};
    if (!email) newErrors.email = 'Email es requerido';
    if (!password) newErrors.password = 'Contraseña es requerida';
    if (!barName) newErrors.barName = 'Nombre del bar es requerido';
    if (!firstName) newErrors.firstName = 'Nombre es requerido';
    if (!lastName) newErrors.lastName = 'Apellido es requerido';
    if (!address) newErrors.address = 'Dirección es requerida';
    if (!city) newErrors.city = 'Ciudad es requerida';
    if (!country) newErrors.country = 'País es requerido';

    if (email && !validateEmailLocal(email)) newErrors.email = 'Email inválido';
    if (password && !validatePasswordLocal(password)) newErrors.password = 'Debe incluir mayúsculas, minúsculas, número y símbolo (≥8)';
    if (barName && !validateNonEmpty(barName)) newErrors.barName = 'Nombre del bar debe tener entre 2 y 100 caracteres';
    if (firstName && !validateNonEmpty(firstName)) newErrors.firstName = 'Nombre debe tener entre 2 y 50 caracteres';
    if (lastName && !validateNonEmpty(lastName)) newErrors.lastName = 'Apellido debe tener entre 2 y 50 caracteres';
    if (address && !validateNonEmpty(address, 5, 255)) newErrors.address = 'Dirección debe tener al menos 5 caracteres';
    if (city && !validateNonEmpty(city)) newErrors.city = 'Ciudad debe tener entre 2 y 100 caracteres';
    if (country && !validateNonEmpty(country)) newErrors.country = 'País debe tener entre 2 y 100 caracteres';
    if (phone && !validatePhoneLocal(phone)) newErrors.phone = 'Formato de teléfono inválido';

    setFieldErrors(newErrors);
    const hasErrors = Object.values(newErrors).some(Boolean);
    if (hasErrors) {
      setApiError('Por favor corrige los campos resaltados');
      return;
    }
    setLoading(true);
    try {
      console.log('RegisterBarOwner: Enviando registro', { email, barName, firstName, lastName, address, city, country, phone });
      const res = await fetch(`${API_ENDPOINTS.base}/api/auth/register-bar-owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          barName,
          address,
          city,
          country,
          phone
        })
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      if (!res.ok) {
        const serverMessage = json?.message || json?.error || json?.data?.message;
        const validationList = json?.errors || json?.data?.errors;
        const message = serverMessage || `Error de registro (${res.status})`;
        setApiError(message);
        if (Array.isArray(validationList) && validationList.length) {
          console.error('Validation errors:', validationList);
        }
        error(message);
        return;
      }

      const accessToken: string | undefined = json?.data?.accessToken || json?.token;
      const refreshToken: string | undefined = json?.data?.refreshToken || json?.refreshToken;
      const barId: string | undefined = json?.data?.bar?.id || json?.bar?.id;
      const user = json?.data?.user || json?.user;

      if (!accessToken) {
        setApiError('Registro exitoso pero sin token de acceso');
        error('Registro exitoso pero sin token de acceso');
        return;
      }

      try {
        localStorage.setItem('encore_access_token', accessToken);
        if (refreshToken) localStorage.setItem('encore_refresh_token', refreshToken);
        if (barId) localStorage.setItem('encore_bar_id', barId);
      } catch {}

      // Guardar usuario en store para permisos
      if (user) {
        setUser({
          id: user.id,
          email: user.email,
          role: user.role,
          points: 0
        } as any);
      }

      success('Registro exitoso. Redirigiendo al panel...');
      router.push('/admin');
    } catch (err: any) {
      const isTypeError = err && err.name === 'TypeError';
      const message = isTypeError ? 'No se pudo conectar con el servidor. Verifica que el servicio de autenticación esté activo en http://localhost:3001.' : (err?.message || 'Error de red al registrar');
      console.error('RegisterBarOwner error:', err);
      setApiError(message);
      error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout background="gradient" animate>
      <PageContainer className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-xl mx-auto">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">Registrar mi Bar</h1>
            <p className="text-muted-foreground">Crea tu cuenta de propietario y configura tu bar</p>
          </motion.div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Datos del propietario y del bar</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Nombre</Label>
                    <Input id="firstName" type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                    {fieldErrors.firstName && <div className="text-xs text-red-600">{fieldErrors.firstName}</div>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Apellido</Label>
                    <Input id="lastName" type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} required />
                    {fieldErrors.lastName && <div className="text-xs text-red-600">{fieldErrors.lastName}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                  <Input id="email" type="email" placeholder="admin@tu-bar.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  {fieldErrors.email && <div className="text-xs text-red-600">{fieldErrors.email}</div>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2"><Lock className="h-4 w-4" /> Contraseña</Label>
                  <Input id="password" type="password" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} required />
                  {fieldErrors.password && <div className="text-xs text-red-600">{fieldErrors.password}</div>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barName" className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Nombre del Bar</Label>
                  <Input id="barName" type="text" placeholder="Mi Bar Ejemplo" value={barName} onChange={e => setBarName(e.target.value)} required />
                  {fieldErrors.barName && <div className="text-xs text-red-600">{fieldErrors.barName}</div>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Dirección</Label>
                  <Input id="address" type="text" placeholder="Av. Principal 123" value={address} onChange={e => setAddress(e.target.value)} required />
                  {fieldErrors.address && <div className="text-xs text-red-600">{fieldErrors.address}</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Ciudad</Label>
                    <Input id="city" type="text" placeholder="Bogotá" value={city} onChange={e => setCity(e.target.value)} required />
                    {fieldErrors.city && <div className="text-xs text-red-600">{fieldErrors.city}</div>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="flex items-center gap-2"><Building2 className="h-4 w-4" /> País</Label>
                    <Input id="country" type="text" placeholder="Colombia" value={country} onChange={e => setCountry(e.target.value)} required />
                    {fieldErrors.country && <div className="text-xs text-red-600">{fieldErrors.country}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Teléfono</Label>
                  <Input id="phone" type="tel" placeholder="+57 300 123 4567" value={phone} onChange={e => setPhone(e.target.value)} />
                  {fieldErrors.phone && <div className="text-xs text-red-600">{fieldErrors.phone}</div>}
                </div>

                {apiError && (
                  <div className="text-sm text-red-600">{apiError}</div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Registrando...' : 'Crear mi cuenta'}
                </Button>
              </form>
              <div className="text-sm text-muted-foreground mt-4">
                Al registrarte aceptas nuestros términos y políticas.
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
}
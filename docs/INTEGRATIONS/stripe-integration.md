# Integración con Stripe

## Descripción

Integración con Stripe para procesamiento de pagos y gestión del sistema de puntos.

## Configuración

### 1. Crear Cuenta en Stripe

1. Visita [Stripe Dashboard](https://dashboard.stripe.com)
2. Crea una cuenta de desarrollador
3. Obtén las claves de API (publishable y secret)
4. Configura webhooks para eventos

### 2. Variables de Entorno

```env
# Frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Backend (points-service)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Funcionalidades Implementadas

- ✅ Procesamiento de pagos
- ✅ Compra de puntos
- ✅ Webhooks para confirmación de pagos
- ✅ Gestión de clientes
- 🔄 Suscripciones (en desarrollo)
- 🔄 Reembolsos (planificado)

## Productos Configurados

### Paquetes de Puntos
- **Básico**: 100 puntos - $5.00
- **Estándar**: 250 puntos - $10.00
- **Premium**: 500 puntos - $18.00
- **VIP**: 1000 puntos - $30.00

## Webhooks Configurados

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.created`
- `invoice.payment_succeeded`

## Seguridad

- Validación de firmas de webhook
- Claves de API seguras
- Procesamiento server-side únicamente
- Logs de auditoría para transacciones

---

*Para más información sobre el sistema de puntos, consulte [Points Service](../SERVICES/points-service.md)*
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

interface Table {
  id: string;
  bar_id: string;
  table_number: number;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Bar {
  id: string;
  name: string;
  description: string;
  address: string;
}

const TableManagementPage: React.FC = () => {
  const router = useRouter();
  const { barId } = router.query;

  const [bar, setBar] = useState<Bar | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTable, setNewTable] = useState({
    table_number: '',
    capacity: '4'
  });

  useEffect(() => {
    if (barId) {
      loadBarData();
      loadTables();
    }
  }, [barId]);

  const loadBarData = async () => {
    if (!barId) return;

    try {
      const response = await fetch(`/api/bars/${barId}`);
      if (response.ok) {
        const data = await response.json();
        setBar(data.data);
      }
    } catch (error) {
      console.error('Error loading bar data:', error);
    }
  };

  const loadTables = async () => {
    if (!barId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bars/${barId}/tables`);
      if (response.ok) {
        const data = await response.json();
        setTables(data.data || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Error al cargar mesas');
    } finally {
      setIsLoading(false);
    }
  };

  const createTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barId) return;

    try {
      const response = await fetch(`/api/bars/${barId}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_number: parseInt(newTable.table_number),
          capacity: parseInt(newTable.capacity),
          is_active: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Mesa creada exitosamente');
        setNewTable({ table_number: '', capacity: '4' });
        setShowCreateForm(false);
        loadTables();
      } else {
        toast.error(data.message || 'Error al crear mesa');
      }
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error('Error de conexión');
    }
  };

  const generateQR = async (tableId: string, tableNumber: number) => {
    if (!barId) return;

    try {
      const response = await fetch(`/api/bars/${barId}/tables/${tableId}/qr`);
      if (response.ok) {
        const data = await response.json();

        // Mostrar modal con el código QR
        showQRModal(data.data, tableNumber);
      } else {
        toast.error('Error al generar código QR');
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      toast.error('Error de conexión');
    }
  };

  const showQRModal = (qrData: any, tableNumber: number) => {
    // TODO: Implementar modal con código QR
    // Por ahora, mostrar la URL en un alert
    const qrUrl = qrData.qrUrl;
    window.open(qrUrl, '_blank');
    toast.success(`Código QR para Mesa ${tableNumber} generado`);
  };

  if (!barId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Bar ID requerido
          </h1>
          <p className="text-gray-600">
            Debes acceder desde el panel de administración con un Bar ID válido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestión de Mesas
              </h1>
              {bar && (
                <p className="text-gray-600 text-sm mt-1">
                  {bar.name} - {bar.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Mesa
              </button>
              <button
                onClick={loadTables}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                disabled={isLoading}
              >
                {isLoading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Create Table Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Crear Nueva Mesa</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Mesa
                  </label>
                  <input
                    type="number"
                    value={newTable.table_number}
                    onChange={(e) => setNewTable(prev => ({ ...prev, table_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 5"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacidad
                  </label>
                  <input
                    type="number"
                    value={newTable.capacity}
                    onChange={(e) => setNewTable(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 4"
                    required
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Mesa
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tables List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">
              Mesas ({tables.length})
            </h2>
          </div>

          {tables.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay mesas configuradas
              </h3>
              <p className="text-gray-600 mb-4">
                Crea tu primera mesa para comenzar a generar códigos QR
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Primera Mesa
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tables.map((table) => (
                <div key={table.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-600">
                          {table.table_number}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Mesa {table.table_number}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Capacidad: {table.capacity} personas
                        </p>
                        <p className="text-xs text-gray-500">
                          Creada: {new Date(table.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        table.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {table.is_active ? 'Activa' : 'Inactiva'}
                      </span>

                      <button
                        onClick={() => generateQR(table.id, table.table_number)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Generar QR
                      </button>

                      <button className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableManagementPage;
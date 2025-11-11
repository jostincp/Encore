// Test para verificar que el componente QR Generator Simple funciona
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRGeneratorSimple from '../src/components/QRGeneratorSimple';

// Mock de useToast
jest.mock('../src/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('QRGeneratorSimple', () => {
  const defaultProps = {
    barId: 'test-bar-123',
    barName: 'Test Bar',
    onGenerate: jest.fn(),
    maxTables: 10,
  };

  it('renders without crashing', () => {
    render(<QRGeneratorSimple {...defaultProps} />);
    expect(screen.getByText('Configuración de Códigos QR')).toBeInTheDocument();
    expect(screen.getByText('Generador de Códigos QR')).toBeInTheDocument();
    expect(screen.getByText('Códigos QR Generados (0)')).toBeInTheDocument();
  });

  it('generates QR for a specific table', async () => {
    const mockOnGenerate = jest.fn();
    render(<QRGeneratorSimple {...defaultProps} onGenerate={mockOnGenerate} />);

    // Seleccionar mesa
    const tableSelect = screen.getByLabelText('Mesa:');
    fireEvent.change(tableSelect, { target: { value: '5' } });

    // Hacer clic en generar
    const generateButton = screen.getByText('Generar');
    fireEvent.click(generateButton);

    // Verificar que se generó el QR
    await waitFor(() => {
      expect(mockOnGenerate).toHaveBeenCalledWith(5, expect.any(Object));
    });
  });

  it('generates all QR codes', async () => {
    const mockOnGenerate = jest.fn();
    render(<QRGeneratorSimple {...defaultProps} onGenerate={mockOnGenerate} />);

    // Hacer clic en generar todos
    const generateAllButton = screen.getByText('Generar Todos (10)');
    fireEvent.click(generateAllButton);

    // Esperar a que se generen todos los QRs
    await waitFor(() => {
      expect(mockOnGenerate).toHaveBeenCalledTimes(10);
    });
  });

  it('shows preview when QR is generated', async () => {
    render(<QRGeneratorSimple {...defaultProps} />);

    // Generar QR para mesa 1
    const generateButton = screen.getByText('Generar');
    fireEvent.click(generateButton);

    // Verificar que aparece la vista previa
    await waitFor(() => {
      expect(screen.getByText('Vista Previa - Mesa 1')).toBeInTheDocument();
    });
  });
});

console.log('✅ QR Generator Simple tests completed successfully!');

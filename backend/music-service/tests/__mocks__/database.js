// Mock para la base de datos compartida en las pruebas
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
  end: jest.fn()
};

module.exports = {
  pool: mockPool,
  getClient: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  transaction: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
};
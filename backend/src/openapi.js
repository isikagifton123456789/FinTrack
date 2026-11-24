export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'FinTrack API',
    version: '1.0.0',
    description: 'REST API for analyst authentication, portfolios, transaction history, and average-cost holdings.',
  },
  servers: [{ url: '/api', description: 'Current FinTrack API host' }],
  tags: [
    { name: 'Authentication' },
    { name: 'Portfolios' },
    { name: 'Transactions' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'details'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      PortfolioInput: {
        type: 'object',
        required: ['name', 'clientName', 'baseCurrency'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 64 },
          clientName: { type: 'string', minLength: 2, maxLength: 64 },
          baseCurrency: { type: 'string', enum: ['KES', 'USD'] },
        },
      },
      TransactionInput: {
        type: 'object',
        required: ['instrument', 'type', 'quantity', 'unitPrice', 'tradeDate'],
        properties: {
          instrument: { type: 'string', example: 'SCOM' },
          type: { type: 'string', enum: ['BUY', 'SELL'] },
          quantity: { type: 'number', exclusiveMinimum: 0 },
          unitPrice: { type: 'number', exclusiveMinimum: 0 },
          tradeDate: { type: 'string', format: 'date' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register an analyst account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, description: 'Must include upper/lowercase letters and a number.' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Account created and tokens issued' }, '409': { description: 'Email is already registered' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in an analyst',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Account and access/refresh tokens' }, '401': { description: 'Credentials do not match' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access and refresh tokens',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } } },
        responses: { '200': { description: 'New token pair' }, '401': { description: 'Refresh token is invalid or expired' } },
      },
    },
    '/portfolios': {
      get: { tags: ['Portfolios'], security: [{ bearerAuth: [] }], summary: 'List the signed-in analyst’s portfolios', responses: { '200': { description: 'Portfolio list' } } },
      post: {
        tags: ['Portfolios'],
        security: [{ bearerAuth: [] }],
        summary: 'Create a portfolio',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioInput' } } } },
        responses: { '201': { description: 'Portfolio created' } },
      },
    },
    '/portfolios/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Portfolios'], security: [{ bearerAuth: [] }], summary: 'Get one portfolio', responses: { '200': { description: 'Portfolio details' }, '404': { description: 'Portfolio not found' } } },
      put: {
        tags: ['Portfolios'],
        security: [{ bearerAuth: [] }],
        summary: 'Update a portfolio',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioInput' } } } },
        responses: { '200': { description: 'Portfolio updated' } },
      },
      delete: { tags: ['Portfolios'], security: [{ bearerAuth: [] }], summary: 'Delete a portfolio and its transaction history', responses: { '204': { description: 'Portfolio deleted' } } },
    },
    '/portfolios/{id}/transactions': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Transactions'], security: [{ bearerAuth: [] }], summary: 'List portfolio transactions', responses: { '200': { description: 'Transaction list' } } },
      post: {
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        summary: 'Record a transaction; sells cannot exceed holdings on the trade date',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TransactionInput' } } } },
        responses: { '201': { description: 'Transaction created' }, '422': { description: 'Invalid input or insufficient holdings', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
      },
    },
    '/transactions/{id}': {
      delete: {
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete a transaction',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '204': { description: 'Transaction deleted' }, '404': { description: 'Transaction not found' } },
      },
    },
    '/portfolios/{id}/summary': {
      get: {
        tags: ['Portfolios'],
        security: [{ bearerAuth: [] }],
        summary: 'Calculate holdings and portfolio totals using average cost',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Portfolio summary' } },
      },
    },
  },
}

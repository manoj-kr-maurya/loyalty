import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { ConfigService } from '@nestjs/config';

describe('AppController', () => {
  let controller: AppController;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'ENVIRONMENT') return 'local';
      if (key === 'REDIS_PASSWORD') return 'test-password';
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('serviceCheck', () => {
    it('should return service status', async () => {
      const result = await controller.serviceCheck();

      expect(result).toBeDefined();
      expect(result.environment).toBe('local');
      expect(result.lastRestartedOrDeployedTimestamp).toBeDefined();
    });
  });
});

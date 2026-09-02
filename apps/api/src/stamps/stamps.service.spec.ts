import { Test, TestingModule } from '@nestjs/testing';
import { StampsService } from './stamps.service.js';

describe('StampsService', () => {
  let service: StampsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StampsService],
    }).compile();

    service = module.get<StampsService>(StampsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

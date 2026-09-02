import { Test, TestingModule } from '@nestjs/testing';
import { StampsController } from './stamps.controller.js';
import { StampsService } from './stamps.service.js';

describe('StampsController', () => {
  let controller: StampsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StampsController],
      providers: [StampsService],
    }).compile();

    controller = module.get<StampsController>(StampsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

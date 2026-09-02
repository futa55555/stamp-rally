import { Injectable } from '@nestjs/common';
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';

@Injectable()
export class StampsService {
  create(createStampDto: CreateStampDto) {
    return 'This action adds a new stamp';
  }

  findAll() {
    return `This action returns all stamps`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stamp`;
  }

  update(id: number, updateStampDto: UpdateStampDto) {
    return `This action updates a #${id} stamp`;
  }

  remove(id: number) {
    return `This action removes a #${id} stamp`;
  }
}

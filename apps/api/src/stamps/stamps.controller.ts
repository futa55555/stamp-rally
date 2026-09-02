import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StampsService } from './stamps.service.js';
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';

@Controller('stamps')
export class StampsController {
  constructor(private readonly stampsService: StampsService) {}

  @Post()
  create(@Body() createStampDto: CreateStampDto) {
    return this.stampsService.create(createStampDto);
  }

  @Get()
  findAll() {
    return this.stampsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stampsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStampDto: UpdateStampDto) {
    return this.stampsService.update(+id, updateStampDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stampsService.remove(+id);
  }
}

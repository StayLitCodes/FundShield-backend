import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BlockchainEventService } from '../services/blockchain-event.service';
import { BlockchainListenerService } from '../services/blockchain-listener.service';
import { EventProcessorService } from '../services/event-processor.service';
import {
  EventFilterDto,
  UpdateBlockchainEventDto,
} from '../validators/blockchain-event.dto';
import { BlockchainEvent } from '../models/blockchain-event.entity';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private readonly eventService: BlockchainEventService,
    private readonly listenerService: BlockchainListenerService,
    private readonly processorService: EventProcessorService,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'Get blockchain events with filtering' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async getEvents(@Query() filter: EventFilterDto) {
    return this.eventService.findEvents(filter);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get blockchain event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  async getEvent(@Param('id') id: string): Promise<BlockchainEvent> {
    return this.eventService.getEventById(id);
  }

  @Put('events/:id')
  @ApiOperation({ summary: 'Update blockchain event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  async updateEvent(
    @Param('id') id: string,
    @Body() updateDto: UpdateBlockchainEventDto,
  ): Promise<BlockchainEvent> {
    return this.eventService.updateEvent(id, updateDto);
  }

  @Get('events/failed')
  @ApiOperation({ summary: 'Get failed events' })
  @ApiResponse({ status: 200, description: 'Failed events retrieved' })
  async getFailedEvents(): Promise<BlockchainEvent[]> {
    return this.eventService.getFailedEvents();
  }

  @Post('events/:id/retry')
  @ApiOperation({ summary: 'Retry failed event processing' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event queued for retry' })
  @HttpCode(HttpStatus.OK)
  async retryEvent(@Param('id') id: string): Promise<{ message: string }> {
    await this.processorService.retryDeadLetterEvent(id);
    return { message: 'Event queued for retry' };
  }

  @Post('listener/start')
  @ApiOperation({ summary: 'Start blockchain event listener' })
  @ApiResponse({ status: 200, description: 'Listener started' })
  @HttpCode(HttpStatus.OK)
  async startListener(): Promise<{ message: string }> {
    await this.listenerService.startListening();
    return { message: 'Blockchain listener started' };
  }

  @Post('listener/stop')
  @ApiOperation({ summary: 'Stop blockchain event listener' })
  @ApiResponse({ status: 200, description: 'Listener stopped' })
  @HttpCode(HttpStatus.OK)
  async stopListener(): Promise<{ message: string }> {
    this.listenerService.stopListening();
    return { message: 'Blockchain listener stopped' };
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Get synchronization status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getSyncStatus() {
    const lastProcessedBlock = await this.eventService.getLastProcessedBlock();
    // You can add more sync status information here
    return {
      lastProcessedBlock,
      isListening: true, // Get from listener service
      timestamp: new Date().toISOString(),
    };
  }
}

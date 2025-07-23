import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventProcessorService } from './event-processor.service';

@Processor('event-processing')
export class EventQueueProcessor {
  private readonly logger = new Logger(EventQueueProcessor.name);

  constructor(private readonly eventProcessor: EventProcessorService) {}

  @Process('process-event')
  async handleEventProcessing(job: Job<{ eventId: string }>) {
    const { eventId } = job.data;

    this.logger.debug(`Processing job for event ${eventId}`);

    try {
      await this.eventProcessor.processEvent(eventId);
      this.logger.log(`Job completed for event ${eventId}`);
    } catch (error) {
      this.logger.error(`Job failed for event ${eventId}`, error.stack);
      throw error; // This will trigger Bull's retry mechanism
    }
  }

  @Process('retry-failed-events')
  async handleRetryFailedEvents(job: Job) {
    this.logger.log('Processing retry job for failed events');

    // This job can be scheduled to periodically retry failed events
    // Implementation depends on your retry strategy
  }
}

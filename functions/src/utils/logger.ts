import * as functions from 'firebase-functions';
import { WebhookProcessingResult } from '../types';

export class Logger {
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, data?: any): void {
    functions.logger.info(message, data);
  }

  warn(message: string, data?: any): void {
    functions.logger.warn(message, data);
  }

  error(message: string, error?: any): void {
    functions.logger.error(message, error);
  }

  debug(message: string, data?: any): void {
    functions.logger.debug(message, data);
  }

  logWebhookResult(result: WebhookProcessingResult): void {
    const logData = {
      eventId: result.eventId,
      eventType: result.eventType,
      userId: result.userId,
      subscriptionId: result.subscriptionId,
      success: result.success,
      processingTime: result.processingTime,
      error: result.error
    };

    if (result.success) {
      this.info(`Webhook processed successfully: ${result.eventType}`, logData);
    } else {
      this.error(`Webhook processing failed: ${result.eventType}`, logData);
    }
  }

  logStripeEvent(eventType: string, eventId: string, data?: any): void {
    this.info(`Processing Stripe event: ${eventType}`, {
      eventId,
      eventType,
      data: data ? JSON.stringify(data, null, 2) : undefined
    });
  }

  logUserUpdate(userId: string, operation: string, data?: any): void {
    this.info(`User update: ${operation}`, {
      userId,
      operation,
      data: data ? JSON.stringify(data, null, 2) : undefined
    });
  }

  logSubscriptionUpdate(subscriptionId: string, operation: string, data?: any): void {
    this.info(`Subscription update: ${operation}`, {
      subscriptionId,
      operation,
      data: data ? JSON.stringify(data, null, 2) : undefined
    });
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const functions = require("firebase-functions");
class Logger {
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    info(message, data) {
        functions.logger.info(message, data);
    }
    warn(message, data) {
        functions.logger.warn(message, data);
    }
    error(message, error) {
        functions.logger.error(message, error);
    }
    debug(message, data) {
        functions.logger.debug(message, data);
    }
    logWebhookResult(result) {
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
        }
        else {
            this.error(`Webhook processing failed: ${result.eventType}`, logData);
        }
    }
    logStripeEvent(eventType, eventId, data) {
        this.info(`Processing Stripe event: ${eventType}`, {
            eventId,
            eventType,
            data: data ? JSON.stringify(data, null, 2) : undefined
        });
    }
    logUserUpdate(userId, operation, data) {
        this.info(`User update: ${operation}`, {
            userId,
            operation,
            data: data ? JSON.stringify(data, null, 2) : undefined
        });
    }
    logSubscriptionUpdate(subscriptionId, operation, data) {
        this.info(`Subscription update: ${operation}`, {
            subscriptionId,
            operation,
            data: data ? JSON.stringify(data, null, 2) : undefined
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map
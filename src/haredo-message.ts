import { Message, MessagePropertyHeaders } from 'amqplib';
import { makeEmitter, TypedEventEmitter } from './events';
import { parseJSON } from './utils';

export interface HaredoMessageEvents {
    handled: void;
}

export interface HaredoMessage<TMessage = unknown, TReply = unknown>
    extends Methods<TReply> {
    emitter: TypedEventEmitter<HaredoMessageEvents>;
    /**
     * Raw message from amqplib
     */
    raw: Message;
    /**
     * Message contents
     */
    data: TMessage;
    /**
     * Unparsed message data
     */
    dataString: string;
    /**
     * Returns true if message has been acked/nacked
     */
    isHandled: () => boolean;
    isNacked: () => boolean;
    isAcked: () => boolean;
    isReplied: () => boolean;
    headers: MessagePropertyHeaders;
    getHeader: (header: string) => string | string[];

    contentType?: string;
    contentEncoding?: string;
    /**
     * Either 1 for non-persistent or 2 for persistent
     */
    deliveryMode?: 1 | 2;
    priority?: number;
    correlationId?: string;
    replyTo?: string;
    expiration?: number;
    messageId?: string;
    timestamp?: number;
    type?: string;
    userId?: string;
    appId?: string;

    messageCount?: number;
    consumerTag?: string;
    deliveryTag: number;
    /**
     * True if the message has been sent to a consumer at least once
     */
    redelivered: boolean;
    exchange: string;
    routingKey: string;
}

export interface Methods<TReply = unknown> {
    /**
     * Mark the message as done, removes it from the queue
     */
    ack: () => void;
    /**
     * Nack the message. If requeue is false (defaults to true)
     * then the message will be discarded. Otherwise it will be returned to
     * the front of the queue
     */
    nack: (requeue?: boolean) => void;
    /**
     * Reply to the message. Only works if the message has a
     * replyTo and correlationId have been set on the message.
     * If autoReply has been set on the chain, then You can just return a
     * non-undefined value from the subscribe callback
     */
    reply: (message: TReply) => Promise<void>;
}

export const makeHaredoMessage = <TMessage = unknown, TReply = unknown>(
    raw: Message,
    parseJson: boolean,
    methods: Methods<TReply>
): HaredoMessage<TMessage, TReply> => {
    const state = {
        isHandled: false,
        isAcked: false,
        isNacked: false,
        isReplied: false,
    };

    const dataString = raw.content.toString();
    const data = parseJson ? parseJSON(dataString) : dataString;

    const emitter = makeEmitter<HaredoMessageEvents>();
    return {
        emitter,
        raw,
        dataString,
        data,
        isHandled: () => state.isHandled,
        isAcked: () => state.isAcked,
        isNacked: () => state.isNacked,
        isReplied: () => state.isReplied,
        ack: () => {
            if (state.isHandled) {
                return;
            }
            state.isAcked = true;
            state.isHandled = true;
            methods.ack();
            emitter.emit('handled');
        },
        nack: (requeue = true) => {
            if (state.isHandled) {
                return;
            }
            state.isNacked = true;
            state.isHandled = true;
            methods.nack(requeue);
            emitter.emit('handled');
        },
        reply: (message: TReply) => {
            state.isReplied = true;
            return methods.reply(message);
        },
        headers: raw.properties.headers,
        getHeader: (header: string) => raw.properties.headers[header],
        appId: raw.properties.appId,
        consumerTag: raw.fields.consumerTag,
        contentEncoding: raw.properties.contentEncoding,
        contentType: raw.properties.contentType,
        correlationId: raw.properties.correlationId,
        deliveryMode: raw.properties.deliveryMode,
        deliveryTag: raw.fields.deliveryTag,
        exchange: raw.fields.exchange,
        expiration: raw.properties.expiration,
        messageCount: raw.fields.messageCount,
        messageId: raw.properties.messageId,
        priority: raw.properties.priority,
        redelivered: raw.fields.redelivered,
        replyTo: raw.properties.replyTo,
        routingKey: raw.fields.routingKey,
        timestamp: raw.properties.timestamp,
        type: raw.properties.type,
        userId: raw.properties.userId
    };
};

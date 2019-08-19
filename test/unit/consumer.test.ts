import 'mocha';

import { Consumer, makeConsumer } from '../../src/consumer';
import { spy, stub, SinonStub } from 'sinon';
import { EventEmitter } from 'events';
import { ConnectionManager } from '../../src/connection-manager';

import * as sinonChai from 'sinon-chai';
import { use, expect } from 'chai';
import { Queue } from '../../src/queue';
import { Channel } from 'amqplib';
import { delay } from '../../src/utils';
import { eventToPromise } from '../integration/consumer.test';

use(sinonChai);

describe('unit/consumer', () => {
    let consumer: Consumer;
    let cbSpy = spy();
    let channelMock: Omit<Channel, 'consume'> & {
        consume: SinonStub
    };
    beforeEach(async () => {
        channelMock = Object.assign(
            new EventEmitter() as Channel,
            {
                consume: stub().resolves({ consumerTag: 'testtag' }),
                cancel: stub().resolves(),
                prefetch: stub().resolves()
            }
        );
        consumer = await makeConsumer(cbSpy, { getChannel: async () => channelMock as any } as ConnectionManager, {
            prefetch: 0,
            autoAck: true,
            autoReply: true,
            json: true,
            middleware: [],
            queue: new Queue('test'),
            reestablish: true,
            setup: async () => {}
        });
    })
    it('Should reestablish when channel closes', async () => {
        channelMock.emit('close');
        await delay(10);
        expect(channelMock.consume).to.be.calledTwice;
    });
    it('should', async () => {
        const promise = eventToPromise(consumer.emitter, 'error');
        channelMock.emit('close');
        let consumerErrored = false;
        consumer.emitter.on('error', () => {
            consumerErrored = true;
        });
        channelMock.consume.onSecondCall().rejects(new Error());
        await delay(10);
        expect(promise).to.eventually.be.fulfilled;
        expect(consumerErrored).to.be.true;
    });
});

import { DomainEvent } from '@/shared/domain/domain-event';
import {
  DomainEventHandler,
  InMemoryDomainEventDispatcher,
} from '@/shared/domain/domain-event-dispatcher';

class StubEvent implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventType = 'stub.event';

  constructor(
    public readonly aggregateId: string,
    public readonly payload: string,
  ) {
    this.occurredOn = new Date();
  }
}

describe('InMemoryDomainEventDispatcher', () => {
  describe('registerHandler', () => {
    it('should invoke a handler when a matching event is dispatched', async () => {
      const dispatcher = new InMemoryDomainEventDispatcher();
      const handler: DomainEventHandler = jest.fn();

      dispatcher.registerHandler('stub.event', handler);

      const event = new StubEvent('agg-1', 'hello');

      await dispatcher.dispatch(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not invoke a handler registered for a different event type', async () => {
      const dispatcher = new InMemoryDomainEventDispatcher();
      const handler: DomainEventHandler = jest.fn();

      dispatcher.registerHandler('other.event', handler);

      await dispatcher.dispatch(new StubEvent('agg-1', 'hello'));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should invoke all handlers registered for the same event type', async () => {
      const dispatcher = new InMemoryDomainEventDispatcher();
      const first: DomainEventHandler = jest.fn();
      const second: DomainEventHandler = jest.fn();

      dispatcher.registerHandler('stub.event', first);
      dispatcher.registerHandler('stub.event', second);

      await dispatcher.dispatch(new StubEvent('agg-1', 'hello'));

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('should route dispatchBatch to matching handlers', async () => {
      const dispatcher = new InMemoryDomainEventDispatcher();
      const handler: DomainEventHandler = jest.fn();
      const other: DomainEventHandler = jest.fn();

      dispatcher.registerHandler('stub.event', handler);
      dispatcher.registerHandler('unrelated.event', other);

      await dispatcher.dispatchBatch([new StubEvent('a', '1'), new StubEvent('b', '2')]);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(other).not.toHaveBeenCalled();
    });
  });
});

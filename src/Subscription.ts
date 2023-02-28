import { MessageDefinition } from "@foxglove/message-definition";
import { MessageReader } from "@foxglove/rosmsg2-serialization";
import { Time, fromDate } from "@foxglove/rostime";
import {
  Durability,
  EndpointAttributes,
  EntityId,
  Guid,
  HistoryAndDepth,
  makeGuid,
  Participant,
  ReliabilityAndMaxBlockingTime,
  SubscribeOpts as RtpsSubscribeOpts,
  subscriptionMatchesPublication,
} from "@foxglove/rtps";
import { EventEmitter } from "eventemitter3";

export type SubscribeOpts = {
  topic: string;
  dataType: string;
  durability?: Durability;
  reliability?: ReliabilityAndMaxBlockingTime;
  history?: HistoryAndDepth;
  msgDefinition?: MessageDefinition[];
  skipParsing?: boolean;
};

type SubscriptionOpts = {
  subscribeOpts: RtpsSubscribeOpts;
  readerEntityId: EntityId;
  participant: Participant;
  msgDefinition?: MessageDefinition[];
  skipParsing?: boolean;
};

export interface SubscriptionEvents {
  publisherConnected: (publisher: EndpointAttributes) => void;
  message: (timestamp: Time, msg: unknown, data: Uint8Array, publisher: EndpointAttributes) => void;
  error: (err: Error) => void;
}

export class Subscription extends EventEmitter<SubscriptionEvents> {
  readonly msgDefinition?: ReadonlyArray<MessageDefinition>;

  private readonly _subscribeOpts: RtpsSubscribeOpts;
  private readonly _participant: Participant;
  private readonly _readerEntityId: EntityId;
  private readonly _msgReader?: MessageReader;
  private readonly _publishers = new Map<Guid, EndpointAttributes>();
  private _bytesReceived = 0;

  get name(): string {
    return this._subscribeOpts.topicName;
  }

  get dataType(): string {
    return this._subscribeOpts.typeName;
  }

  get readerEntityId(): EntityId {
    return this._readerEntityId;
  }

  constructor(options: SubscriptionOpts) {
    super();

    this.msgDefinition = options.msgDefinition;
    this._subscribeOpts = options.subscribeOpts;
    this._participant = options.participant;
    this._readerEntityId = options.readerEntityId;
    this._msgReader =
      options.skipParsing !== true && options.msgDefinition != undefined
        ? new MessageReader(options.msgDefinition)
        : undefined;

    // NOTE: Query Participant directly for publishers connected to a subscription instead of
    // tracking it ourselves
    this._participant.on("discoveredPublication", (publication) => {
      if (subscriptionMatchesPublication(this._subscribeOpts, publication)) {
        const guid = makeGuid(publication.guidPrefix, publication.entityId);
        this._publishers.set(guid, publication);
      }
    });

    this._participant.on("userData", (userData) => {
      const topicName = this._subscribeOpts.topicName;
      if (userData.subscription.topicName !== topicName) {
        return;
      }

      const timestamp = userData.timestamp ?? fromDate(new Date());
      try {
        const msg = this._msgReader?.readMessage(userData.serializedData);
        this.emit("message", timestamp, msg, userData.serializedData, userData.publication);
      } catch (unk) {
        const err = unk instanceof Error ? unk : new Error(unk as string);
        const size = userData.serializedData.byteLength;
        this.emit(
          "error",
          new Error(`Failed to parse ${size} byte message on "${topicName}": ${err.message}`),
        );
      }
    });
  }

  close(): void {
    this.removeAllListeners();
    this._bytesReceived = 0;
    throw new Error(`not implemented`);
    // this._participant.unsubscribe();
  }

  publishers(): Readonly<Map<Guid, EndpointAttributes>> {
    return this._publishers;
  }

  receivedBytes(): number {
    return this._bytesReceived;
  }
}

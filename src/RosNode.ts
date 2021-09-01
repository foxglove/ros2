import {
  Durability,
  EndpointAttributes,
  GuidPrefix,
  HistoryKind,
  LoggerService,
  NetworkInterface,
  Participant,
  ParticipantAttributes,
  Reliability,
  selectIPv4,
  UdpSocketCreate,
} from "@foxglove/rtps";
import { EventEmitter } from "eventemitter3";

import { Subscription, SubscribeOpts } from "./Subscription";
import {
  DdsTopicType,
  ddsToRosTopic,
  ddsToRosType,
  rosTopicToDds,
  rosTypeToDds,
} from "./ddsMangling";

export interface RosNodeEvents {
  discoveredParticipant: (participant: ParticipantAttributes) => void;
  discoveredPublication: (endpoint: EndpointAttributes) => void;
  discoveredSubscription: (endpoint: EndpointAttributes) => void;
}

export class RosNode extends EventEmitter<RosNodeEvents> {
  subscriptions = new Map<string, Subscription>();
  // publications = new Map<string, Publication>();
  // parameters = new Map<string, ParamValue>();

  private _log?: LoggerService;
  private _participant: Participant;

  get name(): string {
    return this._participant.name;
  }

  constructor(options: {
    name: string;
    udpSocketCreate: UdpSocketCreate;
    addresses?: string[];
    getNetworkInterfaces?: () => NetworkInterface[];
    domainId?: number;
    guidPrefix?: GuidPrefix;
    log?: LoggerService;
  }) {
    super();
    this._log = options.log;

    if (options.addresses == undefined && options.getNetworkInterfaces == undefined) {
      throw new Error(`either addresses or getNetworkInterfaces must be specified for RosNode`);
    }
    const addresses = options.addresses ?? [selectIPv4(options.getNetworkInterfaces!())];

    this._participant = new Participant({
      name: options.name,
      addresses,
      domainId: options.domainId,
      guidPrefix: options.guidPrefix,
      udpSocketCreate: options.udpSocketCreate,
      log: options.log,
    });

    this._participant.on("discoveredParticipant", (participant) =>
      this.emit("discoveredParticipant", participant),
    );
    this._participant.on("discoveredPublication", (endpoint) =>
      this.emit("discoveredPublication", endpoint),
    );
    this._participant.on("discoveredSubscription", (endpoint) =>
      this.emit("discoveredSubscription", endpoint),
    );
  }

  async start(): Promise<void> {
    await this._participant.start();
  }

  async shutdown(): Promise<void> {
    await this._participant.shutdown();
  }

  subscribe(options: SubscribeOpts): Subscription {
    const topicName = rosTopicToDds(options.topic);
    if (topicName == undefined) {
      throw new Error(`Invalid topic "${options.topic}"`);
    }
    const typeName = rosTypeToDds(options.dataType);
    if (typeName == undefined) {
      throw new Error(`Invalid dataType "${options.dataType}"`);
    }

    // Check if we are already subscribed
    let subscription = this.subscriptions.get(options.topic);
    if (subscription != undefined) {
      this._log?.debug?.(`reusing existing subscribtion to ${options.topic} (${options.dataType})`);
      return subscription;
    }

    const DURATION_INFINITE = { sec: 0x7fffffff, nsec: 0xffffffff };
    const rtpsOpts = {
      topicName,
      typeName,
      durability: Durability.TransientLocal,
      reliability: { kind: Reliability.Reliable, maxBlockingTime: DURATION_INFINITE },
      history: { kind: HistoryKind.KeepLast, depth: 1 },
    };

    this._log?.debug?.(`subscribing to ${options.topic} (${options.dataType})`);

    // Asynchronously announce this subscription by writing to our builtin Subscription topic.
    // As writers that match these subscription options are discovered, a new reader will be created
    // for each.
    const readerEntityId = this._participant.subscribe(rtpsOpts);

    subscription = new Subscription({
      subscribeOpts: rtpsOpts,
      readerEntityId,
      participant: this._participant,
      msgDefinition: options.msgDefinition,
      skipParsing: options.skipParsing,
    });
    this.subscriptions.set(options.topic, subscription);

    return subscription;
  }

  // async advertise(options: PublishOpts): Promise<Publication> {}

  // async publish(topic: string, message: unknown): Promise<void> {}

  unsubscribe(topic: string): boolean {
    const subscription = this.subscriptions.get(topic);
    if (subscription == undefined) {
      return false;
    }
    this.subscriptions.delete(topic);

    if (!this._participant.unsubscribe(subscription.readerEntityId)) {
      this._log?.warn?.(`unsubscribing from "${topic}" but participant was not subscribed`);
    }

    // NOTE: Publish a rmw_dds_common::msg::ParticipantEntitiesInfo message removing this
    // subscription from the RosGraph

    return true;
  }

  // unadvertise(topic: string): boolean {}

  // async getParamNames(): Promise<string[]> {}

  // async setParameter(key: string, value: ParamValue): Promise<void> {}

  // async subscribeParam(key: string): Promise<ParamValue> {}

  // async unsubscribeParam(key: string): Promise<boolean> {}

  // async subscribeAllParams(): Promise<Readonly<Map<string, ParamValue>>> {}

  // async unsubscribeAllParams(): Promise<void> {}

  getPublishedTopics(): [topic: string, dataType: string][] {
    const map = new Map<string, Set<string>>();
    const writers = this._participant.topicWriters();
    for (const endpoint of writers) {
      let set = map.get(endpoint.topicName!);
      if (set == undefined) {
        set = new Set<string>();
        map.set(endpoint.topicName!, set);
      }
      set.add(endpoint.typeName!);
    }

    const output: [string, string][] = [];
    for (const [topic, dataTypes] of map) {
      const ros2Topic = ddsToRosTopic(topic);
      if (ros2Topic != undefined && ros2Topic.kind === DdsTopicType.Topic) {
        for (const dataType of dataTypes) {
          const ros2DataType = ddsToRosType(dataType);
          if (ros2DataType != undefined) {
            output.push([ros2Topic.topic, ros2DataType]);
          }
        }
      }
    }
    return output;
  }

  // async getSystemState(): Promise<RosGraph> {}

  receivedBytes(): number {
    return this._participant.receivedBytes;
  }
}

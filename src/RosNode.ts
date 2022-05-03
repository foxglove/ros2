import {
  Durability,
  EndpointAttributesWithTopic,
  GuidPrefix,
  HistoryKind,
  LoggerService,
  makeGuid,
  NetworkInterface,
  Participant,
  ParticipantAttributes,
  Reliability,
  selectIPv4,
  UdpSocketCreate,
  UdpSocketOptions,
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

export type RosEndpoint = EndpointAttributesWithTopic & {
  /**
   * The DDS guid of this endpoint. A combination of the guidPrefix and entityId
   */
  guid: string;

  /**
   * The ROS topic name. This is different from the DDS topic name. A DDS topic
   * name of "rt/foo/bar" translates to a rosTopic of "/foo/bar"
   */
  rosTopic: string;

  /**
   * The ROS data type. See <https://docs.ros.org/en/galactic/Concepts/About-ROS-Interfaces.html>
   * This is different from the DDS type name. A DDS type name of "std_msgs::msg::dds_::String_"
   * translates to a rosDataType of "std_msgs/msg/String"
   */
  rosDataType: string;
};

export interface RosNodeEvents {
  discoveredParticipant: (participant: ParticipantAttributes) => void;
  discoveredPublication: (endpoint: RosEndpoint) => void;
  discoveredSubscription: (endpoint: RosEndpoint) => void;
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
    udpSocketOptions?: UdpSocketOptions;
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
      udpSocketOptions: options.udpSocketOptions,
      log: options.log,
    });

    this._participant.on("discoveredParticipant", (participant) =>
      this.emit("discoveredParticipant", participant),
    );
    this._participant.on("discoveredPublication", (endpoint) => {
      if (endpoint.topicName == undefined || endpoint.typeName == undefined) {
        this._log?.warn?.(
          `Missing topicName or typeName: ${JSON.stringify(endpoint)}`,
          "discoveredPublication",
        );
        return;
      }

      const rosTopic = ddsToRosTopic(endpoint.topicName);
      if (rosTopic == undefined) {
        this._log?.warn?.(
          `Cannot convert DDS topicName "${endpoint.topicName}" to ROS topic`,
          "discoveredPublication",
        );
        return;
      }
      if (rosTopic.kind !== DdsTopicType.Topic) {
        // Ignore parameters, services, and actions for now
        return;
      }

      const rosDataType = ddsToRosType(endpoint.typeName);
      if (rosDataType == undefined) {
        this._log?.warn?.(
          `Cannot convert DDS typeName "${endpoint.typeName}" to ROS dataType`,
          "discoveredPublication",
        );
        return;
      }

      const guid = makeGuid(endpoint.guidPrefix, endpoint.entityId);
      this.emit("discoveredPublication", {
        ...endpoint,
        guid,
        rosTopic: rosTopic.topic,
        rosDataType,
      } as RosEndpoint);
    });
    this._participant.on("discoveredSubscription", (endpoint) => {
      if (endpoint.topicName == undefined || endpoint.typeName == undefined) {
        this._log?.warn?.(
          `Missing topicName or typeName: ${JSON.stringify(endpoint)}`,
          "discoveredSubscription",
        );
        return;
      }

      const rosTopic = ddsToRosTopic(endpoint.topicName);
      if (rosTopic == undefined) {
        this._log?.warn?.(
          `Cannot convert DDS topicName "${endpoint.topicName}" to ROS topic`,
          "discoveredPublication",
        );
        return;
      }
      if (rosTopic.kind !== DdsTopicType.Topic) {
        // Ignore parameters, services, and actions for now
        return;
      }

      const rosDataType = ddsToRosType(endpoint.typeName);
      if (rosDataType == undefined) {
        this._log?.warn?.(
          `Cannot convert DDS typeName "${endpoint.typeName}" to ROS dataType`,
          "discoveredSubscription",
        );
        return;
      }

      const guid = makeGuid(endpoint.guidPrefix, endpoint.entityId);
      this.emit("discoveredSubscription", {
        ...endpoint,
        guid,
        rosTopic: rosTopic.topic,
        rosDataType,
      } as RosEndpoint);
    });
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
      durability: options.durability ?? Durability.Volatile,
      reliability: options.reliability ?? {
        kind: Reliability.BestEffort,
        maxBlockingTime: DURATION_INFINITE,
      },
      history: options.history ?? { kind: HistoryKind.KeepLast, depth: 1 },
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

  getPublishedTopics(): ReadonlyMap<string, RosEndpoint[]> {
    const output = new Map<string, RosEndpoint[]>();
    const writers = this._participant.topicWriters();
    for (const endpoint of writers) {
      const rosTopic = ddsToRosTopic(endpoint.topicName);
      const rosDataType = ddsToRosType(endpoint.typeName);
      if (!rosTopic || rosDataType == undefined || rosTopic.kind !== DdsTopicType.Topic) {
        continue;
      }
      let endpoints = output.get(rosTopic.topic);
      if (endpoints == undefined) {
        endpoints = [];
        output.set(rosTopic.topic, endpoints);
      }

      const guid = makeGuid(endpoint.guidPrefix, endpoint.entityId);
      endpoints.push({ ...endpoint, guid, rosTopic: rosTopic.topic, rosDataType });
    }

    return output;
  }

  // async getSystemState(): Promise<RosGraph> {}

  receivedBytes(): number {
    return this._participant.receivedBytes;
  }
}

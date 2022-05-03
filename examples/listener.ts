import { parse as parseMsgDef } from "@foxglove/rosmsg";
import { toString as timeString, fromMillis } from "@foxglove/rostime";
import { Durability, HistoryKind, Reliability } from "@foxglove/rtps";

import { getNetworkInterfaces, UdpSocketNode } from "../nodejs";
import { durationToString, RosEndpoint, RosNode, vendorName } from "../src";

async function main() {
  const ros = new RosNode({
    name: "listener",
    udpSocketCreate: async () => await UdpSocketNode.Create(),
    getNetworkInterfaces,
    // log: console, // Enable this for verbose console debugging
  });

  // Create a message definition for the std_msgs/msg/String type
  const msgDefinition = parseMsgDef("string data", { ros2: true });

  function subscribeToStringTopic(pub: RosEndpoint) {
    const subscription = ros.subscribe({
      topic: pub.topicName,
      dataType: pub.rosDataType,
      durability: pub.durability,
      history: pub.history,
      msgDefinition,
    });
    subscription.on("message", (timestamp, msg, _data, _publisher) => {
      const strMsg = msg as { data: string };
      console.log(
        `[INFO] [${timeString(timestamp)}] [listener]: I heard: [${strMsg.data}] on [${
          pub.rosTopic
        }]`,
      );
    });
  }

  ros.on("discoveredPublication", (pub) => {
    console.log(
      `[INFO] [${timeString(fromMillis(Date.now()))}] [listener]: Discovered publication ${
        pub.rosTopic
      } (${pub.rosDataType}) from ${pub.guid} (${vendorName(pub.vendorId)}), durability=${
        Durability[pub.durability] ?? pub.durability
      }, reliability=${
        Reliability[pub.reliability.kind] ?? pub.reliability.kind
      }, maxBlockingTime=${durationToString(pub.reliability.maxBlockingTime)} history=${
        HistoryKind[pub.history.kind] ?? pub.history.kind
      }, depth=${pub.history.depth}}`,
    );

    if (pub.rosDataType === "std_msgs/msg/String") {
      subscribeToStringTopic(pub);
    }
  });

  await ros.start();

  // Listen for Ctrl+C to stop
  process.on("SIGINT", () => void shutdown(ros));

  // Wait for Ctrl+C
  process.stdin.resume();
}

async function shutdown(ros: RosNode) {
  await ros.shutdown();
  process.exit();
}

void main();

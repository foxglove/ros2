import { parse as parseMsgDef } from "@foxglove/rosmsg";
import { toString as timeString } from "@foxglove/rostime";

import { getNetworkInterfaces, UdpSocketNode } from "../nodejs";
import { RosNode } from "../src";

async function main() {
  const ros = new RosNode({
    name: "listener",
    udpSocketCreate: UdpSocketNode.Create,
    getNetworkInterfaces,
    // log: console, // Enable this for verbose console debugging
  });

  await ros.start();

  // Create a message definition for the std_msgs/msg/String type
  const msgDefinition = parseMsgDef("string data", { ros2: true });

  // Subscribe to the /chatter topic
  const subscription = ros.subscribe({
    topic: "/chatter",
    dataType: "std_msgs/msg/String",
    msgDefinition,
  });
  subscription.on("message", (timestamp, msg, _data, _publisher) => {
    const strMsg = msg as { data: string };
    console.log(`[INFO] [${timeString(timestamp)}] [listener]: I heard: [${strMsg.data}]`);
  });

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

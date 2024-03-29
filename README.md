# @foxglove/ros2

> _Standalone TypeScript implementation of the ROS 2 protocol built on [@foxglove/rtps](https://github.com/foxglove/rtps)_

[![npm version](https://img.shields.io/npm/v/@foxglove/ros2.svg?style=flat)](https://www.npmjs.com/package/@foxglove/ros2)

## Deprecated

This library is no longer maintained by Foxglove, as we now use the [Foxglove WebSocket](https://foxglove.dev/docs/studio/connection/ros2) for connecting to ROS 2 systems.

## Usage

A simple listener that is compatible with the ROS 2 "talker" example application.

```Typescript
import { parse as parseMsgDef } from "@foxglove/rosmsg";
import { toString as timeString } from "@foxglove/rostime";
import { RosNode } from "@foxglove/ros2";
import { getNetworkInterfaces, UdpSocketNode } from "@foxglove/ros2/nodejs";

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
```

## Notes

Receiving large (>256KB) messages not be possible with the default Linux networking receive buffer size of 256KB, depending on CPU speed / contention / network speed / many factors. Linux users should set the following sysctls:

```
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -w net.core.rmem_default=26214400
sudo sysctl -w net.ipv4.udp_mem=26214400
```

Or permanently in `/etc/sysctl.conf`:

```
net.core.rmem_max=26214400
net.core.rmem_default=26214400
net.ipv4.udp_mem=26214400
```

### Test

`yarn test`

## License

@foxglove/ros2 is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Releasing

1. Run `yarn version --[major|minor|patch]` to bump version
2. Run `git push && git push --tags` to push new tag
3. GitHub Actions will take care of the rest
